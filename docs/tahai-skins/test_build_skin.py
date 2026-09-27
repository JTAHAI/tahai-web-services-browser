"""Creator regression tests: run `py -m unittest discover -s docs/tahai-skins`."""
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest import mock
import zipfile

import build_skin
import build_creator_kit


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

    def test_operational_manifest_builds_with_only_reviewed_actions(self):
        def make_operational(manifest):
            manifest["schema_version"] = 2
            manifest["operational"] = {
                "capabilities": ["workspace-layout", "mission-checklist"],
                "surfaces": [{"id": "research-surface", "layout": "quad",
                              "rail_state": "expanded", "start_surface": "mission"}],
                "workflows": [{"id": "research-workflow", "name": "Research workflow",
                               "steps": [{"id": "open-mission", "name": "Open mission",
                                          "kind": "run-command", "action": "mission.open"}]}],
                "modes": [{"id": "research-mode", "name": "Research mode",
                           "surface": "research-surface", "workflow": "research-workflow",
                           "actions": ["layout.quad", "mission.open"]}],
            }
        self.mutate(make_operational)
        self.assertTrue(build_skin.build(self.source))
        self.mutate(lambda m: m["operational"]["modes"][0].update(
            actions=["navigate.https://untrusted.invalid"]))
        with self.assertRaisesRegex(ValueError, "unknown or lacks"):
            build_skin.build(self.source)

    def test_named_outputs_roundtrip_in_archive_as_definitions_only(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "source-input", "name": "Source", "type": "text", "required": True,
                               "protected": True, "validation": {"max_bytes": 64}}]
        workflow["outputs"] = [{"id": "result", "name": "Result", "from": {"input": "source-input"}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        package = build_skin.build(self.source)
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            saved = json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]
            self.assertEqual(workflow["outputs"], saved["outputs"])
            self.assertEqual({"id", "name", "from"}, set(saved["outputs"][0]))
            self.assertNotIn("value", saved["inputs"][0])
            self.assertNotIn("protected_value", saved["inputs"][0])
        self.mutate(lambda manifest: manifest["operational"]["workflows"][0]["outputs"][0].update(value="private-run-value"))
        with self.assertRaises(ValueError): build_skin.build(self.source)

    def test_manual_compensation_reviews_are_bounded_inert_definitions(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["compensation_steps"] = [
            {"id": "confirm-authority", "name": "Confirm actual authority"},
            {"id": "record-outcome", "name": "Record actual outcome"}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            saved = json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]
            self.assertEqual(workflow["compensation_steps"], saved["compensation_steps"])
            self.assertEqual({"id", "name"}, set(saved["compensation_steps"][0]))
        valid = json.dumps(operational)
        for steps in ([], None, [{}], [{"id": "review", "name": "Review", "action": "delete"}],
                      [{"id": "same", "name": "One"}, {"id": "same", "name": "Two"}],
                      [{"id": f"review-{i}", "name": "Review"} for i in range(9)]):
            invalid = json.loads(valid); invalid["workflows"][0]["compensation_steps"] = steps
            with self.subTest(steps=steps), self.assertRaises(ValueError):
                build_skin.validate_operational(invalid)

    def test_variables_and_assignments_roundtrip_without_run_values(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "amount", "name": "Amount", "type": "number", "required": False}]
        workflow["variables"] = [{"id": "total", "name": "Total", "type": "number",
                                   "validation": {"minimum": 2, "maximum": 4}}]
        workflow["steps"] = [{"id": "assign-total", "name": "Assign total", "kind": "assign-variable",
                               "assign": {"variable": "total", "from": {"input": "amount"}}}]
        workflow["outputs"] = [{"id": "result", "name": "Result", "from": {"variable": "total"}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            saved = json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]
            self.assertEqual(workflow, saved)
            self.assertNotIn("value", saved["variables"][0])
        valid = json.dumps(operational)
        mutations = [
            lambda w: w["variables"][0].update(value="3"),
            lambda w: w["variables"][0].update(default="3"),
            lambda w: w["variables"][0].update(protected="true"),
            lambda w: w["variables"][0].update(required=False),
            lambda w: w["variables"].append(w["variables"][0]),
            lambda w: w.update(variables=None),
            lambda w: w["inputs"][0].update(protected=True),
            lambda w: w["inputs"][0].update(type="text"),
            lambda w: w["steps"][0]["assign"].update(variable="missing"),
            lambda w: w["steps"][0]["assign"]["from"].update(variable="total"),
            lambda w: w["steps"][0]["assign"].update(value="3"),
            lambda w: w["steps"][0].update(kind="checkpoint"),
            lambda w: w["outputs"][0]["from"].update(variable="missing"),
        ]
        for mutation in mutations:
            invalid = json.loads(valid)
            mutation(invalid["workflows"][0])
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                build_skin.validate_operational(invalid)

    def test_protected_variables_roundtrip_without_downgrades_or_embedded_values(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id":"secret", "name":"Secret", "type":"number", "required":False, "protected":True}]
        workflow["variables"] = [{"id":"first", "name":"First", "type":"number", "protected":True},
                                 {"id":"second", "name":"Second", "type":"number", "protected":True}]
        workflow["steps"] = [{"id":"copy-one", "name":"Copy one", "kind":"assign-variable", "assign":{"variable":"first", "from":{"input":"secret"}}},
                             {"id":"copy-two", "name":"Copy two", "kind":"assign-variable", "assign":{"variable":"second", "from":{"variable":"first"}}}]
        workflow["outputs"] = [{"id":"result", "name":"Result", "from":{"variable":"second"}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(workflow, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0])
        valid = json.dumps(operational)
        for mutation in (lambda w: w["variables"][0].update(protected=False),
                         lambda w: w["variables"][1].update(protected=False),
                         lambda w: w["variables"][0].update(protected="true"),
                         lambda w: w["variables"][0].update(value="secret"),
                         lambda w: w["variables"][0].update(protected_value="ciphertext"),
                         lambda w: w["variables"][0].update(protected_has_value=True),
                         lambda w: w["steps"][0].update(when={"not":{"variable":"first", "compare":{"op":"equal", "number":1}}}),
                         lambda w: w["steps"][0].update(assign={"variable":"first", "expression":{"number":1}})):
            invalid = json.loads(valid); mutation(invalid["workflows"][0])
            with self.subTest(mutation=mutation), self.assertRaises(ValueError): build_skin.validate_operational(invalid)
        workflow["inputs"][0]["protected"] = False
        build_skin.validate_operational(operational)  # Protection can increase, never decrease.

    def test_numeric_conditions_roundtrip_and_reject_ambiguous_or_private_predicates(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "amount", "name": "Amount", "type": "number", "required": False}]
        workflow["steps"] = [{"id": "review", "name": "Review", "kind": "checkpoint",
                              "when": {"input": "amount", "compare": {"op": "greater-than", "number": 3.125}}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(workflow, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0])
        for op in ("equal", "not-equal", "less-than", "at-most", "greater-than", "at-least"):
            workflow["steps"][0]["when"]["compare"] = {"op": op, "number": -1e12}
            build_skin.validate_operational(operational)
        for compare in (None, [], {}, {"op": "equal", "number": True}, {"op": "equal", "number": "3"},
                        {"op": "equal", "number": float("nan")}, {"op": "equal", "number": float("inf")},
                        {"op": "equal", "number": 1e12 + 1}, {"op": ["equal"], "number": 3},
                        {"op": "eval", "number": 3}, {"op": "equal"}, {"op": "equal", "number": 3, "script": "no"}):
            workflow["steps"][0]["when"] = {"input": "amount", "compare": compare}
            with self.subTest(compare=compare), self.assertRaises(ValueError):
                build_skin.validate_operational(operational)
        workflow["steps"][0]["when"] = {"input": "amount", "compare": {"op": "equal", "number": 3}}
        valid = json.dumps(operational)
        for mutation in (lambda w: w["inputs"][0].update(protected=True),
                         lambda w: w["inputs"][0].update(type="text"),
                         lambda w: w["steps"][0]["when"].update(equals="3"),
                         lambda w: w["steps"][0]["when"].update(input="missing")):
            invalid = json.loads(valid); mutation(invalid["workflows"][0])
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                build_skin.validate_operational(invalid)

    def test_variable_conditions_roundtrip_and_reject_run_state_or_ambiguous_namespaces(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "amount", "name": "Private amount", "type": "number", "required": False, "protected": True}]
        workflow["variables"] = [{"id": "amount", "name": "Saved amount", "type": "number"}]
        workflow["steps"] = [{"id": "review", "name": "Review", "kind": "checkpoint",
                              "when": {"variable": "amount", "compare": {"op": "greater-than", "number": 3.125}}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(workflow, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0])
        valid = json.dumps(operational)
        for mutation in (lambda w: w["variables"][0].update(protected=True),
                         lambda w: w["variables"][0].update(type="text"),
                         lambda w: w["steps"][0]["when"].update(input="amount"),
                         lambda w: w["steps"][0]["when"].update(variable="missing"),
                         lambda w: w["steps"][0]["when"].update(variable=[]),
                         lambda w: w["steps"][0].update(variable_condition_result=True)):
            invalid = json.loads(valid); mutation(invalid["workflows"][0])
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                build_skin.validate_operational(invalid)
        for kind, value in (("boolean", "true"), ("selection", "Yes")):
            workflow["variables"][0]["type"] = kind
            if kind == "selection": workflow["variables"][0]["options"] = ["Yes", "No"]
            workflow["steps"][0]["when"] = {"variable": "amount", "equals": value}
            build_skin.validate_operational(operational)

    def test_compound_predicates_roundtrip_with_strict_privacy_shape_and_tree_budgets(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id":"approved", "name":"Approved", "type":"boolean", "required":False},
                              {"id":"secret", "name":"Secret", "type":"boolean", "required":False, "protected":True}]
        workflow["variables"] = [{"id":"total", "name":"Total", "type":"number"}]
        leaf = {"input":"approved", "equals":"true"}
        predicate = {"all":[leaf, {"not":{"variable":"total", "compare":{"op":"at-most", "number":3}}}]}
        workflow["steps"] = [{"id":"review", "name":"Review", "kind":"checkpoint", "when":predicate}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(predicate, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]["steps"][0]["when"])
        for invalid in ({"all":[]}, {"any":[leaf]}, {"not":[leaf]}, {"not":None}, {"all":[leaf]*9},
                        {"all":[leaf,leaf], "result":True}, {"all":[leaf, {"input":"secret", "equals":"true"}]},
                        {"any":[leaf, {"variable":"missing", "equals":"true"}]}, {"not":{"variable":"total", "equals":"3"}}):
            workflow["steps"][0]["when"] = invalid
            with self.subTest(invalid=invalid), self.assertRaises(ValueError): build_skin.validate_operational(operational)
        tree = leaf
        for _ in range(4): tree = {"all":[tree, tree]}
        workflow["steps"][0]["when"] = tree
        build_skin.validate_operational(operational)  # 31 nodes, 5 levels.
        workflow["steps"][0]["when"] = {"not":tree}
        with self.assertRaises(ValueError): build_skin.validate_operational(operational)
        workflow["steps"][0]["when"] = {"all":[{"all":[leaf]*7}]*4}
        with self.assertRaises(ValueError): build_skin.validate_operational(operational)

    def test_bounded_repeats_preserve_authored_source_and_reject_invalid_expansions(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["steps"] = [{"id":"first", "name":"First", "kind":"checkpoint"},
                             {"id":"last", "name":"Last", "kind":"wait", "wait":{"seconds":1}}]
        workflow["repeats"] = [{"id":"rounds", "from":"first", "through":"last", "count":3}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(workflow, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0])
        valid = json.dumps(operational)
        for repeats in (None, {}, True, [None], [{}],
                        *[[dict(workflow["repeats"][0], count=n)] for n in (0, 1, 9, -1, 2.5, True, "2", None)],
                        [dict(workflow["repeats"][0], through="missing")],
                        [dict(workflow["repeats"][0], **{"from":"last", "through":"first"})],
                        [dict(workflow["repeats"][0], result=True)],
                        [workflow["repeats"][0], {"id":"again", "from":"last", "through":"last", "count":2}],
                        [workflow["repeats"][0]] * 9):
            invalid = json.loads(valid); invalid["workflows"][0]["repeats"] = repeats
            with self.subTest(repeats=repeats), self.assertRaises(ValueError): build_skin.validate_operational(invalid)
        for mutation in (lambda w: w["steps"][0].update(name="a" * 123),
                         lambda w: w["repeats"][0].update(id="a" * 64),
                         lambda w: w["steps"].append({"id":"r-rounds-1-first", "name":"Collision", "kind":"checkpoint"})):
            invalid = json.loads(valid); mutation(invalid["workflows"][0])
            with self.assertRaises(ValueError): build_skin.validate_operational(invalid)
        workflow["steps"] = [{"id":f"step-{i}", "name":"Step", "kind":"checkpoint"} for i in range(4)]
        workflow["repeats"] = [{"id":"rounds", "from":"step-0", "through":"step-3", "count":8}]
        build_skin.validate_operational(operational)
        workflow["steps"].append({"id":"extra", "name":"Extra", "kind":"checkpoint"})
        with self.assertRaises(ValueError): build_skin.validate_operational(operational)

    def test_action_status_binding_roundtrip_and_strict_references(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" / "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        operational["capabilities"] = ["workspace-layout", "mission-checklist", "guard-control"]
        workflow["variables"] = [{"id":"outcome", "name":"Outcome", "type":"text"}]
        workflow["steps"] = [{"id":"dispatch", "name":"Dispatch", "kind":"run-command", "action":"layout.dual"},
            {"id":"capture", "name":"Capture", "kind":"assign-variable", "assign":{"variable":"outcome", "from":{"action_status":"dispatch"}}}]
        workflow["repeats"] = [{"id":"rounds", "from":"dispatch", "through":"capture", "count":2}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(workflow["steps"], json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]["steps"])
        for change in ("self", "missing", "instruction", "protected", "number", "ambiguous"):
            with self.subTest(change=change):
                altered = json.loads(json.dumps(operational)); current = altered["workflows"][0]
                if change in ("self", "missing"): current["steps"][1]["assign"]["from"]["action_status"] = "capture" if change == "self" else "missing"
                if change == "instruction": current["steps"][0].update(kind="instruction"); current["steps"][0].pop("action")
                if change == "protected": current["variables"][0]["protected"] = True
                if change == "number": current["variables"][0]["type"] = "number"
                if change == "ambiguous": current["steps"][1]["assign"]["from"]["input"] = "dispatch"
                with self.assertRaises(ValueError): build_skin.validate_operational(altered)

    def test_boolean_expression_roundtrip_bounds_privacy_and_no_coercion(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" / "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id":"flag", "name":"Flag", "type":"boolean", "required":False}]
        workflow["variables"] = [{"id":"result", "name":"Result", "type":"boolean"}]
        expression = {"not":{"input":"flag", "equals":"true"}}
        workflow["steps"] = [{"id":"calculate", "name":"Calculate", "kind":"assign-variable", "assign":{"variable":"result", "boolean_expression":expression}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(expression, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]["steps"][0]["assign"]["boolean_expression"])
        tree = {"input":"flag", "equals":"true"}
        for _ in range(4): tree = {"all":[tree, tree]}
        workflow["steps"][0]["assign"]["boolean_expression"] = tree
        build_skin.validate_operational(operational)
        for node in [None, [], {}, {"all":[]}, {"input":"flag", "equals":True}, {"input":"missing", "equals":"true"}, {"not":tree}]:
            workflow["steps"][0]["assign"]["boolean_expression"] = node
            with self.subTest(node=node), self.assertRaises(ValueError): build_skin.validate_operational(operational)
        workflow["steps"][0]["assign"]["boolean_expression"] = expression
        for field in (workflow["inputs"][0], workflow["variables"][0]):
            field["protected"] = True
            with self.assertRaises(ValueError): build_skin.validate_operational(operational)
            field.pop("protected")
            field["type"] = "text"
            with self.assertRaises(ValueError): build_skin.validate_operational(operational)
            field["type"] = "boolean"
        for key, value in (("from", {"input":"flag"}), ("expression", {"number":1}), ("text_expression", {"text":"true"})):
            workflow["steps"][0]["assign"][key] = value
            with self.assertRaises(ValueError): build_skin.validate_operational(operational)
            workflow["steps"][0]["assign"].pop(key)

    def test_text_expression_roundtrip_bounds_privacy_and_no_coercion(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" / "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "source", "name": "Source", "type": "text", "required": False}]
        workflow["variables"] = [{"id": "result", "name": "Result", "type": "text"}]
        expression = {"op": "concat", "args": [{"op": "upper-ascii", "args": [{"input": "source"}]}, {"text": "é😀"}]}
        workflow["steps"] = [{"id": "format", "name": "Format", "kind": "assign-variable", "assign": {"variable": "result", "text_expression": expression}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(expression, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]["steps"][0]["assign"]["text_expression"])
        invalid = [None, [], {}, {"text": 1}, {"text": "\n"}, {"text": "\x7f"}, {"text": "\ud800"}, {"text": "\uffff"}, {"text": "\U0001fffe"}, {"text": "é"*129},
                   {"text":"x", "input":"source"}, {"input":"missing"}, {"number":1}, {"op":"eval","args":[]},
                   {"op":"concat","args":[{"text":"a"}]}, {"op":"replace","args":[{"text":"a"},{"text":"b"}]}]
        tree = {"text": "x"}
        for _ in range(4): tree = {"op": "concat", "args": [tree, tree]}
        workflow["steps"][0]["assign"]["text_expression"] = tree
        build_skin.validate_operational(operational)
        invalid.append({"op": "trim-space", "args": [tree]})
        for node in invalid:
            workflow["steps"][0]["assign"]["text_expression"] = node
            with self.subTest(node=node), self.assertRaises(ValueError): build_skin.validate_operational(operational)
        workflow["steps"][0]["assign"]["text_expression"] = {"input":"source"}
        for field in (workflow["inputs"][0], workflow["variables"][0]):
            field["protected"] = True
            with self.assertRaises(ValueError): build_skin.validate_operational(operational)
            field.pop("protected")
            field["type"] = "number"
            with self.assertRaises(ValueError): build_skin.validate_operational(operational)
            field["type"] = "text"
        workflow["steps"][0]["assign"]["expression"] = {"number":1}
        with self.assertRaises(ValueError): build_skin.validate_operational(operational)

    def test_numeric_expression_roundtrip_and_closed_bounded_privacy_contract(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "amount", "name": "Amount", "type": "number", "required": False}]
        workflow["variables"] = [{"id": "total", "name": "Total", "type": "number"}]
        expression = {"op": "multiply", "args": [{"op": "add", "args": [{"input": "amount"}, {"number": 1}]}, {"number": 2}]}
        workflow["steps"] = [{"id": "calculate", "name": "Calculate", "kind": "assign-variable",
                              "assign": {"variable": "total", "expression": expression}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(expression, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0]["steps"][0]["assign"]["expression"])
        invalid_expressions = [None, [], {}, {"number": True}, {"number": "2"}, {"number": float("nan")},
                              {"number": float("inf")}, {"number": 1e12 + 1}, {"input": "missing"},
                              {"number": 1, "input": "amount"}, {"op": "eval", "args": []},
                              {"op": "add", "args": [{"number": 1}]}, {"op": "abs", "args": [1, 2]},
                              {"op": "abs", "args": [{"number": 1}], "script": "no"}]
        tree = {"number": 1}
        for _ in range(4): tree = {"op": "add", "args": [tree, tree]}
        workflow["steps"][0]["assign"]["expression"] = tree
        build_skin.validate_operational(operational)
        invalid_expressions.append({"op": "abs", "args": [tree]})
        invalid_expressions.extend({"op": op, "args": [{"number": 1}, {"number": 2}]}
                                   for op in (None, ["add"], {}, 1))
        for expression in invalid_expressions:
            with self.subTest(expression=expression), self.assertRaises(ValueError):
                workflow["steps"][0]["assign"]["expression"] = expression
                build_skin.validate_operational(operational)
        workflow["steps"][0]["assign"]["expression"] = {"input": "amount"}
        workflow["inputs"][0]["protected"] = True
        with self.assertRaises(ValueError): build_skin.validate_operational(operational)
        workflow["inputs"][0]["protected"] = False
        workflow["inputs"][0]["type"] = "text"
        with self.assertRaises(ValueError): build_skin.validate_operational(operational)
        workflow["inputs"][0]["type"] = "number"
        workflow["steps"][0]["assign"]["from"] = {"input": "amount"}
        with self.assertRaises(ValueError): build_skin.validate_operational(operational)

    def test_timed_waits_roundtrip_as_bounded_definitions_without_clock_state(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["steps"] = [{"id": "delay", "name": "Local delay", "kind": "wait", "wait": {"seconds": 3}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(workflow, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0])
        for seconds in (1, 86400):
            workflow["steps"][0]["wait"]["seconds"] = seconds
            build_skin.validate_operational(operational)
        valid = json.dumps(operational)
        mutations = [lambda step, n=n: step["wait"].update(seconds=n)
                     for n in (0, -1, 86401, 1.5, "3", True, None)] + [
            lambda step: step.update(wait=None), lambda step: step.pop("wait"),
            lambda step: step["wait"].update(started=1),
            lambda step: step["wait"].update(remaining_ms=0),
            lambda step: step.update(action="mission.open"),
            lambda step: step.update(kind="checkpoint"),
            lambda step: step.update(assign={"variable": "no", "from": {"input": "no"}})]
        for mutation in mutations:
            invalid = json.loads(valid)
            mutation(invalid["workflows"][0]["steps"][0])
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                build_skin.validate_operational(invalid)

    def test_wait_deadlines_roundtrip_without_runtime_budgets(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["steps"] = [{"id": "delay", "name": "Delay", "kind": "wait", "wait": {"seconds": 3, "timeout_seconds": 5}}]
        self.mutate(lambda manifest: manifest.update(schema_version=2, operational=operational))
        with zipfile.ZipFile(io.BytesIO(build_skin.build(self.source))) as archive:
            self.assertEqual(workflow, json.loads(archive.read("manifest.json"))["operational"]["workflows"][0])
        for timeout in (0, -1, 3, 2, 86401, 4.5, True, None, "5", {}, []):
            workflow["steps"][0]["wait"]["timeout_seconds"] = timeout
            with self.subTest(timeout=timeout), self.assertRaises(ValueError):
                build_skin.validate_operational(operational)
        workflow["steps"][0]["wait"]["timeout_seconds"] = 86400
        build_skin.validate_operational(operational)
        workflow["steps"][0]["wait"]["timeout_remaining_ms"] = 4000
        with self.assertRaises(ValueError):
            build_skin.validate_operational(operational)

    def test_operational_package_signs_exact_generated_manifest(self):
        self.mutate(lambda m: m.update(
            schema_version=2,
            operational={
                "capabilities": ["workspace-layout", "mission-checklist"],
                "surfaces": [{"id": "mission-surface", "layout": "one",
                              "rail_state": "icons", "start_surface": "mission"}],
                "workflows": [{"id": "mission-workflow", "name": "Mission workflow",
                               "steps": [{"id": "review", "name": "Review",
                                          "kind": "instruction"}]}],
                "modes": [{"id": "mission-mode", "name": "Mission mode",
                           "surface": "mission-surface", "workflow": "mission-workflow",
                           "actions": ["mission.open"]}],
            }))
        preimages = []
        package = build_skin.build(
            self.source, "enterprise-2026",
            lambda preimage: preimages.append(preimage) or b"\x5a" * 64)
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            self.assertEqual("enterprise-2026",
                             archive.read("META-INF/tahai-key-id").decode())
            self.assertEqual(b"\x5a" * 64,
                             archive.read("META-INF/tahai-signature.ed25519"))
            self.assertEqual(
                build_skin.operational_signature_preimage(
                    archive.read("manifest.json")),
                preimages[0])
        unsigned_source = Path(self.temp.name) / "unsigned-skin"
        shutil.copytree(Path(__file__).parent / "starter-skin", unsigned_source)
        with self.assertRaisesRegex(ValueError, "Only operational"):
            build_skin.build(unsigned_source, "enterprise-2026",
                             lambda _: b"\x00" * 64)

        for key_id in ("a", "ab", "a" * 64):
            with self.subTest(valid_key_id=key_id):
                self.assertTrue(build_skin.build(self.source, key_id, lambda _: b"\x5a" * 64))
        for key_id in ("", "A", "-bad", "bad-", "a" * 65, None):
            with self.subTest(invalid_key_id=key_id):
                with self.assertRaisesRegex(ValueError, "Signing key ID"):
                    build_skin.build(self.source, key_id, lambda _: b"\x5a" * 64)

    def test_python_ed25519_signer_emits_verifiable_envelope(self):
        try:
            from cryptography.exceptions import InvalidSignature
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        except ImportError:
            self.skipTest("cryptography Ed25519 support is unavailable")
        self.mutate(lambda m: m.update(
            schema_version=2,
            operational={
                "capabilities": ["workspace-layout", "mission-checklist"],
                "surfaces": [{"id": "mission-surface", "layout": "one",
                              "rail_state": "icons", "start_surface": "mission"}],
                "workflows": [{"id": "mission-workflow", "name": "Mission workflow",
                               "steps": [{"id": "review", "name": "Review",
                                          "kind": "instruction"}]}],
                "modes": [{"id": "mission-mode", "name": "Mission mode",
                           "surface": "mission-surface", "workflow": "mission-workflow",
                           "actions": ["mission.open"]}],
            }))
        private_key = Ed25519PrivateKey.generate()
        key_path = Path(self.temp.name) / "signing.pem"
        key_path.write_bytes(private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption()))
        package = build_skin.build(
            self.source, "enterprise-2026",
            build_skin.python_ed25519_signer(key_path))
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            manifest = archive.read("manifest.json")
            signature = archive.read("META-INF/tahai-signature.ed25519")
        private_key.public_key().verify(
            signature, build_skin.operational_signature_preimage(manifest))
        with self.assertRaises(InvalidSignature):
            private_key.public_key().verify(
                signature, build_skin.operational_signature_preimage(manifest + b" "))
        with self.assertRaises(InvalidSignature):
            Ed25519PrivateKey.generate().public_key().verify(
                signature, build_skin.operational_signature_preimage(manifest))
        key_path.write_bytes(private_key.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
            serialization.BestAvailableEncryption(b"ephemeral-test-password")))
        with self.assertRaisesRegex(ValueError, "unencrypted Ed25519"):
            build_skin.python_ed25519_signer(key_path)
        key_path.write_bytes(b"not a private key")
        with self.assertRaisesRegex(ValueError, "unencrypted Ed25519"):
            build_skin.python_ed25519_signer(key_path)
        key_path.write_bytes(b"x" * 16385)
        with self.assertRaisesRegex(ValueError, "16 KiB"):
            build_skin.python_ed25519_signer(key_path)

    def test_openssl_signer_is_noninteractive_hidden_and_bounded(self):
        key_path = Path(self.temp.name) / "fixture.pem"
        key_path.write_text("fixture only; the subprocess is mocked", encoding="ascii")
        signer = build_skin.openssl_ed25519_signer(key_path, "fixture-openssl")

        def signed(arguments, **options):
            self.assertEqual("fixture-openssl", arguments[0])
            self.assertEqual(build_skin.subprocess.DEVNULL, options["stdin"])
            self.assertEqual(30, options["timeout"])
            self.assertEqual(build_skin.subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                             options["creationflags"])
            self.assertTrue(options["capture_output"])
            self.assertEqual(b"reviewed bytes", Path(arguments[-3]).read_bytes())
            Path(arguments[-1]).write_bytes(b"\x5a" * 64)
            return build_skin.subprocess.CompletedProcess(arguments, 0)

        with mock.patch.object(build_skin.subprocess, "run", side_effect=signed):
            self.assertEqual(b"\x5a" * 64, signer(b"reviewed bytes"))
        with mock.patch.object(build_skin.subprocess, "run", return_value=
                               build_skin.subprocess.CompletedProcess([], 1)):
            with self.assertRaisesRegex(ValueError, "could not create"):
                signer(b"reviewed bytes")
        with mock.patch.object(build_skin.subprocess, "run", side_effect=
                               build_skin.subprocess.TimeoutExpired("fixture-openssl", 30)):
            with self.assertRaises(build_skin.subprocess.TimeoutExpired):
                signer(b"reviewed bytes")

    def test_creator_kit_contains_operational_template_and_package(self):
        kit = build_creator_kit.outputs()["skin-creator-kit.zip"]
        with zipfile.ZipFile(io.BytesIO(kit)) as archive:
            names = set(archive.namelist())
            self.assertIn("operational-starter-skin.tahaiskin", names)
            self.assertIn("operational-starter-skin/manifest.json", names)
            with zipfile.ZipFile(io.BytesIO(
                    archive.read("operational-starter-skin.tahaiskin"))) as skin:
                self.assertEqual(2, json.loads(skin.read("manifest.json"))["schema_version"])


class SurfaceDesignTests(unittest.TestCase):
    def test_named_outputs_are_bounded_bindings_without_values_or_privacy_override(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "source-input", "name": "Private source", "type": "text", "required": True, "protected": True}]
        valid = {"id": "result", "name": "Result", "from": {"input": "source-input"}}
        workflow["outputs"] = [valid]
        build_skin.validate_operational(operational)
        invalid = [None, {}, True, [None], [{}],
                   [{**valid, "from": {"input": "missing"}}],
                   [{**valid, "from": {"variable": "source-input"}}],
                   [{**valid, "from": {"input": "source-input", "selector": "body"}}],
                   [valid, valid]]
        invalid += [[{**valid, key: "invalid"}] for key in ("value", "default", "protected", "type", "destination")]
        invalid += [[{**valid, "id": f"result-{i}"} for i in range(13)]]
        for outputs in invalid:
            with self.subTest(outputs=outputs):
                workflow["outputs"] = outputs
                with self.assertRaises(ValueError): build_skin.validate_operational(operational)
        workflow["outputs"] = [{**valid, "id": f"result-{i}"} for i in range(12)]
        build_skin.validate_operational(operational)
        workflow["outputs"] = []
        build_skin.validate_operational(operational)
        del workflow["outputs"]
        build_skin.validate_operational(operational)

    def test_workflow_validation_rules_are_typed_closed_and_bounded(self):
        operational = json.loads((Path(__file__).parent / "operational-starter-skin" /
                                   "manifest.json").read_text(encoding="utf-8"))["operational"]
        workflow = operational["workflows"][0]
        invalid = [None, [], True, {}, {"pattern": ".*"}, {"min_bytes": -1},
                   {"max_bytes": 0}, {"max_bytes": 257}, {"min_bytes": 1.5},
                   {"min_bytes": 4, "max_bytes": 3}, {"minimum": True}, {"maximum": "3"},
                   {"minimum": 3, "maximum": 2}, {"minimum": -1e12-1}, {"maximum": 1e12+1},
                   {"minimum": float("nan")}, {"maximum": float("inf")},
                   {"minimum": 0, "min_bytes": 0}]
        for kind in ("text", "url", "number", "boolean", "selection", "date"):
            item = {"id": "bounded", "name": "Bounded", "type": kind, "required": True}
            if kind == "selection": item["options"] = ["Choice"]
            workflow["inputs"] = [item]
            for rules in invalid:
                with self.subTest(kind=kind, rules=rules):
                    item["validation"] = rules
                    with self.assertRaises(ValueError): build_skin.validate_operational(operational)
            item["validation"] = {"minimum": -.5, "maximum": 3} if kind == "number" else {"min_bytes": 2, "max_bytes": 4}
            for protected in (False, True):
                item["protected"] = protected
                if kind in ("text", "url", "number"): build_skin.validate_operational(operational)
                else:
                    with self.assertRaises(ValueError): build_skin.validate_operational(operational)

    def test_protected_definitions_reject_values_bad_flags_and_branch_leaks(self):
        source = json.loads((Path(__file__).parent / "operational-starter-skin" /
                             "manifest.json").read_text(encoding="utf-8"))
        operational = source["operational"]
        workflow = operational["workflows"][0]
        item = {"id": "private-input", "name": "Private input", "type": "boolean",
                "required": True, "protected": True}
        workflow["inputs"] = [item]
        build_skin.validate_operational(operational)
        for value in (None, 1, "true", [], {}):
            item["protected"] = value
            with self.assertRaises(ValueError):
                build_skin.validate_operational(operational)
        item["protected"] = True
        for field in ("value", "default", "protected_value"):
            item[field] = "must-not-be-in-a-design"
            with self.assertRaises(ValueError):
                build_skin.validate_operational(operational)
            del item[field]
        workflow["steps"][0]["when"] = {"input": "private-input", "equals": "true"}
        with self.assertRaises(ValueError):
            build_skin.validate_operational(operational)
        item["protected"] = False
        build_skin.validate_operational(operational)

    def test_date_and_url_are_declarations_not_embedded_values_or_actions(self):
        source = json.loads((Path(__file__).parent / "operational-starter-skin" /
                             "manifest.json").read_text(encoding="utf-8"))
        operational = source["operational"]
        workflow = operational["workflows"][0]
        for kind in ("date", "url"):
            with self.subTest(kind=kind):
                item = {"id": "typed-input", "name": "Typed input", "type": kind, "required": True}
                workflow["inputs"] = [item]
                build_skin.validate_operational(operational)
                for field, value in (("value", "private value"), ("options", ["Choice"]),
                                     ("default", "private value"), ("sensitive", True)):
                    item[field] = value
                    with self.assertRaises(ValueError):
                        build_skin.validate_operational(operational)
                    del item[field]
                workflow["steps"][0]["when"] = {"input": "typed-input", "equals": "2026-09-25"}
                with self.assertRaises(ValueError):
                    build_skin.validate_operational(operational)
                del workflow["steps"][0]["when"]

    def test_surface_and_workflow_capabilities_cannot_be_bypassed(self):
        source = json.loads((Path(__file__).parent / "operational-starter-skin" /
                             "manifest.json").read_text(encoding="utf-8"))
        operational = source["operational"]
        surface = operational["surfaces"][0]
        surface["layout"] = "one"
        operational["capabilities"].remove("workspace-layout")
        with self.assertRaisesRegex(ValueError, "workspace-layout"):
            build_skin.validate_operational(operational)
        operational["capabilities"].append("workspace-layout")
        surface["rail_modules"] = ["guard"]
        with self.assertRaisesRegex(ValueError, "guard-control"):
            build_skin.validate_operational(operational)
        operational["capabilities"].append("guard-control")
        build_skin.validate_operational(operational)
        operational["capabilities"].remove("mission-checklist")
        with self.assertRaisesRegex(ValueError, "mission-checklist"):
            build_skin.validate_operational(operational)
        surface["start_surface"] = "launchpad"
        for workflow in operational["workflows"]:
            workflow["steps"] = [{"id": "review-local", "name": "Review",
                                   "kind": "instruction"}]
        for mode in operational["modes"]:
            mode["actions"] = ["layout.one"]
        with self.assertRaisesRegex(ValueError, "Mode workflow"):
            build_skin.validate_operational(operational)

    def design(self):
        return {
            "version": 1, "rail_dock": "trailing", "gap": 12,
            "narrow_width": 640, "short_height": 360, "keyboard_order": [1, 2, 0],
            "nodes": [{"kind": "columns", "first": 1, "second": 2, "percent": 30},
                      {"kind": "pane", "pane": 0, "role": "reference"},
                      {"kind": "rows", "first": 3, "second": 4, "percent": 65},
                      {"kind": "pane", "pane": 1, "role": "working"},
                      {"kind": "pane", "pane": 2, "role": "tasks"}],
        }

    def test_valid_native_tree_and_legacy_surfaces(self):
        build_skin.validate_surface_design(self.design(), 3)
        source = json.loads((Path(__file__).parent / "operational-starter-skin" /
                             "manifest.json").read_text(encoding="utf-8"))
        operational = source["operational"]
        build_skin.validate_operational(operational)
        surface = operational["surfaces"][0]
        surface.update(layout="tri", rail_modules=["mission", "tabs"], design=self.design())
        workflow = operational["workflows"][0]
        workflow["inputs"] = [{"id": "review-ready", "name": "Ready for review",
                               "type": "boolean", "required": True}]
        workflow["steps"][0]["when"] = {"input": "review-ready", "equals": "true"}
        build_skin.validate_operational(operational)
        workflow["steps"][0]["when"]["equals"] = "not-a-boolean"
        with self.assertRaisesRegex(ValueError, "Condition"):
            build_skin.validate_operational(operational)

    def test_rejects_malformed_tree_without_repair(self):
        mutations = [
            lambda d: d.update(version=True),
            lambda d: d.update(gap=3),
            lambda d: d.update(narrow_width=1601),
            lambda d: d.update(short_height=0),
            lambda d: d.update(keyboard_order=[0, 0, 1]),
            lambda d: d.update(keyboard_order=[True, 2, 0]),
            lambda d: d.update(script="not allowed"),
            lambda d: d["nodes"][0].update(first=0),
            lambda d: d["nodes"][0].update(second=1),
            lambda d: d["nodes"][0].update(first=99),
            lambda d: d["nodes"][0].update(percent=0.5),
            lambda d: d["nodes"][4].update(pane=1),
            lambda d: d["nodes"][4].update(url="https://example.invalid"),
            lambda d: d["nodes"].append({"kind": "pane", "pane": 3, "role": "preview"}),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                design = self.design()
                mutate(design)
                with self.assertRaises(ValueError):
                    build_skin.validate_surface_design(design, 3)
        with self.assertRaises(ValueError):
            build_skin.validate_surface_design(self.design(), 4)


if __name__ == "__main__":
    release_gate = "--release-gate" in sys.argv
    if release_gate:
        sys.argv.remove("--release-gate")
    expected = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]).countTestCases()
    program = unittest.main(exit=False)
    result = program.result
    complete = result.testsRun == expected and expected > 0 and not result.skipped
    if release_gate and not complete:
        print("Creator release gate requires every test, including real Ed25519 signing; "
              "skipped or filtered tests cannot pass.", file=sys.stderr)
    raise SystemExit(0 if result.wasSuccessful() and (not release_gate or complete) else 1)
