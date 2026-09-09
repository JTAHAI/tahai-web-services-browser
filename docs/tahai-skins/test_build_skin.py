"""Creator regression tests: run `py -m unittest discover -s docs/tahai-skins`."""
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

import build_skin


class CreatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "skin"
        shutil.copytree(Path(__file__).parent / "starter-skin", self.source)

    def mutate(self, update):
        path = self.source / "manifest.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        update(manifest)
        path.write_text(json.dumps(manifest), encoding="utf-8")

    def test_reproducible_file_only_archive_and_fresh_hashes(self):
        self.mutate(lambda m: m["assets"][0].update(sha256="stale"))
        first = build_skin.build(self.source)
        self.assertEqual(first, build_skin.build(self.source))
        with zipfile.ZipFile(io.BytesIO(first)) as archive:
            self.assertEqual({"manifest.json", "assets/preview.png"}, set(archive.namelist()))
            self.assertIsNone(archive.testzip())
            manifest = json.loads(archive.read("manifest.json"))
            self.assertEqual(build_skin.hashlib.sha256(archive.read("assets/preview.png")).hexdigest(),
                             manifest["assets"][0]["sha256"])
        self.assertEqual("stale", json.loads((self.source / "manifest.json").read_text())["assets"][0]["sha256"])

    def test_corrupt_image_is_rejected_even_when_manifest_hash_is_updated(self):
        path = self.source / "assets/preview.png"
        image = bytearray(path.read_bytes())
        image[-5] ^= 1
        path.write_bytes(image)
        self.mutate(lambda m: m["assets"][0].update(sha256=build_skin.hashlib.sha256(image).hexdigest()))
        with self.assertRaisesRegex(ValueError, "checksum"):
            build_skin.build(self.source)

    def test_low_contrast_is_actionable(self):
        self.mutate(lambda m: m["appearance"]["dark_tokens"].update(toolbar_foreground="#082f49"))
        with self.assertRaisesRegex(ValueError, "dark_tokens.toolbar: contrast"):
            build_skin.build(self.source)

    def test_unsafe_path_is_rejected_before_file_read(self):
        self.mutate(lambda m: m["assets"][0].update(path="assets/../../outside.png"))
        with self.assertRaisesRegex(ValueError, "Unsafe asset path"):
            build_skin.build(self.source)

    def test_duplicate_json_fields_are_rejected(self):
        path = self.source / "manifest.json"
        path.write_text('{"id":"first", "id":"second"}', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Duplicate JSON field: id"):
            build_skin.build(self.source)


if __name__ == "__main__":
    unittest.main()
