#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0

"""Read-only import audit. Emits JSON; never builds code or extracts archives.

The lock input must retain crates.io checksums (Chromium's vendored lock drops
them). The generated inventory is source evidence, NOT a linked-binary SBOM,
license opinion, vulnerability scan, or proof that Guard blocks requests.
"""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile
import tomllib


ROOT = Path(__file__).resolve().parents[2]
RUST = ROOT / "third_party/rust"
VENDOR = RUST / "chromium_crates_io/vendor"
PIN = "0.12.6"
PIN_REVISION = "ca7f9f4a24a439da99e052b4e4041c45d87687f5"
PIN_SHA256 = "4844c456026028b3a22f3bc0b0e0b2485809591673e2d70930a4ada7c4d3a90d"
# Existing package versions are not rolled by this import. Semver was formerly
# a placeholder: its real source is now needed by a declared build dependency.
IMPORTED = {
    "adblock", "arrayvec", "flatbuffers", "form_urlencoded", "idna",
    "idna_adapter", "percent-encoding", "precomputed-hash", "rustc-hash",
    "rustc_version", "seahash", "semver", "thiserror", "thiserror-impl", "url",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def epoch(version):
    major, minor, patch = version.split("+")[0].split("-")[0].split(".")
    if major != "0":
        return f"v{major}"
    return f"v0_{minor}" if minor != "0" else f"v0_0_{patch}"


def inside(path, parent):
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(parent.resolve(strict=True)):
        raise ValueError(f"Path escapes expected directory: {path}")
    return resolved


def read_bounded(path, maximum=16 * 1024 * 1024):
    if path.stat().st_size > maximum:
        raise ValueError(f"File exceeds audit limit: {path}")
    with path.open("rb") as source:
        data = source.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError(f"File grew beyond audit limit: {path}")
    return data


def verify_import_archive(package, cache):
    name, version = package["name"], package["version"]
    checksum = package.get("checksum")
    if not checksum or len(checksum) != 64:
        raise ValueError(f"Missing crates.io checksum for {name} {version}")
    matches = list(cache.glob(f"*/{name}-{version}.crate"))
    if len(matches) != 1:
        raise ValueError(f"Expected one cached original archive for {name} {version}")
    archive = inside(matches[0], cache)
    if digest(read_bounded(archive, 100 * 1024 * 1024)) != checksum:
        raise ValueError(f"Archive checksum mismatch: {name}")
    vendor = inside(VENDOR / f"{name}-{epoch(version)}", VENDOR)
    prefix = f"{name}-{version}"
    verified = 0
    total_bytes = 0
    # Stream contents for comparison; do not extract third-party paths.
    with tarfile.open(archive, "r|gz") as stream:
        for entry in stream:
            relative = PurePosixPath(entry.name)
            if not relative.parts or relative.parts[0] != prefix:
                raise ValueError(f"Unexpected archive root: {entry.name}")
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"Unsafe archive path: {entry.name}")
            if entry.isdir():
                continue
            if not entry.isfile() or entry.size > 16 * 1024 * 1024:
                raise ValueError(f"Unsupported archive entry: {entry.name}")
            total_bytes += entry.size
            if total_bytes > 256 * 1024 * 1024 or verified >= 20000:
                raise ValueError(f"Archive exceeds expanded audit limit: {name}")
            destination = inside(vendor.joinpath(*relative.parts[1:]), vendor)
            with stream.extractfile(entry) as source:
                original = source.read(entry.size + 1)
            if len(original) != entry.size or read_bounded(destination) != original:
                raise ValueError(f"Vendored file differs from pinned archive: {destination}")
            verified += 1
    if verified == 0:
        raise ValueError(f"Empty archive: {name}")
    return verified


def describe(package):
    name, version = package["name"], package["version"]
    vendor = inside(VENDOR / f"{name}-{epoch(version)}", VENDOR)
    manifest = tomllib.loads(read_bounded(vendor / "Cargo.toml").decode("utf-8"))
    if manifest["package"]["version"] != version:
        raise ValueError(f"Vendored version mismatch: {name}")
    readme = RUST / name.replace("-", "_") / epoch(version) / "README.chromium"
    fields = {}
    for line in read_bounded(readme).decode("utf-8").splitlines():
        if ": " in line:
            key, value = line.split(": ", 1)
            fields[key] = value
    license_path = fields["License File"]
    if not license_path.startswith("//"):
        raise ValueError(f"Unexpected license path for {name}")
    license_file = inside(ROOT / license_path[2:], ROOT)
    tree = hashlib.sha256()
    for path in sorted(vendor.rglob("*")):
        if path.is_file():
            path = inside(path, vendor)
            relative = path.relative_to(vendor).as_posix()
            tree.update(relative.encode("utf-8") + b"\0")
            tree.update(hashlib.sha256(read_bounded(path)).digest())
    return {
        "name": name,
        "version": version,
        "crates_io_archive_sha256": package.get("checksum"),
        "upstream_revision": fields.get("Revision"),
        "license": fields["License"],
        "license_file": license_path[2:],
        "license_sha256": digest(read_bounded(license_file)),
        "vendored_tree_sha256": tree.hexdigest(),
    }


