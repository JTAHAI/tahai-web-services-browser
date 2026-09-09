#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Reproduce bundled declarative lists from checked-in, hash-pinned upstream data.

No downloads. Use --check to detect stale outputs. The derived filter DATA is
CC-BY-SA-3.0; this transformation script is Apache-2.0.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
UNSUPPORTED = {
    "redirect", "redirect-rule", "rewrite", "removeparam", "csp", "replace",
    "urltransform", "header", "permissions", "cookie",
}
COSMETIC = ("##", "#@#", "#?#", "#@?#", "#$#", "#$?#", "#@$#", "#%#", "#@%#")


def generate():
    outputs = {}
    records = []
    for source in json.loads((ROOT / "sources.json").read_text(encoding="utf-8")):
        name = source["name"]
        if name not in ("easylist", "easyprivacy"):
            raise ValueError("Unknown source")
        raw = (ROOT / "upstream" / f"{name}.txt").read_bytes()
        if hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError(f"{name}: upstream snapshot hash mismatch")
        counts = {"network_candidates": 0, "cosmetic_candidates": 0, "comments": 0, "unsupported": 0}
        rules = [f"! {name}: declarative adaptation by TAHAI Web Services",
                 "! The EasyList authors (https://easylist.to/), CC-BY-SA-3.0",
                 f"! Pinned upstream revision: {source['revision']}",
                 "! Browser-bundled snapshot; updated with browser releases."]
        for original in raw.decode("utf-8").splitlines():
            line = original.strip()
            if line.startswith("!#"):
                raise ValueError(f"{name}: preprocessor directive requires explicit review")
            if not line or line.startswith(("!", "[Adblock")):
                counts["comments"] += 1
                continue
            if any(marker in line for marker in COSMETIC):
                marker = "#@#" if "#@#" in line else "##"
                selector = line.split(marker, 1)[1] if marker in line else ""
                # The Rust parser independently admits only plain CSS, without
                # procedural operators, scriptlets, style actions or resources.
                if (not selector or len(selector.encode()) > 2048 or
                        selector.startswith("+js(") or
                        any(c in selector for c in "{};@\\") or
                        "/*" in selector or "*/" in selector or
                        any(ord(c) < 32 or ord(c) == 127 for c in selector)):
                    counts["unsupported"] += 1
                    continue
                rules.append(line)
                counts["cosmetic_candidates"] += 1
                continue
            options = line.rsplit("$", 1)[1].split(",") if "$" in line else []
            if any(option.strip().split("=", 1)[0].lstrip("~") in UNSUPPORTED for option in options):
                counts["unsupported"] += 1
                continue
            if len(line.encode()) > 8192 or any(ord(c) < 32 and c != "\t" for c in line):
                raise ValueError(f"{name}: rule outside runtime bounds")
            rules.append(line)
            counts["network_candidates"] += 1
        output = ("\n".join(rules) + "\n").encode("utf-8")
        outputs[f"{name}-network.txt"] = output
        records.append({"name": name, "source_sha256": source["sha256"],
                        "output_sha256": hashlib.sha256(output).hexdigest(),
                        "bytes": len(output), **counts})
    # Leave room for the small TAHAI baseline appended by the profile owner.
    if sum(len(value) for value in outputs.values()) > 4 * 1024 * 1024 - 16384:
        raise ValueError("Combined list exceeds Guard's 4 MiB input budget")
    if sum(row["network_candidates"] + row["cosmetic_candidates"] for row in records) > 149000:
        raise ValueError("Combined list exceeds Guard's line budget")
    outputs["rules_manifest.json"] = (json.dumps(records, indent=2) + "\n").encode()
    return outputs, records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        outputs, records = generate()
        for name, data in outputs.items():
            path = ROOT / name
            if args.check:
                if not path.exists() or path.read_bytes() != data:
                    raise ValueError(f"{name}: generated output is stale")
            else:
                path.write_bytes(data)
        print(json.dumps(records, indent=2))
    except (OSError, ValueError) as error:
        print(f"Guard list build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
