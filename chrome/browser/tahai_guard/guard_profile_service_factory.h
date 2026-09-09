// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_GUARD_GUARD_PROFILE_SERVICE_FACTORY_H_
#define CHROME_BROWSER_TAHAI_GUARD_GUARD_PROFILE_SERVICE_FACTORY_H_

#include "base/no_destructor.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"

class Profile;

namespace tahai::guard {
class GuardProfileService;

class GuardProfileServiceFactory final : public ProfileKeyedServiceFactory {
 public:
  static GuardProfileService* GetForProfile(Profile* profile);
  static GuardProfileServiceFactory* GetInstance();

 private:
  friend base::NoDestructor<GuardProfileServiceFactory>;
  GuardProfileServiceFactory();
  ~GuardProfileServiceFactory() override;
  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
};
}  // namespace tahai::guard

#endif  // CHROME_BROWSER_TAHAI_GUARD_GUARD_PROFILE_SERVICE_FACTORY_H_
