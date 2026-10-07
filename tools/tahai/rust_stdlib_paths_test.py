#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Retain the subst workaround and support a dedicated output junction."""

import importlib.util
import ntpath
from pathlib import Path
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "chromium_find_std_rlibs", ROOT / "build/rust/std/find_std_rlibs.py")
STDLIB = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STDLIB)


class RustStdlibPathTest(unittest.TestCase):
    def relative(self, library, physical, logical):
        with mock.patch.object(STDLIB.os.path, "relpath", side_effect=ntpath.relpath), \
             mock.patch.object(STDLIB.os.path, "realpath", return_value=physical), \
             mock.patch.object(STDLIB.os, "getcwd", return_value=logical):
            return STDLIB.relative_rustlib_directory(library)

    def test_same_volume_uses_canonical_directory(self):
        self.assertEqual(r"..\..\third_party\rust-toolchain\lib",
                         self.relative(r"C:\checkout\third_party\rust-toolchain\lib",
                                       r"C:\checkout\out\release",
                                       r"C:\CHECKO~1\out\release"))

    def test_subst_alias_retains_physical_directory_workaround(self):
        self.assertEqual(r"..\..\third_party\rust-toolchain\lib",
                         self.relative(r"C:\checkout\third_party\rust-toolchain\lib",
                                       r"C:\checkout\out\release", r"S:\out\release"))

    def test_cross_volume_output_uses_owned_logical_directory(self):
        self.assertEqual(r"..\..\third_party\rust-toolchain\lib",
                         self.relative(r"C:\checkout\third_party\rust-toolchain\lib",
                                       r"D:\outputs\release",
                                       r"C:\checkout\out\release"))

    def test_unrelated_volumes_still_reject_invalid_relative_path(self):
        with self.assertRaises(ValueError):
            self.relative(r"E:\rust-toolchain\lib", r"D:\outputs\release",
                          r"C:\checkout\out\release")


if __name__ == "__main__":
    unittest.main()
