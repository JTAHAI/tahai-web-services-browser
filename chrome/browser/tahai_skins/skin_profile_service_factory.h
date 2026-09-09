// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_FACTORY_H_
#define CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_FACTORY_H_

#include "base/no_destructor.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"

class Profile;

namespace tahai::skins {
class SkinProfileService;

class SkinProfileServiceFactory final : public ProfileKeyedServiceFactory {
 public:
  static SkinProfileService* GetForProfile(Profile* profile);
  static SkinProfileServiceFactory* GetInstance();

 private:
  friend base::NoDestructor<SkinProfileServiceFactory>;
  SkinProfileServiceFactory();
  ~SkinProfileServiceFactory() override;
  bool ServiceIsCreatedWithBrowserContext() const override;
  bool ServiceIsNULLWhileTesting() const override;
  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
};
}  // namespace tahai::skins

#endif  // CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_FACTORY_H_
