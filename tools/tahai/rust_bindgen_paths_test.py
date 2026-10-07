#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Exercise bindgen's output-junction paths without changing compiler policy."""

import importlib.util
import ntpath
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "build/rust/gni_impl/run_bindgen.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("chromium_run_bindgen", SCRIPT)
BINDGEN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BINDGEN)


class RustBindgenPathTest(unittest.TestCase):
    def test_only_cross_volume_windows_outputs_need_rebasing(self):
        with mock.patch.object(BINDGEN.sys, "platform", "win32"), \
             mock.patch.object(BINDGEN.os.path, "splitdrive", ntpath.splitdrive), \
             mock.patch.object(BINDGEN.os, "getcwd", return_value=r"C:\src\out\release"), \
             mock.patch.object(BINDGEN.os.path, "realpath", return_value=r"D:\release"):
            self.assertTrue(BINDGEN.cross_volume_output())
        with mock.patch.object(BINDGEN.sys, "platform", "win32"), \
             mock.patch.object(BINDGEN.os.path, "splitdrive", ntpath.splitdrive), \
             mock.patch.object(BINDGEN.os, "getcwd", return_value=r"C:\src\out\release"), \
             mock.patch.object(BINDGEN.os.path, "realpath", return_value=r"c:\output\release"):
            self.assertFalse(BINDGEN.cross_volume_output())
        with mock.patch.object(BINDGEN.sys, "platform", "linux"):
            self.assertFalse(BINDGEN.cross_volume_output())

    def invoke(self, cross_volume):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        output = str(Path(temporary.name) / "bindings.rs")
        clangargs = ["-I../..", "-Igen", "-isystem", "../../headers",
                     "-imsvc../../SDK with spaces/include", "-resource-dir",
                     "../../clang/lib/clang/23", "--warning-suppression-mappings=../../warnings.txt",
                     "-fcrash-diagnostics-dir=../crashreports", "-ffile-compilation-dir=.",
                     "-fstack-protector-strong", "-D_LIBCPP_HARDENING_MODE=2",
                     "-Werror", "-DSTRING=-Irelative"]
        command = [str(SCRIPT), "--bindgen-exe", "bindgen", "--rustfmt-exe",
                   "rustfmt", "--header", "../../allocator/handler.h",
                   "--output", output, "--", *clangargs]
        calls = []

        def child(argv, **kwargs):
            calls.append(list(argv))
            if argv[0] == "bindgen":
                Path(output).write_text("pub fn allocation_failure();\n")

        with mock.patch.object(BINDGEN.sys, "argv", command), \
             mock.patch.object(BINDGEN, "cross_volume_output", return_value=cross_volume), \
             mock.patch.object(BINDGEN.subprocess, "check_call", side_effect=child), \
             mock.patch.dict(BINDGEN.os.environ, {}, clear=True):
            BINDGEN.main()
        return calls[0], clangargs, Path(output).read_text()

    def test_ordinary_output_retains_exact_header_and_clang_arguments(self):
        command, original, generated = self.invoke(False)
        delimiter = command.index("--")
        self.assertEqual("../../allocator/handler.h", command[delimiter - 1])
        self.assertEqual(original, command[delimiter + 1:])
        self.assertIn("@generated", generated)

    def test_cross_volume_output_anchors_source_sdk_and_generated_headers(self):
        command, original, _ = self.invoke(True)
        delimiter = command.index("--")
        self.assertEqual(os.path.abspath("../../allocator/handler.h"), command[delimiter - 1])
        arguments = command[delimiter + 1:]
        self.assertEqual("-I" + os.path.abspath("../.."), arguments[0])
        self.assertEqual("-I" + os.path.abspath("gen"), arguments[1])
        self.assertEqual(os.path.abspath("../../headers"), arguments[3])
        self.assertEqual("-imsvc" + os.path.abspath("../../SDK with spaces/include"), arguments[4])
        self.assertEqual(os.path.abspath("../../clang/lib/clang/23"), arguments[6])
        self.assertEqual("--warning-suppression-mappings=" + os.path.abspath("../../warnings.txt"), arguments[7])
        self.assertEqual("-fcrash-diagnostics-dir=" + os.path.abspath("../crashreports"), arguments[8])
        self.assertEqual(original[9:], arguments[9:])

    def test_absolute_toolchain_paths_are_retained(self):
        path = os.path.abspath("toolchain/headers")
        arguments = ["-I" + path, "--sysroot=" + path, "-include", path]
        self.assertEqual(arguments, BINDGEN.absolute_clang_paths(arguments))


if __name__ == "__main__":
    unittest.main()
