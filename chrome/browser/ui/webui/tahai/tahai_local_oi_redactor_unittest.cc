// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_redactor.h"

#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {

TEST(TahaiLocalOiRedactorTest, PreservesSafeLocalReportText) {
  const LocalOiRedactionResult result =
      RedactLocalOiExportText("Local-only Mission Health Summary");
  EXPECT_FALSE(result.blocked);
  EXPECT_EQ(0u, result.redaction_count);
  EXPECT_EQ("Local-only Mission Health Summary", result.text);
}

TEST(TahaiLocalOiRedactorTest, BlocksCredentialAndSessionMaterial) {
  for (const char* unsafe : {"Authorization: Bearer redacted", "cookie: value",
                             "refresh_token=value", "password=value"}) {
    const LocalOiRedactionResult result = RedactLocalOiExportText(unsafe);
    EXPECT_TRUE(result.blocked);
    EXPECT_GT(result.redaction_count, 0u);
    EXPECT_EQ("[Local OI export blocked: sensitive material was detected.]",
              result.text);
  }
}

}  // namespace tahai
