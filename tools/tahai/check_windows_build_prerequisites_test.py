#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Synthetic filesystem tests. Never execute a compiler or SDK installer."""

from pathlib import Path
import os
import tempfile
import unittest
from unittest import mock

import check_windows_build_prerequisites as preflight


class BuildPrerequisiteTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(
            prefix="tahai-build-preflight-", dir=preflight.ROOT / "out")
        self.root = Path(self.temporary.name).resolve()
        self.assertTrue(self.root.is_relative_to((preflight.ROOT / "out").resolve()))
        self.addCleanup(self.temporary.cleanup)
        self.source, self.sdk = self.root / "source", self.root / "sdk"
        self.vs, self.depot = self.root / "vs", self.root / "depot"
        self.python = self.depot / "bootstrap/bin/python.exe"
        self.write(self.source / "build/vs_toolchain.py", "SDK_VERSION = '10.0.28000.0'\n")
        self.write(self.source / "build/toolchain/win/setup_toolchain.py",
                   "SDK_VERSION = '10.0.28000.0'\n")
        self.write(self.source / "tools/clang/scripts/update.py",
                   "CLANG_REVISION = 'llvm-test'\nCLANG_SUB_REVISION = 27\n")
        self.write(self.source / "tools/rust/update_rust.py",
                   "RUST_REVISION = 'abc123'\nRUST_SUB_REVISION = 2\n")
        self.write(self.source / "third_party/llvm-build/Release+Asserts/cr_build_revision",
                   "llvm-test-27\n")
        self.write(self.source / "third_party/rust-toolchain/VERSION",
                   "rustc 1.99.0 abc123 (abc123-2-llvm-test chromium)\n")
        for folder in (self.sdk / "Include/10.0.28000.0/um/Windows.h",
                       self.sdk / "Include/10.0.28000.0/shared/sdkddkver.h",
                       self.sdk / "Include/10.0.28000.0/ucrt/stdio.h",
                       self.sdk / "Lib/10.0.28000.0/um/x64/kernel32.lib",
                       self.sdk / "Lib/10.0.28000.0/ucrt/x64/ucrt.lib",
                       self.sdk / "Debuggers/x64/dbghelp.dll",
                       self.sdk / "Debuggers/x64/dbgeng.dll",
                       self.vs / "VC/Auxiliary/Build/vcvarsall.bat",
                       self.depot / "gclient.py", self.python):
            self.write(folder, "synthetic fixture, not executable")
        for tool in ("rc.exe", "midl.exe", "mc.exe", "mt.exe", "makeappx.exe", "signtool.exe"):
            self.write(self.sdk / "bin/10.0.28000.0/x64" / tool, "fixture")
        for tool in ("buildtools/win/gn.exe", "third_party/ninja/ninja.exe",
                     "third_party/llvm-build/Release+Asserts/bin/clang-cl.exe",
                     "third_party/llvm-build/Release+Asserts/bin/lld-link.exe",
                     "third_party/rust-toolchain/bin/rustc.exe"):
            self.write(self.source / tool, "fixture")

    def write(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value, encoding="utf-8")

    def check(self):
        return preflight.check(self.source, self.sdk, self.vs, self.depot, self.python)

    def test_matching_files_and_stamps(self):
        result = self.check()
        self.assertEqual([], result["errors"])
        self.assertEqual(21, result["checked_files"])
        self.assertIn("not native/runtime acceptance", result["scope"])
        self.assertTrue(result["additional_requirements"])

    def test_missing_sdk_is_reported_not_installed(self):
        self.sdk = self.root / "missing-sdk"
        result = self.check()
        self.assertEqual(13, len(result["errors"]))
        self.assertFalse(self.sdk.exists())

    def test_missing_signing_tool_fails(self):
        (self.sdk / "bin/10.0.28000.0/x64/signtool.exe").unlink()
        self.assertTrue(any("signtool.exe" in e for e in self.check()["errors"]))

    def test_stale_clang_and_rust_are_rejected(self):
        self.write(self.source / "third_party/llvm-build/Release+Asserts/cr_build_revision", "old")
        self.write(self.source / "third_party/rust-toolchain/VERSION", "old")
        errors = self.check()["errors"]
        self.assertEqual(2, len(errors))
        self.assertTrue(any("Clang stamp" in e for e in errors))
        self.assertTrue(any("Rust stamp" in e for e in errors))

    def test_disagreeing_sdk_pins_fail(self):
        self.write(self.source / "build/toolchain/win/setup_toolchain.py",
                   "SDK_VERSION = '10.0.26100.0'")
        with self.assertRaisesRegex(ValueError, "SDK pins disagree"):
            self.check()

    def test_unrelated_python_is_not_selected(self):
        self.python = self.root / "other/python.exe"
        self.write(self.python, "fixture")
        self.assertTrue(any("selected depot_tools" in e for e in self.check()["errors"]))

    def test_source_settings_are_not_executed(self):
        path = self.source / "setting.py"
        self.write(path, "raise RuntimeError('must not execute')\nPIN = 'expected'\n")
        self.assertEqual("expected", preflight.literal_setting(path, "PIN"))

    def test_duplicate_setting_is_rejected(self):
        path = self.source / "setting.py"
        self.write(path, "PIN = 'one'\nPIN = 'two'\n")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            preflight.literal_setting(path, "PIN")

    def test_sdk_environment_override(self):
        with mock.patch.dict(os.environ, {"WINDOWSSDKDIR": str(self.sdk)}):
            self.assertEqual(self.sdk, preflight.default_sdk())

    def test_empty_sdk_override_uses_program_files(self):
        with mock.patch.dict(os.environ, {"WINDOWSSDKDIR": "",
                                         "ProgramFiles(x86)": str(self.root)}):
            self.assertEqual(self.root / "Windows Kits/10", preflight.default_sdk())


if __name__ == "__main__":
    unittest.main()
