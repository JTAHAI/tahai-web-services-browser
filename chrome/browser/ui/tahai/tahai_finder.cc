// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_finder.h"

#include <algorithm>
#include <map>
#include <memory>
#include <utility>

#include "base/functional/bind.h"
#include "base/i18n/case_conversion.h"
#include "base/no_destructor.h"
#include "base/notreached.h"
#include "base/strings/string_split.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/bind_post_task.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/grit/generated_resources.h"
#include "components/strings/grit/components_strings.h"
#include "content/public/browser/web_contents.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/base/mojom/dialog_button.mojom.h"
#include "ui/color/color_id.h"
#include "ui/events/keycodes/keyboard_codes.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/background.h"
#include "ui/views/controls/button/md_text_button.h"
#include "ui/views/controls/label.h"
#include "ui/views/controls/scroll_view.h"
#include "ui/views/controls/textfield/textfield.h"
#include "ui/views/controls/textfield/textfield_controller.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/view_class_properties.h"
#include "ui/views/widget/widget.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai {
DEFINE_ELEMENT_IDENTIFIER_VALUE(kFinderSearchElementId);
namespace {

constexpr size_t kMaxResults = 60;
struct Command {
  int id;
  std::u16string_view name;
  std::u16string_view keywords;
};
constexpr Command kCommands[] = {
    {IDC_FOCUS_LOCATION, u"Search or enter an address", u"address URL omnibox"},
    {IDC_TAB_SEARCH, u"Find a tab", u"search tabs"},
    {IDC_RESTORE_TAB, u"Reopen closed tab", u"undo recover restore"},
    {IDC_TAHAI_NAMED_WORKSPACES, u"Saved workspaces", u"save resume layout"},
    {IDC_TAHAI_GUARD_PANEL, u"Guard protection",
     u"ads trackers adblock blocking pause site"},
    {IDC_TAHAI_SKIN_MANAGER, u"Skin packages",
     u"appearance theme colors creator template"},
    {IDC_SHOW_DOWNLOADS, u"Downloads", u"download files"},
    {IDC_SHOW_HISTORY, u"History", u"recent pages"},
    {IDC_SHOW_BOOKMARK_MANAGER, u"Bookmarks", u"favorites saved pages"},
    {IDC_TASK_MANAGER, u"Task manager", u"memory CPU performance"},
    {IDC_OPTIONS, u"Settings", u"preferences privacy passwords accessibility"},
    {IDC_ZOOM_NORMAL, u"Reset page zoom", u"zoom size 100%"},
    {IDC_FIND, u"Find on this page", u"text search"},
    {IDC_NEW_TAB, u"New tab", u"open blank tab"},
};

bool Available(Browser* browser) {
  return browser && browser->is_type_normal() &&
         !browser->GetProfile()->IsGuestSession() &&
         !browser->GetProfile()->IsSystemProfile();
}

bool CanActivateItem(Browser* source, const FinderResult& result) {
  if (!Available(source)) {
    return false;
  }
  switch (result.kind) {
    case FinderResult::Kind::kCommand:
      return std::ranges::any_of(kCommands,
                                 [&](const auto& command) {
                                   return command.id == result.command_id;
                                 }) &&
             chrome::IsCommandEnabled(source, result.command_id);
    case FinderResult::Kind::kWorkspace:
      return NamedWorkspaceStore(source->GetProfile())
          .Find(result.workspace_id)
          .has_value();
    case FinderResult::Kind::kTab:
      return Available(result.browser.get()) && result.contents &&
             result.browser->GetProfile() == source->GetProfile() &&
             result.contents->GetBrowserContext() == source->GetProfile() &&
             result.browser->tab_strip_model()->GetIndexOfWebContents(
                 result.contents.get()) != TabStripModel::kNoTab;
  }
  return false;
}

bool Matches(std::u16string text, const std::vector<std::u16string>& terms) {
  text = base::i18n::ToLower(text);
  return std::ranges::all_of(terms, [&](const auto& term) {
    return text.find(term) != std::u16string::npos;
  });
}

class FinderView;
using Finders = std::map<Browser*, base::WeakPtr<FinderView>>;
Finders& OpenFinders() {
  static base::NoDestructor<Finders> finders;
  return *finders;
}

class FinderView final : public views::DialogDelegate,
                         public views::TextfieldController {
 public:
  explicit FinderView(Browser* browser)
      : browser_(browser->AsWeakPtr()), key_(browser) {
    SetTitle(l10n_util::GetStringUTF16(IDS_TAHAI_FINDER_TITLE));
    SetButtons(static_cast<int>(ui::mojom::DialogButton::kCancel));
    SetButtonLabel(ui::mojom::DialogButton::kCancel,
                   l10n_util::GetStringUTF16(IDS_CLOSE));
    SetShowCloseButton(true);
    SetCanResize(true);
    auto body = std::make_unique<views::View>();
    auto* layout = body->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(16), 10));
    body->SetPreferredSize(gfx::Size(680, 540));
    search_ = body->AddChildView(std::make_unique<views::Textfield>());
    search_->set_controller(this);
    search_->SetPlaceholderText(
        l10n_util::GetStringUTF16(IDS_TAHAI_FINDER_PROMPT));
    search_->GetViewAccessibility().SetName(
        l10n_util::GetStringUTF16(IDS_TAHAI_FINDER_PROMPT));
    search_->SetProperty(views::kElementIdentifierKey, kFinderSearchElementId);
    status_ = body->AddChildView(std::make_unique<views::Label>());
    status_->SetMultiLine(true);
    status_->SetHorizontalAlignment(gfx::ALIGN_LEFT);
    auto* scroll = body->AddChildView(std::make_unique<views::ScrollView>());
    layout->SetFlexForView(scroll, 1);
    rows_ = scroll->SetContents(std::make_unique<views::View>());
    rows_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(), 4));
    SetContentsView(std::move(body));
    SetInitiallyFocusedView(search_);
    Refresh();
  }

  ~FinderView() override {
    Detach();
    if (activation_) {
      std::move(activation_).Run();
    }
  }
  base::WeakPtr<FinderView> GetWeakPtr() { return weak_factory_.GetWeakPtr(); }
  void FocusSearch() {
    search_->RequestFocus();
    search_->SelectAll(false);
  }

  void ContentsChanged(views::Textfield* sender,
                       const std::u16string& text) override {
    Refresh();
  }

  bool HandleKeyEvent(views::Textfield* sender,
                      const ui::KeyEvent& event) override {
    if (event.type() != ui::EventType::kKeyPressed ||
        sender->IsIMEComposing() || event.IsAltDown() ||
        event.IsControlDown() || event.IsShiftDown()) {
      return false;
    }
    if (event.key_code() == ui::VKEY_RETURN && !results_.empty()) {
      Activate(selected_);
      return true;
    }
    if ((event.key_code() == ui::VKEY_UP ||
         event.key_code() == ui::VKEY_DOWN) &&
        !results_.empty()) {
      selected_ = event.key_code() == ui::VKEY_DOWN
                      ? (selected_ + 1) % results_.size()
                      : (selected_ + results_.size() - 1) % results_.size();
      MarkSelection(true);
      return true;
    }
    return false;
  }

 private:
  void WindowClosing() override {
    Detach();
    views::DialogDelegate::WindowClosing();
  }

  void Detach() {
    if (!key_) {
      return;
    }
    const auto found = OpenFinders().find(key_);
    if (found != OpenFinders().end() && found->second.get() == this) {
      OpenFinders().erase(found);
    }
    key_ = nullptr;
    weak_factory_.InvalidateWeakPtrs();
  }

  void Refresh() {
    results_ = FindBrowserItems(browser_.get(), search_->GetText());
    buttons_.clear();
    rows_->RemoveAllChildViews();
    selected_ = 0;
    for (size_t i = 0; i < results_.size(); ++i) {
      auto* button = rows_->AddChildView(std::make_unique<views::MdTextButton>(
          base::BindRepeating(&FinderView::Activate, weak_factory_.GetWeakPtr(),
                              i),
          results_[i].title + u"  |  " + results_[i].detail));
      button->SetHorizontalAlignment(gfx::ALIGN_LEFT);
      button->SetTooltipText(results_[i].title + u" — " + results_[i].detail);
      buttons_.push_back(button);
    }
    status_->SetText(l10n_util::GetStringUTF16(
        results_.empty()                 ? IDS_TAHAI_FINDER_EMPTY
        : results_.size() == kMaxResults ? IDS_TAHAI_FINDER_LIMIT
                                         : IDS_TAHAI_FINDER_HINT));
    MarkSelection(false);
  }

  void MarkSelection(bool announce) {
    for (size_t i = 0; i < buttons_.size(); ++i) {
      buttons_[i]->SetBackground(i == selected_
                                     ? views::CreateRoundedRectBackground(
                                           ui::kColorSysStateHoverOnSubtle, 6)
                                     : nullptr);
    }
    if (announce && selected_ < buttons_.size()) {
      buttons_[selected_]->ScrollViewToVisible();
      search_->GetViewAccessibility().AnnounceText(
          results_[selected_].title + u", " + results_[selected_].detail);
    }
  }

  void Activate(size_t index) {
    if (index >= results_.size() || !browser_) {
      return;
    }
    const auto result = results_[index];
    if (CanActivateItem(browser_.get(), result)) {
      // Dispatch after destruction, so native dialog teardown cannot steal
      // focus back from the destination. Revalidate again in that later task.
      activation_ = base::BindPostTaskToCurrentDefault(base::BindOnce(
          [](base::WeakPtr<Browser> browser, FinderResult selected) {
            if (browser) {
              ActivateFinderResult(browser.get(), selected);
            }
          },
          browser_, result));
      GetWidget()->Close();
    } else {
      Refresh();
      status_->SetText(l10n_util::GetStringUTF16(IDS_TAHAI_FINDER_STALE));
      status_->GetViewAccessibility().AnnounceText(
          std::u16string(status_->GetText()));
    }
  }

  const base::WeakPtr<Browser> browser_;
  // Identity-only map key; never dereferenced, including during window
  // teardown.
  raw_ptr<Browser> key_;
  raw_ptr<views::Textfield> search_ = nullptr;
  raw_ptr<views::Label> status_ = nullptr;
  raw_ptr<views::View> rows_ = nullptr;
  std::vector<raw_ptr<views::MdTextButton>> buttons_;
  std::vector<FinderResult> results_;
  base::OnceClosure activation_;
  size_t selected_ = 0;
  base::WeakPtrFactory<FinderView> weak_factory_{this};
};

}  // namespace

