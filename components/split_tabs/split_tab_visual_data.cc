// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "components/split_tabs/split_tab_visual_data.h"

#include <algorithm>
#include <cmath>

namespace split_tabs {

SplitTabVisualData::SplitTabVisualData()
    : split_layout_(SplitTabLayout::kSideBySide) {}

SplitTabVisualData::SplitTabVisualData(SplitTabLayout split_layout)
    : split_layout_(split_layout) {}

SplitTabVisualData::SplitTabVisualData(SplitTabLayout split_layout,
                                       double split_ratio)
    : split_layout_(split_layout), split_ratio_(split_ratio) {}

SplitTabVisualData::~SplitTabVisualData() = default;

void SplitTabVisualData::set_tahai_grid_ratios(double row_ratio,
                                               double column_ratio) {
  const auto normalize = [](double ratio) {
    return std::isfinite(ratio) ? std::clamp(ratio, 0.1, 0.9) : 0.5;
  };
  tahai_row_ratio_ = normalize(row_ratio);
  tahai_column_ratio_ = normalize(column_ratio);
}

}  // namespace split_tabs
