#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
import os
import subprocess
import tempfile
import unittest
from unittest import mock
import zipfile

from source_provenance import capture, capture_source, git as source_git, write_snapshot


class SourceProvenanceTest(unittest.TestCase):
    def test_output_junction_binds_its_target_and_rejects_direct_external_path(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            root = parent / "source"
            (root / "out").mkdir(parents=True)
            first = parent / "first-output"
            second = parent / "second-output"
            for target in (first, second):
                target.mkdir()
                (target / "args.gn").write_text("is_debug = false\n")
            build = root / "out" / "release"

            def link(target):
                if os.name == "nt":
                    subprocess.run([os.environ["COMSPEC"], "/c", "mklink", "/J",
                                    str(build), str(target)], check=True,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
                else:
                    build.symlink_to(target, target_is_directory=True)

            def source_record(_):
                return {"sourceRoot": str(root), "identitySha256": "source",
                        "identity": {}}, b""

            link(first)
            with mock.patch("source_provenance.capture_source", side_effect=source_record):
                original, _ = capture(root, build)
                self.assertEqual(str(build), original["buildDirectory"])
                self.assertEqual(str(first), original["resolvedBuildDirectory"])
                with self.assertRaises(ValueError):
                    capture(root, first)
                if os.name == "nt":
                    build.rmdir()  # Remove only this fixture junction.
                else:
                    build.unlink()
                link(second)
                changed, _ = capture(root, build)
                self.assertNotEqual(original, changed)
                self.assertEqual(str(second), changed["resolvedBuildDirectory"])
                with self.assertRaises(ValueError):
                    capture(root, root / "out" / ".." / ".." / "first-output")

    def test_git_helpers_cannot_open_console_windows_or_read_stdin(self):
        with mock.patch("source_provenance.subprocess.run", return_value=
                        subprocess.CompletedProcess([], 0, stdout=b"fixture")) as invoked:
            self.assertEqual(b"fixture", source_git(Path("fixture"), "status"))
        options = invoked.call_args.kwargs
        self.assertEqual(subprocess.DEVNULL, options["stdin"])
        self.assertEqual(subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                         options["creationflags"])
        self.assertTrue(options["check"])

    def test_dirty_staged_untracked_deleted_and_arguments_change_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            build = root / "out"
            build.mkdir()
            (build / "args.gn").write_text("is_debug = false\n")
            (root / ".gitignore").write_text("out/\n")
            (root / "source.cc").write_text("original\n")
            def git(*args):
                return subprocess.run(["git", "-C", str(root), *args], check=True,
                                      stdin=subprocess.DEVNULL,
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                      creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            git("init")
            git("add", ".")
            git("-c", "user.name=Source test", "-c", "user.email=test@example.invalid",
                "-c", "commit.gpgsign=false", "commit", "-m", "fixture")
            original, _ = capture(root, build)
            source, _ = capture_source(root)
            self.assertEqual(source["identitySha256"], original["sourceIdentitySha256"])
            self.assertEqual(git("rev-parse", "HEAD^{tree}").stdout.decode().strip(),
                             source["identity"]["tree"])
            self.assertEqual(original, capture(root, build)[0])
            (root / "source.cc").write_text("modified\n")
            dirty, patch = capture(root, build)
            self.assertNotEqual(original["identitySha256"], dirty["identitySha256"])
            self.assertIn(b"+modified", patch)
            git("add", "source.cc")
            staged, _ = capture(root, build)
            self.assertNotEqual(dirty["identitySha256"], staged["identitySha256"])
            (root / "new.h").write_text("untracked\n")
            untracked, _ = capture(root, build)
            self.assertNotEqual(staged["identitySha256"], untracked["identitySha256"])
            (root / "source.cc").unlink()
            deleted, _ = capture(root, build)
            self.assertNotEqual(untracked["identitySha256"], deleted["identitySha256"])
            self.assertTrue(any(item.get("deleted") for item in deleted["identity"]["overrides"]))
            snapshot = write_snapshot(deleted, capture(root, build)[1],
                                      build / "source-provenance.json")
            with zipfile.ZipFile(build / snapshot["file"]) as archive:
                self.assertEqual((root / "new.h").read_bytes(),
                                 archive.read("overrides/new.h"))
                self.assertNotIn("overrides/source.cc", archive.namelist())
                self.assertEqual((build / "args.gn").read_bytes(),
                                 archive.read("args.gn"))
            self.assertEqual(deleted, capture(root, build)[0])
            (root / "new.h").write_text("changed during capture\n")
            with self.assertRaisesRegex(ValueError, "Source changed"):
                write_snapshot(deleted, b"", build / "changed.json")
            (build / "args.gn").write_text("is_debug = true\n")
            before_args, _ = capture_source(root)
            self.assertNotEqual(deleted["identitySha256"], capture(root, build)[0]["identitySha256"])
            self.assertEqual(before_args["identitySha256"],
                             capture(root, build)[0]["sourceIdentitySha256"])


if __name__ == "__main__":
    unittest.main()
