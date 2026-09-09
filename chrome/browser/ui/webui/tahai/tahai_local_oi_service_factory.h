// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_SERVICE_FACTORY_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_SERVICE_FACTORY_H_

#include <memory>

#include "base/no_destructor.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"

class KeyedService;
class Profile;

namespace content {
class BrowserContext;
}

namespace tahai {

class TahaiLocalOiService;

// Local OI is never redirected from incognito and is never created for Guest,
// system, or Ash-internal profiles. This makes the durable store's scope match
// one original regular browser profile exactly.
class TahaiLocalOiServiceFactory : public ProfileKeyedServiceFactory {
 public:
  static TahaiLocalOiService* GetForProfile(Profile* profile);
  static TahaiLocalOiServiceFactory* GetInstance();

  TahaiLocalOiServiceFactory(const TahaiLocalOiServiceFactory&) = delete;
  TahaiLocalOiServiceFactory& operator=(const TahaiLocalOiServiceFactory&) =
      delete;

 private:
  friend base::NoDestructor<TahaiLocalOiServiceFactory>;

  TahaiLocalOiServiceFactory();
  ~TahaiLocalOiServiceFactory() override;

  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_SERVICE_FACTORY_H_
