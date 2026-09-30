#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Read-only Windows build preflight. Never installs, downloads or builds.

Checks source-pinned compiler stamps and SDK files on the selected machine.
This is not a compiler execution test, dependency audit, or release acceptance.
"""

import argparse
import ast
import json
import os
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[2]


def default_sdk():
    # Match Chromium's override, including nonstandard SDK installations.
    override = os.environ.get("WINDOWSSDKDIR")
    if override:
        return Path(override)
    return Path(os.environ.get("ProgramFiles(x86)",
                               "C:/Program Files (x86)")) / "Windows Kits/10"


def literal_setting(path, name):
    """Read constants without importing/executing an upstream update script."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    values = [ast.literal_eval(node.value) for node in tree.body
              if isinstance(node, ast.Assign)
              and any(isinstance(target, ast.Name) and target.id == name
                      for target in node.targets)]
    if len(values) != 1:
        raise ValueError(f"Expected exactly one {name} in {path}")
    return values[0]


def check(source, sdk, visual_studio, depot_tools, bootstrap_python):
    source, sdk, visual_studio, depot_tools, bootstrap_python = (
        Path(p).resolve() for p in
        (source, sdk, visual_studio, depot_tools, bootstrap_python))
    errors = []
    checked = []

    def require(path):
        checked.append(str(path))
        if not path.is_file():
            errors.append(f"Required file missing: {path}")

    sdk_version = literal_setting(source / "build/vs_toolchain.py", "SDK_VERSION")
    other_sdk = literal_setting(
        source / "build/toolchain/win/setup_toolchain.py", "SDK_VERSION")
    if sdk_version != other_sdk or not re.fullmatch(r"\d+\.\d+\.\d+\.\d+", sdk_version):
        raise ValueError("Source SDK pins disagree or are invalid")
    for relative in (f"Include/{sdk_version}/um/Windows.h",
                     f"Include/{sdk_version}/shared/sdkddkver.h",
                     f"Include/{sdk_version}/ucrt/stdio.h",
                     f"Lib/{sdk_version}/um/x64/kernel32.lib",
                     f"Lib/{sdk_version}/ucrt/x64/ucrt.lib"):
        require(sdk / relative)
    for tool in ("rc.exe", "midl.exe", "mc.exe", "mt.exe",
                 "makeappx.exe", "signtool.exe"):
        require(sdk / "bin" / sdk_version / "x64" / tool)
    require(sdk / "Debuggers/x64/dbghelp.dll")
    require(sdk / "Debuggers/x64/dbgeng.dll")
    require(visual_studio / "VC/Auxiliary/Build/vcvarsall.bat")
    require(depot_tools / "gclient.py")
    require(bootstrap_python)
    if not bootstrap_python.is_relative_to(depot_tools):
        errors.append("Bootstrap Python must belong to the selected depot_tools installation")
    for tool in ("buildtools/win/gn.exe", "third_party/ninja/ninja.exe",
                 "third_party/llvm-build/Release+Asserts/bin/clang-cl.exe",
                 "third_party/llvm-build/Release+Asserts/bin/lld-link.exe",
                 "third_party/rust-toolchain/bin/rustc.exe"):
        require(source / tool)
    clang_script = source / "tools/clang/scripts/update.py"
    clang = literal_setting(clang_script, "CLANG_REVISION")
    clang_sub = literal_setting(clang_script, "CLANG_SUB_REVISION")
    clang_pin = f"{clang}-{clang_sub}"
    clang_stamp = source / "third_party/llvm-build/Release+Asserts/cr_build_revision"
    if not clang_stamp.is_file() or clang_stamp.read_text().strip() != clang_pin:
        errors.append(f"Installed Clang stamp does not match source pin {clang_pin}")
    rust_script = source / "tools/rust/update_rust.py"
    rust = literal_setting(rust_script, "RUST_REVISION")
    rust_sub = literal_setting(rust_script, "RUST_SUB_REVISION")
    rust_pin = f"{rust}-{rust_sub}-{clang}"
    rust_stamp = source / "third_party/rust-toolchain/VERSION"
    rust_text = rust_stamp.read_text().strip() if rust_stamp.is_file() else ""
    match = re.fullmatch(r"rustc [0-9.]+ ([0-9a-f]+) \((.+?) chromium\)", rust_text)
    if not match or match.group(1) != rust or match.group(2) != rust_pin:
        errors.append(f"Installed Rust stamp does not match source pin {rust_pin}")
    return {"scope": "read-only file/pin preflight; not native/runtime acceptance",
            "source": str(source), "sdk": str(sdk), "sdk_version": sdk_version,
            "clang_pin": clang_pin, "rust_pin": rust_pin,
            "checked_files": len(checked), "errors": errors,
            "additional_requirements": [
                "Visual Studio 2026 >= 18.0 with C++/ATL/MFC components",
                "SDK servicing version and debugger versions from docs/windows_build_instructions.md",
                "Successful gclient sync/runhooks and isolated native runtime gates"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT)
    parser.add_argument("--sdk", type=Path, default=default_sdk())
    parser.add_argument("--visual-studio", type=Path, required=True)
    parser.add_argument("--depot-tools", type=Path, required=True)
    parser.add_argument("--bootstrap-python", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = check(args.source, args.sdk, args.visual_studio,
                       args.depot_tools, args.bootstrap_python)
    except (OSError, ValueError, SyntaxError) as error:
        print(json.dumps({"scope": "read-only build preflight", "errors": [str(error)]}))
        return 1
    print(json.dumps(report, indent=2))
    return int(bool(report["errors"]))


if __name__ == "__main__":
    sys.exit(main())
