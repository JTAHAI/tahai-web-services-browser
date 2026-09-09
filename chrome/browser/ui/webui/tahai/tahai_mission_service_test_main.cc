// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <memory>

#include "base/functional/bind.h"
#include "base/test/launcher/unit_test_launcher.h"
#include "base/test/test_io_thread.h"
#include "base/threading/platform_thread.h"
#include "chrome/browser/chrome_content_browser_client.h"
#include "chrome/common/chrome_content_client.h"
#include "chrome/install_static/test/scoped_install_details.h"
#include "chrome/test/base/chrome_unit_test_suite.h"
#include "chrome/utility/chrome_content_utility_client.h"
#include "content/public/test/unittest_test_suite.h"
#include "mojo/core/embedder/scoped_ipc_support.h"

namespace {

class TestChromeContentBrowserClient : public ChromeContentBrowserClient {
 public:
  void OnNetworkServiceCreated(
      network::mojom::NetworkService* network_service) override {}
};

std::unique_ptr<content::UnitTestTestSuite::ContentClients>
CreateContentClients() {
  auto clients = std::make_unique<content::UnitTestTestSuite::ContentClients>();
  clients->content_client = std::make_unique<ChromeContentClient>();
  clients->content_browser_client =
      std::make_unique<TestChromeContentBrowserClient>();
  clients->content_utility_client =
      std::make_unique<ChromeContentUtilityClient>();
  return clients;
}

}  // namespace

int main(int argc, char** argv) {
  base::PlatformThread::SetName("MainThread");
  content::UnitTestTestSuite test_suite(
      new ChromeUnitTestSuite(argc, argv),
      base::BindRepeating(CreateContentClients));
  base::TestIOThread test_io_thread(base::TestIOThread::kAutoStart);
  mojo::core::ScopedIPCSupport ipc_support(
      test_io_thread.task_runner(),
      mojo::core::ScopedIPCSupport::ShutdownPolicy::FAST);
  install_static::ScopedInstallDetails scoped_install_details;
  return base::LaunchUnitTests(
      argc, argv,
      base::BindOnce(&content::UnitTestTestSuite::Run,
                     base::Unretained(&test_suite)));
}