std::vector<FinderResult> FindBrowserItems(Browser* source,
                                           std::u16string_view query) {
  std::vector<FinderResult> results;
  if (!Available(source) || query.size() > 256) {
    return results;
  }
  const auto terms =
      base::SplitString(base::i18n::ToLower(query), u" \t\r\n",
                        base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);
  for (const auto& command : kCommands) {
    if (chrome::IsCommandEnabled(source, command.id) &&
        Matches(std::u16string(command.name) + u" " +
                    std::u16string(command.keywords),
                terms)) {
      results.push_back(
          {FinderResult::Kind::kCommand, std::u16string(command.name),
           l10n_util::GetStringUTF16(IDS_TAHAI_FINDER_COMMAND), command.id});
    }
  }
  // Saved workspaces are capped at 24 and remain local to regular profiles.
  if (auto workspaces = NamedWorkspaceStore(source->GetProfile()).Read()) {
    for (const auto& workspace : *workspaces) {
      if (Matches(base::UTF8ToUTF16(workspace.name), terms)) {
        FinderResult result{
            FinderResult::Kind::kWorkspace, base::UTF8ToUTF16(workspace.name),
            l10n_util::GetStringUTF16(IDS_TAHAI_FINDER_WORKSPACE)};
        result.workspace_id = workspace.id;
        results.push_back(std::move(result));
      }
    }
  }
  GlobalBrowserCollection::GetInstance()->ForEach(
      [&](BrowserWindowInterface* window) {
        Browser* browser = window->GetBrowserForMigrationOnly();
        if (!Available(browser) ||
            browser->GetProfile() != source->GetProfile()) {
          return true;
        }
        const auto* tabs = browser->tab_strip_model();
        for (int index = 0;
             index < tabs->count() && results.size() < kMaxResults; ++index) {
          auto* contents = tabs->GetWebContentsAt(index);
          const auto& url = contents->GetVisibleURL();
          const auto title = contents->GetTitle().empty()
                                 ? base::UTF8ToUTF16(url.spec())
                                 : contents->GetTitle();
          if (Matches(title + u" " + base::UTF8ToUTF16(url.spec()), terms)) {
            FinderResult result{
                FinderResult::Kind::kTab, title.substr(0, 200),
                l10n_util::GetStringUTF16(IDS_TAHAI_FINDER_TAB) + u" · " +
                    base::UTF8ToUTF16(url.host())};
            result.browser = browser->AsWeakPtr();
            result.contents = contents->GetWeakPtr();
            results.push_back(std::move(result));
          }
        }
        return results.size() < kMaxResults;
      },
      BrowserCollection::Order::kActivation);
  return results;
}