def verify_recorded_sources(inventory_path, cache=None):
    """Check the real checkout, optionally also the pinned original archives.

    This mode needs no historical checksum-bearing Cargo.lock. Checksums are
    taken from the reviewed inventory; active versions must also exist in the
    current Chromium lock. It never regenerates or relaxes expected hashes.
    """
    inventory = json.loads(read_bounded(inventory_path).decode("utf-8"))
    entries = inventory["packages"]
    if (inventory.get("schema_version") != 1 or len(entries) != len(IMPORTED)
            or {p["name"] for p in entries} != IMPORTED):
        raise ValueError("Recorded imported package set differs from the reviewed set")
    lock = tomllib.loads(read_bounded(
        VENDOR.parent / "Cargo.lock").decode("utf-8"))
    locked = {(p["name"], p["version"]) for p in lock["package"]}
    files = 0
    for entry in entries:
        name, version = entry["name"], entry["version"]
        checksum = entry["crates_io_archive_sha256"]
        if (not re.fullmatch(r"\d+\.\d+\.\d+", version)
                or not re.fullmatch(r"[0-9a-f]{64}", checksum)):
            raise ValueError(f"Invalid recorded package identity/checksum: {name}")
        if (name, version) not in locked:
            raise ValueError(f"Recorded package missing from current lock: {name} {version}")
        if name == "adblock" and (version != PIN or checksum != PIN_SHA256
                                  or entry["upstream_revision"] != PIN_REVISION):
            raise ValueError("The reviewed adblock-rust pin changed")
        package = {"name": name, "version": version, "checksum": checksum}
        for field, actual in describe(package).items():
            if entry.get(field) != actual:
                raise ValueError(f"Recorded source inventory mismatch: {name} {field}")
        if cache is not None:
            count = verify_import_archive(package, cache)
            if count != entry["archive_files_verified"]:
                raise ValueError(f"Recorded archive file count mismatch: {name}")
            files += count
    return {"source_inventory_verified": True, "packages": len(entries),
            "original_archives_verified": cache is not None,
            "archive_files": files, "native_build_or_runtime_validation": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lock", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--verify-inventory", type=Path)
    parser.add_argument("--source-inventory", type=Path,
                        help="Verify current sources against the reviewed inventory; "
                             "optionally verify original archives with --cache")
    args = parser.parse_args()
    if args.source_inventory:
        if args.lock or args.verify_inventory:
            parser.error("--source-inventory cannot be combined with --lock/--verify-inventory")
        print(json.dumps(verify_recorded_sources(args.source_inventory, args.cache)))
        return
    if not args.lock or not args.cache:
        parser.error("--lock and --cache are required unless using --source-inventory")
    lock = tomllib.loads(read_bounded(args.lock).decode("utf-8"))
    packages = [p for p in lock["package"] if p["name"] in IMPORTED]
    # thiserror 2 was already in Chromium. The import introduces only epoch 1.
    packages = [p for p in packages if p["name"] not in {"thiserror", "thiserror-impl"}
                or p["version"].startswith("1.")]
    if len(packages) != len(IMPORTED) or {p["name"] for p in packages} != IMPORTED:
        raise ValueError("Imported package set differs from the reviewed set")
    entry = next(p for p in packages if p["name"] == "adblock")
    if entry["version"] != PIN or entry.get("checksum") != PIN_SHA256:
        raise ValueError("The reviewed adblock-rust pin changed")
    inventory = []
    for package in sorted(packages, key=lambda p: p["name"]):
        verified = verify_import_archive(package, args.cache)
        item = describe(package)
        item["archive_files_verified"] = verified
        inventory.append(item)
    if inventory[0]["upstream_revision"] != PIN_REVISION:
        raise ValueError("adblock-rust VCS provenance does not match the pin")
    report = {
        "schema_version": 1,
        "scope": "newly imported source packages only, including declared build dependencies",
        "native_build_or_runtime_validation": False,
        "adblock_source_url": f"https://github.com/brave/adblock-rust/tree/{PIN_REVISION}",
        "packages": inventory,
    }
    if args.verify_inventory:
        expected = json.loads(read_bounded(args.verify_inventory).decode("utf-8"))
        if report != expected:
            raise ValueError("Guard source/license inventory changed; review and regenerate it")
        print(json.dumps({"source_inventory_verified": True,
                          "packages": len(inventory),
                          "archive_files": sum(p["archive_files_verified"] for p in inventory),
                          "native_build_or_runtime_validation": False}))
    else:
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
