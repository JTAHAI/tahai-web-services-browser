"""Deterministic, editable operational skin examples for the creator kit.

These are local browser workflows. External actions require a separately
reviewed integration and are never implied by a template or its artwork.
"""

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent

# The same six user-facing families as Studio's local workflow starters. Each
# package has its own mode, surface, input contract, steps and output bindings.
TEMPLATES = {
    "research": {
        "title": "Research Desk", "layout": "quad", "rail": "expanded",
        "modules": ["tabs", "mission", "local-oi"],
        "inputs": [{"id": "question", "name": "Research question", "type": "text", "required": True}],
        "steps": [
            {"id": "scope", "name": "Review the research question", "kind": "checkpoint"},
            {"id": "sources", "name": "Review chosen sources in browser tabs", "kind": "instruction"},
            {"id": "compare", "name": "Compare findings and note uncertainty", "kind": "checkpoint"},
            {"id": "brief", "name": "Review a brief before separate export", "kind": "checkpoint"},
        ],
        "outputs": [{"id": "question-result", "name": "Research question", "from": {"input": "question"}}],
        "walkthrough": "Enter a question, review independent sources in live browser panes, record uncertainty, then confirm the local brief. Selection capture and export require separate reviewed actions.",
    },
    "creator": {
        "title": "Creator Studio", "layout": "tri", "rail": "expanded",
        "modules": ["tabs", "mission", "downloads"],
        "inputs": [
            {"id": "brief", "name": "Creative brief", "type": "text", "required": True},
            {"id": "publish", "name": "Plan a separate publishing review", "type": "boolean", "required": True},
        ],
        "steps": [
            {"id": "assets", "name": "Gather references and review usage rights", "kind": "instruction"},
            {"id": "create", "name": "Create work in the chosen editor", "kind": "checkpoint"},
            {"id": "review", "name": "Review quality and privacy before sharing", "kind": "checkpoint"},
            {"id": "publish-review", "name": "Review publishing on the chosen site", "kind": "instruction", "when": {"input": "publish", "equals": "true"}},
        ],
        "outputs": [{"id": "brief-result", "name": "Creative brief", "from": {"input": "brief"}}],
        "walkthrough": "Enter a brief, review assets and rights, work in a normal website or native editor, and confirm the result. Publishing remains a separate action on the chosen service.",
    },
    "planning": {
        "title": "Personal Planning", "layout": "dual", "rail": "icons",
        "modules": ["tabs", "mission", "bookmarks"],
        "inputs": [
            {"id": "priority", "name": "Main priority", "type": "text", "required": True},
            {"id": "horizon", "name": "Planning horizon", "type": "selection", "required": True, "options": ["Today", "This week"]},
        ],
        "steps": [
            {"id": "collect", "name": "Collect priorities without secrets", "kind": "checkpoint"},
            {"id": "compare", "name": "Compare commitments and time", "kind": "instruction"},
            {"id": "plan", "name": "Record the plan in a chosen tool", "kind": "checkpoint"},
            {"id": "follow-up", "name": "Record a follow-up", "kind": "checkpoint"},
        ],
        "outputs": [{"id": "priority-result", "name": "Priority", "from": {"input": "priority"}}],
        "walkthrough": "Select a horizon, set a priority, compare commitments in normal browser tabs, and check off a local follow-up. No calendar or task account is read.",
    },
    "learning": {
        "title": "Learning Space", "layout": "dual", "rail": "expanded",
        "modules": ["tabs", "mission", "bookmarks"],
        "inputs": [
            {"id": "lesson", "name": "Lesson topic", "type": "text", "required": True},
            {"id": "extra-practice", "name": "Include extra practice", "type": "boolean", "required": True},
        ],
        "steps": [
            {"id": "choose", "name": "Choose a lesson and objective", "kind": "checkpoint"},
            {"id": "practice", "name": "Practice on the chosen learning site", "kind": "instruction"},
            {"id": "extra", "name": "Complete an additional exercise", "kind": "instruction", "when": {"input": "extra-practice", "equals": "true"}},
            {"id": "review", "name": "Review progress and the next topic", "kind": "checkpoint"},
        ],
        "outputs": [{"id": "lesson-result", "name": "Lesson topic", "from": {"input": "lesson"}}],
        "walkthrough": "Choose a lesson, practice in live browser tabs, optionally complete extra practice, and review progress locally. The workflow does not read a course account.",
    },
    "operations": {
        "title": "Operations Console", "layout": "quad", "rail": "expanded",
        "modules": ["tabs", "mission", "guard", "local-oi"],
        "inputs": [{"id": "scope", "name": "Work scope without secrets", "type": "text", "required": True}],
        "steps": [
            {"id": "scope-review", "name": "Confirm scope and authorization", "kind": "checkpoint"},
            {"id": "inspect", "name": "Inspect the chosen system and documentation", "kind": "instruction"},
            {"id": "validate", "name": "Validate outcome and recovery options", "kind": "checkpoint"},
            {"id": "handoff", "name": "Prepare a redacted handoff", "kind": "checkpoint"},
        ],
        "outputs": [{"id": "scope-result", "name": "Reviewed scope", "from": {"input": "scope"}}],
        "walkthrough": "Confirm scope, inspect authorized systems in live panes, validate the outcome, and prepare a separately reviewed handoff. The template starts no diagnostic or remote write.",
    },
    "focus": {
        "title": "Blank Accessible Focus", "layout": "one", "rail": "icons",
        "modules": ["tabs", "mission"],
        "inputs": [],
        "steps": [{"id": "focus", "name": "Choose one task and review completion", "kind": "checkpoint"}],
        "outputs": [],
        "walkthrough": "Start from one browser pane, choose a task, and edit the local checklist. Keyboard access and browser recovery controls remain available.",
    },
}


def source_manifest(name):
    template = TEMPLATES[name]
    manifest = json.loads((ROOT / "operational-starter-skin" / "manifest.json").read_text(encoding="utf-8"))
    manifest["id"] = f"tahai-{name}-template"
    manifest["name"] = template["title"]
    manifest["creator"] = "TAHAI Browser"
    manifest["operational"] = {
        "capabilities": ["workspace-layout", "mission-checklist"] + (["guard-control"] if name == "operations" else []),
        "surfaces": [{
            "id": f"{name}-surface", "layout": template["layout"],
            "rail_state": template["rail"], "start_surface": "mission",
            "rail_modules": template["modules"],
        }],
        "workflows": [{
            "id": f"{name}-workflow", "name": template["title"],
            "inputs": template["inputs"], "steps": template["steps"],
            "outputs": template["outputs"],
        }],
        "modes": [{
            "id": f"{name}-mode", "name": template["title"],
            "surface": f"{name}-surface", "workflow": f"{name}-workflow",
            "actions": ["mission.open"],
        }],
    }
    return manifest


def readme(name):
    template = TEMPLATES[name]
    return (f"# {template['title']}\n\n{template['walkthrough']}\n\n"
            "This is editable source for a local operational skin. Review and change "
            "the manifest before signing or installing it. Its included preview "
            "image is shared starter artwork, not a screenshot of runtime behavior. "
            "Import, trust, activation, credential grants, and external actions "
            "remain separate decisions.\n").encode("utf-8")
