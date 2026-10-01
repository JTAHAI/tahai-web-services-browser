// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_WORKFLOW_NATIVE_HANDLER_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_WORKFLOW_NATIVE_HANDLER_H_

#include <cstddef>
#include <memory>
#include <optional>
#include <string>
#include <string_view>

#include "base/memory/weak_ptr.h"

class Profile;
namespace content { class WebUIMessageHandler; }
namespace tahai {
class MissionService;
struct MissionSummary;
struct TahaiOperationalSkinManifest;

// Pure resolution only. The caller must supply the *currently trusted* window
// manifest, pin its document/window, check policy, and journal before dispatch.
// Preferences carry IDs/checkpoint state, not symbolic action authority.
std::optional<int> ResolveMissionNativeCommand(
    const TahaiOperationalSkinManifest& manifest, std::string_view mode_id,
    std::string_view archive_sha256, const MissionSummary& mission, size_t index);

// Completion notifies preference observers. Never retain a raw owner or a
// borrowed mission ID across that notification; report only its surviving state.
std::string CompleteMissionNativeAttempt(base::WeakPtr<MissionService> service,
                                         std::string_view id, size_t index,
                                         std::string_view result);

std::unique_ptr<content::WebUIMessageHandler> CreateWorkflowNativeHandler(Profile* profile);
}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_WORKFLOW_NATIVE_HANDLER_H_
