// Copyright 2026 TAHAI Web Services
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/installer/setup/brand_behaviors.h"

namespace installer {

// TAHAI does not depend on Google Update or transmit installation state.
void UpdateInstallStatus() {}

std::wstring GetDistributionData() {
  return std::wstring();
}

// TAHAI does not open a remote survey or transmit uninstall metadata.
void DoPostUninstallOperations(const base::Version& version,
                               const base::FilePath& local_data_path,
                               const std::wstring& distribution_data) {}

}  // namespace installer
