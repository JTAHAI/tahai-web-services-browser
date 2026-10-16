// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_NATIVE_DIALOG_OWNER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_NATIVE_DIALOG_OWNER_H_

#include <memory>
#include <utility>

#include "base/location.h"
#include "base/scoped_observation.h"
#include "base/task/single_thread_task_runner.h"
#include "ui/gfx/native_ui_types.h"
#include "ui/views/widget/widget.h"
#include "ui/views/widget/widget_observer.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai {
namespace internal {

// The native widget owns its own lifetime, but does not own a plain
// DialogDelegate. Retain that delegate until Widget::DeleteDelegate() has run.
// Closing delegates must release their non-owning view references in
// WindowClosing(), before the native widget destroys the view hierarchy.
class NativeDialogOwner final : public views::WidgetObserver {
 public:
  explicit NativeDialogOwner(std::unique_ptr<views::DialogDelegate> delegate)
      : delegate_(std::move(delegate)) {}
  ~NativeDialogOwner() override = default;

  views::Widget* Create(gfx::NativeWindow parent) {
    auto* widget = views::DialogDelegate::CreateDialogWidget(
        delegate_.get(), parent, parent);
    observation_.Observe(widget);
    return widget;
  }

  void OnWidgetDestroyed(views::Widget* widget) override {
    observation_.Reset();
    // This notification precedes DeleteDelegate() in the same stack. Destroy
    // the owner on the next UI turn, after deletion of the delegate is legal.
    base::SingleThreadTaskRunner::GetCurrentDefault()->DeleteSoon(FROM_HERE, this);
  }

 private:
  std::unique_ptr<views::DialogDelegate> delegate_;
  base::ScopedObservation<views::Widget, views::WidgetObserver> observation_{this};
};

}  // namespace internal

inline views::Widget* CreateOwnedNativeDialog(
    std::unique_ptr<views::DialogDelegate> delegate,
    gfx::NativeWindow parent) {
  auto owner = std::make_unique<internal::NativeDialogOwner>(std::move(delegate));
  auto* widget = owner->Create(parent);
  // The observer's exactly-once destruction notification releases this owner.
  owner.release();
  return widget;
}

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_NATIVE_DIALOG_OWNER_H_
