// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SURFACE_EDITOR_HANDLER_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SURFACE_EDITOR_HANDLER_H_

#include <memory>

class Profile;
namespace content {
class WebUIMessageHandler;
}
namespace tahai {

// A separate, geometry-only Studio interface. It cannot execute a package,
// open tabs, navigate, install artwork, or grant operational capabilities.
std::unique_ptr<content::WebUIMessageHandler> CreateSurfaceEditorHandler(Profile* profile);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SURFACE_EDITOR_HANDLER_H_