bool ActivateFinderResult(Browser* source, const FinderResult& result) {
  if (!Available(source)) {
    return false;
  }
  switch (result.kind) {
    case FinderResult::Kind::kCommand:
      return std::ranges::any_of(kCommands,
                                 [&](const auto& command) {
                                   return command.id == result.command_id;
                                 }) &&
             chrome::IsCommandEnabled(source, result.command_id) &&
             chrome::ExecuteCommand(source, result.command_id);
    case FinderResult::Kind::kWorkspace:
      return OpenNamedWorkspace(source, result.workspace_id) != nullptr;
    case FinderResult::Kind::kTab: {
      auto* browser = result.browser.get();
      auto* contents = result.contents.get();
      if (!Available(browser) || !contents ||
          browser->GetProfile() != source->GetProfile() ||
          contents->GetBrowserContext() != source->GetProfile()) {
        return false;
      }
      const int index =
          browser->tab_strip_model()->GetIndexOfWebContents(contents);
      if (index == TabStripModel::kNoTab) {
        return false;
      }
      browser->tab_strip_model()->ActivateTabAt(index);
      browser->GetWindow()->Activate();
      contents->Focus();
      return true;
    }
  }
  NOTREACHED();
}

void ShowFinder(Browser* browser) {
  if (!Available(browser)) {
    return;
  }
  auto& existing = OpenFinders()[browser];
  if (existing) {
    existing->GetWidget()->Activate();
    existing->FocusSearch();
    return;
  }
  auto* dialog = new FinderView(browser);
  existing = dialog->GetWeakPtr();
  auto* widget = views::DialogDelegate::CreateDialogWidget(
      dialog, browser->GetWindow()->GetNativeWindow(),
      browser->GetWindow()->GetNativeWindow());
  widget->Show();
}

}  // namespace tahai
