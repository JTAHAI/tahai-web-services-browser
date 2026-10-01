#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Bind a release run to HEAD and the actual dirty source bytes.

This records source identity, not build success or functional acceptance.
Output belongs in an ignored evidence directory. A comparison rejects edits,
deletions, new untracked files, changed index state, or changed build arguments.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile


def git(root, *args):
    result = subprocess.run(["git", "-C", str(root), *args], check=True,
                            stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    return result.stdout


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def capture_source(root):
    """The build-independent source identity shared by CI and native acceptance."""
    root = Path(root).resolve(strict=True)
    patch = git(root, "diff", "--no-ext-diff", "--no-textconv", "--binary", "HEAD")
    changed = git(root, "diff", "--name-only", "-z", "HEAD").split(b"\0")
    untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0")
    entries = []
    for encoded in sorted(set(changed + untracked) - {b""}):
        name = encoded.decode("utf-8")
        path = root / name
        path.resolve().relative_to(root)
        if path.is_symlink():
            raise ValueError(f"Source override must not be a symlink: {name}")
        if not path.exists():
            entries.append({"path": name, "deleted": True})
        elif path.is_file():
            data = path.read_bytes()
            entries.append({"path": name, "bytes": len(data), "sha256": sha256(data)})
        else:
            raise ValueError(f"Changed source is not a regular file: {name}")
    identity = {
        "head": git(root, "rev-parse", "HEAD").decode().strip(),
        "tree": git(root, "rev-parse", "HEAD^{tree}").decode().strip(),
        "diffSha256": sha256(patch),
        "indexDiffSha256": sha256(git(root, "diff", "--cached", "--no-ext-diff",
                                      "--no-textconv", "--binary", "HEAD")),
        "overrides": entries,
    }
    return {
        "schemaVersion": 1,
        "sourceRoot": str(root),
        "branch": git(root, "branch", "--show-current").decode().strip(),
        "identity": identity,
        "identitySha256": sha256(json.dumps(identity, sort_keys=True,
                                              separators=(",", ":")).encode()),
    }, patch


def capture(root, build_directory):
    record, patch = capture_source(root)
    build_directory = Path(build_directory).resolve(strict=True)
    build_directory.relative_to(Path(record["sourceRoot"]))
    record["buildDirectory"] = str(build_directory)
    record["sourceIdentitySha256"] = record["identitySha256"]
    record["identity"]["buildArgsSha256"] = sha256(
        (build_directory / "args.gn").read_bytes())
    record["identitySha256"] = sha256(json.dumps(
        record["identity"], sort_keys=True, separators=(",", ":")).encode())
    return record, patch


def write_snapshot(record, patch, output_path):
    """Archive exact overrides as well as their hashes, including untracked code."""
    root = Path(record["sourceRoot"])
    snapshot_path = output_path.with_suffix(".zip")
    with zipfile.ZipFile(snapshot_path, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        def add(name, data):
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, data)
        add("identity.json", json.dumps(record, sort_keys=True).encode())
        add("tracked.patch", patch)
        arguments = (Path(record["buildDirectory"]) / "args.gn").read_bytes()
        if sha256(arguments) != record["identity"]["buildArgsSha256"]:
            raise ValueError("Build arguments changed while capturing source.")
        add("args.gn", arguments)
        for item in record["identity"]["overrides"]:
            if item.get("deleted"):
                continue  # The identity manifest records deletions explicitly.
            data = (root / item["path"]).read_bytes()
            if sha256(data) != item["sha256"] or len(data) != item["bytes"]:
                raise ValueError(f"Source changed while capturing: {item['path']}")
            add("overrides/" + item["path"], data)
    return {"file": snapshot_path.name, "sha256": sha256(snapshot_path.read_bytes())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--build", type=Path)
    parser.add_argument("--source-only", action="store_true")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", type=Path)
    group.add_argument("--compare", type=Path)
    args = parser.parse_args()
    if args.source_only == bool(args.build):
        parser.error("Select either --source-only or --build, not both.")
    record, patch = (capture_source(args.source) if args.source_only else
                     capture(args.source, args.build))
    if args.compare:
        previous = json.loads(args.compare.read_text(encoding="utf-8"))
        snapshot = previous.pop("sourceSnapshot", None)
        if not args.source_only and (not snapshot or Path(snapshot["file"]).name != snapshot["file"] or
                sha256((args.compare.parent / snapshot["file"]).read_bytes()) !=
                snapshot["sha256"]):
            raise SystemExit("Source snapshot is missing or changed.")
        if previous != record:
            raise SystemExit("Source or build arguments changed during this release run.")
    else:
        # Never overwrite the record of an earlier run.
        snapshot = None if args.source_only else write_snapshot(record, patch, args.output)
        current = (capture_source(args.source) if args.source_only else
                   capture(args.source, args.build))[0]
        if current != record:
            raise SystemExit("Source changed while creating its snapshot.")
        if snapshot:
            record["sourceSnapshot"] = snapshot
            with args.output.with_suffix(".patch").open("xb") as output:
                output.write(patch)
        with args.output.open("x", encoding="utf-8") as output:
            json.dump(record, output, indent=2)
            output.write("\n")
    print(f"Source identity: {record['identitySha256']} ({len(record['identity']['overrides'])} overrides)")


if __name__ == "__main__":
    main()
