#!/usr/bin/env python3
"""Build a local .tahaiskin with file entries only. Python 3.9+, no dependencies.

This checks creator mistakes; the browser's sandboxed decoder is authoritative.
It never fetches URLs or executes package content, and leaves the source intact.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
import zipfile
import zlib

TOKENS = {
    "shell_background", "toolbar_background", "toolbar_foreground",
    "tab_background", "tab_foreground", "rail_background", "rail_foreground",
    "accent", "panel_background", "panel_foreground",
}
MAX_ASSET = 4 * 1024 * 1024
CAPABILITIES = {
    "browser-navigation", "workspace-layout", "mission-checklist", "guard-control",
}
ACTION_CAPABILITIES = {
    "address.focus": "browser-navigation",
    "tabs.find": "workspace-layout",
    "workspaces.open": "workspace-layout",
    "mission.open": "mission-checklist",
    "guard.open": "guard-control",
    "layout.one": "workspace-layout",
    "layout.dual": "workspace-layout",
    "layout.tri": "workspace-layout",
    "layout.quad": "workspace-layout",
    "layout.focus": "workspace-layout",
}


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


def optional_fields(value, required, optional, where):
    require(isinstance(value, dict) and required <= set(value) <= required | optional,
            f"{where}: missing required or unknown field")


def bounded_int(value, minimum, maximum, where):
    require(type(value) is int and minimum <= value <= maximum,
            f"{where}: expected an integer from {minimum} to {maximum}")


def validate_surface_design(design, pane_count):
    fields(design, {"version", "nodes", "rail_dock", "gap", "narrow_width",
                    "short_height", "keyboard_order"}, "Surface.design")
    bounded_int(design["version"], 1, 1, "Surface.design.version")
    require(design["rail_dock"] in ("leading", "trailing"), "Invalid rail dock")
    bounded_int(design["gap"], 4, 24, "Surface.design.gap")
    bounded_int(design["narrow_width"], 320, 1600, "Surface.design.narrow_width")
    bounded_int(design["short_height"], 200, 900, "Surface.design.short_height")
    nodes, order = design["nodes"], design["keyboard_order"]
    require(isinstance(nodes, list) and 1 <= len(nodes) <= 7,
            "Surface.design.nodes: expected 1-7 nodes")
    require(isinstance(order, list) and len(order) == pane_count and
            all(type(index) is int for index in order) and
            set(order) == set(range(pane_count)),
            "Surface.design.keyboard_order must name each pane once")
    visited, panes = set(), set()

    def visit(index, depth):
        bounded_int(index, 0, len(nodes) - 1, "Surface node index")
        require(depth <= 4 and index not in visited,
                "Surface tree contains a cycle, shared child or excessive depth")
        visited.add(index)
        node = nodes[index]
        require(isinstance(node, dict), "Surface node must be an object")
        if node.get("kind") == "pane":
            fields(node, {"kind", "pane", "role"}, "Pane node")
            bounded_int(node["pane"], 0, pane_count - 1, "Pane index")
            require(node["pane"] not in panes, "Duplicate pane index")
            require(node["role"] in ("working", "reference", "tasks", "preview", "notes"),
                    "Unsupported pane role")
            panes.add(node["pane"])
        else:
            fields(node, {"kind", "first", "second", "percent"}, "Split node")
            require(node["kind"] in ("rows", "columns"), "Unsupported split kind")
            bounded_int(node["percent"], 10, 90, "Split percent")
            visit(node["first"], depth + 1)
            visit(node["second"], depth + 1)

    visit(0, 1)
    require(len(visited) == len(nodes) and panes == set(range(pane_count)),
            "Surface tree must reference every node and declared pane exactly once")


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


def safe_id(value, where):
    require(isinstance(value, str) and
            re.fullmatch(r"[a-z0-9][a-z0-9-]{1,62}[a-z0-9]", value),
            f"{where}: use a 3-64 character lowercase identifier")


def safe_metadata(value, where):
    require(isinstance(value, str) and 1 <= len(value) <= 128 and
            all(32 <= ord(c) <= 126 and c not in '\\"<>' for c in value),
            f"{where}: use 1-128 plain ASCII characters without quotes, slashes or markup")


def validate_actions(actions, capabilities, where):
    require(isinstance(actions, list) and 1 <= len(actions) <= 12,
            f"{where}: declare 1-12 actions")
    require(all(isinstance(action, str) for action in actions),
            f"{where}: action names must be strings")
    require(len(actions) == len(set(actions)), f"{where}: actions must be unique")
    for action in actions:
        require(action in ACTION_CAPABILITIES and
                ACTION_CAPABILITIES[action] in capabilities,
                f"{where}: action is unknown or lacks its declared capability")


def validate_operational(operational):
    fields(operational, {"capabilities", "surfaces", "workflows", "modes"},
           "operational")
    capabilities = operational["capabilities"]
    require(isinstance(capabilities, list) and 1 <= len(capabilities) <= 4 and
            all(isinstance(item, str) for item in capabilities) and
            len(capabilities) == len(set(capabilities)) and
            set(capabilities) <= CAPABILITIES,
            "operational.capabilities: declare unique supported capabilities")
    surfaces = operational["surfaces"]
    require(isinstance(surfaces, list) and 1 <= len(surfaces) <= 12,
            "operational.surfaces: declare 1-12 surfaces")
    surface_ids = set()
    for surface in surfaces:
        optional_fields(surface, {"id", "layout", "rail_state", "start_surface"},
                        {"rail_modules", "design"}, "Surface")
        safe_id(surface["id"], "Surface.id")
        require(surface["id"] not in surface_ids, "Surface.id must be unique")
        surface_ids.add(surface["id"])
        require(surface["layout"] in ("one", "dual", "tri", "quad"),
                "Surface.layout is unsupported")
        require(surface["rail_state"] in ("icons", "expanded", "hidden"),
                "Surface.rail_state is unsupported")
        require(surface["start_surface"] in ("launchpad", "mission", "commands", "modes"),
                "Surface.start_surface is unsupported")
        require("workspace-layout" in capabilities,
                "Surface requires the workspace-layout capability, including one pane")
        if "rail_modules" in surface:
            modules = surface["rail_modules"]
            require(isinstance(modules, list) and 1 <= len(modules) <= 5 and
                    all(isinstance(item, str) for item in modules) and
                    len(set(modules)) == len(modules) and set(modules) <= {
                        "tabs", "saved-workspaces", "bookmarks", "history", "downloads",
                        "mission", "local-oi", "command-center", "guard"},
                    "Surface.rail_modules: declare 1-5 unique native module names")
        modules = surface.get("rail_modules", [])
        require((surface["start_surface"] != "mission" and "mission" not in modules)
                or "mission-checklist" in capabilities,
                "Mission surface requires the mission-checklist capability")
        require("guard" not in modules or "guard-control" in capabilities,
                "Guard rail module requires the guard-control capability")
        if "design" in surface:
            validate_surface_design(surface["design"],
                                    ("one", "dual", "tri", "quad").index(surface["layout"]) + 1)
    workflows = operational["workflows"]
    require(isinstance(workflows, list) and 1 <= len(workflows) <= 24,
            "operational.workflows: declare 1-24 workflows")
    workflow_ids = set()
    for workflow in workflows:
        optional_fields(workflow, {"id", "name", "steps"}, {"inputs", "outputs", "variables", "repeats", "compensation_steps"}, "Workflow")
        safe_id(workflow["id"], "Workflow.id")
        safe_metadata(workflow["name"], "Workflow.name")
        require(workflow["id"] not in workflow_ids, "Workflow.id must be unique")
        workflow_ids.add(workflow["id"])
        inputs = workflow.get("inputs", [])
        require(isinstance(inputs, list) and len(inputs) <= 12,
                "Workflow.inputs: expected at most twelve local inputs")
        input_by_id = {}
        variables = workflow.get("variables", [])
        require(isinstance(variables, list) and len(variables) <= 12,
                "Workflow.variables: expected at most twelve typed variables")
        for variable in variables:
            optional_fields(variable, {"id", "name", "type"}, {"options", "validation", "protected"}, "Workflow variable")
        variable_by_id = {}
        for item, registry in ([(item, input_by_id) for item in inputs] +
                               [(dict(item, required=False), variable_by_id) for item in variables]):
            optional_fields(item, {"id", "name", "type", "required"}, {"options", "protected", "validation"},
                            "Workflow input")
            safe_id(item["id"], "Workflow input.id")
            safe_metadata(item["name"], "Workflow input.name")
            require(item["id"] not in registry and
                    item["type"] in ("text", "number", "boolean", "selection", "date", "url") and
                    type(item["required"]) is bool and
                    type(item.get("protected", False)) is bool, "Invalid workflow input")
            if "validation" in item:
                rules = item["validation"]
                length = item["type"] in ("text", "url")
                allowed = {"min_bytes", "max_bytes"} if length else (
                    {"minimum", "maximum"} if item["type"] == "number" else set())
                require(isinstance(rules, dict) and bool(rules) and set(rules) <= allowed,
                        "Validation must contain only limits for this input type")
                if length:
                    require(all(type(n) is int for n in rules.values()) and
                            0 <= rules.get("min_bytes", 0) <= rules.get("max_bytes", 256) <= 256 and
                            rules.get("max_bytes", 256) >= 1, "Invalid UTF-8 byte limits")
                else:
                    require(all(type(n) in (int, float) and -1e12 <= n <= 1e12
                                for n in rules.values()) and
                            rules.get("minimum", -1e12) <= rules.get("maximum", 1e12),
                            "Invalid finite numeric limits")
            if item["type"] == "selection":
                options = item.get("options")
                require(isinstance(options, list) and 1 <= len(options) <= 12,
                        "Selection input must declare 1-12 options")
                for option in options:
                    safe_metadata(option, "Selection option")
                    require(":" not in option and "@" not in option,
                            "Selection options cannot contain origins or contact addresses")
                require(len(options) == len(set(options)), "Duplicate selection option")
            else:
                require("options" not in item, "Only selection inputs accept options")
            registry[item["id"]] = item
        def binding_source(binding):
            require(isinstance(binding, dict) and set(binding) in ({"input"}, {"variable"}),
                    "A binding must name exactly one input or variable")
            key = next(iter(binding))
            safe_id(binding[key], "Binding source")
            source = (variable_by_id if key == "variable" else input_by_id).get(binding[key])
            require(source is not None, "Binding must reference a declared input or variable")
            return source
        def validate_expression(expression):
            count = 0
            arities = {"add": 2, "subtract": 2, "multiply": 2, "divide": 2,
                       "min": 2, "max": 2, "abs": 1, "negate": 1}
            def visit(node, depth):
                nonlocal count
                count += 1
                require(depth <= 5 and count <= 31 and isinstance(node, dict),
                        "Numeric expressions allow at most 31 nodes and five levels")
                if set(node) == {"number"}:
                    require(type(node["number"]) in (int, float) and -1e12 <= node["number"] <= 1e12,
                            "Expression constants must be finite numbers within +/-1e12")
                elif set(node) in ({"input"}, {"variable"}):
                    origin = binding_source(node)
                    require(origin["type"] == "number" and not origin.get("protected", False),
                            "Calculations require ordinary numeric sources")
                else:
                    fields(node, {"op", "args"}, "Calculation operation")
                    require(isinstance(node["op"], str) and node["op"] in arities and
                            isinstance(node["args"], list) and len(node["args"]) == arities[node["op"]],
                            "Use a supported calculation operation and exact argument count")
                    for argument in node["args"]:
                        visit(argument, depth + 1)
            visit(expression, 1)
        def validate_text_expression(expression):
            count = 0
            arities = {"concat": 2, "trim-space": 1, "lower-ascii": 1, "upper-ascii": 1, "replace": 3}
            def visit(node, depth):
                nonlocal count
                count += 1
                require(depth <= 5 and count <= 31 and isinstance(node, dict), "Text expressions allow at most 31 nodes and five levels")
                if set(node) == {"text"}:
                    text = node["text"]
                    require(isinstance(text, str) and all(32 <= ord(c) != 127 and not 0xd800 <= ord(c) <= 0xdfff and not 0xfdd0 <= ord(c) <= 0xfdef and (ord(c) & 0xffff) < 0xfffe for c in text), "Text constants must be valid Unicode without control characters or noncharacters")
                    require(len(text.encode("utf-8")) <= 256, "Text constants are at most 256 UTF-8 bytes")
                elif set(node) in ({"input"}, {"variable"}):
                    origin = binding_source(node)
                    require(origin["type"] == "text" and not origin.get("protected", False), "Text expressions require ordinary text sources")
                else:
                    fields(node, {"op", "args"}, "Text operation")
                    require(isinstance(node["op"], str) and node["op"] in arities and isinstance(node["args"], list) and len(node["args"]) == arities[node["op"]], "Use a supported text operation and exact argument count")
                    for child in node["args"]:
                        visit(child, depth + 1)
            visit(expression, 1)
        def validate_condition(condition):
            count = 0
            def visit(node, depth):
                nonlocal count
                count += 1
                require(depth <= 5 and count <= 31 and isinstance(node, dict),
                        "Condition trees allow at most 31 nodes and five levels")
                if any(key in node for key in ("all", "any", "not")):
                    require(len(node) == 1, "Compound condition has exactly one operator")
                    op = next(iter(node))
                    if op == "not":
                        visit(node[op], depth + 1)
                    else:
                        require(op in ("all", "any") and isinstance(node[op], list) and 2 <= len(node[op]) <= 8,
                                "All/any conditions require two to eight children")
                        for child in node[op]: visit(child, depth + 1)
                    return
                require(set(node) in ({"input", "equals"}, {"input", "compare"}, {"variable", "equals"}, {"variable", "compare"}),
                        "Condition leaf must select one input or variable and one equality or numeric comparison")
                key = "variable" if "variable" in node else "input"
                require(isinstance(node[key], str), "Invalid condition source")
                item = (variable_by_id if key == "variable" else input_by_id).get(node[key])
                require(item is not None and not item.get("protected", False), "Condition requires an ordinary declared source")
                if "compare" in node:
                    compare = node["compare"]
                    fields(compare, {"op", "number"}, "Numeric condition")
                    require(item["type"] == "number" and isinstance(compare["op"], str) and
                            compare["op"] in ("equal", "not-equal", "less-than", "at-most", "greater-than", "at-least") and
                            type(compare["number"]) in (int, float) and -1e12 <= compare["number"] <= 1e12,
                            "Use an ordinary numeric source, supported comparison and finite constant within +/-1e12")
                else:
                    require(isinstance(node["equals"], str) and (
                        item["type"] == "boolean" and node["equals"] in ("true", "false") or
                        item["type"] == "selection" and node["equals"] in item["options"]),
                        "Condition equality must compare a declared boolean or selection source")
            visit(condition, 1)
        outputs = workflow.get("outputs", [])
        require(isinstance(outputs, list) and len(outputs) <= 12,
                "Workflow.outputs: expected at most twelve named results")
        output_ids = set()
        for output in outputs:
            fields(output, {"id", "name", "from"}, "Workflow output")
            safe_id(output["id"], "Workflow output.id")
            safe_metadata(output["name"], "Workflow output.name")
            binding_source(output["from"])
            require(output["id"] not in output_ids, "Output IDs must be unique")
            output_ids.add(output["id"])
        compensation_steps = workflow.get("compensation_steps", [])
        require(isinstance(compensation_steps, list) and
                ("compensation_steps" not in workflow or 1 <= len(compensation_steps) <= 8),
                "Workflow.compensation_steps: declare 1-8 manual recovery reviews when present")
        compensation_ids = set()
        for step in compensation_steps:
            fields(step, {"id", "name"}, "Workflow compensation step")
            safe_id(step["id"], "Workflow compensation step.id")
            safe_metadata(step["name"], "Workflow compensation step.name")
            require(step["id"] not in compensation_ids,
                    "Workflow compensation step IDs must be unique")
            compensation_ids.add(step["id"])
        steps = workflow["steps"]
        require(isinstance(steps, list) and 1 <= len(steps) <= 32,
                "Workflow.steps: declare 1-32 steps")
        step_ids = set()
        for step_index, step in enumerate(steps):
            require(isinstance(step, dict), "Workflow step must be an object")
            optional_fields(step, {"id", "name", "kind", "action"}
                            if step.get("kind") == "run-command" else
                            {"id", "name", "kind", "assign"} if step.get("kind") == "assign-variable" else
                            {"id", "name", "kind", "wait"} if step.get("kind") == "wait" else
                            {"id", "name", "kind"},
                            {"when"}, "Workflow step")
            safe_id(step["id"], "Workflow step.id")
            safe_metadata(step["name"], "Workflow step.name")
            require(step["id"] not in step_ids, "Workflow step.id must be unique")
            step_ids.add(step["id"])
            require(step["kind"] in ("instruction", "checkpoint", "run-command", "assign-variable", "wait"),
                    "Workflow step.kind is unsupported")
            if step["kind"] == "wait":
                optional_fields(step["wait"], {"seconds"}, {"timeout_seconds"}, "Workflow wait")
                require(type(step["wait"]["seconds"]) is int and
                        1 <= step["wait"]["seconds"] <= 86400,
                        "Workflow wait.seconds must be an integer from 1 to 86400")
                if "timeout_seconds" in step["wait"]:
                    require(type(step["wait"]["timeout_seconds"]) is int and
                            step["wait"]["seconds"] < step["wait"]["timeout_seconds"] <= 86400,
                            "Workflow wait.timeout_seconds must be greater than seconds and at most 86400")
            if step["kind"] == "run-command":
                validate_actions([step["action"]], capabilities, "Workflow step.action")
            if step["kind"] == "assign-variable":
                require(isinstance(step["assign"], dict), "Workflow assignment must be an object")
                fields(step["assign"], {"variable", "boolean_expression"} if "boolean_expression" in step["assign"] else {"variable", "text_expression"} if "text_expression" in step["assign"] else {"variable", "expression"} if "expression" in step["assign"]
                       else {"variable", "from"}, "Workflow assignment")
                safe_id(step["assign"]["variable"], "Assignment variable")
                target = variable_by_id.get(step["assign"]["variable"])
                if "boolean_expression" in step["assign"]:
                    require(target is not None and target["type"] == "boolean" and not target.get("protected", False), "Boolean expressions require an ordinary boolean destination")
                    validate_condition(step["assign"]["boolean_expression"])
                elif "text_expression" in step["assign"]:
                    require(target is not None and target["type"] == "text" and not target.get("protected", False), "Text expressions require an ordinary text destination")
                    validate_text_expression(step["assign"]["text_expression"])
                elif "expression" in step["assign"]:
                    require(target is not None and target["type"] == "number" and not target.get("protected", False), "Calculations require an ordinary numeric destination variable")
                    validate_expression(step["assign"]["expression"])
                elif isinstance(step["assign"].get("from"), dict) and "action_status" in step["assign"]["from"]:
                    fields(step["assign"]["from"], {"action_status"}, "Action status binding")
                    source_id = step["assign"]["from"]["action_status"]
                    safe_id(source_id, "Action status source")
                    require(target is not None and target["type"] in ("text", "selection") and not target.get("protected", False),
                            "Action status requires an ordinary text or selection variable")
                    require(any(item["id"] == source_id and item["kind"] == "run-command" for item in steps[:step_index]),
                            "Action status must refer to a preceding native action")
                else:
                    origin = binding_source(step["assign"]["from"])
                    require(target is not None and (not origin.get("protected", False) or target.get("protected", False)) and
                            target["type"] == origin["type"],
                            "Assignments require a same-type source; protected sources require a protected destination")
            if "when" in step:
                validate_condition(step["when"])
        repeats = workflow.get("repeats", [])
        require(isinstance(repeats, list) and len(repeats) <= 8, "Workflow.repeats: at most eight bounded ranges")
        positions = {step["id"]: i for i, step in enumerate(steps)}
        repeat_ids, claimed, expanded_ids = set(), set(), set()
        expanded_size = len(steps)
        for repeat in repeats:
            fields(repeat, {"id", "from", "through", "count"}, "Workflow repeat")
            for key in ("id", "from", "through"):
                safe_id(repeat[key], "Repeat." + key)
            require(repeat["id"] not in repeat_ids, "Repeat IDs must be unique")
            repeat_ids.add(repeat["id"])
            require(type(repeat["count"]) is int and 2 <= repeat["count"] <= 8, "Repeat.count: integer from 2 to 8")
            first, last = positions.get(repeat["from"], -1), positions.get(repeat["through"], -1)
            require(first >= 0 and last >= first, "Repeat range must reference ordered steps")
            selected = set(range(first, last + 1))
            require(not claimed.intersection(selected), "Repeat ranges cannot overlap or nest")
            claimed.update(selected)
            expanded_size += len(selected) * (repeat["count"] - 1)
            require(expanded_size <= 32, "Expanded workflow exceeds 32 steps")
            for iteration in range(1, repeat["count"] + 1):
                for step in steps[first:last + 1]:
                    expanded_id = f'r-{repeat["id"]}-{iteration}-{step["id"]}'
                    safe_id(expanded_id, "Expanded step.id")
                    safe_metadata(f'[{iteration}/{repeat["count"]}] {step["name"]}', "Expanded step.name")
                    require(expanded_id not in step_ids and expanded_id not in expanded_ids, "Expanded step IDs must not collide")
                    expanded_ids.add(expanded_id)
    modes = operational["modes"]
    require(isinstance(modes, list) and 1 <= len(modes) <= 12,
            "operational.modes: declare 1-12 modes")
    mode_ids = set()
    for mode in modes:
        fields(mode, {"id", "name", "surface", "workflow", "actions"}, "Mode")
        safe_id(mode["id"], "Mode.id")
        safe_metadata(mode["name"], "Mode.name")
        require(mode["id"] not in mode_ids, "Mode.id must be unique")
        mode_ids.add(mode["id"])
        require(mode["surface"] in surface_ids and mode["workflow"] in workflow_ids,
                "Mode must reference a surface and workflow in this manifest")
        require("mission-checklist" in capabilities,
                "Mode workflow requires the mission-checklist capability")
        validate_actions(mode["actions"], capabilities, "Mode.actions")


def operational_signature_preimage(manifest_bytes):
    require(len(manifest_bytes) <= 0xffffffff,
            "Generated manifest cannot be represented for signing")
    return (b"TAHAI-SKIN-SIGNATURE-V1\0" +
            struct.pack(">I", len(manifest_bytes)) + manifest_bytes)


def build(source, signing_key_id=None, signer=None):
    source = source.resolve(strict=True)
    manifest_path = source / "manifest.json"
    require(manifest_path.stat().st_size <= 65536, "Manifest exceeds 64 KiB")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"),
                          object_pairs_hook=unique_object)
    require(isinstance(manifest, dict) and type(manifest.get("schema_version")) is int,
            "schema_version must be an integer")
    schema_version = manifest["schema_version"]
    fields(manifest, {"schema_version", "id", "name", "creator", "license",
                      "compatibility", "appearance", "assets"} |
           ({"operational"} if schema_version == 2 else set()), "Manifest")
    require(schema_version in (1, 2), "schema_version must be 1 or 2")
    identity = manifest["id"]
    safe_id(identity, "id")
    for key in ("name", "creator", "license"):
        value = manifest[key]
        safe_metadata(value, key)
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
    if schema_version == 2:
        validate_operational(manifest["operational"])
    manifest_bytes = (json.dumps(manifest, indent=2) + "\n").encode()
    entries = {"manifest.json": manifest_bytes, **entries}
    require(len(entries["manifest.json"]) <= 65536, "Generated manifest exceeds 64 KiB")
    if signing_key_id is not None or signer is not None:
        require(schema_version == 2,
                "Only operational schema-version 2 packages may be signed")
        require(isinstance(signing_key_id, str) and
                re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?", signing_key_id),
                "Signing key ID: use a 1-64 character lowercase identifier")
        require(signer is not None, "A signer is required with a signing key ID")
        signature = signer(operational_signature_preimage(manifest_bytes))
        require(isinstance(signature, bytes) and len(signature) == 64,
                "Ed25519 signer must produce exactly 64 bytes")
        entries["META-INF/tahai-key-id"] = signing_key_id.encode("ascii")
        entries["META-INF/tahai-signature.ed25519"] = signature
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, data in entries.items():
            item = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            item.create_system = 0
            archive.writestr(item, data)
    require(len(output.getvalue()) <= 9 * 1024 * 1024, "Package exceeds 9 MiB")
    return output.getvalue()


def openssl_ed25519_signer(key_path, openssl):
    key_path = Path(key_path).resolve(strict=True)

    def sign(payload):
        with tempfile.TemporaryDirectory(prefix="tahai-skin-sign-") as directory:
            input_path = Path(directory) / "manifest-preimage.bin"
            signature_path = Path(directory) / "signature.bin"
            input_path.write_bytes(payload)
            result = subprocess.run(
                [openssl, "pkeyutl", "-sign", "-rawin", "-inkey",
                 str(key_path), "-in", str(input_path), "-out",
                 str(signature_path)],
                stdin=subprocess.DEVNULL, capture_output=True, check=False,
                timeout=30,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            require(result.returncode == 0 and signature_path.is_file(),
                    "OpenSSL could not create an Ed25519 signature")
            return signature_path.read_bytes()

    return sign


def python_ed25519_signer(key_path):
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
    except ImportError as error:
        raise ValueError("Python cryptography Ed25519 support is unavailable") from error
    key_path = Path(key_path).resolve(strict=True)
    require(0 < key_path.stat().st_size <= 16384,
            "Signing key PEM must be at most 16 KiB")
    try:
        key = load_pem_private_key(key_path.read_bytes(), password=None)
    except (ValueError, TypeError) as error:
        raise ValueError("Signing key must be an unencrypted Ed25519 private-key PEM") from error
    require(isinstance(key, Ed25519PrivateKey),
            "Signing key must be an Ed25519 private-key PEM")
    return key.sign


def make_ed25519_signer(key_path, backend, openssl):
    if backend == "python":
        return python_ed25519_signer(key_path)
    if backend == "openssl":
        return openssl_ed25519_signer(key_path, openssl)
    try:
        return python_ed25519_signer(key_path)
    except ValueError as error:
        if "cryptography Ed25519 support is unavailable" not in str(error):
            raise
        return openssl_ed25519_signer(key_path, openssl)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Folder containing manifest.json and assets")
    parser.add_argument("output", type=Path, nargs="?", help="New .tahaiskin output filename")
    parser.add_argument("--check", action="store_true", help="Check source without writing")
    parser.add_argument("--signing-key", type=Path,
                        help="Ed25519 private-key PEM used only to sign a v2 package")
    parser.add_argument("--signing-key-id",
                        help="Managed Ed25519 public-key identifier for a v2 package")
    parser.add_argument("--openssl", default="openssl",
                        help="OpenSSL executable used with --signing-key")
    parser.add_argument("--signer-backend", choices=("auto", "python", "openssl"),
                        default="auto",
                        help="Ed25519 signer backend; auto prefers Python cryptography")
    args = parser.parse_args()
    try:
        require((args.signing_key is None) == (args.signing_key_id is None),
                "Specify both --signing-key and --signing-key-id")
        signer = (make_ed25519_signer(args.signing_key, args.signer_backend,
                                      args.openssl)
                  if args.signing_key else None)
        data = build(args.source, args.signing_key_id, signer)
        if not args.check:
            require(args.output is not None and args.output.suffix == ".tahaiskin",
                    "Specify a new .tahaiskin output file, or use --check")
            # Exclusive creation protects an existing package or source asset.
            with args.output.open("xb") as output:
                output.write(data)
        print(f"{'Checked' if args.check else 'Built'}: {len(data)} bytes; SHA-256 {hashlib.sha256(data).hexdigest()}")
        print("Next: review the package in TAHAI's Skin packages manager before installing.")
    except (ValueError, OSError, subprocess.SubprocessError, zlib.error) as error:
        print(f"Skin build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
