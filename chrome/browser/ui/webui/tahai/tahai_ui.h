// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_UI_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_UI_H_

#include <memory>
#include <string>
#include <string_view>

#include "base/memory/raw_ptr.h"
#include "content/public/browser/url_data_source.h"
#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

class Profile;

namespace tahai {

class MissionService;
class ModeService;
class TahaiLocalOiService;

class TahaiPlaceholderSource : public content::URLDataSource {
 public:
  explicit TahaiPlaceholderSource(Profile* profile);
  TahaiPlaceholderSource(const TahaiPlaceholderSource&) = delete;
  TahaiPlaceholderSource& operator=(const TahaiPlaceholderSource&) = delete;
  ~TahaiPlaceholderSource() override;

  std::string GetSource() override;
  void StartDataRequest(const GURL& url,
                        const content::WebContents::Getter& wc_getter,
                        GotDataCallback callback) override;
  std::string GetMimeType(const GURL& url) override;
  std::string GetContentSecurityPolicy(
      network::mojom::CSPDirectiveName directive) override;

 private:
  // A single source serves the trusted chrome://tahai host. It selects a
  // surface from each request path so navigation order cannot change content.
  const std::string source_name_;
  const raw_ptr<Profile> profile_;
};

class TahaiUI : public content::WebUIController {
 public:
  TahaiUI(content::WebUI* web_ui,
          std::string_view surface,
          std::string_view title);
  TahaiUI(const TahaiUI&) = delete;
  TahaiUI& operator=(const TahaiUI&) = delete;
  ~TahaiUI() override;
};

class TahaiUIConfig : public content::WebUIConfig {
 public:
  TahaiUIConfig();
  TahaiUIConfig(const TahaiUIConfig&) = delete;
  TahaiUIConfig& operator=(const TahaiUIConfig&) = delete;
  ~TahaiUIConfig() override;

  // Off-the-record windows get their own memory-only Mission and mode state.
  // Local OI deliberately has no service there, so its page must render the
  // explicit unavailable state rather than read through the regular profile.
  bool IsWebUIEnabled(content::BrowserContext* browser_context) override;
  bool ShouldHandleURL(const GURL& url) override;

  std::unique_ptr<content::WebUIController> CreateWebUIController(
      content::WebUI* web_ui,
      const GURL& url) override;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_UI_H_
