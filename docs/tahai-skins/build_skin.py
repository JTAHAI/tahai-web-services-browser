#!/usr/bin/env python3
"""Build a local .tahaiskin with file entries only. Python 3.9+, no dependencies.

This checks creator mistakes; the browser's sandboxed decoder is authoritative.
It never fetches URLs or executes package content, and leaves the source intact.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import sys
import zipfile
import zlib

TOKENS = {
    "shell_background", "toolbar_background", "toolbar_foreground",
    "tab_background", "tab_foreground", "rail_background", "rail_foreground",
    "accent", "panel_background", "panel_foreground",
}
MAX_ASSET = 4 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON field: {key}")
        result[key] = value
    return result


def fields(value, expected, where):
    require(isinstance(value, dict) and set(value) == set(expected),
            f"{where}: expected exactly {', '.join(sorted(expected))}")


def luminance(color):
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    channels = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
                for c in channels]
    return sum(c * w for c, w in zip(channels, (.2126, .7152, .0722)))


def png_checks(data):
    require(data.startswith(b"\x89PNG\r\n\x1a\n"), "PNG signature is invalid")
    offset, seen, compressed, header = 8, [], bytearray(), None
    while offset < len(data):
        require(offset + 12 <= len(data), "Truncated PNG chunk")
        size, kind = struct.unpack_from(">I4s", data, offset)
        end = offset + size + 12
        require(end <= len(data), "Truncated PNG data")
        payload = data[offset + 8:end - 4]
        crc = struct.unpack_from(">I", data, end - 4)[0]
        require(zlib.crc32(kind + payload) == crc, "PNG chunk checksum failed")
        require(kind not in (b"acTL", b"fcTL", b"fdAT"), "Animated PNG is unsupported")
        if kind == b"IHDR":
            require(not seen and size == 13, "Invalid PNG header")
            header = payload
            width, height = struct.unpack_from(">II", payload)
            require(0 < width <= 2048 and 0 < height <= 2048,
                    "Image dimensions must be between 1 and 2048 pixels")
        if kind == b"IDAT":
            compressed.extend(payload)
        seen.append(kind)
        offset = end
        if kind == b"IEND":
            require(size == 0 and end == len(data), "PNG has trailing data")
            break
    require(header and b"IDAT" in seen and seen[-1] == b"IEND", "Incomplete PNG")
    # Bounded decompression catches damaged image streams, not just CRC errors.
    decoder = zlib.decompressobj()
    decoder.decompress(bytes(compressed), 34 * 1024 * 1024)
    require(decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail,
            "Invalid or oversized PNG image stream")


def safe_asset_path(name):
    require(isinstance(name, str) and len(name) <= 256 and
            re.fullmatch(r"assets/[a-z0-9_./-]+\.(png|webp)", name),
            f"Unsafe asset path: {name!r}")
    for part in name.split("/"):
        require(part not in ("", ".", "..") and not part.endswith("."),
                f"Unsafe asset path: {name}")
        stem = part.split(".")[0]
        require(not re.fullmatch(r"con|prn|aux|nul|com[1-9]|lpt[1-9]", stem),
                f"Windows reserved filename: {name}")


def build(source):
    source = source.resolve(strict=True)
    manifest_path = source / "manifest.json"
    require(manifest_path.stat().st_size <= 65536, "Manifest exceeds 64 KiB")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"),
                          object_pairs_hook=unique_object)
    fields(manifest, {"schema_version", "id", "name", "creator", "license",
                      "compatibility", "appearance", "assets"}, "Manifest")
    require(type(manifest["schema_version"]) is int and manifest["schema_version"] == 1,
            "schema_version must be 1")
    identity = manifest["id"]
    require(isinstance(identity, str) and
            re.fullmatch(r"[a-z0-9][a-z0-9-]{1,62}[a-z0-9]", identity),
            "id must be 3-64 lowercase letters, digits or interior hyphens")
    for key in ("name", "creator", "license"):
        value = manifest[key]
        require(isinstance(value, str) and 1 <= len(value) <= 128 and
                all(32 <= ord(c) <= 126 and c not in '\\"<>' for c in value),
                f"{key}: use 1-128 plain ASCII characters without quotes, slashes or markup")
    compatibility = manifest["compatibility"]
    fields(compatibility, {"min_chromium_major", "max_chromium_major"}, "Compatibility")
    low, high = compatibility["min_chromium_major"], compatibility["max_chromium_major"]
    require(type(low) is int and type(high) is int and 1 <= low <= high <= 999,
            "Compatibility must be an ordered range from 1 to 999")
    appearance = manifest["appearance"]
    palettes = ("light_tokens", "dark_tokens", "high_contrast_tokens")
    fields(appearance, {"density", "reduced_motion", *palettes}, "Appearance")
    require(appearance["density"] in ("comfortable", "compact"), "Unknown density")
    require(type(appearance["reduced_motion"]) is bool, "reduced_motion must be boolean")
    for name in palettes:
        palette = appearance[name]
        fields(palette, TOKENS, name)
        for token, color in palette.items():
            require(isinstance(color, str) and re.fullmatch(r"#[0-9a-f]{6}", color),
                    f"{name}.{token}: expected lowercase #rrggbb")
        for surface in ("toolbar", "tab", "rail", "panel"):
            values = sorted(luminance(palette[f"{surface}_{role}"])
                            for role in ("background", "foreground"))
            contrast = (values[1] + .05) / (values[0] + .05)
            require(contrast >= 4.5, f"{name}.{surface}: contrast {contrast:.2f}:1 is below 4.5:1")
    assets = manifest["assets"]
    require(isinstance(assets, list) and 1 <= len(assets) <= 16, "Declare 1-16 assets")
    entries = {}
    for asset in assets:
        fields(asset, {"path", "sha256", "purpose"}, "Asset")
        name = asset["path"]
        safe_asset_path(name)
        require(name not in entries, f"Duplicate asset: {name}")
        require(asset["purpose"] in ("preview", "shell-decoration"), "Unknown asset purpose")
        path = source / name
        require(path.resolve(strict=True).is_relative_to(source), "Asset escapes source folder")
        require(0 < path.stat().st_size <= MAX_ASSET, "Each asset must be at most 4 MiB")
        data = path.read_bytes()
        if name.endswith(".png"):
            png_checks(data)
        else:
            require(data[:4] == b"RIFF" and data[8:12] == b"WEBP" and
                    struct.unpack_from("<I", data, 4)[0] + 8 == len(data),
                    "Invalid WebP container; verify dimensions and animation in TAHAI")
        asset["sha256"] = hashlib.sha256(data).hexdigest()
        entries[name] = data
    require(sum(map(len, entries.values())) <= 8 * 1024 * 1024, "Assets exceed 8 MiB total")
    entries = {"manifest.json": (json.dumps(manifest, indent=2) + "\n").encode(), **entries}
    require(len(entries["manifest.json"]) <= 65536, "Generated manifest exceeds 64 KiB")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, data in entries.items():
            item = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            item.create_system = 0
            archive.writestr(item, data)
    require(len(output.getvalue()) <= 9 * 1024 * 1024, "Package exceeds 9 MiB")
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Folder containing manifest.json and assets")
    parser.add_argument("output", type=Path, nargs="?", help="New .tahaiskin output filename")
    parser.add_argument("--check", action="store_true", help="Check source without writing")
    args = parser.parse_args()
    try:
        data = build(args.source)
        if not args.check:
            require(args.output is not None and args.output.suffix == ".tahaiskin",
                    "Specify a new .tahaiskin output file, or use --check")
            # Exclusive creation protects an existing package or source asset.
            with args.output.open("xb") as output:
                output.write(data)
        print(f"{'Checked' if args.check else 'Built'}: {len(data)} bytes; SHA-256 {hashlib.sha256(data).hexdigest()}")
        print("Next: review the package in TAHAI's Skin packages manager before installing.")
    except (ValueError, OSError, zlib.error) as error:
        print(f"Skin build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
