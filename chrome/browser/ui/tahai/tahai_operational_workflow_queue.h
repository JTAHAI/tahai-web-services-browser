// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_OPERATIONAL_WORKFLOW_QUEUE_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_OPERATIONAL_WORKFLOW_QUEUE_H_

#include <optional>
#include <string>
#include <string_view>

#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"

class Profile;

namespace tahai {

// This is a one-shot, profile-local handoff from native mode activation to
// Mission Control. It carries only a reviewed workflow's identity, revision,
// inert checklist labels, input definitions and local conditions. It never
// carries entered values, an action, origin, URL, page
// data, credential, package archive, or grant.
struct QueuedOperationalWorkflowLaunch {
  TahaiOperationalWorkflow workflow;
  std::string skin_id;
  std::string archive_sha256;
  // Versioned browser adapter metadata, never command authority. Version zero
  // keeps previously saved checklist-only handoffs inert.
  int adapter_version = 0;
};

bool QueueOperationalWorkflowLaunch(Profile* profile,
                                    const TahaiOperationalWorkflow& workflow,
                                    std::string_view skin_id,
                                    std::string_view archive_sha256);
std::optional<QueuedOperationalWorkflowLaunch> GetQueuedOperationalWorkflowLaunch(
    Profile* profile);
void ClearQueuedOperationalWorkflowLaunch(Profile* profile);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_OPERATIONAL_WORKFLOW_QUEUE_H_
