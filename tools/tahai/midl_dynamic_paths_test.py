#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Keep dynamic-IDL comment paths deterministic without relaxing MIDL checks."""

import contextlib
import importlib.util
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "chromium_midl", ROOT / "build/toolchain/win/midl.py")
MIDL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIDL)
OLD = "../../chrome/elevation_service/service.idl"
NEW = "gen/chrome/elevation_service/service.idl"


class DynamicIdlPathTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tahai-midl-test-",
                                                dir=ROOT / "out")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def rewrite(self, data):
        target = self.root / "service.h"
        target.write_bytes(data)
        MIDL.update_compiler_settings_path(str(target), OLD, NEW)
        return target.read_bytes()

    def test_original_path_is_updated_with_lf_or_crlf(self):
        for ending in (b"\n", b"\r\n"):
            with self.subTest(ending=ending):
                data = b"/* Compiler settings for " + OLD.encode() + b":" + ending
                self.assertEqual(data.replace(OLD.encode(), NEW.encode()),
                                 self.rewrite(data))

    def test_only_exact_comment_line_changes(self):
        data = (b"/* Compiler settings for " + OLD.encode() + b":\r\n"
                b"    Oicf, W1, Zp8, env=Win64 (32b run)\r\n */\r\n"
                b"const char* path = \"" + OLD.encode() + b"\";\r\n"
                b"MIDL_DEFINE_GUID(IID, 0x12345678, 0x1234, 0x5678);\r\n")
        expected = data.replace(b"/* Compiler settings for " + OLD.encode() + b":",
                                b"/* Compiler settings for " + NEW.encode() + b":")
        self.assertEqual(expected, self.rewrite(data))

    def test_already_generated_path_stays_identical(self):
        data = b"/* Compiler settings for " + NEW.encode() + b":\n */\n"
        self.assertEqual(data, self.rewrite(data))

    def test_unexpected_path_is_not_hidden(self):
        data = b"/* Compiler settings for unexpected/service.idl:\n */\n"
        self.assertEqual(data, self.rewrite(data))

    def test_partial_or_non_comment_matches_are_not_changed(self):
        for data in (b"/* Compiler settings for " + OLD.encode() + b": extra\n",
                     b"prefix /* Compiler settings for " + OLD.encode() + b":\n",
                     OLD.encode() + b"\n"):
            with self.subTest(data=data):
                self.assertEqual(data, self.rewrite(data))

    def run_main(self, mutation=None, already_generated=False):
        baseline = self.root / "baseline/x64"
        baseline.mkdir(parents=True)
        output = self.root / "gen/chrome/elevation_service"
        output.mkdir(parents=True)
        template = self.root / "service.idl"
        template.write_bytes(b"[uuid(PLACEHOLDER-GUID-12345678-1234-5678-9012-123456789012)]\n")
        old_path = str(template)
        generated_path = MIDL.posixpath.join(str(output), "service.idl")
        comment_path = generated_path if already_generated else old_path
        original = {
            "service.h": ("/* Compiler settings for " + comment_path + ":\n"
                          " */\ninterface IService {};\n").encode(),
            "service_i.c": ("/* Compiler settings for " + comment_path + ":\n"
                            " */\nconst int iid = 7;\n").encode(),
            "service.tlb": b"synthetic binary typelib\x00\xff",
            "service.dlldata.c": b"/* synthetic dlldata */\n",
        }
        for name, contents in original.items():
            (baseline / name).write_bytes(contents)
        environment = self.root / "environment.x64"
        environment.write_text("PATH=synthetic\0\0")
        calls = []

        def compiler(args, env):
            actual = self.root / ("actual-" + str(len(calls)))
            actual.mkdir()
            calls.append(args)
            for name, contents in original.items():
                contents = contents.replace(old_path.encode(), generated_path.encode())
                if mutation and name == mutation[0]:
                    contents = contents.replace(mutation[1], mutation[2])
                (actual / name).write_bytes(contents)
            return 0, str(actual)

        with mock.patch.object(MIDL.sys, "platform", "win32"), \
                mock.patch.object(MIDL, "overwrite_guids") as substitutions, \
                mock.patch.object(MIDL, "run_midl", side_effect=compiler), \
                contextlib.redirect_stdout(io.StringIO()) as diagnostic:
            result = MIDL.main(
                str(environment), str(baseline.parent), str(output),
                "12345678-1234-5678-9012-123456789012=87654321-4321-8765-2109-210987654321",
                "service.tlb", "service.h", "service.dlldata.c", "service_i.c",
                "none", "clang-cl", str(template), "/env", "x64", "/Oicf")
            self.assertEqual(1, substitutions.call_count)
        for name, contents in original.items():
            self.assertEqual(contents, (baseline / name).read_bytes())
        return result, diagnostic.getvalue()

    def test_main_accepts_only_comment_path_difference(self):
        self.assertEqual(0, self.run_main()[0])

    def test_main_accepts_existing_dynamic_baseline_path(self):
        self.assertEqual(0, self.run_main(already_generated=True)[0])

    def test_main_still_rejects_interface_or_binary_changes(self):
        for mutation in (("service.h", b"IService", b"IChanged"),
                         ("service_i.c", b"iid = 7", b"iid = 8"),
                         ("service.tlb", b"\x00\xff", b"\x00\xfe"),
                         ("service.dlldata.c", b"dlldata", b"changed")):
            with self.subTest(file=mutation[0]):
                # Every case gets its own output; never overwrite a prior fixture.
                with tempfile.TemporaryDirectory(prefix="case-", dir=self.temp.name) as case:
                    previous = self.root
                    self.root = Path(case)
                    try:
                        result, diagnostic = self.run_main(mutation)
                    finally:
                        self.root = previous
                self.assertEqual(1, result)
                self.assertIn("midl.exe output different", diagnostic)


if __name__ == "__main__":
    unittest.main()
