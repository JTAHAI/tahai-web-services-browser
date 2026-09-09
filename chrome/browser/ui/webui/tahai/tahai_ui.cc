// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_ui.h"

#include <array>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/check.h"
#include "base/functional/bind.h"
#include "base/json/json_writer.h"
#include "base/memory/ref_counted.h"
#include "base/memory/ref_counted_memory.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/escape.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "base/values.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_manager.h"
#include "chrome/browser/tahai_guard/guard_profile_service.h"
#include "chrome/browser/tahai_guard/guard_profile_service_factory.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration_registry.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_environment_guard_registry.h"
#include "chrome/browser/ui/tahai/tahai_identity_lane.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_change_lens_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_environment_guard.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_model.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_policy.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service_factory.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_capsule.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_network_inspector.h"
#include "chrome/browser/ui/webui/tahai/tahai_oi_promotion_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_recall_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_envelope.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_key_service.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/grit/chrome_unscaled_resources.h"
#include "components/prefs/pref_service.h"
#include "components/version_info/version_info.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/url_data_source.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_message_handler.h"
#include "content/public/common/url_constants.h"
#include "services/network/public/mojom/content_security_policy.mojom-shared.h"
#include "ui/base/clipboard/clipboard_buffer.h"
#include "ui/base/clipboard/scoped_clipboard_writer.h"
#include "ui/base/resource/resource_bundle.h"
#include "url/gurl.h"

namespace tahai {
namespace {

Browser* FindBrowserForWebContents(content::WebContents* web_contents) {
  BrowserWindowInterface* browser_window =
      GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(web_contents);
  return browser_window ? browser_window->GetBrowserForMigrationOnly()
                        : nullptr;
}

constexpr char kNewTabSurface[] = "newtab";
constexpr char kMissionSurface[] = "mission";
constexpr char kOpsToolsSurface[] = "ops-tools";
constexpr char kProfilesSurface[] = "profiles";
constexpr char kSupportSurface[] = "support";
constexpr char kPolicySurface[] = "policy";
constexpr char kModesSurface[] = "modes";
constexpr char kLocalOiSurface[] = "local-oi";
constexpr char kNewTabTitle[] = "TAHAI New Tab";
constexpr char kMissionTitle[] = "Mission Control";
constexpr char kOpsToolsTitle[] = "Operations Tools";
constexpr char kProfilesTitle[] = "TAHAI Profiles";
constexpr char kSupportTitle[] = "TAHAI Support";
constexpr char kPolicyTitle[] = "TAHAI Policy";
constexpr char kModesTitle[] = "TAHAI Work Modes";
constexpr char kLocalOiTitle[] = "TAHAI Local OI";

struct TahaiSurfaceDefinition {
  std::string_view surface;
  std::string_view title;
};

// The native recipe library deliberately contains only reviewable, fixed HTTPS
// destinations. A recipe identifier is the only renderer-controlled value; it
// is resolved here before any tabs are opened. No recipe accepts URLs, query
// parameters, credentials, scripts, files, or connector configuration.
struct RecipeDefinition {
  std::string_view id;
  std::string_view label;
  std::string_view mission_type;
  std::array<std::string_view, 4> urls;
};

constexpr std::array<RecipeDefinition, 10> kRecipeLibrary = {{
    {"dns-migration",
     "DNS Migration",
     "migration",
     {"https://dash.cloudflare.com/", "https://www.whatsmydns.net/",
      "https://www.iana.org/whois", "https://developers.cloudflare.com/dns/"}},
    {"m365-user-offboarding",
     "Microsoft 365 User Offboarding",
     "admin",
     {"https://admin.microsoft.com/", "https://entra.microsoft.com/",
      "https://security.microsoft.com/",
      "https://learn.microsoft.com/microsoft-365/admin/add-users/"
      "remove-former-employee"}},
    {"firewall-change",
     "Firewall Change",
     "admin",
     {"https://support.fortinet.com/", "https://support.paloaltonetworks.com/",
      "https://www.cisco.com/c/en/us/support/index.html",
      "https://www.cisa.gov/topics/cyber-threats-and-advisories"}},
    {"production-deployment",
     "Production Deployment",
     "deployment",
     {"https://github.com/", "https://vercel.com/dashboard",
      "https://www.vercel-status.com/", "https://docs.github.com/actions"}},
    {"certificate-renewal",
     "Certificate Renewal",
     "migration",
     {"https://dash.cloudflare.com/", "https://www.ssllabs.com/ssltest/",
      "https://crt.sh/", "https://developers.cloudflare.com/ssl/"}},
    {"incident-triage",
     "Incident Triage",
     "incident",
     {"https://www.cloudflarestatus.com/", "https://www.githubstatus.com/",
      "https://status.aws.amazon.com/",
      "https://www.cisa.gov/news-events/alerts"}},
    {"github-actions-release",
     "GitHub Actions Release",
     "deployment",
     {"https://github.com/", "https://www.githubstatus.com/",
      "https://docs.github.com/actions",
      "https://docs.github.com/actions/managing-workflow-runs"}},
    {"cloudflare-cutover",
     "Cloudflare Cutover",
     "migration",
     {"https://dash.cloudflare.com/", "https://www.cloudflarestatus.com/",
      "https://developers.cloudflare.com/", "https://www.whatsmydns.net/"}},
    {"workstation-admin-setup",
     "New Workstation / Admin Setup",
     "admin",
     {"https://admin.microsoft.com/", "https://entra.microsoft.com/",
      "https://learn.microsoft.com/mem/intune/",
      "https://learn.microsoft.com/windows/"}},
    {"vendor-support-handoff",
     "Vendor Support Handoff",
     "support",
     {"https://support.microsoft.com/", "https://support.cloudflare.com/",
      "https://support.github.com/", "https://www.cisa.gov/resources-tools"}},
}};

const RecipeDefinition* FindRecipe(std::string_view id) {
  for (const RecipeDefinition& recipe : kRecipeLibrary) {
    if (recipe.id == id) {
      return &recipe;
    }
  }
  return nullptr;
}

bool IsSafeRecipeUrl(const GURL& url) {
  return url.is_valid() && url.SchemeIs("https") && url.has_host() &&
         !url.has_username() && !url.has_password() && !url.has_ref();
}

bool LaunchRecipeWorkspace(Browser* browser, const RecipeDefinition& recipe) {
  if (!browser || !browser->is_type_normal()) {
    return false;
  }

  std::array<GURL, 4> urls;
  for (size_t index = 0; index < recipe.urls.size(); ++index) {
    urls[index] = GURL(recipe.urls[index]);
    if (!IsSafeRecipeUrl(urls[index])) {
      return false;
    }
  }

  TabStripModel* model = browser->tab_strip_model();
  std::vector<int> indices;
  indices.reserve(urls.size());
  for (const GURL& url : urls) {
    content::WebContents* contents =
        chrome::AddAndReturnTabAt(browser, url, -1, false);
    if (!contents) {
      return false;
    }
    const int index = model->GetIndexOfWebContents(contents);
    if (index == TabStripModel::kNoTab) {
      return false;
    }
    indices.push_back(index);
  }

  model->ActivateTabAt(indices.front());
  model->AddToNewTahaiQuad(std::move(indices));
  return chrome::IsTahaiQuadView(browser);
}

std::optional<TahaiSurfaceDefinition> GetSurfaceDefinition(const GURL& url) {
  if (url.path() == "/" || url.path() == "/newtab" ||
      url.path() == "/newtab/") {
    return TahaiSurfaceDefinition{kNewTabSurface, kNewTabTitle};
  }
  if (url.path() == "/mission" || url.path() == "/mission/") {
    return TahaiSurfaceDefinition{kMissionSurface, kMissionTitle};
  }
  if (url.path() == "/ops-tools" || url.path() == "/ops-tools/") {
    return TahaiSurfaceDefinition{kOpsToolsSurface, kOpsToolsTitle};
  }
  if (url.path() == "/profiles" || url.path() == "/profiles/") {
    return TahaiSurfaceDefinition{kProfilesSurface, kProfilesTitle};
  }
  if (url.path() == "/support" || url.path() == "/support/") {
    return TahaiSurfaceDefinition{kSupportSurface, kSupportTitle};
  }
  if (url.path() == "/policy" || url.path() == "/policy/") {
    return TahaiSurfaceDefinition{kPolicySurface, kPolicyTitle};
  }
  if (url.path() == "/modes" || url.path() == "/modes/") {
    return TahaiSurfaceDefinition{kModesSurface, kModesTitle};
  }
  if (url.path() == "/local-oi" || url.path() == "/local-oi/") {
    return TahaiSurfaceDefinition{kLocalOiSurface, kLocalOiTitle};
  }
  return std::nullopt;
}

constexpr char kSharedCss[] = R"TAHAI(
:root{color-scheme:dark;font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;background:#03040b;color:#f7f9ff;--ink:#03040b;--panel:#080b19d9;--panel2:#0d1230;--line:#2f4775;--cyan:#3abdff;--blue:#00beff;--mint:#60ffda;--violet:#ae57ff;--coral:#ff6c8f;--muted:#b9c4df;--warn:#ffd77d}*{box-sizing:border-box}html{min-height:100%;background:#03040b}body{margin:0;min-height:100vh;background:radial-gradient(circle at 8% 4%,#063f78 0,transparent 30rem),radial-gradient(circle at 92% 12%,#481164 0,transparent 29rem),radial-gradient(circle at 62% 82%,#003f45 0,transparent 34rem),linear-gradient(145deg,#03040b 0%,#071126 55%,#060711 100%);background-attachment:fixed}body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.38;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,#000,transparent 78%)}a{color:inherit}.shell{position:relative;width:min(1320px,calc(100% - 44px));margin:auto;padding:28px 0 72px}.brand{display:flex;align-items:center;gap:15px}.mark{width:66px;height:66px;object-fit:cover;border:1px solid #66e9ff66;border-radius:19px;background:#03050d;box-shadow:0 0 0 1px #ae57ff44,0 12px 36px #001c50,0 0 34px #00beff33}.eyebrow{margin:0 0 6px;color:var(--mint);font-size:.7rem;font-weight:850;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 0 14px #60ffda66}.muted{color:var(--muted)}header{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:30px;padding:10px 12px 10px 10px;border:1px solid #7fdcff26;border-radius:24px;background:#060914a8;box-shadow:0 20px 60px #0006;backdrop-filter:blur(18px)}h1{margin:0;font-size:clamp(1.8rem,4.2vw,3.45rem);letter-spacing:-.045em;line-height:.95}h2,h3,p{margin-top:0}.actions,.chips{display:flex;flex-wrap:wrap;gap:9px}.button,.chip{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 15px;border:1px solid #6799c54d;border-radius:999px;background:linear-gradient(135deg,#102044cc,#10142dcc);color:#edf8ff;text-decoration:none;font-weight:720;cursor:pointer;box-shadow:inset 0 1px #ffffff12;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease}.button:hover,.chip:hover{transform:translateY(-2px);border-color:#60ffda99;box-shadow:0 10px 26px #001636aa,0 0 20px #3abdff2b}.button.primary{border-color:#60ffda99;background:linear-gradient(135deg,#007f9e,#4430a7 58%,#8c2cb7);box-shadow:0 0 24px #00beff35}.button.danger{border-color:#ff6c8f80;background:linear-gradient(135deg,#48162a,#291229)}.button[aria-disabled=true]{opacity:.48}.hero,.panel{position:relative;border:1px solid #79dfff38;border-radius:28px;background:linear-gradient(145deg,#0b1430e8,#080a18e8 58%,#15102ae8);box-shadow:0 24px 80px #0008,inset 0 1px #ffffff10;backdrop-filter:blur(16px)}.hero{padding:clamp(26px,5vw,58px);overflow:hidden}.hero::before{content:"";position:absolute;width:420px;height:420px;right:-120px;top:-210px;border-radius:50%;background:conic-gradient(from 45deg,#00beff00,#00beff88,#ae57ffaa,#ff6c8f66,#00beff00);filter:blur(26px);opacity:.42}.hero h2{position:relative;max-width:900px;margin-bottom:14px;font-size:clamp(2rem,4.4vw,4rem);line-height:1.02;letter-spacing:-.048em}.hero p{position:relative;max-width:790px;line-height:1.7}.launch-hero{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(250px,.65fr);gap:42px;align-items:center;min-height:430px}.hero-art{position:relative;display:grid;place-items:center;min-height:300px}.hero-art::before{content:"";position:absolute;width:260px;height:260px;border:1px solid #60ffda55;border-radius:50%;box-shadow:0 0 55px #00beff55,inset 0 0 48px #ae57ff30;animation:orbit 9s linear infinite}.hero-art img{position:relative;width:min(100%,285px);aspect-ratio:1;border-radius:27%;filter:drop-shadow(0 24px 32px #000b) drop-shadow(0 0 24px #00beff55);transform:rotate(2deg)}.hero-badge{position:absolute;right:0;bottom:20px;padding:9px 13px;border:1px solid #60ffda70;border-radius:999px;background:#060914d9;color:#dffff7;font-size:.72rem;font-weight:780;letter-spacing:.08em;text-transform:uppercase}.search{position:relative;display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:26px}.search input,.command-input{width:100%;min-height:58px;padding:15px 18px;border:1px solid #3abdff70;border-radius:17px;background:#030817d9;color:#fff;font:inherit;box-shadow:inset 0 1px 12px #0008}.search input:focus,.command-input:focus{outline:2px solid #60ffda88;outline-offset:2px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin-top:18px}.card{position:relative;display:flex;min-height:164px;overflow:hidden;flex-direction:column;justify-content:space-between;padding:21px;border:1px solid #517bb050;border-radius:21px;background:linear-gradient(145deg,#111c3be8,#090c1ce8);color:inherit;text-align:left;text-decoration:none;box-shadow:inset 0 1px #ffffff0d;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}.card::after{content:"";position:absolute;right:-42px;bottom:-48px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#ae57ff42,transparent 67%)}.card:nth-child(3n+1)::after{background:radial-gradient(circle,#00beff4d,transparent 67%)}.card:nth-child(3n+2)::after{background:radial-gradient(circle,#60ffda38,transparent 67%)}.card:hover{transform:translateY(-5px);border-color:#68e8ff9c;box-shadow:0 18px 44px #0008,0 0 30px #00beff1f}.card strong{position:relative;font-size:1.08rem}.card span{position:relative;color:var(--muted);line-height:1.5}.section{margin-top:30px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:13px}.panel{padding:24px}.three{display:grid;grid-template-columns:1fr 1.35fr 1fr;gap:15px}.list{display:grid;gap:10px;margin:0;padding:0;list-style:none}.list li,.command{padding:14px;border:1px solid #355b8559;border-radius:14px;background:#090f22cc}.status{padding:13px 15px;border:1px solid #60ffda5c;border-radius:14px;background:linear-gradient(135deg,#06352caa,#071c34aa);color:#c8fff0}.boundary{padding:15px;border-left:3px solid var(--warn);background:#392b15bb;color:#ffe9b5;line-height:1.5}.command-layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.7fr);gap:16px}.command-list{display:grid;gap:9px;margin-top:16px}.command{display:grid;grid-template-columns:1fr auto;color:inherit;text-align:left;cursor:pointer;transition:border-color .18s ease,transform .18s ease}.command:hover,.command:focus-visible{border-color:var(--cyan);outline:none;transform:translateX(3px)}.scope{align-self:center;color:var(--mint);font-size:.72rem;text-transform:uppercase}.mission-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:15px}.mission-card{display:grid;gap:15px}.mission-card h3{margin:0}.mission-card-head{display:flex;justify-content:space-between;gap:14px}.mission-steps{display:grid;gap:8px}.mission-step{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;border:1px solid #355b8559;border-radius:13px;background:#090f22cc}.mission-step.complete{border-color:#60ffda70;background:#073128aa}.mission-step-label{line-height:1.4}.mission-timeline{font-size:.82rem;line-height:1.45}.footer{display:flex;align-items:center;gap:10px;margin-top:32px;padding-top:20px;border-top:1px solid #375a7a55;color:#8fa4c8;font-size:.82rem}.footer::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--mint);box-shadow:0 0 14px var(--mint)}@keyframes orbit{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}@media(max-width:960px){.launch-hero{grid-template-columns:1fr}.hero-art{min-height:240px}.hero-art img{width:220px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.three,.command-layout{grid-template-columns:1fr}}@media(max-width:620px){header{align-items:flex-start;flex-direction:column}.actions{width:100%}.grid,.search{grid-template-columns:1fr}.shell{width:min(100% - 22px,1320px)}.launch-hero{gap:14px}.hero-art{display:none}}
@media(min-width:961px){.shell{width:calc(100% - clamp(24px,3vw,72px));max-width:none}.launch-hero{grid-template-columns:minmax(0,2.15fr) minmax(280px,.85fr);min-height:min(560px,42vw)}.grid{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}.hero{padding:clamp(32px,3.25vw,68px)}.hero h2{font-size:clamp(2.4rem,3.2vw,4.8rem)}}
)TAHAI";

constexpr char kSupportChangeJs[] = R"TAHAI(
(()=>{'use strict';const inspection=document.querySelector('#network-inspection-form'),anchor=inspection&&inspection.closest('.section');if(!anchor||!anchor.parentNode)return;const section=document.createElement('section'),deck=document.createElement('div'),panel=document.createElement('article'),boundary=document.createElement('aside'),eyebrow=document.createElement('p'),heading=document.createElement('h2'),description=document.createElement('p'),form=document.createElement('form'),kind=document.createElement('select'),target=document.createElement('input'),digest=document.createElement('input'),button=document.createElement('button'),status=document.createElement('p'),result=document.createElement('p');section.className='section';deck.className='oi-command-deck';panel.className='panel';boundary.className='panel oi-boundary';eyebrow.className='eyebrow';eyebrow.textContent='Change intelligence';heading.textContent='Explicit Change Lens';description.className='muted';description.textContent='Compare safe SHA-256 digests that you explicitly supply for an approved public target. Local OI stores only the digest, target, capture kind, time, and comparison outcome.';form.className='actions';form.id='change-capture-form';kind.className='button';for(const pair of [['dns_record','DNS record digest'],['tls_certificate','TLS certificate digest'],['redirect_chain','Redirect-chain digest'],['endpoint_status','Endpoint-status digest'],['response_header','Response-header digest'],['content','Content digest'],['download_artifact','Download artifact digest']]){const option=document.createElement('option');option.value=pair[0];option.textContent=pair[1];kind.append(option)}target.className='command-input';target.type='text';target.autocomplete='off';target.maxLength=2048;target.placeholder='Host or canonical HTTPS URL';target.setAttribute('aria-label','Approved public host or HTTPS target');digest.className='command-input';digest.type='text';digest.autocomplete='off';digest.maxLength=64;digest.placeholder='64-character lowercase SHA-256 digest';digest.setAttribute('aria-label','SHA-256 digest');button.className='button primary';button.type='submit';button.textContent='Record and compare';status.id='change-capture-status';status.className='muted';status.setAttribute('role','status');status.setAttribute('aria-live','polite');result.className='boundary';result.textContent='No baseline is stored yet.';form.append(kind,target,digest,button);panel.append(eyebrow,heading,description,form,status,result);const boundaryEyebrow=document.createElement('p'),boundaryHeading=document.createElement('h2'),boundaryText=document.createElement('p');boundaryEyebrow.className='eyebrow';boundaryEyebrow.textContent='Digest-only boundary';boundaryHeading.textContent='No recovery or hidden capture';boundaryText.className='boundary';boundaryText.textContent='This tool does not fetch a page, resolve DNS, read response headers, inspect a download, access files, schedule a watch, or reconstruct the material behind a digest. Use the DNS + TLS tool separately for its own one-time transport metadata inspection.';boundary.append(boundaryEyebrow,boundaryHeading,boundaryText);deck.append(panel,boundary);section.append(deck);anchor.parentNode.insertBefore(section,anchor.nextSibling);window.tahaiChangeCaptureComplete=(recorded,state,canonicalTarget)=>{if(!recorded){status.textContent='The Change Lens entry was rejected by local validation or policy.';result.textContent='Nothing was stored.';return}const label=state==='baseline'?'Baseline recorded locally.':state==='changed'?'Changed: a deterministic Local OI finding was created.':'Unchanged: the supplied digest matches the prior local capture.';status.textContent=label;result.textContent=canonicalTarget?`Target: ${canonicalTarget}`:'Local comparison recorded.'};form.addEventListener('submit',event=>{event.preventDefault();const selected=kind.value,targetValue=target.value.trim(),digestValue=digest.value.trim();if(!targetValue||!digestValue){status.textContent='Enter an approved target and a SHA-256 digest.';return}status.textContent='Validating and comparing safe local digest metadata…';chrome.send('recordTahaiChangeCapture',[selected,targetValue,digestValue])})})();
)TAHAI";

constexpr char kSupportArtifactJs[] = R"TAHAI(
(()=>{'use strict';const changeForm=document.querySelector('#change-capture-form'),anchor=changeForm&&changeForm.closest('.section');if(!anchor||!anchor.parentNode)return;const section=document.createElement('section'),deck=document.createElement('div'),panel=document.createElement('article'),boundary=document.createElement('aside'),eyebrow=document.createElement('p'),heading=document.createElement('h2'),description=document.createElement('p'),form=document.createElement('form'),label=document.createElement('input'),origin=document.createElement('input'),digest=document.createElement('input'),button=document.createElement('button'),status=document.createElement('p'),result=document.createElement('p');section.className='section';deck.className='oi-command-deck';panel.className='panel';boundary.className='panel oi-boundary';eyebrow.className='eyebrow';eyebrow.textContent='Artifact intelligence';heading.textContent='Artifact integrity record';description.className='muted';description.textContent='Record a human label, approved public HTTPS origin, and SHA-256 value you explicitly provide. This does not open the URL or read a local file.';form.className='actions';form.id='artifact-metadata-form';label.className='command-input';label.type='text';label.autocomplete='off';label.maxLength=256;label.placeholder='Artifact label (not a file path)';label.setAttribute('aria-label','Artifact label');origin.className='command-input';origin.type='url';origin.autocomplete='off';origin.maxLength=2048;origin.placeholder='https://example.com/download';origin.setAttribute('aria-label','Approved public HTTPS origin');digest.className='command-input';digest.type='text';digest.autocomplete='off';digest.maxLength=64;digest.placeholder='64-character lowercase SHA-256 digest';digest.setAttribute('aria-label','SHA-256 digest');button.className='button primary';button.type='submit';button.textContent='Record artifact metadata';status.className='muted';status.setAttribute('role','status');status.setAttribute('aria-live','polite');result.className='boundary';result.textContent='Artifact records are local metadata only.';form.append(label,origin,digest,button);panel.append(eyebrow,heading,description,form,status,result);const boundaryEyebrow=document.createElement('p'),boundaryHeading=document.createElement('h2'),boundaryText=document.createElement('p');boundaryEyebrow.className='eyebrow';boundaryEyebrow.textContent='Artifact boundary';boundaryHeading.textContent='No file or download access';boundaryText.className='boundary';boundaryText.textContent='TAHAI retains no local path, filename, bytes, response body, response headers, cookie, credential, or browser download record. Linkage to a Mission is added only by a future explicit Mission workflow.';boundary.append(boundaryEyebrow,boundaryHeading,boundaryText);deck.append(panel,boundary);section.append(deck);anchor.parentNode.insertBefore(section,anchor.nextSibling);window.tahaiArtifactMetadataComplete=(recorded,canonicalSource)=>{if(!recorded){status.textContent='The artifact metadata entry was rejected by local validation or policy.';result.textContent='Nothing was stored.';return}status.textContent='Artifact integrity metadata recorded locally.';result.textContent=canonicalSource?`Approved origin: ${canonicalSource}`:'Local artifact record created.'};form.addEventListener('submit',event=>{event.preventDefault();const title=label.value.trim(),source=origin.value.trim(),hash=digest.value.trim();if(!title||!source||!hash){status.textContent='Enter a label, approved HTTPS origin, and SHA-256 digest.';return}status.textContent='Validating explicit artifact metadata…';chrome.send('recordTahaiArtifactMetadata',[title,source,hash])})})();
)TAHAI";

constexpr char kSupportChangeMissionJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#change-capture-form');if(!form)return;const button=form.querySelector('button[type=submit]'),kind=form.querySelector('select'),inputs=Array.from(form.querySelectorAll('input'));if(!button||!kind||inputs.length<2)return;const mission=document.createElement('select'),empty=document.createElement('option');mission.className='button';mission.id='change-capture-mission';empty.value='';empty.textContent='No Mission association';mission.append(empty);form.insertBefore(mission,button);window.tahaiChangeMissionList=items=>{for(const item of Array.isArray(items)?items:[]){if(!item||typeof item.id!=='string'||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title;mission.append(option)}};form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const [target,digest]=inputs.map(input=>input.value.trim());if(!target||!digest)return;chrome.send('recordTahaiChangeCapture',[kind.value,target,digest,mission.value])},true);chrome.send('listTahaiChangeMissions')})();
)TAHAI";

constexpr char kSupportChangeHistoryJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#change-capture-form'),panel=form&&form.closest('.panel');if(!form||!panel)return;const history=document.createElement('section'),heading=document.createElement('h3'),detail=document.createElement('p'),rows=document.createElement('div');history.className='section';history.id='change-capture-history';history.hidden=true;heading.textContent='Local comparison history';detail.className='muted';detail.textContent='Newest eight states for this exact kind and target. Digest values are never displayed here.';rows.className='oi-search-results';history.append(heading,detail,rows);panel.append(history);const row=(label,value)=>{const item=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('span');item.className='oi-search-row';name.textContent=label;text.textContent=value;item.append(name,text);return item};const existing=window.tahaiChangeCaptureComplete;window.tahaiChangeCaptureComplete=(recorded,state,target,kind)=>{if(typeof existing==='function')existing(recorded,state,target,kind);rows.replaceChildren();history.hidden=true;if(!recorded||typeof target!=='string'||typeof kind!=='string')return;chrome.send('listTahaiChangeCaptureHistory',[kind,target])};window.tahaiChangeCaptureHistory=items=>{rows.replaceChildren();const values=Array.isArray(items)?items:[];if(!values.length)return;history.hidden=false;for(const item of values){if(!item||typeof item!=='object')continue;const when=typeof item.recorded_at==='string'?item.recorded_at:'Local capture';const state=typeof item.comparison==='string'?item.comparison:'unknown';rows.append(row(when,`Comparison: ${state}${item.is_current?' · current local record':''}`))}}})();
)TAHAI";

constexpr char kSupportArtifactMissionJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#artifact-metadata-form');if(!form)return;const button=form.querySelector('button[type=submit]'),inputs=Array.from(form.querySelectorAll('input'));if(!button||inputs.length<3)return;const mission=document.createElement('select'),empty=document.createElement('option');mission.className='button';mission.id='artifact-mission';empty.value='';empty.textContent='No Mission link';mission.append(empty);form.insertBefore(mission,button);window.tahaiLocalOiMissionList=items=>{for(const item of Array.isArray(items)?items:[]){if(!item||typeof item.id!=='string'||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title;mission.append(option)}};form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const [label,origin,digest]=inputs.map(input=>input.value.trim());if(!label||!origin||!digest)return;chrome.send('recordTahaiArtifactMetadata',[label,origin,digest,mission.value])},true);chrome.send('listTahaiLocalOiMissions')})();
)TAHAI";

constexpr char kSupportArtifactHistoryJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#artifact-metadata-form'),panel=form&&form.closest('.panel');if(!form||!panel)return;const history=document.createElement('section'),heading=document.createElement('h3'),detail=document.createElement('p'),rows=document.createElement('div');history.className='section';history.id='artifact-metadata-history';history.hidden=true;heading.textContent='Local artifact history';detail.className='muted';detail.textContent='Newest eight metadata rows for this exact source. Paths, file names, and digest values are never displayed here.';rows.className='oi-search-results';history.append(heading,detail,rows);panel.append(history);const row=(label,value)=>{const item=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('span');item.className='oi-search-row';name.textContent=label;text.textContent=value;item.append(name,text);return item};const existing=window.tahaiArtifactMetadataComplete;window.tahaiArtifactMetadataComplete=(recorded,source)=>{if(typeof existing==='function')existing(recorded,source);rows.replaceChildren();history.hidden=true;if(!recorded||typeof source!=='string')return;chrome.send('listTahaiArtifactHistory',[source])};window.tahaiArtifactHistory=items=>{rows.replaceChildren();const values=Array.isArray(items)?items:[];if(!values.length)return;history.hidden=false;for(const item of values){if(!item||typeof item!=='object')continue;const when=typeof item.recorded_at==='string'?item.recorded_at:'Local record';const label=typeof item.label==='string'?item.label:'Artifact metadata';rows.append(row(when,`${label} · digest ${item.digest_recorded?'recorded':'unavailable'}`))}}})();
)TAHAI";

constexpr char kSupportWatchJs[] = R"TAHAI(
(()=>{'use strict';const artifactForm=document.querySelector('#artifact-metadata-form'),anchor=artifactForm&&artifactForm.closest('.section');if(!anchor||!anchor.parentNode)return;const section=document.createElement('section'),deck=document.createElement('div'),panel=document.createElement('article'),boundary=document.createElement('aside'),eyebrow=document.createElement('p'),heading=document.createElement('h2'),description=document.createElement('p'),form=document.createElement('form'),kind=document.createElement('select'),target=document.createElement('input'),interval=document.createElement('select'),button=document.createElement('button'),status=document.createElement('p'),result=document.createElement('p');section.className='section';deck.className='oi-command-deck';panel.className='panel';boundary.className='panel oi-boundary';eyebrow.className='eyebrow';eyebrow.textContent='Manual recheck list';heading.textContent='Local watch foundation';description.className='muted';description.textContent='Save an approved public target for operator-initiated rechecks. This configuration never runs a scheduler, background request, authenticated-console scan, or silent page capture.';form.className='actions';form.id='manual-watch-form';kind.className='button';for(const pair of [['dns_record','DNS record'],['tls_certificate','TLS certificate'],['redirect_chain','Redirect chain'],['endpoint_status','Endpoint status'],['response_header','Response header digest'],['content_hash','Content digest'],['download_artifact_hash','Download artifact digest']]){const option=document.createElement('option');option.value=pair[0];option.textContent=pair[1];kind.append(option)}target.className='command-input';target.type='text';target.autocomplete='off';target.maxLength=2048;target.placeholder='Public host or canonical HTTPS URL';target.setAttribute('aria-label','Approved public target');interval.className='button';for(const seconds of [300,900,3600,14400,86400]){const option=document.createElement('option');option.value=String(seconds);option.textContent=`Manual cadence reference: ${seconds<3600?seconds/60+' minutes':seconds/3600+' hours'}`;interval.append(option)}button.className='button primary';button.type='submit';button.textContent='Save manual recheck';status.className='muted';status.setAttribute('role','status');status.setAttribute('aria-live','polite');result.className='boundary';result.textContent='No background watcher is active.';form.append(kind,target,interval,button);panel.append(eyebrow,heading,description,form,status,result);const boundaryEyebrow=document.createElement('p'),boundaryHeading=document.createElement('h2'),boundaryText=document.createElement('p');boundaryEyebrow.className='eyebrow';boundaryEyebrow.textContent='Execution boundary';boundaryHeading.textContent='Configuration is not monitoring';boundaryText.className='boundary';boundaryText.textContent='The cadence is an operator reference only. A future explicit recheck must invoke a separately approved tool and will have its own visible result. No scheduled service or watch daemon exists in this browser.';boundary.append(boundaryEyebrow,boundaryHeading,boundaryText);deck.append(panel,boundary);section.append(deck);anchor.parentNode.insertBefore(section,anchor.nextSibling);window.tahaiManualWatchConfigured=(recorded,canonicalTarget)=>{if(!recorded){status.textContent='The manual recheck entry was rejected by local validation or policy.';return}status.textContent='Manual-only local recheck entry saved.';result.textContent=canonicalTarget?`Target: ${canonicalTarget}. No request was made.`:'No request was made.';chrome.send('listTahaiManualWatches')};form.addEventListener('submit',event=>{event.preventDefault();const targetValue=target.value.trim();if(!targetValue){status.textContent='Enter an approved public target.';return}status.textContent='Validating manual-only recheck metadata…';chrome.send('configureTahaiManualWatch',[kind.value,targetValue,Number(interval.value)])})})();
)TAHAI";

constexpr char kSupportWatchMissionJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#manual-watch-form');if(!form)return;const button=form.querySelector('button[type=submit]'),kind=form.querySelector('select'),inputs=Array.from(form.querySelectorAll('input')),selects=Array.from(form.querySelectorAll('select'));if(!button||!kind||inputs.length!==1||selects.length<2)return;const mission=document.createElement('select'),empty=document.createElement('option');mission.className='button';mission.id='manual-watch-mission';empty.value='';empty.textContent='No Mission association';mission.append(empty);form.insertBefore(mission,button);window.tahaiWatchMissionList=items=>{for(const item of Array.isArray(items)?items:[]){if(!item||typeof item.id!=='string'||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title;mission.append(option)}};form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const target=inputs[0].value.trim(),interval=selects.find(select=>select!==kind)?.value;if(!target||!interval)return;chrome.send('configureTahaiManualWatch',[kind.value,target,Number(interval),mission.value])},true);chrome.send('listTahaiWatchMissions')})();
)TAHAI";

constexpr char kSupportManualWatchRegistryJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#manual-watch-form'),panel=form&&form.closest('.panel');if(!form||!panel)return;const registry=document.createElement('section'),heading=document.createElement('h3'),detail=document.createElement('p'),rows=document.createElement('div');registry.className='section';registry.id='manual-watch-registry';heading.textContent='Current manual recheck configurations';detail.className='muted';detail.textContent='Operator reference entries only. This list does not schedule a task, run a probe, or create a watcher.';rows.className='oi-search-results';registry.append(heading,detail,rows);panel.append(registry);const row=(label,value)=>{const item=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('span');item.className='oi-search-row';name.textContent=label;text.textContent=value;item.append(name,text);return item};window.tahaiManualWatchList=items=>{rows.replaceChildren();const values=Array.isArray(items)?items:[];if(!values.length){rows.append(row('No manual rechecks','Save an approved public target to create a local operator reference.'));return}for(const item of values){if(!item||typeof item!=='object')continue;const title=typeof item.title==='string'?item.title:'Manual recheck';const target=typeof item.target==='string'?item.target:'Unavailable';const kind=typeof item.watch_kind==='string'?item.watch_kind:'unknown';const interval=Number.isInteger(item.interval_seconds)?item.interval_seconds:0;rows.append(row(title,`${target} · ${kind} · manual cadence reference: ${interval} seconds`))}};const existing=window.tahaiManualWatchConfigured;window.tahaiManualWatchConfigured=(recorded,target)=>{if(typeof existing==='function')existing(recorded,target);if(recorded)chrome.send('listTahaiManualWatches')};chrome.send('listTahaiManualWatches')})();
)TAHAI";

constexpr char kSupportManualWatchRunJs[] = R"TAHAI(
(() => {
  'use strict';
  const form = document.querySelector('#manual-watch-form');
  const panel = form && form.closest('.panel');
  const host = document.querySelector('#network-inspection-host');
  const output = document.querySelector('#network-inspection-results');
  const status = document.querySelector('#support-status');
  if (!panel || !host) return;

  const runner = document.createElement('section');
  const heading = document.createElement('h3');
  const detail = document.createElement('p');
  const rows = document.createElement('div');
  runner.className = 'section';
  runner.id = 'manual-watch-explicit-runner';
  runner.hidden = true;
  heading.textContent = 'Run a saved DNS or TLS recheck';
  detail.className = 'muted';
  detail.textContent = 'Each run is a new foreground action. It is not scheduled, retried, or sent to a hosted service.';
  rows.className = 'oi-search-results';
  runner.append(heading, detail, rows);
  panel.append(runner);

  let inFlight = false;
  const row = (title, target, action) => {
    const item = document.createElement('div');
    const name = document.createElement('strong');
    const value = document.createElement('span');
    item.className = 'oi-search-row';
    name.textContent = title;
    value.textContent = target;
    item.append(name, value, action);
    return item;
  };
  const setButtonsEnabled = enabled => {
    for (const button of rows.querySelectorAll('button')) button.disabled = !enabled;
  };
  const existingComplete = window.tahaiNetworkInspectionComplete;
  window.tahaiNetworkInspectionComplete = result => {
    inFlight = false;
    setButtonsEnabled(true);
    if (typeof existingComplete === 'function') existingComplete(result);
  };
  const existingRejected = window.tahaiNetworkInspectionRejected;
  window.tahaiNetworkInspectionRejected = () => {
    inFlight = false;
    setButtonsEnabled(true);
    if (status) status.textContent = 'Another DNS + TLS inspection is already running. Wait for its visible result before starting another.';
    if (typeof existingRejected === 'function') existingRejected();
  };
  const existingList = window.tahaiManualWatchList;
  window.tahaiManualWatchList = items => {
    if (typeof existingList === 'function') existingList(items);
    rows.replaceChildren();
    const watches = Array.isArray(items) ? items : [];
    for (const watch of watches) {
      if (!watch || typeof watch !== 'object' ||
          (watch.watch_kind !== 'dns_record' &&
           watch.watch_kind !== 'tls_certificate') ||
          typeof watch.target !== 'string' || !watch.target) {
        continue;
      }
      const action = document.createElement('button');
      action.className = 'button';
      action.type = 'button';
      action.textContent = 'Run DNS + TLS inspection';
      action.addEventListener('click', () => {
        if (inFlight) return;
        inFlight = true;
        setButtonsEnabled(false);
        host.value = watch.target;
        if (output) output.replaceChildren();
        if (status) status.textContent = 'Running the saved public target through the explicit DNS + TLS inspector…';
        const missionId = typeof watch.mission_id === 'string' ? watch.mission_id : '';
        const watchId = typeof watch.record_id === 'string' ? watch.record_id : '';
        chrome.send('inspectTahaiNetwork', watchId
            ? [watch.target, missionId, watchId]
            : missionId ? [watch.target, missionId] : [watch.target]);
      });
      const seconds = Number.isInteger(watch.seconds_until_due)
          ? watch.seconds_until_due
          : 0;
      const due = watch.schedule_state === 'due'
          ? 'due for explicit recheck'
          : watch.schedule_state === 'scheduled'
          ? `next manual recheck in ${seconds} seconds`
          : 'manual due state unavailable';
      rows.append(
          row(watch.title || 'Manual recheck', `${watch.target} · ${due}`,
              action));
    }
    runner.hidden = !rows.childElementCount;
  };
  chrome.send('listTahaiManualWatches');
})();
)TAHAI";

constexpr char kSupportInspectionOutcomeJs[] = R"TAHAI(
(() => {
  'use strict';
  const output = document.querySelector('#network-inspection-results');
  const status = document.querySelector('#support-status');
  if (!output) return;
  const existingComplete = window.tahaiNetworkInspectionComplete;
  window.tahaiNetworkInspectionComplete = result => {
    if (typeof existingComplete === 'function') existingComplete(result);
    if (!result || typeof result !== 'object') return;
    if (status && result.recorded !== true) {
      status.textContent = 'Inspection completed, but the result was not recorded in Local OI. Recording may be disabled, unavailable, or rejected by the current local context.';
    }
    const item = document.createElement('div');
    const name = document.createElement('strong');
    const detail = document.createElement('span');
    const copy = document.createElement('button');
    item.className = 'oi-search-row';
    name.textContent = 'Inspection outcome';
    if (result.target_rejected === true) {
      detail.textContent = 'Target rejected before DNS or HTTPS. Enter one public host name or publicly routable IPv4 address only.';
    } else if (result.public_address_guard_blocked === true) {
      detail.textContent = 'Blocked before HTTPS because DNS did not resolve to only public addresses.';
    } else if (Number(result.dns_net_error) !== 0) {
      detail.textContent = 'DNS resolution did not complete, so no HTTPS request was sent.';
    } else if (Number(result.request_net_error) !== 0) {
      detail.textContent = 'The credential-free HTTPS/TLS probe did not complete after public DNS resolution.';
    } else if (result.certificate_revoked === true) {
      detail.textContent = 'HTTPS responded, but Chromium reports the certificate as revoked.';
    } else if (result.certificate_authority_invalid === true) {
      detail.textContent = 'HTTPS responded, but Chromium does not trust the certificate authority.';
    } else if (result.certificate_name_mismatch === true) {
      detail.textContent = 'HTTPS responded, but Chromium reports that the certificate does not match the target.';
    } else if (result.certificate_expired === true) {
      detail.textContent = 'HTTPS responded, but Chromium reports the certificate as expired.';
    } else if (result.certificate_valid === true) {
      detail.textContent = 'Public DNS and Chromium certificate validation completed. Review the typed details for this explicit run.';
    } else {
      detail.textContent = 'HTTPS responded, but TLS validation needs review in the typed inspection details.';
    }
    copy.className = 'button';
    copy.type = 'button';
    copy.textContent = 'Copy sanitized inspection handoff';
    copy.addEventListener('click', () => {
      if (status) status.textContent = 'Copying the sanitized inspection handoff…';
      chrome.send('copyTahaiNetworkInspectionSummary');
    });
    item.append(name, detail, copy);
    output.append(item);
    const certificateClass = result.tls_info_available !== true
        ? 'Unavailable'
        : result.certificate_revoked === true
              ? 'revoked'
              : result.certificate_authority_invalid === true
                    ? 'authority not trusted'
                    : result.certificate_name_mismatch === true
                          ? 'target mismatch'
                          : 'no fixed failure observed';
    const certificateItem = document.createElement('div');
    const certificateName = document.createElement('strong');
    const certificateDetail = document.createElement('span');
    certificateItem.className = 'oi-search-row';
    certificateName.textContent = 'Certificate status class';
    certificateDetail.textContent = `${certificateClass}; certificate values and chains are not shown here.`;
    certificateItem.append(certificateName, certificateDetail);
    output.append(certificateItem);
    const guidance = Array.isArray(result.guidance) ? result.guidance : [];
    const safeSteps = guidance.filter(step => typeof step === 'string' && step);
    if (safeSteps.length) {
      const guide = document.createElement('div');
      const guideName = document.createElement('strong');
      const guideDetail = document.createElement('span');
      guide.className = 'oi-search-row';
      guideName.textContent = 'Deterministic next steps';
      guideDetail.textContent = safeSteps.join(' ');
      guide.append(guideName, guideDetail);
      output.append(guide);
    }
  };
  window.tahaiNetworkInspectionSummaryCopied = () => {
    if (status) status.textContent = 'Sanitized inspection handoff copied. It excludes addresses, aliases, certificate names, response headers, bodies, cookies, credentials, and browser data.';
  };
})();
)TAHAI";

constexpr char kSupportEnvironmentJs[] = R"TAHAI(
(()=>{'use strict';const watchForm=document.querySelector('#manual-watch-form'),anchor=watchForm&&watchForm.closest('.section');if(!anchor||!anchor.parentNode)return;const section=document.createElement('section'),deck=document.createElement('div'),panel=document.createElement('article'),boundary=document.createElement('aside'),eyebrow=document.createElement('p'),heading=document.createElement('h2'),description=document.createElement('p'),form=document.createElement('form'),environment=document.createElement('select'),origin=document.createElement('input'),button=document.createElement('button'),status=document.createElement('p'),result=document.createElement('p');section.className='section';deck.className='oi-command-deck';panel.className='panel';boundary.className='panel oi-boundary';eyebrow.className='eyebrow';eyebrow.textContent='Environment Guard';heading.textContent='Exact-origin local classification';description.className='muted';description.textContent='Classify one exact HTTPS origin to retain its intended local guard posture. This is a profile-local reference record, not automatic browser-wide enforcement.';form.className='actions';form.id='environment-classification-form';environment.className='button';for(const pair of [['production','Production'],['staging','Staging'],['development','Development'],['customer','Customer'],['internal','Internal'],['sensitive','Sensitive']]){const option=document.createElement('option');option.value=pair[0];option.textContent=pair[1];environment.append(option)}origin.className='command-input';origin.type='url';origin.autocomplete='off';origin.maxLength=2048;origin.placeholder='https://console.example.com';origin.setAttribute('aria-label','Exact HTTPS origin');button.className='button primary';button.type='submit';button.textContent='Save local classification';status.className='muted';status.setAttribute('role','status');status.setAttribute('aria-live','polite');result.className='boundary';result.textContent='No network request or browser-wide navigation policy is changed.';form.append(environment,origin,button);panel.append(eyebrow,heading,description,form,status,result);const boundaryEyebrow=document.createElement('p'),boundaryHeading=document.createElement('h2'),boundaryText=document.createElement('p');boundaryEyebrow.className='eyebrow';boundaryEyebrow.textContent='Authority boundary';boundaryHeading.textContent='Metadata, not access control';boundaryText.className='boundary';boundaryText.textContent='This registry does not inspect a page, enforce a permission boundary, infer a tenant, change a browser tab, manage an account, or grant TAHAI Pilot permission. It preserves an explicit local classification for Local OI context only.';boundary.append(boundaryEyebrow,boundaryHeading,boundaryText);deck.append(panel,boundary);section.append(deck);anchor.parentNode.insertBefore(section,anchor.nextSibling);window.tahaiEnvironmentClassificationConfigured=(recorded,canonicalOrigin)=>{if(!recorded){status.textContent='The exact-origin classification was rejected by local validation or policy.';return}status.textContent='Exact-origin local Environment Guard classification saved.';result.textContent=canonicalOrigin?`Origin: ${canonicalOrigin}. No browser-wide policy was changed.`:'No browser-wide policy was changed.'};form.addEventListener('submit',event=>{event.preventDefault();const value=origin.value.trim();if(!value){status.textContent='Enter one exact HTTPS origin.';return}status.textContent='Validating local exact-origin classification…';chrome.send('configureTahaiEnvironmentClassification',[environment.value,value])})})();
)TAHAI";

constexpr char kSupportGuardJs[] = R"TAHAI(
(() => {
  'use strict';
  const anchor = document.querySelector('#network-inspection-form')?.closest('.section');
  if (!anchor?.parentNode) return;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const section = element('section', '', 'section');
  section.id = 'tahai-guard-settings';
  const panel = element('article', '', 'panel');
  const heading = element('h2', 'TAHAI Guard — local Custom network rules');
  const detail = element('p', 'Custom rules use the native sandboxed engine. Incognito uses a separate in-memory engine with inherited settings and no decision counters; edit rules from the regular profile. Balanced/Strict default lists, cosmetic filtering, automatic updates and temporary page exceptions are not available here.', 'muted');
  const form = element('form', '', 'actions');
  const mode = element('select', '', 'button');
  mode.id = 'tahai-guard-mode';
  mode.setAttribute('aria-label', 'TAHAI Guard mode');
  for (const [value, text] of [
    ['off', 'Off'], ['custom', 'Custom network rules'],
    ['balanced', 'Balanced — default lists unavailable'],
    ['strict', 'Strict — default lists unavailable']
  ]) {
    const option = element('option', text);
    option.value = value;
    option.disabled = value === 'balanced' || value === 'strict';
    mode.append(option);
  }
  const stats = element('input');
  stats.type = 'checkbox';
  stats.id = 'tahai-guard-local-statistics';
  const statsLabel = element('label', 'Count aggregate decisions in this session only');
  statsLabel.htmlFor = stats.id;
  const save = element('button', 'Apply mode', 'button primary');
  save.type = 'submit';
  const status = element('p', '', 'muted');
  status.id = 'tahai-guard-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const engine = element('p', 'Reading native engine state…', 'boundary');
  engine.id = 'tahai-guard-engine-status';
  const counters = element('p', '', 'muted');
  const editorLabel = element('label', 'Local network-filter text (up to 4 MiB)');
  const editor = element('textarea', '', 'command-input');
  editor.id = 'tahai-guard-rules';
  editorLabel.htmlFor = editor.id;
  editor.rows = 8;
  editor.maxLength = 4194304;
  editor.spellcheck = false;
  editor.autocomplete = 'off';
  editor.placeholder = 'Enter rules you are authorized to use; no list is downloaded.';
  const actions = element('div', '', 'actions');
  const load = element('button', 'Load stored rules', 'button');
  const install = element('button', 'Compile and replace Custom rules', 'button primary');
  install.id = 'tahai-guard-install-rules';
  const clear = element('button', 'Clear stored Custom rules', 'button');
  const refresh = element('button', 'Refresh engine state', 'button');
  for (const button of [load, install, clear, refresh]) button.type = 'button';
  actions.append(load, install, clear, refresh);
  form.append(mode, stats, statsLabel, save);
  panel.append(heading, detail, form, engine, counters, editorLabel, editor, actions,
    element('p', 'A failed replacement retains the last valid local rules. Rules are stored in this profile, not separately encrypted or synced. Request bodies, headers and credentials are not collected. Mode changes affect new decisions: reload affected pages yourself to retry resources already loaded or blocked.', 'muted'), status);
  section.append(panel);
  anchor.parentNode.insertBefore(section, anchor);
  let current = {schema_version: 1, mode: 'off', local_statistics_enabled: false, site_overrides: []};
  let state = {available: false, managed: false, rules_managed: false};
  let busy = false;
  const updateControls = () => {
    mode.disabled = stats.disabled = save.disabled = busy || !state.available || state.managed || state.private_session;
    editor.disabled = load.disabled = clear.disabled =
      busy || !state.available || state.managed || state.rules_managed || state.private_session;
    install.disabled = editor.disabled || current.mode !== 'custom';
  };
  const read = () => chrome.send('getTahaiGuardConfiguration');
  window.tahaiGuardConfigurationLoaded = (value, snapshot) => {
    if (!value || !['off','balanced','strict','custom'].includes(value.mode)) return;
    current = value;
    state = snapshot && typeof snapshot === 'object' ? snapshot : {available:false};
    mode.value = state.private_session ? state.mode : current.mode;
    stats.checked = state.statistics_enabled === true;
    engine.textContent = typeof state.message === 'string' ? state.message : 'Engine unavailable.';
    counters.textContent = state.statistics_enabled === true
      ? 'Engine decisions (including redirect rechecks): ' + String(state.allowed) +
        ' allowed, ' + String(state.blocked) + ' blocked, ' + String(state.unavailable) + ' unavailable.'
      : state.private_session
        ? 'Private engine: no counters, rule edits or request history are retained. Settings are inherited; changes belong in the regular profile.'
        : 'Decision counters are off. No request history is retained by Guard.';
    updateControls();
  };
  window.tahaiGuardConfigurationStored = (stored, message) => {
    status.textContent = typeof message === 'string' ? message : 'Preference not changed.';
    busy = false;
    read();
  };
  window.tahaiGuardRulesLoaded = value => {
    if (typeof value === 'string' && value.length <= 4194304) editor.value = value;
  };
  window.tahaiGuardRulesUpdated = (stored, message) => {
    status.textContent = typeof message === 'string' ? message : 'Rule update did not complete.';
    busy = false;
    read();
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy || save.disabled) return;
    busy = true;
    updateControls();
    chrome.send('setTahaiGuardConfiguration', [{
      schema_version:1, mode:mode.value, local_statistics_enabled:stats.checked,
      site_overrides:current.site_overrides
    }]);
  });
  load.addEventListener('click', () => chrome.send('getTahaiGuardCustomRules'));
  install.addEventListener('click', () => {
    if (install.disabled) return;
    if (!editor.value.trim() || new TextEncoder().encode(editor.value).length > 4194304) {
      status.textContent = 'Enter non-empty UTF-8 rules no larger than 4 MiB.';
      return;
    }
    busy = true;
    updateControls();
    status.textContent = 'Compiling a separate candidate. Existing valid rules remain in use…';
    chrome.send('installTahaiGuardCustomRules', [editor.value]);
  });
  clear.addEventListener('click', () => {
    if (clear.disabled || !window.confirm('Clear this profile’s stored Custom rules? Custom filtering will become unavailable.')) return;
    editor.value = '';
    chrome.send('clearTahaiGuardCustomRules');
  });
  refresh.addEventListener('click', read);
  updateControls();
  read();
})();
)TAHAI";

constexpr char kSupportEnvironmentMissionJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#environment-classification-form');if(!form)return;const button=form.querySelector('button[type=submit]'),environment=form.querySelector('select'),origin=form.querySelector('input');if(!button||!environment||!origin)return;const mission=document.createElement('select'),empty=document.createElement('option');mission.className='button';mission.id='environment-classification-mission';empty.value='';empty.textContent='No Mission association';mission.append(empty);form.insertBefore(mission,button);window.tahaiEnvironmentMissionList=items=>{for(const item of Array.isArray(items)?items:[]){if(!item||typeof item.id!=='string'||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title;mission.append(option)}};form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const value=origin.value.trim();if(!value)return;chrome.send('configureTahaiEnvironmentClassification',[environment.value,value,mission.value])},true);chrome.send('listTahaiEnvironmentMissions')})();
)TAHAI";

constexpr char kSupportEnvironmentRegistryJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#environment-classification-form'),panel=form&&form.closest('.panel');if(!form||!panel)return;const registry=document.createElement('section'),heading=document.createElement('h3'),detail=document.createElement('p'),rows=document.createElement('div');registry.className='section';registry.id='environment-classification-registry';heading.textContent='Current exact-origin registry';detail.className='muted';detail.textContent='Profile-local classification metadata only. This list does not inspect pages, change navigation, or enforce browser policy.';rows.className='oi-search-results';registry.append(heading,detail,rows);panel.append(registry);const row=(label,value)=>{const item=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('span');item.className='oi-search-row';name.textContent=label;text.textContent=value;item.append(name,text);return item};window.tahaiEnvironmentClassificationRegistry=items=>{rows.replaceChildren();const values=Array.isArray(items)?items:[];if(!values.length){rows.append(row('No local classifications','Save an exact HTTPS origin to add profile-local posture metadata.'));return}for(const item of values){if(!item||typeof item!=='object'||typeof item.origin!=='string')continue;const environment=typeof item.environment==='string'?item.environment:'unclassified',posture=[];if(item.persistent_boundary)posture.push('persistent-boundary posture');if(item.redaction_preview)posture.push('redaction-preview posture');if(item.pilot_actions_blocked)posture.push('Pilot-blocked posture');rows.append(row(item.origin,`${environment} · ${posture.length?posture.join(', '):'reference posture only'}`))}};const existing=window.tahaiEnvironmentClassificationConfigured;window.tahaiEnvironmentClassificationConfigured=(recorded,origin)=>{if(typeof existing==='function')existing(recorded,origin);if(recorded)chrome.send('listTahaiEnvironmentClassifications')};chrome.send('listTahaiEnvironmentClassifications')})();
)TAHAI";

constexpr char kSupportDocumentationReferenceJs[] = R"TAHAI(
(()=>{'use strict';const environmentForm=document.querySelector('#environment-classification-form'),anchor=environmentForm&&environmentForm.closest('.section');if(!anchor||!anchor.parentNode)return;const section=document.createElement('section'),deck=document.createElement('div'),panel=document.createElement('article'),boundary=document.createElement('aside'),eyebrow=document.createElement('p'),heading=document.createElement('h2'),description=document.createElement('p'),form=document.createElement('form'),title=document.createElement('input'),reference=document.createElement('input'),endpoint=document.createElement('select'),button=document.createElement('button'),status=document.createElement('p'),result=document.createElement('p');section.className='section';deck.className='oi-command-deck';panel.className='panel';boundary.className='panel oi-boundary';eyebrow.className='eyebrow';eyebrow.textContent='Knowledge intelligence';heading.textContent='Endpoint documentation reference';description.className='muted';description.textContent='Link a human label and approved public HTTPS documentation pointer to a local endpoint already recorded by Support tools or Environment Guard.';form.className='actions';form.id='documentation-reference-form';title.className='command-input';title.type='text';title.autocomplete='off';title.maxLength=256;title.placeholder='Documentation label';title.setAttribute('aria-label','Documentation label');reference.className='command-input';reference.type='url';reference.autocomplete='off';reference.maxLength=2048;reference.placeholder='https://docs.example.com/runbook';reference.setAttribute('aria-label','Approved public HTTPS documentation reference');endpoint.className='button';endpoint.id='documentation-reference-endpoint';const empty=document.createElement('option');empty.value='';empty.textContent='Select existing local endpoint';endpoint.append(empty);button.className='button primary';button.type='submit';button.textContent='Link documentation reference';status.className='muted';status.setAttribute('role','status');status.setAttribute('aria-live','polite');result.className='boundary';result.textContent='No source is opened, fetched, copied, indexed, or retained.';form.append(title,reference,endpoint,button);panel.append(eyebrow,heading,description,form,status,result);const boundaryEyebrow=document.createElement('p'),boundaryHeading=document.createElement('h2'),boundaryText=document.createElement('p');boundaryEyebrow.className='eyebrow';boundaryEyebrow.textContent='Documentation boundary';boundaryHeading.textContent='Pointer, not a connector';boundaryText.className='boundary';boundaryText.textContent='This creates local typed relationship metadata only. TAHAI does not integrate with IT documentation providers, retrieve this URL, read a document, browse authenticated consoles, or create a searchable documentation corpus.';boundary.append(boundaryEyebrow,boundaryHeading,boundaryText);deck.append(panel,boundary);section.append(deck);anchor.parentNode.insertBefore(section,anchor.nextSibling);window.tahaiLocalOiEndpointList=items=>{for(const item of Array.isArray(items)?items:[]){if(!item||typeof item.id!=='string'||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title;endpoint.append(option)}};window.tahaiDocumentationReferenceComplete=(recorded,canonicalReference)=>{if(!recorded){status.textContent='The documentation reference was rejected by local validation or policy.';result.textContent='Nothing was stored.';return}status.textContent='Local documentation reference linked to the endpoint.';result.textContent=canonicalReference?`Reference: ${canonicalReference}. It was not opened.`:'The pointer was not opened.'};form.addEventListener('submit',event=>{event.preventDefault();const label=title.value.trim(),url=reference.value.trim();if(!label||!url||!endpoint.value){status.textContent='Enter a label and approved reference, then select an existing local endpoint.';return}status.textContent='Validating local documentation pointer…';chrome.send('recordTahaiDocumentationReference',[label,url,endpoint.value])});chrome.send('listTahaiLocalOiEndpoints')})();
)TAHAI";

constexpr char kSupportDocumentationMissionJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#documentation-reference-form');if(!form)return;const button=form.querySelector('button[type=submit]'),inputs=Array.from(form.querySelectorAll('input')),endpoint=form.querySelector('select');if(!button||!endpoint||inputs.length<2)return;const mission=document.createElement('select'),empty=document.createElement('option');mission.className='button';mission.id='documentation-reference-mission';empty.value='';empty.textContent='No Mission association';mission.append(empty);form.insertBefore(mission,button);window.tahaiDocumentationMissionList=items=>{for(const item of Array.isArray(items)?items:[]){if(!item||typeof item.id!=='string'||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title;mission.append(option)}};form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const [title,reference]=inputs.map(input=>input.value.trim());if(!title||!reference||!endpoint.value)return;chrome.send('recordTahaiDocumentationReference',[title,reference,endpoint.value,mission.value])},true);chrome.send('listTahaiDocumentationMissions')})();
)TAHAI";

constexpr char kSupportDocumentationRegistryJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#documentation-reference-form'),endpoint=form&&form.querySelector('#documentation-reference-endpoint'),panel=form&&form.closest('.panel');if(!form||!endpoint||!panel)return;const registry=document.createElement('section'),heading=document.createElement('h3'),detail=document.createElement('p'),rows=document.createElement('div');registry.className='section';registry.id='documentation-reference-registry';registry.hidden=true;heading.textContent='Current endpoint documentation pointers';detail.className='muted';detail.textContent='Validated public pointers only. TAHAI does not open, fetch, index, or retain the referenced material.';rows.className='oi-search-results';registry.append(heading,detail,rows);panel.append(registry);const row=(label,value)=>{const item=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('span');item.className='oi-search-row';name.textContent=label;text.textContent=value;item.append(name,text);return item};const load=endpointId=>{rows.replaceChildren();registry.hidden=true;if(typeof endpointId!=='string'||!endpointId)return;chrome.send('listTahaiDocumentationReferences',[endpointId])};window.tahaiDocumentationReferenceRegistry=items=>{rows.replaceChildren();const values=Array.isArray(items)?items:[];if(!values.length)return;registry.hidden=false;for(const item of values){if(!item||typeof item!=='object')continue;const when=typeof item.recorded_at==='string'?item.recorded_at:'Local record';const label=typeof item.label==='string'?item.label:'Documentation pointer';const pointer=typeof item.reference_url==='string'?item.reference_url:'Unavailable';rows.append(row(`${when} · ${label}`,pointer))}};endpoint.addEventListener('change',()=>load(endpoint.value));const existing=window.tahaiDocumentationReferenceComplete;window.tahaiDocumentationReferenceComplete=(recorded,pointer,endpointId)=>{if(typeof existing==='function')existing(recorded,pointer,endpointId);if(recorded)load(endpointId)};if(endpoint.value)load(endpoint.value)})();
)TAHAI";

constexpr char kSupportNetworkMissionJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#network-inspection-form'),host=document.querySelector('#network-inspection-host'),status=document.querySelector('#support-status'),output=document.querySelector('#network-inspection-results');if(!form||!host)return;const button=form.querySelector('button[type=submit]'),mission=document.createElement('select'),empty=document.createElement('option');mission.className='button';mission.id='network-inspection-mission';empty.value='';empty.textContent='No Mission association';mission.append(empty);if(button)form.insertBefore(mission,button);window.tahaiSupportMissionList=items=>{for(const item of Array.isArray(items)?items:[]){if(!item||typeof item.id!=='string'||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title;mission.append(option)}};form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const value=host.value.trim();if(!value||value.length>253){if(status)status.textContent='Enter a host name or IPv4 address up to 253 characters.';return}if(status)status.textContent='Resolving DNS and running an HTTPS TLS probe…';if(output)output.replaceChildren();chrome.send('inspectTahaiNetwork',[value,mission.value])},true);chrome.send('listTahaiSupportMissions')})();
)TAHAI";

constexpr char kSupportNetworkHistoryJs[] = R"TAHAI(
(() => {
  'use strict';
  const output = document.querySelector('#network-inspection-results');
  if (!output || !output.parentNode) return;
  const history = document.createElement('section');
  const heading = document.createElement('h3');
  const detail = document.createElement('p');
  const rows = document.createElement('div');
  history.className = 'section';
  history.id = 'network-inspection-history';
  history.hidden = true;
  heading.textContent = 'Local inspection history';
  detail.className = 'muted';
  detail.textContent = 'Newest eight rows for this exact host. Reading this local metadata never runs another probe.';
  rows.className = 'oi-search-results';
  history.append(heading, detail, rows);
  output.parentNode.insertBefore(history, output.nextSibling);
  const row = (label, text) => {
    const item = document.createElement('div');
    const name = document.createElement('strong');
    const value = document.createElement('span');
    item.className = 'oi-search-row';
    name.textContent = label;
    value.textContent = text;
    item.append(name, value);
    return item;
  };
  const value = (item, key, fallback) =>
      item && typeof item[key] !== 'undefined' ? String(item[key]) : fallback;
  const count = (item, key) => {
    const candidate = item?.[key];
    return Number.isInteger(candidate) && candidate >= 0 && candidate <= 64
        ? String(candidate)
        : 'Unavailable';
  };
  const securityHeaderCount = item => {
    const candidate = item?.observed_security_header_count;
    return Number.isInteger(candidate) && candidate >= 0 && candidate <= 6
        ? `${candidate} of 6 observed; values not retained`
        : 'Unavailable';
  };
  const existing = window.tahaiNetworkInspectionComplete;
  window.tahaiNetworkInspectionComplete = result => {
    if (typeof existing === 'function') existing(result);
    rows.replaceChildren();
    history.hidden = true;
    if (!result || !result.recorded || typeof result.host !== 'string') return;
    chrome.send('listTahaiNetworkInspectionHistory', [result.host]);
  };
  window.tahaiNetworkInspectionHistory = (host, items) => {
    rows.replaceChildren();
    const values = Array.isArray(items) ? items : [];
    if (!values.length) return;
    history.hidden = false;
    for (const item of values) {
      if (!item || typeof item !== 'object') continue;
      const tls = item.tls_info_available
          ? (item.certificate_valid
              ? (item.certificate_expired ? 'expired' : 'valid')
              : 'not validated')
          : 'unavailable';
      const days = Number.isInteger(item.certificate_days_remaining) &&
              item.certificate_days_remaining >= 0
          ? String(item.certificate_days_remaining)
          : 'Unavailable';
      const comparison = value(item, 'comparison', 'unknown');
      const changed = value(item, 'changed_fields', 'none');
      const publicGuard = item.public_address_guard_blocked === true;
      const securityHeaders = item.security_header_observation_available === true
          ? securityHeaderCount(item)
          : 'Unavailable';
      rows.append(
          row(value(item, 'inspected_at', 'Inspection'),
              `Comparison: ${comparison}; changed: ${changed}`),
          row('DNS topology',
              `IPv4: ${count(item, 'resolved_ipv4_count')}; IPv6: ${count(item, 'resolved_ipv6_count')}; aliases: ${count(item, 'dns_alias_count')}`),
          row('Selected HTTP security headers', securityHeaders),
          row('DNS / request / HTTPS',
              `${value(item, 'dns_net_error', '0')} / ${value(item, 'request_net_error', '0')} / ${value(item, 'http_status', 'Unavailable')}`),
          row('Public address guard',
              publicGuard ? 'blocked before HTTPS' : 'not triggered'),
          row('TLS', `${tls}; days remaining: ${days}`));
    }
  };
})();
)TAHAI";

constexpr char kSupportArtifactBoundaryTruthJs[] = R"TAHAI(
(()=>{'use strict';const panel=Array.from(document.querySelectorAll('.panel.oi-boundary')).find(candidate=>candidate.textContent.includes('No file or download access'));const text=panel&&panel.querySelector('.boundary');if(text)text.textContent='Artifact metadata can be linked to an active local Mission through the explicit picker. TAHAI still retains no local path, bytes, response body, response headers, cookie, credential, or browser download record.'})();
)TAHAI";

constexpr char kLocalOiWatchJs[] = R"TAHAI(
(()=>{'use strict';const panel=Array.from(document.querySelectorAll('.panel')).find(candidate=>candidate.textContent.includes('Watchlists & local assist'));if(!panel)return;const status=panel.querySelector('.muted'),list=document.createElement('ul');list.className='list';list.id='tahai-manual-watch-list';panel.insertBefore(list,panel.querySelector('.boundary'));window.tahaiManualWatchList=items=>{list.replaceChildren();const watches=Array.isArray(items)?items:[];if(status)status.textContent=watches.length?'Configured local recheck entries are manual only. Their due state is a local reminder; no task, timer, or background network activity is active.':'No local watch is configured. Local OI does not observe browsing activity, schedule network checks, or collect page content without a separate operator-approved tool run.';if(!watches.length)return;for(const watch of watches){const item=document.createElement('li'),name=document.createElement('strong'),detail=document.createElement('span');const due=watch.schedule_state==='due'?'due for explicit recheck':watch.schedule_state==='scheduled'?`next manual recheck in ${watch.seconds_until_due||0} seconds`:'manual due state unavailable';name.textContent=watch.title||'Manual recheck';detail.textContent=`${watch.target||'Unavailable'} · ${watch.execution_mode||'manual_only'} · ${due}`;item.append(name,detail);list.append(item)}};chrome.send('listTahaiManualWatches')})();
)TAHAI";

constexpr char kLocalOiPrivacyControlsJs[] = R"TAHAI(
(()=>{'use strict';const actions=document.querySelector('.oi-hero .actions');if(!actions)return;const clear=document.createElement('button');clear.className='button danger';clear.type='button';clear.textContent='Clear Local OI data';clear.title='Deletes only the Local OI profile store; Mission Control owns its separate mission store.';clear.addEventListener('click',()=>{if(window.confirm('Delete all profile-local TAHAI Local OI records? Mission Control missions are not deleted.'))chrome.send('deleteTahaiLocalOiData')});actions.append(clear);window.tahaiLocalOiDataDeleted=()=>window.location.reload()})();
)TAHAI";

constexpr char kLocalOiBoundaryTruthJs[] = R"TAHAI(
(()=>{'use strict';const hero=document.querySelector('.oi-hero .hero>.muted'),boundary=document.querySelector('.oi-privacy-rail .oi-state-card:last-child span');if(hero)hero.textContent='Local OI turns bounded Mission Control state and operator-saved Support Engineer metadata into an on-device operational view. It works deterministically without a model, connector, account, or cloud upload.';if(boundary)boundary.textContent='No browser history, ordinary tabs, page bodies, credentials, cookies, screenshots, or account data enter Local OI. Explicit public support targets and documentation pointers appear only when you save them.'})();
)TAHAI";

constexpr char kModeCss[] = R"TAHAI(
.mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mode-grid .card{min-height:0;padding:17px;gap:14px}.mode-grid .card::after{display:none}.mode-grid .card:hover{transform:translateY(-2px);box-shadow:0 12px 28px #0005}.mode-grid .card strong{font-size:1rem}.mode-grid .card.mode-active{border-color:#60ffda;box-shadow:0 0 28px #00beff24}.mode-grid .card.mode-active::before{content:"";position:absolute;inset:5px;border:1px solid #60ffda99;border-radius:16px;box-shadow:inset 0 0 18px #00beff16,0 0 18px #60ffda20;pointer-events:none}.mode-card-title{color:var(--mint);font-size:.7rem;font-weight:850;letter-spacing:.16em;text-transform:uppercase}.mode-card-audience{display:block;margin-top:7px;line-height:1.42}.mode-card-theme{display:block;margin-top:8px;color:#9eb7dc;font-size:.75rem;font-weight:700;letter-spacing:.04em}.mode-card-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--muted);font-size:.82rem}.mode-card-footer .chip{min-height:36px;padding:7px 12px}.mode-card.mode-creator{border-top-color:#d95cff}.mode-card.mode-builder{border-top-color:#51c9ff}.mode-card.mode-operator{border-top-color:#48e4d5}.mode-card.mode-research{border-top-color:#b595ff}.mode-card.mode-support{border-top-color:#79f5c7}.chip.selected{border-color:#60ffda;background:linear-gradient(135deg,#087f96,#4934a7 58%,#8b2bb5);box-shadow:0 0 22px #00beff44}.mode-actions{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px}.mode-actions h2{margin:3px 0 0;font-size:1.12rem}.mode-actions nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:9px}.mode-flyout{margin-top:14px;border-top:1px solid #355b8559;padding-top:12px;color:var(--muted)}.mode-flyout summary{cursor:pointer;color:var(--mint);font-weight:750}.mode-flyout p{margin:9px 0 0;max-width:70ch}.mode-dialog{width:min(900px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:0;color:var(--ink);background:linear-gradient(145deg,#091529,#101136 62%,#1f1240);border:1px solid #3b79abbb;border-radius:20px;box-shadow:0 30px 100px #000b}.mode-dialog::backdrop{background:#000b;backdrop-filter:blur(5px)}.mode-dialog form{display:grid;gap:16px;padding:22px}.mode-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.mode-dialog-head h2{margin:4px 0 0;font-size:1.38rem}.mode-dialog-head .chip{flex:none}.mode-config{display:grid;gap:15px}.mode-config-group{display:grid;gap:8px}.mode-config-group h3{margin:0;font-size:.94rem}.template-card{min-height:142px}.template-card .actions{margin-top:14px}.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid #355b8559;border-radius:14px;background:#090f22cc}.product-lane{color:var(--mint);font-weight:700}body.theme-light .mode-card-theme{color:#567393}body.theme-light .mode-dialog{color:#11213c;background:linear-gradient(145deg,#fff,#edf5ff 62%,#f6efff);border-color:#4f91c577}@media(max-width:960px){.mode-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.mode-actions{display:grid}.mode-actions nav{justify-content:flex-start}}@media(max-width:620px){.mode-grid{grid-template-columns:1fr}.mode-dialog form{padding:16px}}
.command-palette{width:min(900px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:0;color:var(--ink);background:linear-gradient(145deg,#091529,#101136 62%,#1f1240);border:1px solid #3b79abbb;border-radius:20px;box-shadow:0 30px 100px #000b}.command-palette::backdrop{background:#000b;backdrop-filter:blur(5px)}.command-palette form{display:grid;gap:14px;padding:22px}.command-palette-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.command-palette-head h2{margin:4px 0 0;font-size:1.38rem}.command-palette-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:52vh;overflow:auto}.command-palette-results .command{grid-template-columns:1fr auto;min-height:68px}.command-palette kbd{align-self:center;padding:3px 7px;border:1px solid #6d95c780;border-radius:6px;color:var(--muted);font-family:ui-monospace,monospace;font-size:.72rem;white-space:nowrap}body.theme-light .command-palette{color:#11213c;background:linear-gradient(145deg,#fff,#edf5ff 62%,#f6efff);border-color:#4f91c577}@media(max-width:700px){.command-palette-results{grid-template-columns:1fr}}@media(max-width:620px){.command-palette form{padding:16px}}
body.theme-light{color-scheme:light;color:#11213c;background:radial-gradient(circle at 8% 4%,#bdeaff 0,transparent 30rem),radial-gradient(circle at 92% 12%,#edc8ff 0,transparent 29rem),radial-gradient(circle at 62% 82%,#baffeb 0,transparent 34rem),linear-gradient(145deg,#f8fcff 0%,#eaf2ff 55%,#f7f2ff 100%)}body.theme-light::before{opacity:.22;background-image:linear-gradient(#113b6b19 1px,transparent 1px),linear-gradient(90deg,#113b6b19 1px,transparent 1px)}body.theme-light .shell{color:#11213c}body.theme-light header{background:#ffffffbd;border-color:#4f91c555;box-shadow:0 20px 60px #33507a26}body.theme-light .panel,body.theme-light .hero{background:linear-gradient(145deg,#ffffffef,#eef6ffea 58%,#faf4ffe8);border-color:#4f91c566;box-shadow:0 20px 58px #33507a26,inset 0 1px #fff}body.theme-light .muted,body.theme-light .card span{color:#48617f}body.theme-light .button,body.theme-light .chip{color:#132947;background:linear-gradient(135deg,#f9fdff,#e8f1ff);border-color:#4e88bb80;box-shadow:inset 0 1px #fff}body.theme-light .button.primary,body.theme-light .chip.selected{color:#fff;background:linear-gradient(135deg,#087fa1,#4b43bf 58%,#9a3db6)}body.theme-light .card,body.theme-light .mission-step,body.theme-light .toggle-row,body.theme-light .command,body.theme-light .list li{background:linear-gradient(145deg,#ffffffef,#edf4ffea);border-color:#5b8db95e;box-shadow:inset 0 1px #fff}body.theme-light .search input,body.theme-light .command-input{color:#11213c;background:#ffffffd9;border-color:#488cc087;box-shadow:inset 0 1px 10px #7ba7cf22}body.theme-light .status{color:#164b42;background:linear-gradient(135deg,#d9fff3,#e5f4ff)}body.theme-light .boundary{background:#fff2d1;color:#634400}.theme-light .hero-badge{background:#fff;color:#14315a}
/* A work mode is a calm, persistent visual identity layered over the user's
   light or dark choice. It never changes a web page, tab, or browser policy. */
body.mode-daily{--cyan:#3abdff;--blue:#00beff;--mint:#60ffda;--violet:#ae57ff;--coral:#ff6c8f}body.mode-creator{--cyan:#55d5ff;--blue:#6c62ff;--mint:#76ffd8;--violet:#d95cff;--coral:#ff8b72;background:radial-gradient(circle at 9% 4%,#19296f 0,transparent 31rem),radial-gradient(circle at 91% 11%,#721d77 0,transparent 30rem),radial-gradient(circle at 56% 83%,#164873 0,transparent 35rem),linear-gradient(145deg,#07061c,#170a31 54%,#09152d)}body.mode-builder{--cyan:#51c9ff;--blue:#1886f6;--mint:#79f0c2;--violet:#7b93ff;--coral:#f4b673;background:radial-gradient(circle at 9% 4%,#063e70 0,transparent 31rem),radial-gradient(circle at 91% 10%,#133978 0,transparent 30rem),radial-gradient(circle at 56% 83%,#123a47 0,transparent 35rem),linear-gradient(145deg,#031223,#061d38 54%,#071424)}body.mode-operator{--cyan:#48e4d5;--blue:#20a8d1;--mint:#a6ffb8;--violet:#7b9fff;--coral:#ffc56d;background:radial-gradient(circle at 9% 4%,#075354 0,transparent 31rem),radial-gradient(circle at 91% 10%,#25435d 0,transparent 30rem),radial-gradient(circle at 56% 83%,#264419 0,transparent 35rem),linear-gradient(145deg,#04191d,#082c31 54%,#111a16)}body.mode-research{--cyan:#86bdff;--blue:#5d8ee6;--mint:#9ddfbd;--violet:#b595ff;--coral:#d89a79;background:radial-gradient(circle at 9% 4%,#243a66 0,transparent 31rem),radial-gradient(circle at 91% 10%,#53416a 0,transparent 30rem),radial-gradient(circle at 56% 83%,#344b42 0,transparent 35rem),linear-gradient(145deg,#101629,#24283b 54%,#171a26)}body.mode-support{--cyan:#6bdaff;--blue:#3a9ee8;--mint:#79f5c7;--violet:#8796ff;--coral:#ff9b89;background:radial-gradient(circle at 9% 4%,#07527c 0,transparent 31rem),radial-gradient(circle at 91% 10%,#2b3f78 0,transparent 30rem),radial-gradient(circle at 56% 83%,#064f58 0,transparent 35rem),linear-gradient(145deg,#051629,#092847 54%,#071d2b)}body.mode-creator .hero::before{background:conic-gradient(from 45deg,#6c62ff00,#55d5ff88,#d95cffaa,#ff8b7266,#6c62ff00)}body.mode-builder .hero::before{background:conic-gradient(from 45deg,#1886f600,#51c9ff88,#7b93ffaa,#79f0c266,#1886f600)}body.mode-operator .hero::before{background:conic-gradient(from 45deg,#20a8d100,#48e4d588,#a6ffb8aa,#ffc56d66,#20a8d100)}body.mode-research .hero::before{background:conic-gradient(from 45deg,#5d8ee600,#86bdff88,#b595ffaa,#9ddfbd66,#5d8ee600)}body.mode-support .hero::before{background:conic-gradient(from 45deg,#3a9ee800,#6bdaff88,#8796ffaa,#79f5c766,#3a9ee800)}body.mode-creator .button.primary,body.mode-creator .chip.selected{background:linear-gradient(135deg,#4d6fff,#9a45d8 58%,#ed688d)}body.mode-builder .button.primary,body.mode-builder .chip.selected{background:linear-gradient(135deg,#087cae,#315fe0 58%,#4f9f92)}body.mode-operator .button.primary,body.mode-operator .chip.selected{background:linear-gradient(135deg,#087f83,#227bb0 58%,#749a44)}body.mode-research .button.primary,body.mode-research .chip.selected{background:linear-gradient(135deg,#466aa8,#7564aa 58%,#718b69)}body.mode-support .button.primary,body.mode-support .chip.selected{background:linear-gradient(135deg,#188ab8,#4d6dc3 58%,#4eaa8c)}body.theme-light.mode-creator{background:radial-gradient(circle at 8% 4%,#d9dcff 0,transparent 30rem),radial-gradient(circle at 92% 12%,#ffd5ed 0,transparent 29rem),radial-gradient(circle at 62% 82%,#d6f8ff 0,transparent 34rem),linear-gradient(145deg,#fcfaff,#f3efff 55%,#fff4f8)}body.theme-light.mode-builder{background:radial-gradient(circle at 8% 4%,#ccecff 0,transparent 30rem),radial-gradient(circle at 92% 12%,#d8e1ff 0,transparent 29rem),radial-gradient(circle at 62% 82%,#d8f5e7 0,transparent 34rem),linear-gradient(145deg,#f7fbff,#ebf3ff 55%,#f4fbf8)}body.theme-light.mode-operator{background:radial-gradient(circle at 8% 4%,#c9fff4 0,transparent 30rem),radial-gradient(circle at 92% 12%,#d9ecff 0,transparent 29rem),radial-gradient(circle at 62% 82%,#f7f0c7 0,transparent 34rem),linear-gradient(145deg,#f6fffd,#e9f8fa 55%,#fbfaed)}body.theme-light.mode-research{background:radial-gradient(circle at 8% 4%,#e4eaff 0,transparent 30rem),radial-gradient(circle at 92% 12%,#f0ddff 0,transparent 29rem),radial-gradient(circle at 62% 82%,#e7f3dc 0,transparent 34rem),linear-gradient(145deg,#fffdf8,#f5f2fb 55%,#f9f7ed)}body.theme-light.mode-support{background:radial-gradient(circle at 8% 4%,#d2f3ff 0,transparent 30rem),radial-gradient(circle at 92% 12%,#e1e5ff 0,transparent 29rem),radial-gradient(circle at 62% 82%,#d2faed 0,transparent 34rem),linear-gradient(145deg,#f9feff,#eff6ff 55%,#f3fcf8)}
)TAHAI";

constexpr char kModeActionCss[] = R"TAHAI(
.mode-surface-menu{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:-16px 0 28px;padding:10px 13px;border:1px solid var(--mode-border,#4a80af66);border-radius:16px;background:color-mix(in srgb,var(--mode-surface,#091329) 84%,transparent);box-shadow:0 12px 30px var(--mode-shadow,#0005);backdrop-filter:blur(14px)}.mode-surface-menu-copy{display:grid;gap:2px;min-width:0}.mode-surface-menu-copy strong{font-size:.78rem;letter-spacing:.09em;text-transform:uppercase}.mode-surface-menu-copy span{color:var(--muted);font-size:.76rem;line-height:1.35}.mode-surface-menu nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.mode-surface-menu .chip{min-height:34px;padding:6px 11px;font-size:.76rem}.mode-surface-menu .chip.primary{border-color:#60ffda99;background:linear-gradient(135deg,#087f96,#4934a7 58%,#8b2bb5);box-shadow:0 0 18px #00beff38}@media(max-width:780px){.mode-surface-menu{display:grid;margin-top:-10px}.mode-surface-menu nav{justify-content:flex-start}}
)TAHAI";

// Mode signatures are professional cockpit systems rather than decorative
// themes. Palette, geometry, typography, density, texture, and information
// hierarchy vary by job while every surface remains recognizably TAHAI.
constexpr char kModeSignatureCss[] = R"TAHAI(
body.mode-daily,body.mode-creator,body.mode-builder,body.mode-operator,
body.mode-research,body.mode-support{--mode-accent:#8092a8;--mode-accent-strong:#aebccc;--mode-surface:#111820f2;--mode-surface-2:#151e28ed;--mode-border:#60708466;--mode-shadow:#00000070;background-attachment:fixed}
body.mode-daily header,body.mode-creator header,body.mode-builder header,
body.mode-operator header,body.mode-research header,body.mode-support header{border-color:var(--mode-border);border-radius:10px;background:var(--mode-surface);box-shadow:0 10px 30px var(--mode-shadow);backdrop-filter:blur(14px)}
body.mode-daily .hero,body.mode-daily .panel,body.mode-creator .hero,
body.mode-creator .panel,body.mode-builder .hero,body.mode-builder .panel,
body.mode-operator .hero,body.mode-operator .panel,body.mode-research .hero,
body.mode-research .panel,body.mode-support .hero,body.mode-support .panel{border-color:var(--mode-border);border-radius:10px;background:var(--mode-surface);box-shadow:0 18px 48px var(--mode-shadow),inset 0 1px #ffffff0b;backdrop-filter:blur(12px)}
body.mode-daily .hero::before,body.mode-creator .hero::before,
body.mode-builder .hero::before,body.mode-operator .hero::before,
body.mode-research .hero::before,body.mode-support .hero::before{width:4px;height:100%;right:0;top:0;border-radius:0;background:var(--mode-accent);filter:none;opacity:.78}
body.mode-daily .card,body.mode-creator .card,body.mode-builder .card,
body.mode-operator .card,body.mode-research .card,body.mode-support .card{border-color:var(--mode-border);border-radius:8px;background:var(--mode-surface-2);box-shadow:inset 0 1px #ffffff0a}
body.mode-daily .card::after,body.mode-creator .card::after,
body.mode-builder .card::after,body.mode-operator .card::after,
body.mode-research .card::after,body.mode-support .card::after{width:72px;height:2px;right:18px;bottom:16px;border-radius:0;background:var(--mode-accent);opacity:.62}
body.mode-daily .button,body.mode-daily .chip,body.mode-creator .button,
body.mode-creator .chip,body.mode-builder .button,body.mode-builder .chip,
body.mode-operator .button,body.mode-operator .chip,body.mode-research .button,
body.mode-research .chip,body.mode-support .button,body.mode-support .chip{border-color:var(--mode-border);border-radius:6px;background:linear-gradient(180deg,#ffffff0d,#ffffff05);box-shadow:inset 0 1px #ffffff0d}
body.mode-daily .button.primary,body.mode-daily .chip.selected,
body.mode-creator .button.primary,body.mode-creator .chip.selected,
body.mode-builder .button.primary,body.mode-builder .chip.selected,
body.mode-operator .button.primary,body.mode-operator .chip.selected,
body.mode-research .button.primary,body.mode-research .chip.selected,
body.mode-support .button.primary,body.mode-support .chip.selected{border-color:var(--mode-accent-strong);background:linear-gradient(180deg,var(--mode-accent-strong),var(--mode-accent));color:#fff;box-shadow:0 6px 18px #0005}

/* Daily Driver: executive graphite, quiet spacing, minimal instrumentation. */
body.mode-daily{--cyan:#8ca9c1;--blue:#6f8ba5;--mint:#9db6aa;--violet:#8890a5;--coral:#ad8f87;--muted:#b9c2cc;--mode-accent:#637d94;--mode-accent-strong:#839aae;--mode-surface:#10161cef;--mode-surface-2:#141c24ed;--mode-border:#66778959;--mode-shadow:#00000068;background:linear-gradient(145deg,#0c1116,#121a22 58%,#0d1319)}
body.mode-daily::before{opacity:.08;background-image:linear-gradient(#ffffff08 1px,transparent 1px);background-size:100% 88px;mask-image:linear-gradient(to bottom,#000,transparent 78%)}
body.mode-daily .shell{max-width:1680px}body.mode-daily .hero{min-height:360px}body.mode-daily .eyebrow{letter-spacing:.14em;text-shadow:none}

/* Creator Studio: art-direction suite, deep ink with restrained plum and brass. */
body.mode-creator{--cyan:#8ba9c9;--blue:#647eaa;--mint:#b5b2a1;--violet:#8f789d;--coral:#a87970;--muted:#c8c2cb;--mode-accent:#725d7d;--mode-accent-strong:#957fa0;--mode-surface:#17141bef;--mode-surface-2:#1d1922ed;--mode-border:#9b8b9c5c;--mode-shadow:#0503077a;background:radial-gradient(ellipse at 85% 0,#352c3b 0,transparent 36rem),linear-gradient(145deg,#100f13,#1b1820 55%,#11151b)}
body.mode-creator::before{opacity:.13;background-image:linear-gradient(120deg,#b8a7be17 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(to bottom,#000,transparent 88%)}
body.mode-creator header{border-radius:14px}body.mode-creator .hero,body.mode-creator .panel{border-radius:16px}body.mode-creator .card{border-radius:12px}body.mode-creator .hero h2{font-weight:620;letter-spacing:-.042em}body.mode-creator .eyebrow{color:#b9a5c1;text-shadow:none}

/* Builder: architectural drafting environment with measured blue grid. */
body.mode-builder{--cyan:#7eabc9;--blue:#527da2;--mint:#8caeaa;--violet:#72849e;--coral:#a48c74;--muted:#b4c7d4;--mode-accent:#456f91;--mode-accent-strong:#648eae;--mode-surface:#0b1720f2;--mode-surface-2:#0e1e29ed;--mode-border:#5e849d66;--mode-shadow:#00070c78;background:linear-gradient(#6c94ad0d 1px,transparent 1px),linear-gradient(90deg,#6c94ad0d 1px,transparent 1px),linear-gradient(145deg,#08121a,#0c202d 58%,#091720);background-size:40px 40px,40px 40px,auto}
body.mode-builder::before{opacity:.18;background-image:linear-gradient(#83a8bd13 1px,transparent 1px),linear-gradient(90deg,#83a8bd13 1px,transparent 1px);background-size:8px 8px;mask-image:linear-gradient(to bottom,#000,transparent 82%)}
body.mode-builder header,body.mode-builder .hero,body.mode-builder .panel{border-radius:4px}body.mode-builder .card,body.mode-builder .button,body.mode-builder .chip{border-radius:2px}body.mode-builder .eyebrow,body.mode-builder .scope,body.mode-builder kbd{font-family:"Cascadia Mono","Segoe UI Mono",ui-monospace,monospace;letter-spacing:.1em;text-shadow:none}body.mode-builder .hero h2{max-width:1100px}

/* Operator: hardened operations console with signal green and amber states. */
body.mode-operator{--cyan:#7faaa1;--blue:#577f79;--mint:#91b39a;--violet:#78838f;--coral:#b39870;--warn:#c9a65a;--muted:#c1c9bf;--mode-accent:#587c64;--mode-accent-strong:#77967f;--mode-surface:#101815f2;--mode-surface-2:#151e19ed;--mode-border:#71827561;--mode-shadow:#0007047a;background:repeating-linear-gradient(0deg,#a4b5a506 0 1px,transparent 1px 7px),linear-gradient(180deg,#0c120f,#151d18 52%,#10140f)}
body.mode-operator::before{opacity:.16;background-image:linear-gradient(90deg,#9aa99b0d 1px,transparent 1px);background-size:160px 100%;mask-image:none}
body.mode-operator header,body.mode-operator .hero,body.mode-operator .panel{border-radius:3px}body.mode-operator .card{border-radius:2px;border-left:3px solid var(--mode-accent)}body.mode-operator .button,body.mode-operator .chip,body.mode-operator .status{border-radius:2px}body.mode-operator .eyebrow,body.mode-operator .scope{font-family:"Cascadia Mono","Segoe UI Mono",ui-monospace,monospace;color:#9bb5a1;letter-spacing:.11em;text-shadow:none}body.mode-operator .status{background:#17251d;color:#d6ddd6}

/* Research Desk: editorial archive, warm slate, paper rules, serif hierarchy. */
body.mode-research{--cyan:#aaa18e;--blue:#807764;--mint:#b6ad96;--violet:#8e8390;--coral:#9d7c69;--muted:#d0c8b8;--mode-accent:#88795e;--mode-accent-strong:#a39578;--mode-surface:#1b1916f2;--mode-surface-2:#221f1aed;--mode-border:#9d90765c;--mode-shadow:#05040375;background:linear-gradient(#c6b9960a 1px,transparent 1px),linear-gradient(145deg,#151411,#24211b 58%,#181713);background-size:100% 32px,auto}
body.mode-research::before{opacity:.15;background-image:linear-gradient(90deg,#a99a7911 1px,transparent 1px);background-size:56px 100%;mask-image:linear-gradient(to bottom,#000,transparent 90%)}
body.mode-research header,body.mode-research .hero,body.mode-research .panel{border-radius:2px}body.mode-research .card,body.mode-research .button,body.mode-research .chip{border-radius:1px}body.mode-research h1,body.mode-research h2,body.mode-research h3{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}body.mode-research .eyebrow{color:#b4a789;letter-spacing:.13em;text-shadow:none}body.mode-research .card{box-shadow:inset 2px 0 var(--mode-accent)}

/* Support Desk: structured service center, sober navy and clear cyan signals. */
body.mode-support{--cyan:#79aabd;--blue:#537e9c;--mint:#89aaa7;--violet:#737f98;--coral:#a48178;--muted:#bccbd5;--mode-accent:#477c96;--mode-accent-strong:#6595aa;--mode-surface:#0d1820f2;--mode-surface-2:#11212ced;--mode-border:#64839761;--mode-shadow:#00060a75;background:linear-gradient(90deg,#6b8da20a 1px,transparent 1px),linear-gradient(#6b8da207 1px,transparent 1px),linear-gradient(155deg,#09141b,#102733 56%,#0b1923);background-size:120px 120px,120px 120px,auto}
body.mode-support::before{opacity:.12;background-image:linear-gradient(90deg,#91adbd15 50%,transparent 50%);background-size:240px 100%;mask-image:linear-gradient(to bottom,#000,transparent 86%)}
body.mode-support header,body.mode-support .hero,body.mode-support .panel{border-radius:8px}body.mode-support .card{border-radius:6px}body.mode-support .eyebrow{color:#91afbd;letter-spacing:.13em;text-shadow:none}body.mode-support .status{border-radius:4px;background:#132b37;color:#d5e4ea}

/* Light counterparts retain each mode's hierarchy without pastel styling. */
body.theme-light.mode-daily{color:#17212a;--mode-surface:#f4f6f7f2;--mode-surface-2:#edf1f3ed;--mode-border:#6d7d8957;--mode-shadow:#22303a20;background:linear-gradient(145deg,#f3f5f6,#e8edf0 58%,#f5f6f7)}
body.theme-light.mode-creator{color:#211d24;--mode-surface:#f6f3f5f2;--mode-surface-2:#eee9eded;--mode-border:#87798957;--mode-shadow:#281e2820;background:radial-gradient(ellipse at 86% 0,#ded6df 0,transparent 34rem),linear-gradient(145deg,#f7f5f6,#ece8ec 58%,#f4f3f2)}
body.theme-light.mode-builder{color:#14232d;--mode-surface:#f1f5f7f2;--mode-surface-2:#e7eef2ed;--mode-border:#58798e57;--mode-shadow:#1631441f;background:linear-gradient(#537b9314 1px,transparent 1px),linear-gradient(90deg,#537b9314 1px,transparent 1px),linear-gradient(145deg,#f3f6f7,#e6eef2 58%,#f2f5f6);background-size:40px 40px,40px 40px,auto}
body.theme-light.mode-operator{color:#18221c;--mode-surface:#f2f5f2f2;--mode-surface-2:#e9eeeaed;--mode-border:#61756557;--mode-shadow:#1c2c2020;background:repeating-linear-gradient(0deg,#5d74610a 0 1px,transparent 1px 7px),linear-gradient(180deg,#f4f6f4,#e8ede9 55%,#f5f4ef)}
body.theme-light.mode-research{color:#28241d;--mode-surface:#f5f2ebf2;--mode-surface-2:#ece7dded;--mode-border:#887a5f57;--mode-shadow:#3a30201f;background:linear-gradient(#8d7e5f14 1px,transparent 1px),linear-gradient(145deg,#f7f4ed,#eae5db 58%,#f4f1e9);background-size:100% 32px,auto}
body.theme-light.mode-support{color:#16242d;--mode-surface:#f1f5f6f2;--mode-surface-2:#e5edf1ed;--mode-border:#58768957;--mode-shadow:#17304020;background:linear-gradient(90deg,#55768a0c 1px,transparent 1px),linear-gradient(#55768a0a 1px,transparent 1px),linear-gradient(155deg,#f2f5f6,#e5edf1 58%,#f3f5f6);background-size:120px 120px,120px 120px,auto}
body.theme-light.mode-daily .eyebrow,body.theme-light.mode-creator .eyebrow,
body.theme-light.mode-builder .eyebrow,body.theme-light.mode-operator .eyebrow,
body.theme-light.mode-research .eyebrow,body.theme-light.mode-support .eyebrow{color:var(--mode-accent);text-shadow:none}

/* Workspace Studio is intentionally finite and visual-only. These classes
   turn every saved per-mode choice into an observable cockpit treatment. */
body.accent-slate{--mode-accent:#64748b;--mode-accent-strong:#94a3b8;--cyan:#9aa8b8;--blue:#718097;--mint:#a3b0a4;--violet:#85899d;--coral:#a38c83}
body.accent-azure{--mode-accent:#3d7ea6;--mode-accent-strong:#63a7cf;--cyan:#8fc4dd;--blue:#4b88ba;--mint:#98bdb6;--violet:#748ca9;--coral:#aa9375}
body.accent-teal{--mode-accent:#3f7f79;--mode-accent-strong:#66a79d;--cyan:#86bbb5;--blue:#4c8f93;--mint:#a5c6a9;--violet:#798e98;--coral:#ad986f}
body.accent-violet{--mode-accent:#765d8b;--mode-accent-strong:#9b81af;--cyan:#a99ec1;--blue:#7376a6;--mint:#b5b29d;--violet:#967eae;--coral:#ad8580}
body.accent-amber{--mode-accent:#92734c;--mode-accent-strong:#b69567;--cyan:#b5a983;--blue:#7e8490;--mint:#afb18e;--violet:#928894;--coral:#ba885c}
body.surface-quiet{background-image:linear-gradient(145deg,#0e151c,#141c24 58%,#10171d);background-size:auto}body.theme-light.surface-quiet{background-image:linear-gradient(145deg,#f4f6f7,#e8edf0 58%,#f5f6f7)}
body.surface-grid{background-image:linear-gradient(#8ba2b10d 1px,transparent 1px),linear-gradient(90deg,#8ba2b10d 1px,transparent 1px),linear-gradient(145deg,#0d151c,#13202a 58%,#10161c);background-size:32px 32px,32px 32px,auto}body.theme-light.surface-grid{background-image:linear-gradient(#5b72840f 1px,transparent 1px),linear-gradient(90deg,#5b72840f 1px,transparent 1px),linear-gradient(145deg,#f3f6f7,#e6eef2 58%,#f2f5f6)}
body.surface-paper{background-image:linear-gradient(#c5b99a0c 1px,transparent 1px),linear-gradient(145deg,#171511,#242019 58%,#181611);background-size:100% 28px,auto}body.theme-light.surface-paper{background-image:linear-gradient(#8d7e5f14 1px,transparent 1px),linear-gradient(145deg,#f8f5ed,#ebe5da 58%,#f5f1e9)}
body.density-compact .shell{gap:14px}body.density-compact .section{gap:12px}body.density-compact .hero{padding:26px}body.density-compact .panel,body.density-compact .card{padding:14px}body.density-compact .mode-dialog form{gap:12px;padding:18px}body.density-compact header{padding:12px 16px}body.density-compact .grid{gap:10px}
body.density-spacious .shell{gap:30px}body.density-spacious .section{gap:26px}body.density-spacious .hero{padding:42px}body.density-spacious .panel,body.density-spacious .card{padding:24px}body.density-spacious .grid{gap:18px}
body.header-compact header{padding:10px 14px}body.header-compact header .mark{width:38px;height:38px}body.header-compact header h1{font-size:1.35rem}body.header-compact header .eyebrow{font-size:.58rem}
body.header-minimal header{padding:10px 14px}body.header-minimal header .mark{width:34px;height:34px}body.header-minimal header .eyebrow{display:none}body.header-minimal header h1{font-size:1.2rem}
body.runbook-rail-hidden .mode-runbook-rail{display:none}
)TAHAI";

// Local OI borrows the visual language of the TAHAI command deck—dense, calm,
// and state-forward—while remaining a browser-local, profile-scoped surface.
// It intentionally has no connector, tenant, or hosted-control-plane chrome.
constexpr char kLocalOiCss[] = R"TAHAI(
.oi-hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(270px,.55fr);gap:22px}.oi-hero .hero{min-height:0}.oi-hero .hero::before{right:-150px;top:-235px;opacity:.58}.oi-privacy-rail{display:grid;gap:12px;align-content:stretch}.oi-state-card{position:relative;display:grid;gap:10px;padding:20px;border:1px solid #60ffda52;border-radius:22px;background:linear-gradient(150deg,#071c2ae8,#0e1430ea 58%,#17122ee8);box-shadow:inset 0 1px #ffffff12,0 18px 42px #0006}.oi-state-card::before{content:"";position:absolute;inset:7px;border:1px solid #55d5ff25;border-radius:16px;pointer-events:none}.oi-state-card strong{font-size:clamp(2rem,3vw,3.4rem);line-height:.88;letter-spacing:-.06em;color:#dcfff5;text-shadow:0 0 28px #60ffda50}.oi-state-card span{color:var(--muted);line-height:1.45}.oi-state-card em{font-style:normal;color:var(--mint);font-size:.72rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.oi-metric-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.oi-metric{position:relative;min-height:125px;padding:17px;border:1px solid #42688f66;border-radius:17px;background:linear-gradient(145deg,#0b1530ee,#080d20e8);overflow:hidden;box-shadow:inset 0 1px #fff1}.oi-metric::after{content:"";position:absolute;width:86px;height:86px;right:-32px;bottom:-38px;border-radius:50%;background:radial-gradient(circle,#00beff4d,transparent 68%)}.oi-metric:nth-child(2n)::after{background:radial-gradient(circle,#ae57ff4b,transparent 68%)}.oi-metric:nth-child(3n)::after{background:radial-gradient(circle,#60ffda42,transparent 68%)}.oi-metric strong{display:block;position:relative;margin-top:20px;font-size:1.75rem;letter-spacing:-.05em}.oi-metric span{position:relative;color:var(--muted);font-size:.78rem;font-weight:760;letter-spacing:.08em;text-transform:uppercase}.oi-command-deck{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr);gap:15px}.oi-search-results{display:grid;gap:9px;margin-top:13px}.oi-search-row{padding:13px 15px;border:1px solid #355b8559;border-radius:13px;background:#090f22cc}.oi-search-row strong{display:block}.oi-search-row span{color:var(--muted);font-size:.86rem}.oi-mission-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:13px}.oi-mission{display:grid;gap:13px;padding:19px;border:1px solid #466e9666;border-radius:19px;background:linear-gradient(145deg,#0c1733ee,#080d20e8);box-shadow:inset 0 1px #fff1}.oi-mission[data-oi-readiness=ready]{border-top:3px solid var(--mint)}.oi-mission[data-oi-readiness="in progress"]{border-top:3px solid var(--cyan)}.oi-mission[data-oi-readiness="at risk"]{border-top:3px solid var(--warn)}.oi-mission[data-oi-readiness=blocked]{border-top:3px solid var(--coral)}.oi-mission[data-oi-readiness=archived]{opacity:.7;border-top:3px solid #8492a8}.oi-mission-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.oi-mission h3{margin:0;font-size:1.12rem}.oi-score{display:grid;place-items:center;width:62px;height:62px;flex:none;border:1px solid #60ffda80;border-radius:50%;background:radial-gradient(circle,#0e9c8c48,#071b29 68%);color:#dffff7;font-size:1.18rem;font-weight:860;box-shadow:0 0 22px #00beff25}.oi-progress{height:6px;border-radius:999px;background:#111b38;overflow:hidden}.oi-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--cyan),var(--mint),var(--violet));box-shadow:0 0 12px #60ffda99}.oi-findings{display:grid;gap:10px}.oi-finding{position:relative;display:grid;grid-template-columns:auto 1fr;gap:11px;padding:15px;border:1px solid #466e9666;border-radius:16px;background:#090f22d9}.oi-finding::before{content:"";width:8px;height:8px;margin-top:6px;border-radius:50%;background:#6da5d4;box-shadow:0 0 12px currentColor}.oi-finding[data-oi-severity=attention]{border-color:#ffd77d70}.oi-finding[data-oi-severity=attention]::before{background:var(--warn);color:var(--warn)}.oi-finding[data-oi-severity=blocked]{border-color:#ff6c8f80;background:linear-gradient(135deg,#311122cc,#101126d9)}.oi-finding[data-oi-severity=blocked]::before{background:var(--coral);color:var(--coral)}.oi-finding h3{margin:0 0 5px;font-size:1rem}.oi-finding p{margin:0;color:var(--muted);line-height:1.5}.oi-finding .recommendation{margin-top:8px;color:#d9f7ff}.oi-action-queue{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.oi-action{display:grid;gap:11px;padding:16px;border:1px solid #466e9666;border-radius:17px;background:linear-gradient(145deg,#0c1733ee,#080d20e8);box-shadow:inset 0 1px #fff1}.oi-action[data-oi-severity=blocked]{border-color:#ff6c8f80;background:linear-gradient(135deg,#311122cc,#101126d9)}.oi-action[data-oi-severity=attention]{border-color:#ffd77d70}.oi-action h3{margin:0;font-size:1rem}.oi-action p{margin:0;color:var(--muted);line-height:1.5}.oi-action .action-next{color:#d9f7ff}.oi-evidence-anchor{display:inline-flex;align-items:center;width:max-content;padding:4px 8px;border:1px solid #60ffda45;border-radius:999px;color:var(--mint);font-size:.7rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.oi-graph{display:grid;gap:8px}.oi-edge{display:grid;grid-template-columns:minmax(130px,.8fr) auto minmax(130px,.8fr);align-items:center;gap:10px;padding:12px 13px;border:1px solid #355b8559;border-radius:13px;background:linear-gradient(90deg,#09152bdb,#0d1128e3)}.oi-edge strong{font-size:.92rem}.oi-edge span{justify-self:center;padding:4px 8px;border:1px solid #60ffda45;border-radius:999px;color:var(--mint);font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.oi-edge em{font-style:normal;text-align:right;color:#b9c4df;font-size:.88rem}.oi-memory{display:grid;gap:8px;max-height:540px;overflow:auto}.oi-memory-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid #355b8544}.oi-memory-row:last-child{border-bottom:0}.oi-memory-kind{padding:4px 7px;border:1px solid #4a92bd65;border-radius:7px;color:var(--cyan);font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.oi-memory-row p{margin:0;line-height:1.4}.oi-memory-row time{color:#8fa4c8;font-size:.75rem;white-space:nowrap}.oi-boundary{border-color:#60ffda50;background:linear-gradient(145deg,#073126c9,#071d32d9)}.oi-boundary .boundary{margin:0}.oi-promotion{border-color:#ae57ff7a;background:linear-gradient(145deg,#1b1138eb,#0a1630ed 60%,#06302fd9)}.oi-promotion h2{max-width:24ch}.oi-promotion .actions{margin-top:18px}.oi-empty{padding:28px;text-align:center;border:1px dashed #5480aa80;border-radius:17px;color:var(--muted)}@media(max-width:1050px){.oi-metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.oi-hero,.oi-command-deck{grid-template-columns:1fr}}@media(max-width:700px){.oi-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.oi-edge{grid-template-columns:1fr}.oi-edge span,.oi-edge em{justify-self:start;text-align:left}.oi-memory-row{grid-template-columns:auto 1fr}.oi-memory-row time{grid-column:2}}@media(max-width:440px){.oi-metric-grid{grid-template-columns:1fr}}
)TAHAI";

constexpr char kLocalOiSearchCss[] = R"TAHAI(
.oi-search-form{display:grid;gap:10px}.oi-search-form .actions{align-items:center}.oi-search-form select.button{min-height:40px;max-width:210px;font:inherit}.oi-search-result{display:grid;width:100%;gap:4px;color:inherit;text-align:left;cursor:pointer;transition:border-color .18s ease,transform .18s ease}.oi-search-result:hover,.oi-search-result:focus-visible{border-color:var(--mint);outline:none;transform:translateX(3px)}body.theme-light .oi-search-result{background:linear-gradient(145deg,#ffffffef,#edf4ffea)}@media(max-width:700px){.oi-search-form .actions{display:grid;grid-template-columns:1fr}.oi-search-form select.button{max-width:none;width:100%}}
)TAHAI";

constexpr char kLocalOiGraphExplorerCss[] = R"TAHAI(
.oi-graph-explorer-results{display:grid;gap:9px;margin-top:13px}.oi-graph-explorer-results .oi-edge{grid-template-columns:minmax(110px,.75fr) auto minmax(110px,.75fr);align-items:start}.oi-graph-explorer-results .oi-edge>div{display:grid;gap:5px}.oi-graph-explorer-results .oi-edge small{color:var(--muted);line-height:1.4}.oi-graph-explorer-results .oi-edge span{margin-top:2px}.oi-graph-explorer-results .chip{justify-self:start;text-align:left;line-height:1.35}.oi-entity-detail{display:grid;gap:8px;margin-top:16px;padding:13px;border:1px solid #60ffda45;border-radius:13px;background:#09152b99;color:var(--muted);line-height:1.45}.oi-entity-detail strong{color:#e3f9ff}.oi-entity-detail p{margin:0}.oi-entity-detail span{font-size:.8rem;color:var(--mint)}@media(max-width:700px){.oi-graph-explorer-results .oi-edge{grid-template-columns:1fr}.oi-graph-explorer-results .oi-edge span{justify-self:start}}
)TAHAI";

constexpr char kLocalOiControlCss[] = R"TAHAI(
.oi-control-card{display:grid;gap:9px;padding:16px;border:1px solid #466e9666;border-radius:17px;background:linear-gradient(145deg,#0c1733ee,#080d20e8);box-shadow:inset 0 1px #fff1}.oi-control-card h3,.oi-control-card p{margin:0}.oi-control-card .actions{margin-top:2px}.oi-control-card button:disabled{cursor:not-allowed;opacity:.58}
)TAHAI";

constexpr char kLocalOiCapabilityCss[] = R"TAHAI(
.oi-capability-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.oi-capability{display:grid;gap:10px;padding:16px;border:1px solid #42688f66;border-radius:17px;background:linear-gradient(145deg,#0c1733ee,#080d20e8);box-shadow:inset 0 1px #fff1}.oi-capability h3{margin:0;font-size:1rem}.oi-capability p{margin:0;color:var(--muted);line-height:1.5}.oi-capability-stage{display:inline-flex;width:max-content;padding:4px 8px;border:1px solid #60ffda45;border-radius:999px;color:var(--mint);font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.oi-capability[data-oi-capability-stage="available now"]{border-color:#60ffda6c}.oi-capability[data-oi-capability-stage="available now"] .oi-capability-stage{border-color:#60ffda88;color:#bcffe9}.oi-capability[data-oi-capability-stage="explicit capture required"]{border-color:#ffd77d70}.oi-capability[data-oi-capability-stage="explicit capture required"] .oi-capability-stage{border-color:#ffd77d80;color:var(--warn)}.oi-capability[data-oi-capability-stage="contract ready"]{border-color:#ae57ff78}.oi-capability[data-oi-capability-stage="contract ready"] .oi-capability-stage{border-color:#ae57ff82;color:#d8baff}.oi-capability[data-oi-capability-stage="not configured"]{opacity:.8}.oi-capability[data-oi-capability-stage="not configured"] .oi-capability-stage{border-color:#8ca1c76b;color:#a9b9d2}
)TAHAI";

constexpr char kCommandJs[] = R"TAHAI(
(()=>{'use strict';const input=document.querySelector('#command-input'),list=document.querySelector('#command-list'),status=document.querySelector('#command-status'),commands=[...list.querySelectorAll('.command')];function render(){const q=input.value.trim().toLowerCase();if(!q&&!commands.some(command=>command.hidden)){status.textContent=`${commands.length} approved commands available.`;return}let visible=0;for(const command of commands){const match=!q||command.dataset.tahaiSearch.includes(q);command.hidden=!match;visible+=Number(match)}status.textContent=`${visible} approved commands available.`}for(const command of commands){command.addEventListener('click',()=>{status.textContent=`Running ${command.dataset.tahaiLabel}.`;chrome.send('executeTahaiCommand',[command.dataset.tahaiCommand])})}input.addEventListener('input',render);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select()}});render();})();
)TAHAI";

constexpr char kRecallJs[] = R"TAHAI(
(() => {
  'use strict';
  const anchor = document.querySelector('.command-layout');
  if (!anchor || !anchor.parentNode) return;
  const section = document.createElement('section');
  const panel = document.createElement('article');
  const eyebrow = document.createElement('p');
  const heading = document.createElement('h2');
  const detail = document.createElement('p');
  const form = document.createElement('form');
  const input = document.createElement('input');
  const submit = document.createElement('button');
  const status = document.createElement('p');
  const results = document.createElement('div');
  section.className = 'section';
  panel.className = 'panel';
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'TAHAI Recall';
  heading.textContent = 'Find private operational context';
  detail.className = 'muted';
  detail.textContent = 'Searches only this profile’s persisted Local OI records. Try @mission, @finding, @endpoint, @artifact, @reference, @tool, @watch, or @memory.';
  form.className = 'search';
  input.className = 'command-input';
  input.type = 'search';
  input.maxLength = 256;
  input.autocomplete = 'off';
  input.placeholder = '@mission certificate renewal';
  input.setAttribute('aria-label', 'Search private TAHAI operational context');
  submit.className = 'button primary';
  submit.type = 'submit';
  submit.textContent = 'Recall';
  status.className = 'muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'History, open tabs, downloads, cookies, credentials, and page content are intentionally outside TAHAI Recall.';
  results.className = 'oi-search-results';
  form.append(input, submit);
  panel.append(eyebrow, heading, detail, form, status, results);
  section.append(panel);
  anchor.parentNode.insertBefore(section, anchor.nextSibling);

  const scopeAliases = new Map([
    ['all', 'all'], ['mission', 'mission'], ['missions', 'mission'],
    ['finding', 'finding'], ['findings', 'finding'],
    ['endpoint', 'endpoint'], ['endpoints', 'endpoint'],
    ['artifact', 'artifact'], ['artifacts', 'artifact'],
    ['reference', 'reference'], ['references', 'reference'],
    ['tool', 'tool'], ['tools', 'tool'], ['watch', 'watch'],
    ['watches', 'watch'], ['memory', 'memory']
  ]);
  let nextRequest = 0;
  let activeRequest = 0;
  const parse = value => {
    const raw = value.trim();
    const match = raw.match(/^@([a-z]+)\s*/i);
    if (!match) return {scope: 'all', query: raw};
    const requested = match[1].toLowerCase();
    return {
      scope: scopeAliases.get(requested) || requested,
      query: raw.slice(match[0].length).trim()
    };
  };
  const render = items => {
    results.replaceChildren();
    const values = Array.isArray(items) ? items : [];
    if (!values.length) {
      const empty = document.createElement('div');
      empty.className = 'oi-search-row';
      empty.textContent = 'No matching persisted Local OI records.';
      results.append(empty);
      return;
    }
    for (const item of values) {
      if (!item || typeof item !== 'object') continue;
      const row = document.createElement('div');
      const title = document.createElement('strong');
      const detailText = document.createElement('span');
      const metadata = [];
      row.className = 'oi-search-row';
      title.textContent = `${typeof item.kind === 'string' ? item.kind : 'record'}: ${typeof item.title === 'string' ? item.title : 'Local record'}`;
      if (typeof item.severity === 'string' && item.severity) metadata.push(item.severity);
      if (typeof item.finding_state === 'string' && item.finding_state) metadata.push(item.finding_state);
      detailText.textContent = `${typeof item.detail === 'string' ? item.detail : 'No display-safe summary.'}${metadata.length ? ` · ${metadata.join(' · ')}` : ''}`;
      row.append(title, detailText);
      results.append(row);
    }
  };
  window.tahaiRecallResults = (requestId, outcome, items) => {
    if (requestId !== activeRequest) return;
    if (outcome === 'unsupported_scope') {
      results.replaceChildren();
      status.textContent = 'That Recall scope is unavailable. TAHAI Recall only searches persisted Local OI records, not history, tabs, downloads, credentials, or page content.';
      return;
    }
    if (outcome === 'unavailable') {
      results.replaceChildren();
      status.textContent = 'Local OI is unavailable for this profile or current policy.';
      return;
    }
    render(items);
    const count = Array.isArray(items) ? items.length : 0;
    status.textContent = `${count} private Local OI record${count === 1 ? '' : 's'} found. No browser history or page data was searched.`;
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    const request = parse(input.value);
    if (!request.query) {
      results.replaceChildren();
      status.textContent = 'Enter a term after an optional Recall scope.';
      return;
    }
    activeRequest = ++nextRequest;
    status.textContent = 'Searching private persisted Local OI records…';
    chrome.send('searchTahaiRecall', [activeRequest, request.scope, request.query]);
  });
})();
)TAHAI";

constexpr char kActionsJs[] = R"TAHAI(
(()=>{'use strict';const send=command=>chrome.send('executeTahaiCommand',[command]);for(const control of document.querySelectorAll('[data-tahai-command]')){control.addEventListener('click',()=>send(control.dataset.tahaiCommand))}const dialog=document.querySelector('#tahai-command-palette');if(!dialog)return;const input=dialog.querySelector('#tahai-palette-input'),commands=[...dialog.querySelectorAll('[data-tahai-palette-command]')];const open=()=>{dialog.showModal();input.focus();input.select()};const render=()=>{const query=input.value.trim().toLowerCase();for(const command of commands)command.hidden=!!query&&!command.dataset.tahaiPaletteSearch.includes(query)};document.addEventListener('keydown',event=>{if(event.ctrlKey&&event.shiftKey&&event.code==='Space'){event.preventDefault();if(dialog.open)dialog.close();else open()}else if(event.key==='Escape'&&dialog.open)dialog.close()});input.addEventListener('input',render);for(const command of commands){command.addEventListener('click',()=>{dialog.close();send(command.dataset.tahaiPaletteCommand)})}for(const close of dialog.querySelectorAll('[data-tahai-close-palette]'))close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})})();
)TAHAI";

constexpr char kModesJs[] = R"TAHAI(
(()=>{'use strict';const status=document.querySelector('#mode-status'),save=(key,value)=>{status.textContent='Saving this profile-scoped workspace choice…';chrome.send('setTahaiWorkModeConfiguration',[key,String(value)])};for(const opener of document.querySelectorAll('[data-tahai-open-dialog]')){opener.addEventListener('click',()=>document.getElementById(opener.dataset.tahaiOpenDialog)?.showModal())}for(const closer of document.querySelectorAll('[data-tahai-close-dialog]')){closer.addEventListener('click',()=>closer.closest('dialog')?.close())}for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})}for(const button of document.querySelectorAll('[data-tahai-mode]')){button.addEventListener('click',()=>{status.textContent='Switching mode without changing this profile, tabs, or pane assignments…';chrome.send('setTahaiWorkMode',[button.dataset.tahaiMode])})}for(const control of document.querySelectorAll('[data-tahai-modifier]')){control.addEventListener('change',()=>{status.textContent='Saving the explicit workspace modifier…';chrome.send('setTahaiWorkModeModifier',[control.dataset.tahaiModifier,control.checked])})}for(const control of document.querySelectorAll('[data-tahai-mode-config]')){const key=control.dataset.tahaiModeConfig;if(control.matches('input[type=checkbox]'))control.addEventListener('change',()=>save(key,control.checked));else control.addEventListener('click',()=>save(key,control.dataset.tahaiValue))}for(const control of document.querySelectorAll('[data-tahai-template]')){control.addEventListener('click',()=>{status.textContent='Creating the selected local runbook…';chrome.send('createTahaiWorkModeTemplateMission',[control.dataset.tahaiTemplate])})}const reset=document.querySelector('[data-tahai-mode-reset]');if(reset)reset.addEventListener('click',()=>{status.textContent='Restoring this mode’s safe defaults…';chrome.send('resetTahaiWorkModeConfiguration')});window.tahaiWorkModeUpdated=()=>location.replace('tahai://modes/');})();
)TAHAI";

constexpr char kProfilesJs[] = R"TAHAI(
(()=>{'use strict';const status=document.querySelector('#identity-lane-status');for(const button of document.querySelectorAll('[data-tahai-identity-lane]'))button.addEventListener('click',()=>{const lane=button.dataset.tahaiIdentityLane||'',destination=button.dataset.tahaiLaneDestination||'workspace';if(!/^[0-9A-Fa-f]{32}$/.test(lane))return;if(status)status.textContent='Opening a new window in the selected Chromium Profile boundary…';chrome.send('openTahaiIdentityLane',[lane,destination])});window.tahaiIdentityLaneOpened=result=>{if(!status)return;const messages={opened:'Identity Lane opened in its own Chromium Profile window.',unknown_lane:'That Identity Lane is no longer available.',signin_required:'Chromium requires profile sign-in before this lane can open.',invalid_destination:'The requested fixed TAHAI destination was rejected.',profile_unavailable:'Chromium could not load that profile.'};status.textContent=messages[result]||'The Identity Lane request did not complete.'}})();
)TAHAI";

constexpr char kMissionJs[] = R"TAHAI(
(()=>{'use strict';
const form=document.querySelector('#new-mission-form'),status=document.querySelector('#mission-status');if(!form||!status)return;
const capsuleMessages={copied:'Encrypted capsule copied. Its key remains protected by this Chromium profile and is not included.',verified_ready:'Encrypted capsule verified. You may now create a fresh local runbook from its bounded completion state.',imported:'A fresh local Mission was created from the verified capsule. Source title, identity, timestamps, and event history were not restored.',key_unavailable:'The local OS-protected key is unavailable.',invalid:'That encrypted capsule is malformed, for a different local key, or failed authentication.',failed:'The encrypted capsule request did not complete.'};
window.tahaiMissionHandoffCopied=()=>{status.textContent='Sanitized checkpoint status copied. Mission name and browsing data were omitted.'};window.tahaiEvidencePackCopied=()=>{status.textContent='Sanitized Evidence Pack copied. It contains generated status only.'};window.tahaiMissionCapsuleCopied=()=>{status.textContent='Sanitized Mission Capsule copied. Inspect it before sharing; it contains no sessions or page data.'};window.tahaiEncryptedMissionCapsuleUpdate=result=>{status.textContent=capsuleMessages[result]||capsuleMessages.failed;const importer=document.querySelector('[data-tahai-mission-action=import-encrypted-capsule]');if(importer)importer.disabled=result!=='verified_ready';if(result==='imported')window.setTimeout(()=>window.location.reload(),400)};
form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form),title=String(data.get('title')||'').trim(),type=String(data.get('type')||'investigation');if(!title||title.length>128){status.textContent='Mission names must contain 1–128 characters.';return}status.textContent='Creating profile-scoped mission…';chrome.send('createTahaiMission',[title,type])});
document.addEventListener('click',event=>{const control=event.target.closest('[data-tahai-mission-action]');if(!control)return;const action=control.dataset.tahaiMissionAction,id=control.dataset.tahaiMissionId||'',index=Number(control.dataset.tahaiStepIndex);if(action==='toggle-step'||action==='toggle-validation'||action==='toggle-rollback'){if(!Number.isSafeInteger(index)||index<0)return;status.textContent='Updating generated runbook state…';chrome.send(action==='toggle-step'?'toggleTahaiMissionStep':action==='toggle-validation'?'toggleTahaiValidationStep':'toggleTahaiRollbackStep',[id,index])}else if(action==='toggle-escalation'){status.textContent='Updating generated escalation state…';chrome.send('toggleTahaiEscalation',[id])}else if(action==='add-evidence'){status.textContent='Adding a data-free evidence marker…';chrome.send('addTahaiEvidenceMarker',[id])}else if(action==='copy-evidence'){status.textContent='Copying sanitized Evidence Pack…';chrome.send('copyTahaiEvidencePack',[id])}else if(action==='copy-capsule'){status.textContent='Creating a sanitized Mission Capsule…';chrome.send('copyTahaiMissionCapsule',[id])}else if(action==='copy-encrypted-capsule'){status.textContent='Creating an OS-protected local encrypted capsule…';chrome.send('copyTahaiEncryptedMissionCapsule',[id])}else if(action==='verify-encrypted-capsule'){const input=document.querySelector('#encrypted-capsule-input'),value=input?input.value.trim():'';if(!value||value.length>1048576){status.textContent='Paste one bounded encrypted capsule to verify.';return}status.textContent='Decrypting and validating this local-profile capsule…';chrome.send('verifyTahaiEncryptedMissionCapsule',[value])}else if(action==='import-encrypted-capsule'){status.textContent='Creating a fresh local Mission from the verified capsule…';chrome.send('importTahaiVerifiedMissionCapsule',[])}else if(action==='archive'){status.textContent='Archiving this mission as an immutable local record…';chrome.send('archiveTahaiMission',[id])}else if(action==='restore'){status.textContent='Restoring this profile-scoped mission…';chrome.send('restoreTahaiMission',[id])}else if(action==='duplicate'){status.textContent='Creating a fresh generated runbook…';chrome.send('duplicateTahaiMission',[id])}else if(action==='delete'){if(!window.confirm('Permanently delete this archived mission? This cannot be undone.'))return;status.textContent='Permanently deleting archived mission…';chrome.send('deleteTahaiMission',[id])}else if(action==='copy-handoff'){status.textContent='Copying sanitized checkpoint status…';chrome.send('copyTahaiMissionHandoff',[id])}else if(action==='launch-recipe'){const recipe=control.dataset.tahaiRecipeId||'';if(!recipe)return;status.textContent='Opening the approved recipe workspace…';chrome.send('launchTahaiRecipe',[recipe])}});
document.addEventListener('change',event=>{const control=event.target.closest('[data-tahai-export-profile]');if(!control)return;status.textContent='Setting export profile…';chrome.send('setTahaiExportProfile',[control.dataset.tahaiMissionId||'',control.value])})})();
(()=>{'use strict';document.addEventListener('click',event=>{const button=event.target.closest('[data-tahai-timeline-filter]');if(!button)return;const card=button.closest('.mission-card'),kind=button.dataset.tahaiTimelineFilter||'all';if(!card)return;for(const row of card.querySelectorAll('[data-tahai-timeline-kind]'))row.hidden=kind!=='all'&&row.dataset.tahaiTimelineKind!==kind})})();
)TAHAI";

constexpr char kMissionKeyRotationJs[] = R"TAHAI(
(() => {
  'use strict';
  const status = document.querySelector('#mission-status');
  const existing = window.tahaiEncryptedMissionCapsuleUpdate;
  window.tahaiEncryptedMissionCapsuleUpdate = result => {
    if (result === 'rotated') {
      if (status) {
        status.textContent =
            'Local capsule key rotated. The bounded retained key history can still decrypt recent local capsules.';
      }
      return;
    }
    if (typeof existing === 'function') existing(result);
  };
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-tahai-mission-action]');
    if (!control || control.dataset.tahaiMissionAction !==
                        'rotate-encrypted-capsule-key') {
      return;
    }
    if (!window.confirm(
            'Rotate this profile’s encrypted-capsule key? Recent local capsule keys remain only as a bounded decrypt history.')) {
      return;
    }
    if (status) status.textContent = 'Rotating the local OS-protected capsule key…';
    chrome.send('rotateTahaiEncryptedMissionCapsuleKey');
  });
})();
)TAHAI";

constexpr char kLocalOiJs[] = R"TAHAI(
(()=>{'use strict';const form=document.querySelector('#local-oi-search-form'),input=document.querySelector('#local-oi-search'),kind=document.querySelector('#local-oi-search-kind'),mission=document.querySelector('#local-oi-search-mission'),severity=document.querySelector('#local-oi-search-severity'),findingState=document.querySelector('#local-oi-search-state'),age=document.querySelector('#local-oi-search-age'),status=document.querySelector('#local-oi-search-status'),output=document.querySelector('#local-oi-search-results');let timer=0,requestSequence=0,activeRequest=0;const filters=()=>({kind:kind?.value||'all',mission_id:mission?.value||'',severity:severity?.value||'all',finding_state:findingState?.value||'all',age_days:Number(age?.value||0)});const clearResults=()=>{if(output)output.replaceChildren()};const resultButtons=()=>output?[...output.querySelectorAll('.oi-search-result')]:[];const renderResults=(query,items)=>{if(!output)return;clearResults();const values=Array.isArray(items)?items:[];if(!values.length){const empty=document.createElement('div');empty.className='oi-search-row';empty.textContent='No matching records in this profile-local index.';output.append(empty)}for(const item of values){if(!item||typeof item!=='object')continue;const row=document.createElement('button'),title=document.createElement('strong'),detail=document.createElement('span'),metadata=[];row.type='button';row.className='oi-search-row oi-search-result';title.textContent=`${typeof item.kind==='string'?item.kind:'record'}: ${typeof item.title==='string'?item.title:'Local record'}`;if(typeof item.severity==='string'&&item.severity)metadata.push(item.severity);if(typeof item.finding_state==='string'&&item.finding_state)metadata.push(item.finding_state);detail.textContent=`${typeof item.detail==='string'?item.detail:'No display-safe summary.'}${metadata.length?` · ${metadata.join(' · ')}`:''}`;row.append(title,detail);output.append(row)}if(status)status.textContent=`${values.length} local record${values.length===1?'':'s'} match “${query}” with the current filters.`};window.tahaiLocalOiSearchResults=(query,requestId,items)=>{if(requestId!==activeRequest)return;renderResults(query,items)};const search=()=>{const query=input?.value.trim()||'';activeRequest=++requestSequence;if(!query){clearResults();if(status)status.textContent='Searches only the persisted Local OI index in this profile. Filters are evaluated by the native Local OI handler.';return}if(status)status.textContent='Searching the private local index…';chrome.send('searchTahaiLocalOi',[query,filters(),activeRequest])};if(form)form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);search()});if(input)input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,140)});for(const control of [kind,mission,severity,findingState,age])if(control)control.addEventListener('change',search);if(output)output.addEventListener('keydown',event=>{if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;const buttons=resultButtons(),current=buttons.indexOf(document.activeElement);if(!buttons.length)return;event.preventDefault();buttons[(current+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length].focus()});window.tahaiLocalOiReportCopied=()=>{if(status)status.textContent='Sanitized Local OI report copied and recorded locally. Mission names and browser data were omitted.'};window.tahaiLocalOiFindingUpdated=()=>{if(status)status.textContent='Local finding lifecycle updated.';window.location.reload()};for(const button of document.querySelectorAll('[data-tahai-oi-action]'))button.addEventListener('click',()=>{const action=button.dataset.tahaiOiAction;if(action==='copy-report'){const reportKind=button.dataset.tahaiOiReport||'overview';if(status)status.textContent='Creating a sanitized Local OI report…';chrome.send('copyTahaiLocalOiReport',[reportKind]);return}if(action==='visit-msp'){chrome.send('openTahaiOiMsp',[button.dataset.tahaiOiContext||'local_oi_header']);return}if(action==='promotion-setting'){if(status)status.textContent='Saving hosted OI referral choice…';chrome.send('setTahaiOiMspPromotion',[button.dataset.tahaiOiEnabled==='true']);return}if(action==='acknowledge'||action==='resolve'||action==='suppress'||action==='reopen'){const card=button.closest('[data-tahai-oi-finding-id]'),note=card&&card.querySelector('[data-tahai-oi-finding-note]'),rationale=note&&note.value.trim();if(!card||!rationale){if(status)status.textContent='Enter a bounded local rationale before changing a finding.';return}if(status)status.textContent='Updating the local finding lifecycle…';chrome.send('updateTahaiLocalOiFinding',[card.dataset.tahaiOiFindingId,action,rationale])}});})();
)TAHAI";

constexpr char kLocalOiGraphExplorerJs[] = R"TAHAI(
(() => {
  'use strict';
  const form = document.querySelector('#local-oi-graph-form');
  const entity = document.querySelector('#local-oi-graph-entity');
  const type = document.querySelector('#local-oi-graph-type');
  const depth = document.querySelector('#local-oi-graph-depth');
  const status = document.querySelector('#local-oi-graph-status');
  const output = document.querySelector('#local-oi-graph-results');
  const detailOutput = document.querySelector('#local-oi-entity-detail');
  let requestSequence = 0;
  let activeRequest = 0;
  let detailRequestSequence = 0;
  let activeDetailRequest = 0;
  const clear = () => { if (output) output.replaceChildren(); };
  const showDetail = (entityId) => {
    if (typeof entityId !== 'string' || !entityId) return;
    activeDetailRequest = ++detailRequestSequence;
    if (detailOutput) detailOutput.textContent = 'Loading saved local record detail…';
    chrome.send('getTahaiLocalOiEntityDetail', [entityId, activeDetailRequest]);
  };
  const recordButton = (label, entityId) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = label;
    button.addEventListener('click', () => showDetail(entityId));
    return button;
  };
  const render = (items) => {
    if (!output) return;
    clear();
    const values = Array.isArray(items) ? items : [];
    if (!values.length) {
      const empty = document.createElement('div');
      empty.className = 'oi-empty';
      empty.textContent = 'No persisted local relationships match this bounded traversal.';
      output.append(empty);
      return;
    }
    for (const item of values) {
      if (!item || typeof item !== 'object') continue;
      const row = document.createElement('div');
      const source = recordButton(
          typeof item.source_label === 'string' ? item.source_label : 'Local record',
          typeof item.source_id === 'string' ? item.source_id : '');
      const relationship = document.createElement('span');
      const detail = document.createElement('div');
      const target = recordButton(
          typeof item.target_label === 'string' ? item.target_label : 'Local record',
          typeof item.target_id === 'string' ? item.target_id : '');
      const basis = document.createElement('small');
      row.className = 'oi-edge';
      relationship.textContent = `${typeof item.relationship === 'string' ? item.relationship : 'relationship'} · hop ${Number.isInteger(item.depth) ? item.depth : 1}`;
      basis.textContent = `Why this relationship exists: ${typeof item.basis === 'string' && item.basis ? item.basis : 'Typed local relationship.'}`;
      detail.append(target, basis);
      row.append(source, relationship, detail);
      output.append(row);
    }
  };
  const renderDetail = (detail) => {
    if (!detailOutput) return;
    detailOutput.replaceChildren();
    if (!detail || typeof detail !== 'object') {
      detailOutput.textContent = 'This local record is no longer available.';
      return;
    }
    const title = document.createElement('strong');
    const description = document.createElement('p');
    const metadata = document.createElement('span');
    title.textContent = `${typeof detail.kind === 'string' ? detail.kind : 'record'}: ${typeof detail.label === 'string' ? detail.label : 'Local record'}`;
    description.textContent = typeof detail.detail === 'string' && detail.detail ? detail.detail : 'No display-safe summary is stored for this record.';
    metadata.textContent = `${Number.isInteger(detail.direct_relationship_count) ? detail.direct_relationship_count : 0} direct persisted relationship${detail.direct_relationship_count === 1 ? '' : 's'} in this profile.`;
    detailOutput.append(title, description, metadata);
  };
  window.tahaiLocalOiRelationshipResults = (requestId, items) => {
    if (requestId !== activeRequest) return;
    render(items);
    if (status) status.textContent = `${Array.isArray(items) ? items.length : 0} bounded local relationship${Array.isArray(items) && items.length === 1 ? '' : 's'} returned.`;
  };
  window.tahaiLocalOiEntityDetail = (requestId, detail) => {
    if (requestId !== activeDetailRequest) return;
    renderDetail(detail);
  };
  if (form) form.addEventListener('submit', (event) => {
    event.preventDefault();
    const entityId = entity?.value || '';
    const relationship = type?.value || 'all';
    const maximumDepth = Number(depth?.value || 1);
    if (!entityId) {
      if (status) status.textContent = 'Choose a persisted Local OI record first.';
      return;
    }
    activeRequest = ++requestSequence;
    if (status) status.textContent = 'Traversing only the profile-local relationship projection…';
    chrome.send('exploreTahaiLocalOiRelationships', [entityId, relationship, maximumDepth, activeRequest]);
  });
})();
)TAHAI";

constexpr char kLocalOiControlsJs[] = R"TAHAI(
(() => {
  'use strict';
  const status = document.querySelector('#local-oi-control-status');
  const controls = new Map();
  let rebuild = null;
  const setStatus = (message) => { if (status) status.textContent = message; };
  window.tahaiLocalOiControlUpdated = (setting, updated) => {
    const button = controls.get(setting);
    if (!updated) {
      if (button) button.disabled = false;
      setStatus('That Local OI control is managed or unavailable in this profile.');
      return;
    }
    if (button) {
      const enabled = button.dataset.tahaiOiEnabled === 'true';
      const state = button.parentElement?.querySelector('.chip');
      if (state) state.textContent = enabled ? 'Enabled' : 'Disabled';
      button.dataset.tahaiOiEnabled = enabled ? 'false' : 'true';
      button.textContent = enabled ? 'Disable' : 'Enable';
      button.disabled = false;
    }
    document.dispatchEvent(new CustomEvent('tahai-local-oi-updated',
        {detail: {setting}}));
    setStatus(setting + ' was updated locally. Existing results stay visible; refresh this page only when you are ready.');
  };
  window.tahaiLocalOiProjectionRefreshed = (refreshed) => {
    if (!refreshed) {
      setStatus('The bounded Mission projection could not refresh because Local OI or Mission ingestion is disabled by policy.');
      return;
    }
    if (rebuild) rebuild.disabled = false;
    document.dispatchEvent(new CustomEvent('tahai-local-oi-updated',
        {detail: {setting: 'mission-projection'}}));
    setStatus('The bounded Mission projection was refreshed locally. Existing results stay visible; refresh this page only when you are ready.');
  };
  for (const button of document.querySelectorAll('[data-tahai-oi-setting]')) {
    controls.set(button.dataset.tahaiOiSetting, button);
    button.addEventListener('click', () => {
      const setting = button.dataset.tahaiOiSetting;
      const enabled = button.dataset.tahaiOiEnabled === 'true';
      if (!setting) return;
      button.disabled = true;
      setStatus(`Updating ${setting} in this profile…`);
      chrome.send('setTahaiLocalOiControl', [setting, enabled]);
    });
  }
  rebuild = document.querySelector('[data-tahai-oi-action=rebuild-local]');
  if (rebuild) rebuild.addEventListener('click', () => {
    rebuild.disabled = true;
    setStatus('Refreshing the bounded local Mission projection…');
    chrome.send('rebuildTahaiLocalOiIndex');
  });
})();
)TAHAI";

constexpr char kLocalOiRuntimeJs[] = R"TAHAI(
(() => {
  'use strict';
  window.tahaiLocalOiReportCopyFailed = () => {
    const status = document.querySelector('#local-oi-search-status');
    if (status) status.textContent = 'The safe report was not created. Local OI reports or export may be disabled, the store may be unavailable, or safety redaction may have blocked the result.';
  };
  window.tahaiLocalOiReportCopied = (format) => {
    const status = document.querySelector('#local-oi-search-status');
    const label = format === 'json' ? 'JSON' : 'Markdown';
    if (status) status.textContent = `Sanitized ${label} Local OI report copied and recorded locally. Mission names and browser data were omitted.`;
  };
  window.tahaiLocalOiReportCopiedUnrecorded = (format) => {
    const status = document.querySelector('#local-oi-search-status');
    const label = format === 'json' ? 'JSON' : 'Markdown';
    if (status) status.textContent = `Sanitized ${label} Local OI report copied, but its local export event could not be recorded.`;
  };
})();
)TAHAI";

constexpr char kLocalOiDeterministicBriefJs[] = R"TAHAI(
(() => {
  'use strict';
  const graphEntity = document.querySelector('#local-oi-graph-entity');
  const anchor = Array.from(document.querySelectorAll('.panel')).find(
      candidate => candidate.textContent.includes('Watchlists & local assist'));
  if (!graphEntity || !anchor) return;
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  const detail = document.createElement('p');
  const form = document.createElement('form');
  const operation = document.createElement('select');
  const records = document.createElement('select');
  const button = document.createElement('button');
  const clear = document.createElement('button');
  const selection = document.createElement('p');
  const status = document.createElement('p');
  const result = document.createElement('div');
  section.className = 'section';
  section.id = 'local-oi-deterministic-brief';
  heading.textContent = 'Create a deterministic local operations brief';
  detail.className = 'muted';
  detail.textContent = 'Choose one to eight persisted Local OI records. TAHAI produces a display-only deterministic review, summary, checklist, or sanitized handoff scope. It does not run a model, connect to a provider, open a page, copy/export data, or perform an action.';
  form.className = 'actions';
  operation.className = 'button';
  operation.id = 'local-oi-assist-operation';
  for (const [value, label] of [
      ['explain-findings', 'Explain selected findings'],
      ['summarize-records', 'Summarize selected records'],
      ['draft-checklist', 'Draft checklist'],
      ['draft-sanitized-handoff', 'Draft sanitized handoff']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    operation.append(option);
  }
  records.className = 'command-input';
  records.id = 'local-oi-assist-records';
  records.multiple = true;
  records.size = 5;
  records.setAttribute('aria-label', 'One to eight Local OI records for a deterministic brief');
  for (const source of Array.from(graphEntity.options)) {
    if (!source.value) continue;
    const option = document.createElement('option');
    option.value = source.value;
    option.textContent = source.textContent || 'Local OI record';
    records.append(option);
  }
  for (const finding of Array.from(document.querySelectorAll('[data-tahai-oi-finding-id]'))) {
    const id = finding.getAttribute('data-tahai-oi-finding-id');
    if (!id) continue;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `Finding: ${finding.querySelector('h3')?.textContent || 'Local OI finding'}`;
    records.append(option);
  }
  button.className = 'button';
  button.type = 'submit';
  button.textContent = 'Create deterministic brief';
  clear.className = 'chip';
  clear.type = 'button';
  clear.textContent = 'Clear selection';
  selection.className = 'muted';
  selection.setAttribute('aria-live', 'polite');
  status.className = 'muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  result.className = 'oi-search-results';
  result.setAttribute('aria-live', 'polite');
  if (!records.options.length) {
    records.disabled = true;
    button.disabled = true;
    clear.disabled = true;
    status.textContent = 'No persisted Local OI record is available for a deterministic brief.';
  }
  const updateSelection = () => {
    const count = records.selectedOptions.length;
    selection.textContent = count ? `${count} of 8 local record${count === 1 ? '' : 's'} selected.` : 'Choose one to eight local records.';
  };
  form.append(operation, records, button, clear);
  section.append(heading, detail, form, selection, status, result);
  anchor.append(section);
  updateSelection();
  records.addEventListener('change', updateSelection);
  clear.addEventListener('click', () => {
    for (const option of records.options) option.selected = false;
    result.replaceChildren();
    updateSelection();
    status.textContent = 'Local brief selection cleared.';
  });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('[data-tahai-oi-action=add-to-local-brief]');
    if (!trigger) return;
    const finding = trigger.closest('[data-tahai-oi-finding-id]');
    const id = finding?.getAttribute('data-tahai-oi-finding-id') || '';
    const option = Array.from(records.options).find(candidate => candidate.value === id);
    if (!option) {
      status.textContent = 'That Local OI finding is no longer available for a brief.';
      return;
    }
    if (!option.selected && records.selectedOptions.length >= 8) {
      status.textContent = 'A deterministic local brief can include at most eight records. Clear a selection before adding another finding.';
      return;
    }
    option.selected = true;
    records.focus();
    updateSelection();
    status.textContent = 'Current finding added to the deterministic local brief selection.';
  });
  window.tahaiLocalOiDeterministicBriefPrepared = (prepared, message, title, lines) => {
    result.replaceChildren();
    status.textContent = typeof message === 'string' ? message : 'The deterministic local brief was not created.';
    if (prepared !== true) return;
    const heading = document.createElement('strong');
    heading.textContent = typeof title === 'string' && title ? title : 'Deterministic Local OI brief';
    result.append(heading);
    for (const line of Array.isArray(lines) ? lines : []) {
      if (typeof line !== 'string' || !line) continue;
      const row = document.createElement('p');
      row.className = 'oi-search-row';
      row.textContent = line;
      result.append(row);
    }
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    const selected = Array.from(records.selectedOptions).map(option => option.value);
    if (!selected.length || selected.length > 8) {
      status.textContent = 'Select between one and eight persisted Local OI records.';
      return;
    }
    status.textContent = 'Creating a deterministic local-only brief. No model is being invoked.';
    chrome.send('buildTahaiLocalDeterministicBrief', [operation.value, selected]);
  });
})();
)TAHAI";

constexpr char kLocalOiJsonReportJs[] = R"TAHAI(
(() => {
  'use strict';
  const selector = document.querySelector('#local-oi-json-report-kind');
  const button = document.querySelector('[data-tahai-oi-action=copy-json-report]');
  const status = document.querySelector('#local-oi-search-status');
  if (button) button.addEventListener('click', () => {
    const reportKind = selector?.value || 'overview';
    if (status) status.textContent = 'Creating a sanitized aggregate Local OI JSON report…';
    chrome.send('copyTahaiLocalOiReport', [reportKind, 'json']);
  });
})();
)TAHAI";

constexpr char kSupportJs[] = R"TAHAI(
(()=>{'use strict';const button=document.querySelector('[data-tahai-support-action=copy-summary]'),form=document.querySelector('#network-inspection-form'),host=document.querySelector('#network-inspection-host'),status=document.querySelector('#support-status'),output=document.querySelector('#network-inspection-results');const row=(label,value)=>{const item=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('span');item.className='oi-search-row';name.textContent=label;detail.textContent=value||'Unavailable';item.append(name,detail);return item};const count=value=>Number.isInteger(value)&&value>=0&&value<=64?String(value):'Unavailable';const securityHeaderCount=value=>Number.isInteger(value)&&value>=0&&value<=6?String(value):'Unavailable';window.tahaiSupportSummaryCopied=()=>{if(status)status.textContent='Sanitized support summary copied. It contains no browsing data or secrets.'};window.tahaiNetworkInspectionComplete=result=>{if(!output)return;output.replaceChildren();const securityHeaders=result.security_header_observation_available===true?`${securityHeaderCount(result.observed_security_header_count)} of 6 observed; values not retained`:'Unavailable';output.append(row('Host',result.host),row('Resolved addresses',(result.resolved_addresses||[]).join(', ')),row('DNS aliases',(result.dns_aliases||[]).join(', ')),row('DNS topology',`IPv4: ${count(result.resolved_ipv4_count)}; IPv6: ${count(result.resolved_ipv6_count)}; aliases: ${count(result.dns_alias_count)}`),row('Selected HTTP security headers',securityHeaders),row('DNS result',String(result.dns_net_error)),row('HTTPS status',result.http_status?String(result.http_status):'Unavailable'),row('TLS version',result.tls_version),row('Certificate validity',result.certificate_valid?'valid according to Chromium':'not validated'),row('Known root',result.issued_by_known_root?'yes':'no or unavailable'),row('Subject',result.certificate_subject),row('Issuer',result.certificate_issuer),row('Expiry',result.certificate_expiry),row('Days remaining',result.certificate_days_remaining>=0?String(result.certificate_days_remaining):'Unavailable'),row('Expired',result.certificate_expired?'yes':'no'),row('Subject alternative names',(result.subject_alt_names||[]).join(', ')),row('Cipher suite',result.cipher_suite),row('Elapsed',`${result.elapsed_milliseconds||0} ms`));if(status)status.textContent=result.recorded?'Inspection complete and aggregate-only typed metadata was recorded in Local OI.':'Inspection complete. Local OI recording is disabled by policy.'};if(button)button.addEventListener('click',()=>{if(status)status.textContent='Copying the sanitized support summary…';chrome.send('copyTahaiSupportSummary')});if(form&&host)form.addEventListener('submit',event=>{event.preventDefault();const value=host.value.trim();if(!value||value.length>253){if(status)status.textContent='Enter a host name or IPv4 address up to 253 characters.';return}if(status)status.textContent='Resolving DNS and running an HTTPS TLS probe…';if(output)output.replaceChildren();chrome.send('inspectTahaiNetwork',[value])})})();
)TAHAI";

constexpr char kSupportClipboardReviewJs[] = R"TAHAI(
(() => {
  'use strict';
  const status = document.querySelector('#support-status');
  const output = document.querySelector('#network-inspection-results');
  window.tahaiNetworkInspectionSummaryCopyBlocked = reason => {
    if (status) {
      status.textContent = typeof reason === 'string' && reason
          ? reason
          : 'Environment Guard blocked this sanitized clipboard export.';
    }
  };
  window.tahaiNetworkInspectionSummaryReviewRequired = (summary, reason) => {
    if (!output || typeof summary !== 'string' || !summary ||
        summary.length > 8192) {
      if (status) {
        status.textContent =
            'The classified export review could not be displayed.';
      }
      return;
    }
    output.querySelector('#network-inspection-export-review')?.remove();
    const review = document.createElement('section');
    const title = document.createElement('strong');
    const detail = document.createElement('p');
    const preview = document.createElement('pre');
    const confirm = document.createElement('button');
    review.id = 'network-inspection-export-review';
    review.className = 'panel oi-boundary';
    title.textContent = 'Environment Guard review required';
    detail.className = 'boundary';
    detail.textContent = typeof reason === 'string' && reason
        ? reason
        : 'This classified origin requires a redaction review before clipboard export.';
    preview.className = 'oi-search-results';
    preview.textContent = summary;
    confirm.className = 'button primary';
    confirm.type = 'button';
    confirm.textContent = 'Confirm reviewed copy';
    confirm.addEventListener('click', () => {
      confirm.disabled = true;
      if (status) {
        status.textContent =
            'Copying the reviewed sanitized inspection handoff…';
      }
      chrome.send('confirmTahaiNetworkInspectionSummary');
    });
    review.append(title, detail, preview, confirm);
    output.prepend(review);
    if (status) {
      status.textContent =
          'Review the exact sanitized handoff before copying it.';
    }
  };
})();
)TAHAI";

constexpr char kBrandMark[] = R"TAHAI(
<img class="mark" src="/brand.png" alt="TAHAI Browser spider and orbit mark">
)TAHAI";

constexpr char kCommandPaletteHtml[] = R"TAHAI(
<dialog id=tahai-command-palette class=command-palette aria-labelledby=tahai-command-palette-title><form method=dialog><div class=command-palette-head><div><p class=eyebrow>TAHAI command palette</p><h2 id=tahai-command-palette-title>Go directly to work.</h2><p class=muted>Only fixed native TAHAI commands are available. Press Ctrl + Shift + Space from any TAHAI surface.</p></div><button class=chip type=button data-tahai-close-palette>Close</button></div><input id=tahai-palette-input class=command-input type=search autocomplete=off placeholder="Filter commands, layouts, and surfaces" aria-label="Filter TAHAI commands"><div class=command-palette-results><button class=command type=button data-tahai-palette-command=launchpad.open data-tahai-palette-search="home launchpad start"><span>Launchpad</span><kbd>Alt+Shift+L</kbd></button><button class=command type=button data-tahai-palette-command=mission.open data-tahai-palette-search="mission control runbook"><span>Mission Control</span><kbd>Alt+Shift+M</kbd></button><button class=command type=button data-tahai-palette-command=modes.open data-tahai-palette-search="modes workspace theme templates"><span>Work Modes</span><kbd>Alt+Shift+V</kbd></button><button class=command type=button data-tahai-palette-command=commands.open data-tahai-palette-search="command center tools"><span>Command Center</span><kbd>Alt+Shift+O</kbd></button><button class=command type=button data-tahai-palette-command=dual.open data-tahai-palette-search="dual side by side two pane"><span>Dual: side by side</span><kbd>Alt+Shift+D</kbd></button><button class=command type=button data-tahai-palette-command=dual.stacked data-tahai-palette-search="dual stacked vertical two pane"><span>Dual: stacked</span><kbd>Alt+Shift+S</kbd></button><button class=command type=button data-tahai-palette-command=tri.two-over-one data-tahai-palette-search="tri two over one three pane"><span>Tri: two over one</span><kbd>Alt+Shift+G</kbd></button><button class=command type=button data-tahai-palette-command=tri.one-over-two data-tahai-palette-search="tri one over two three pane"><span>Tri: one over two</span><kbd>Alt+Shift+U</kbd></button><button class=command type=button data-tahai-palette-command=quad.open data-tahai-palette-search="quad four pane 2 by 2"><span>Quad: 2 × 2 workspace</span><kbd>Alt+Shift+Q</kbd></button><button class=command type=button data-tahai-palette-command=quad.focus data-tahai-palette-search="focus active pane"><span>Focus active pane</span><kbd>Alt+Shift+F</kbd></button><button class=command type=button data-tahai-palette-command=quad.exit data-tahai-palette-search="exit layout multiview"><span>Exit multi-view</span><kbd>Alt+Shift+E</kbd></button><button class=command type=button data-tahai-palette-command=profiles.open data-tahai-palette-search="profiles privacy identity"><span>Profile administration</span><kbd>Alt+Shift+Y</kbd></button></div></form></dialog>
)TAHAI";

// Each work mode deliberately exposes a small, distinct set of fixed native
// surfaces. This is presentation guidance only: a click still resolves through
// ExecuteTahaiCommand's allowlist, and no mode can supply a URL or arguments.
struct ModeSurfaceAction {
  std::string_view command;
  std::string_view label;
  std::string_view description;
};

std::vector<ModeSurfaceAction> ModeSurfaceActionsForMode(
    std::string_view mode_id) {
  if (mode_id == "creator") {
    return {{"mission.open", "Creative brief", "Runbook"},
            {"tri.two-over-one", "Studio layout", "Three panes"},
            {"commands.open", "Command Center", "Native actions"}};
  }
  if (mode_id == "builder") {
    return {{"commands.open", "Command Center", "Native actions"},
            {"quad.open", "Release Quad", "Four panes"},
            {"mission.open", "Release runbook", "Mission Control"},
            {"support.open", "Endpoint proof", "DNS + TLS inspection"}};
  }
  if (mode_id == "operator") {
    return {{"mission.open", "Mission Control", "Runbook"},
            {"local-oi.open", "Local OI", "Private posture"},
            {"quad.open", "Operator Quad", "Four panes"},
            {"support.open", "DNS + TLS inspector", "Support tools"},
            {"commands.open", "Command Center", "Native actions"}};
  }
  if (mode_id == "research") {
    return {{"dual.open", "Compare sources", "Dual View"},
            {"mission.open", "Research runbook", "Mission Control"},
            {"local-oi.open", "Local OI", "Private posture"}};
  }
  if (mode_id == "support") {
    return {{"support.open", "Support tools", "DNS + TLS"},
            {"local-oi.open", "Local OI", "Private record"},
            {"mission.open", "Case runbook", "Mission Control"},
            {"policy.open", "Policy", "Managed state"}};
  }
  return {{"tab.new", "New tab", "Browse"},
          {"dual.open", "Dual View", "Two panes"},
          {"modes.open", "Work Modes", "Workspace"}};
}

std::string ModeSurfaceMenuHtml(std::string_view mode_id) {
  const WorkModeDefinition* definition = ModeService::FindDefinition(mode_id);
  if (!definition) {
    definition = ModeService::FindDefinition("daily");
  }
  CHECK(definition);
  std::string actions;
  const std::vector<ModeSurfaceAction> mode_actions =
      ModeSurfaceActionsForMode(definition->id);
  for (size_t index = 0; index < mode_actions.size(); ++index) {
    const ModeSurfaceAction& action = mode_actions[index];
    actions += base::StrCat(
        {"<button class=chip", index == 0u ? " primary" : "",
         " type=button data-tahai-command=\"", action.command, "\" title=\"",
         action.description, "\">", action.label, "</button>"});
  }
  return base::StrCat(
      {"<section class=mode-surface-menu aria-label=\"",
       base::EscapeForHTML(definition->title),
       " workspace tools\"><div class=mode-surface-menu-copy><strong>",
       base::EscapeForHTML(definition->title), " toolset</strong><span>",
       base::EscapeForHTML(definition->launchpad_heading),
       "</span></div><nav aria-label=\"",
       base::EscapeForHTML(definition->title), " tools\">", actions,
       "</nav></section>"});
}

std::string PageFrame(
    std::string_view title,
    std::string_view content,
    std::string_view theme = "dark",
    std::string_view mode_id = "daily",
    const WorkModeWorkspaceConfiguration* configuration = nullptr) {
  const std::string_view body_class =
      theme == "light" ? "theme-light" : "theme-dark";
  const WorkModeDefinition* definition = ModeService::FindDefinition(mode_id);
  const std::string_view safe_mode_id =
      definition ? definition->id : std::string_view("daily");
  const std::string workspace_classes =
      configuration
          ? base::StrCat({" accent-", configuration->accent_id, " surface-",
                          configuration->surface_id, " density-",
                          configuration->density_id, " header-",
                          configuration->header_id,
                          configuration->show_runbook_rail
                              ? ""
                              : " runbook-rail-hidden"})
          : " accent-mode surface-mode density-comfortable header-standard";
  return "<!doctype html><html lang=en><head><meta charset=utf-8><meta "
         "name=viewport "
         "content=\"width=device-width,initial-scale=1\"><title>" +
         std::string(title) +
         "</title><link rel=stylesheet href=/app.css></head><body class=\"" +
         std::string(body_class) + " mode-" + std::string(safe_mode_id) +
         workspace_classes +
         "\"><main "
         "class=shell><header><div class=brand>" +
         kBrandMark + "<div><p class=eyebrow>TAHAI Browser</p><h1>" +
         std::string(title) + "</h1></div></div></header>" +
         ModeSurfaceMenuHtml(safe_mode_id) + std::string(content) +
         "<footer class=footer>Native Chromium surface · profile scoped · no "
         "Electron runtime · no page-content "
         "collection</footer>" +
         kCommandPaletteHtml +
         "<script src=/actions.js></script>"
         "</main></body></html>";
}

std::string_view ActiveTheme(ModeService* service) {
  CHECK(service);
  return service->active_configuration().theme_id;
}

std::string_view ActiveModeId(ModeService* service) {
  CHECK(service);
  return service->active_mode().id;
}

std::string_view RecommendedLayoutCommand(
    const WorkModeWorkspaceConfiguration& configuration) {
  if (configuration.layout_variant_id == "dual-side") {
    return "dual.open";
  }
  if (configuration.layout_variant_id == "dual-stack") {
    return "dual.stacked";
  }
  if (configuration.layout_variant_id == "tri-two-over-one") {
    return "tri.two-over-one";
  }
  if (configuration.layout_variant_id == "tri-one-over-two") {
    return "tri.one-over-two";
  }
  if (configuration.layout_variant_id == "quad") {
    return "quad.open";
  }
  return "quad.exit";
}

std::string_view LayoutVariantLabel(
    const WorkModeWorkspaceConfiguration& configuration) {
  if (configuration.layout_variant_id == "dual-side") {
    return "Dual · side by side";
  }
  if (configuration.layout_variant_id == "dual-stack") {
    return "Dual · stacked";
  }
  if (configuration.layout_variant_id == "tri-two-over-one") {
    return "Tri · 2 over 1";
  }
  if (configuration.layout_variant_id == "tri-one-over-two") {
    return "Tri · 1 over 2";
  }
  if (configuration.layout_variant_id == "quad") {
    return "Quad · 2 × 2";
  }
  return "1-Up";
}

// A mode is a local cockpit choice, not a scriptable workflow engine. These
// fixed quick starts make the next useful native action obvious without giving
// the renderer any ability to choose destinations or alter existing work.
struct ModeQuickStart {
  std::string_view command;
  std::string_view label;
  std::string_view description;
};

ModeQuickStart QuickStartForMode(std::string_view mode) {
  if (mode == "creator") {
    return {"mission.open", "Plan creative work",
            "Start a bounded brief, review checkpoints, and keep your canvas "
            "layout separate from your profile."};
  }
  if (mode == "builder") {
    return {"commands.open", "Open Command Center",
            "Reach allowlisted browser actions, native layouts, and evidence "
            "controls without a hidden automation layer."};
  }
  if (mode == "operator") {
    return {"mission.open", "Open Mission Control",
            "Create a local runbook, choose a governed workspace, and retain "
            "an explicit validation path."};
  }
  if (mode == "research") {
    return {"dual.open", "Open source + notes layout",
            "Start with two independent Chromium panes for source comparison "
            "and your own notes or draft."};
  }
  if (mode == "support") {
    return {"support.open", "Open Support Desk",
            "Begin with a sanitized recovery handoff and native profile or "
            "policy diagnostics when needed."};
  }
  return {"tab.new", "Open a clean tab",
          "Start ordinary browsing quickly, then add a focused workspace only "
          "when the work calls for it."};
}

std::string_view ModifierActionCommand(std::string_view modifier) {
  if (modifier == "watch") {
    return "quad.open";
  }
  return "quad.focus";
}

std::string_view ModifierActionLabel(std::string_view modifier) {
  if (modifier == "watch") {
    return "Open 2 × 2 workspace";
  }
  if (modifier == "presentation") {
    return "Prepare focused pane";
  }
  return "Focus active pane";
}

std::string ModeHtml(ModeService* service) {
  CHECK(service);
  const WorkModeDefinition& active = service->active_mode();
  const WorkModeWorkspaceConfiguration& configuration =
      service->active_configuration();
  std::string cards;
  for (const WorkModeDefinition& mode : ModeService::definitions()) {
    const bool selected = mode.id == active.id;
    cards += base::StrCat({
        "<article class=\"card mode-card mode-",
        mode.id,
        selected ? " mode-active" : "",
        "\"",
        selected ? " aria-current=true" : "",
        "><div><p class=mode-card-title>",
        base::EscapeForHTML(mode.title),
        "</p><strong class=mode-card-audience>",
        base::EscapeForHTML(mode.audience),
        "</strong><span class=mode-card-theme>",
        base::EscapeForHTML(mode.visual_theme),
        "</span></div><div class=mode-card-footer><span class=product-lane>",
        base::EscapeForHTML(mode.featured_products),
        "</span><button class=chip type=button data-tahai-mode=\"",
        mode.id,
        "\">",
        selected ? "Selected" : "Choose",
        "</button></div></article>",
    });
  }
  std::string modifiers;
  for (const WorkModeModifier& modifier : ModeService::modifiers()) {
    modifiers += base::StrCat({
        "<label class=mission-step><span><strong>",
        base::EscapeForHTML(modifier.title),
        "</strong><span class=muted> ",
        base::EscapeForHTML(modifier.description),
        "</span></span><input type=checkbox data-tahai-modifier=\"",
        modifier.id,
        "\"",
        service->IsModifierEnabled(modifier.id) ? " checked" : "",
        "></label><button class=chip type=button data-tahai-command=\"",
        ModifierActionCommand(modifier.id),
        "\">",
        ModifierActionLabel(modifier.id),
        "</button>",
    });
  }
  const auto choice = [](std::string_view key, std::string_view value,
                         std::string_view label, std::string_view current) {
    return base::StrCat(
        {"<button class=chip", current == value ? " selected" : "",
         " type=button data-tahai-mode-config=\"", key,
         "\" data-tahai-value=\"", value, "\">", label, "</button>"});
  };
  std::string templates;
  for (const WorkModeTemplate& work_template : ModeService::templates()) {
    if (work_template.mode_id != active.id) {
      continue;
    }
    templates += base::StrCat(
        {"<article class=card template-card><div><p class=eyebrow>",
         work_template.id == configuration.template_id ? "Default template"
                                                       : "Local template",
         "</p><strong>", base::EscapeForHTML(work_template.title),
         "</strong><span>", base::EscapeForHTML(work_template.description),
         "</span></div><span>Mission type: ",
         base::EscapeForHTML(work_template.mission_type),
         "</span><div class=actions><button class=chip type=button "
         "data-tahai-mode-config=\"template\" data-tahai-value=\"",
         work_template.id,
         "\">Set default</button><button class=button "
         "type=button data-tahai-template=\"",
         work_template.id, "\">Create runbook</button></div></article>"});
  }
  const std::string configuration_controls = base::StrCat(
      {"<div class=mode-config><div class=mode-config-group><h3>Appearance</h3>"
       "<p class=muted><strong>",
       base::EscapeForHTML(active.visual_theme),
       "</strong> is this mode’s formal default. These choices change only "
       "TAHAI’s local cockpit, never pages, tabs, identity, or security."
       "</p><p class=eyebrow>Base</p><div class=chips>",
       choice("theme", "dark", "Dark", configuration.theme_id),
       choice("theme", "light", "Light", configuration.theme_id),
       "</div><p class=eyebrow>Accent</p><div class=chips>",
       choice("accent", "mode", "Mode identity", configuration.accent_id),
       choice("accent", "slate", "Slate", configuration.accent_id),
       choice("accent", "azure", "Azure", configuration.accent_id),
       choice("accent", "teal", "Teal", configuration.accent_id),
       choice("accent", "violet", "Violet", configuration.accent_id),
       choice("accent", "amber", "Amber", configuration.accent_id),
       "</div><p class=eyebrow>Surface</p><div class=chips>",
       choice("surface", "mode", "Mode texture", configuration.surface_id),
       choice("surface", "quiet", "Quiet", configuration.surface_id),
       choice("surface", "grid", "Grid", configuration.surface_id),
       choice("surface", "paper", "Paper", configuration.surface_id),
       "</div></div><div class=mode-config-group><h3>Desktop rhythm</h3>"
       "<p class=muted>Set how much information TAHAI exposes before you drill "
       "into a workspace. Native TAHAI browser controls adapt to the selected "
       "mode; web page content is unaffected."
       "</p><p class=eyebrow>Density</p><div class=chips>",
       choice("density", "comfortable", "Comfortable",
              configuration.density_id),
       choice("density", "compact", "Compact", configuration.density_id),
       choice("density", "spacious", "Spacious", configuration.density_id),
       "</div><p class=eyebrow>TAHAI page header</p><div class=chips>",
       choice("header", "standard", "Standard", configuration.header_id),
       choice("header", "compact", "Compact", configuration.header_id),
       choice("header", "minimal", "Minimal", configuration.header_id),
       "</div></div><div class=mode-config-group><h3>Starting point</h3>"
       "<p class=muted>These are local recommendations. TAHAI never silently "
       "opens, moves, closes, or duplicates Chromium tabs.</p><p class=eyebrow>"
       "Surface</p><div class=chips>",
       choice("start_surface", "launchpad", "Launchpad",
              configuration.start_surface),
       choice("start_surface", "mission", "Mission Control",
              configuration.start_surface),
       choice("start_surface", "commands", "Command Center",
              configuration.start_surface),
       choice("start_surface", "modes", "Work Modes",
              configuration.start_surface),
       "</div><p class=eyebrow>Preferred native view</p><div class=chips>",
       choice("layout_variant", "one", "1-Up", configuration.layout_variant_id),
       choice("layout_variant", "dual-side", "Dual · side by side",
              configuration.layout_variant_id),
       choice("layout_variant", "dual-stack", "Dual · stacked",
              configuration.layout_variant_id),
       choice("layout_variant", "tri-two-over-one", "Tri · 2 over 1",
              configuration.layout_variant_id),
       choice("layout_variant", "tri-one-over-two", "Tri · 1 over 2",
              configuration.layout_variant_id),
       choice("layout_variant", "quad", "Quad · 2 × 2",
              configuration.layout_variant_id),
       "</div></div><div class=mode-config-group><h3>Workspace rail</h3>"
       "<p class=muted>Choose recognizable icons, full descriptive labels, "
       "or no rail. Restore a hidden rail from the toolbar mode menu or "
       "the browser menu. Saved for this profile and work mode.</p>"
       "<div class=chips>",
       choice("rail_state", "icons", "Icons only", configuration.rail_state),
       choice("rail_state", "expanded", "Expanded labels",
              configuration.rail_state),
       choice("rail_state", "hidden", "Hidden", configuration.rail_state),
       "</div><h3>Mission guidance</h3>"
       "<label class=toggle-row><span><strong>Runbook rail</strong>"
       "<span class=muted>Show generated checkpoint guidance on Mission "
       "Control.</span></span><input type=checkbox data-tahai-mode-config=\""
       "show_runbook_rail\"",
       configuration.show_runbook_rail ? " checked" : "",
       "></label>"
       "</div><p class=boundary>For privacy, permissions, downloads, profiles, "
       "search, extensions, and enterprise policy, use Chromium’s native "
       "settings. TAHAI customization never weakens those controls.</p>"
       "<button class=chip type=button data-tahai-mode-reset>Restore this "
       "mode’s defaults</button></div>"});
  return PageFrame(
      "Work Modes",
      base::StrCat(
          {R"TAHAI(
<section class=hero><p class=eyebrow>TAHAI work modes</p><h2>Choose a focused workspace.</h2><p class=muted>One local choice changes safe defaults for this profile. Your tabs, identity, browsing data, and pane assignments stay untouched.</p><div class=status><strong>)TAHAI",
           base::EscapeForHTML(active.title), R"TAHAI(</strong> · )TAHAI",
           base::EscapeForHTML(active.launchpad_heading),
           R"TAHAI(</div><p id=mode-status class=muted role=status aria-live=polite></p></section>
<section class=section><div class=section-head><div><p class=eyebrow>Workspaces</p><h2>Choose a work mode.</h2></div><p class=muted>Pick one, then tune it only when needed.</p></div><div class=mode-grid>)TAHAI",
           cards, R"TAHAI(</div></section>
<section class=section><article class="panel mode-actions"><div><p class=eyebrow>Current workspace</p><h2>)TAHAI",
           base::EscapeForHTML(active.title),
           R"TAHAI(</h2><p class=muted><span class=product-lane>)TAHAI",
           base::EscapeForHTML(active.featured_products),
           R"TAHAI(</span></p></div><nav aria-label="Workspace configuration"><button class="button primary" type=button data-tahai-open-dialog="mode-customize">Customize</button><button class=chip type=button data-tahai-open-dialog="mode-templates">Templates</button><button class=chip type=button data-tahai-open-dialog="mode-tools">Workspace tools</button></nav></article><details class=mode-flyout><summary>What changes with this mode?</summary><p>Only the visible TAHAI workspace defaults saved in this profile: theme, starting surface, layout recommendation, template, and local control density. Changes are explicit, reversible, and never move or duplicate a browser tab.</p></details></section>
<dialog id=mode-customize class=mode-dialog aria-labelledby=mode-customize-title><form method=dialog><div class=mode-dialog-head><div><p class=eyebrow>Customize workspace</p><h2 id=mode-customize-title>)TAHAI",
           base::EscapeForHTML(active.title),
           R"TAHAI(</h2><p class=muted>Saved only to this Chromium profile.</p></div><button class=chip type=button data-tahai-close-dialog>Close</button></div>)TAHAI",
           configuration_controls, R"TAHAI(</form></dialog>
<dialog id=mode-templates class=mode-dialog aria-labelledby=mode-templates-title><form method=dialog><div class=mode-dialog-head><div><p class=eyebrow>Local runbook templates</p><h2 id=mode-templates-title>Start with a known shape.</h2><p class=muted>Templates create only fixed, profile-scoped Mission Control runbooks.</p></div><button class=chip type=button data-tahai-close-dialog>Close</button></div><div class=grid>)TAHAI",
           templates, R"TAHAI(</div></form></dialog>
<dialog id=mode-tools class=mode-dialog aria-labelledby=mode-tools-title><form method=dialog><div class=mode-dialog-head><div><p class=eyebrow>Workspace tools</p><h2 id=mode-tools-title>Focus the current work.</h2><p class=muted>These are deliberate local presentation settings, never automatic rearrangement.</p></div><button class=chip type=button data-tahai-close-dialog>Close</button></div><div class=list>)TAHAI",
           modifiers,
           R"TAHAI(</div><p class=boundary>Modes cannot copy cookies, enumerate accounts, change the active profile, or move a page between panes. Chromium continues to own identity, permissions, authentication, downloads, and session data.</p></form></dialog><script src=/modes.js></script>
)TAHAI"}),
      configuration.theme_id, active.id, &configuration);
}

std::string NewTabHtml(MissionService* service, ModeService* mode_service) {
  CHECK(service);
  CHECK(mode_service);
  const WorkModeDefinition& active_mode = mode_service->active_mode();
  const WorkModeWorkspaceConfiguration& configuration =
      mode_service->active_configuration();
  const ModeQuickStart quick_start = QuickStartForMode(active_mode.id);
  const std::string active_mode_card = base::StrCat(
      {"<article class=panel><p class=eyebrow>Active work mode</p><h2>",
       base::EscapeForHTML(active_mode.title),
       "</h2><p class=muted>",
       base::EscapeForHTML(active_mode.launchpad_heading),
       "</p><p class=muted>Featured lane: <span class=product-lane>",
       base::EscapeForHTML(active_mode.featured_products),
       "</span>",
       "</p><p class=muted>Theme: ",
       configuration.theme_id == "light" ? "Light" : "Dark",
       " · preferred view: ",
       LayoutVariantLabel(configuration),
       "</p><p class=muted>",
       base::EscapeForHTML(quick_start.description),
       "</p><div class=actions><button class=\"button primary\" type=button "
       "data-tahai-command=\"",
       quick_start.command,
       "\">",
       base::EscapeForHTML(quick_start.label),
       "</button><button class=button type=button data-tahai-command=\"",
       RecommendedLayoutCommand(configuration),
       "\">Suggested layout</button><a class=button href=\"tahai://modes/\">"
       "Change mode safely</a></div></article>"});
  std::string recent_missions;
  if (service->missions().empty()) {
    recent_missions =
        "<article class=panel><p class=eyebrow>Profile scoped</p>"
        "<h2>Recent missions</h2><p class=muted>No missions have been "
        "created in this profile yet.</p><a class=button "
        "href=\"tahai://mission/\">Create a Mission</a></article>";
  } else {
    recent_missions =
        "<article class=panel><p class=eyebrow>Profile scoped</p>"
        "<h2>Recent missions</h2><div class=list>";
    size_t rendered = 0;
    for (auto it = service->missions().rbegin();
         it != service->missions().rend() && rendered < 3u; ++it, ++rendered) {
      const MissionSummary& mission = *it;
      size_t complete = 0;
      const size_t total = mission.steps.size() +
                           mission.validation_steps.size() +
                           mission.rollback_steps.size();
      for (const MissionStep& step : mission.steps) {
        complete += step.complete;
      }
      for (const MissionStep& step : mission.validation_steps) {
        complete += step.complete;
      }
      for (const MissionStep& step : mission.rollback_steps) {
        complete += step.complete;
      }
      recent_missions += base::StrCat({
          "<a class=card href=\"tahai://mission/\"><strong>",
          base::EscapeForHTML(mission.title),
          "</strong><span>",
          base::EscapeForHTML(mission.type),
          " · ",
          base::NumberToString(complete),
          "/",
          base::NumberToString(total),
          " generated checkpoints complete</span></a>",
      });
    }
    recent_missions +=
        "</div><a class=button href=\"tahai://mission/\">Open "
        "Mission Control</a></article>";
  }
  return PageFrame(
      "New Tab",
      base::StrCat(
          {R"TAHAI(
<section class=hero><p class=eyebrow>TAHAI Browser</p><h2>Start where you are.</h2><p class=muted>Search the web, return to an open page, or save a useful setup. Your browser profile and site permissions stay in Chromium.</p><div class=actions><button class="button primary" type=button data-tahai-command="address.focus">Search the web or enter a web address</button><button class=button type=button data-tahai-command="tabs.find">Find a tab</button><button class=button type=button data-tahai-command="workspaces.open">Saved workspaces</button></div></section>
 <section class=section><div class=section-head><div><p class=eyebrow>Work with pages</p><h2>Choose a simple next step</h2></div></div><div class=grid><button class=card type=button data-tahai-command="dual.open"><strong>Compare two pages</strong><span>Place the current page beside another page.</span></button><a class=card href="tahai://commands/"><strong>More work tools</strong><span>Find browser actions, layouts, printing, and saving.</span></a><a class=card href="tahai://mission/"><strong>Run a checklist</strong><span>Open Mission Control for recorded steps and evidence.</span></a></div></section>
<section class="section three">)TAHAI",
           active_mode_card, recent_missions,
           R"TAHAI(<article class=panel><p class=eyebrow>Workspace shortcuts</p><h2>Always within reach</h2><p class=muted>Open native TAHAI surfaces from the toolbar or browser menu. Keyboard: Alt+Shift+D for Dual View, Alt+Shift+G for Tri View, Alt+Shift+Q for Quad View, Alt+Shift+L for Launchpad, Alt+Shift+M for Mission Control, and Alt+Shift+O for Command Center.</p></article><article class=panel><p class=eyebrow>Browser state</p><h2>Native Chromium engine</h2><p class=status>Every pane is its own independently controlled tab and WebContents. Profiles, permissions, downloads, history, and authentication remain engine-owned.</p></article></section>
<section class=section><div class=section-head><div><p class=eyebrow>First 10 minutes</p><h2>Start with ordinary browsing. Add structure deliberately.</h2></div></div><div class=grid><article class=card><strong>1. Browse normally</strong><span>Use Chromium tabs, address bar, bookmarks, downloads, and profiles as usual.</span></article><article class=card><strong>2. Open Quad View</strong><span>When work needs parallel context, open four real tabs in the native 2 × 2 workspace.</span></article><article class=card><strong>3. Create a Mission</strong><span>Use generated checkpoints, validation, rollback, and timeline state—never page content or credentials.</span></article><article class=card><strong>4. Review and recover</strong><span>Use Profile Administration, Chromium policy, and Support for explicit, sanitized handoff.</span></article></div></section>
)TAHAI"}),
      configuration.theme_id, active_mode.id, &configuration);
}

std::string MissionHandoffSummary(const MissionSummary& mission) {
  size_t complete_count = 0;
  std::string checkpoints;
  for (const MissionStep& step : mission.steps) {
    complete_count += step.complete;
    checkpoints += base::StrCat(
        {"- [", step.complete ? "x" : " ", "] ", step.label, "\n"});
  }
  return base::StrCat({
      "TAHAI Mission Checkpoint Handoff\n",
      "Product: TAHAI Browser\n",
      "Version: ",
      version_info::GetVersionNumber(),
      "\n",
      "Mission category: ",
      mission.type,
      "\n",
      "Checkpoint status: ",
      base::NumberToString(complete_count),
      "/",
      base::NumberToString(mission.steps.size()),
      " complete\n",
      "Mission title: omitted by design\n",
      "\nGenerated checkpoints\n",
      checkpoints,
      "Privacy: no URLs, page content, form data, cookies, headers, tokens, "
      "credentials, screenshots, timeline notes, local paths, or logs are "
      "included.\n",
  });
}

std::string EvidencePackSummary(const MissionSummary& mission) {
  return base::StrCat({
      "TAHAI Sanitized Evidence Pack\n",
      "Product: TAHAI Browser\n",
      "Version: ",
      version_info::GetVersionNumber(),
      "\n",
      "Mission category: ",
      mission.type,
      "\n",
      "Export profile: ",
      mission.export_profile,
      "\n",
      "Generated evidence markers: ",
      base::NumberToString(mission.evidence.size()),
      "\n",
      "Escalation required: ",
      mission.escalation_required ? "yes" : "no",
      "\n",
      "Timeline ledger: ",
      mission.timeline_integrity_verified
          ? "verified local chain"
          : "legacy or invalid chain; not evidence",
      "\n",
      "Redaction review: no URLs, page titles, page content, screenshots, "
      "forms, cookies, headers, tokens, credentials, account identifiers, "
      "local paths, or logs are collected or exported.\n",
      "IT Docs and PSA profiles are local handoff contracts only; no "
      "connector, provider API, or writeback action is present.\n",
  });
}

std::string MissionCapsuleSummary(const MissionSummary& mission) {
  const std::optional<std::string> capsule = BuildTahaiMissionCapsule(mission);
  return capsule.value_or(
      "Mission Capsule unavailable: bounded schema limit "
      "was exceeded.");
}

std::string MissionHtml(MissionService* service, ModeService* mode_service) {
  CHECK(service);
  CHECK(mode_service);
  size_t checkpoint_count = 0;
  size_t complete_count = 0;
  size_t evidence_count = 0;
  size_t timeline_count = 0;
  size_t active_mission_count = 0;
  size_t archived_mission_count = 0;
  for (const MissionSummary& mission : service->missions()) {
    if (mission.archived) {
      ++archived_mission_count;
    } else {
      ++active_mission_count;
    }
    checkpoint_count += mission.steps.size() + mission.validation_steps.size() +
                        mission.rollback_steps.size();
    for (const MissionStep& step : mission.steps) {
      complete_count += step.complete;
    }
    for (const MissionStep& step : mission.validation_steps) {
      complete_count += step.complete;
    }
    for (const MissionStep& step : mission.rollback_steps) {
      complete_count += step.complete;
    }
    evidence_count += mission.evidence.size();
    timeline_count += mission.timeline.size();
  }
  const MissionSummary* active_mission = nullptr;
  for (auto mission = service->missions().rbegin();
       mission != service->missions().rend(); ++mission) {
    if (!mission->archived) {
      active_mission = &*mission;
      break;
    }
  }
  const std::string active_label =
      active_mission ? base::EscapeForHTML(active_mission->type)
                     : "No active mission";
  const std::string export_profile =
      active_mission ? base::EscapeForHTML(active_mission->export_profile)
                     : "sanitized-handoff";
  std::string missions;
  for (const MissionSummary& mission : service->missions()) {
    const std::string mutability_disabled = mission.archived ? " disabled" : "";
    std::string steps;
    for (size_t index = 0; index < mission.steps.size(); ++index) {
      const MissionStep& step = mission.steps[index];
      steps +=
          "<li class=\"mission-step " +
          std::string(step.complete ? "complete" : "") +
          "\"><span class=mission-step-label>" +
          base::EscapeForHTML(step.label) +
          "</span><button class=chip type=button" + mutability_disabled +
          " "
          "data-tahai-mission-action=toggle-step data-tahai-mission-id=\"" +
          base::EscapeForHTML(mission.id) + "\" data-tahai-step-index=\"" +
          base::NumberToString(index) + "\">" +
          (step.complete ? "Reopen" : "Complete") + "</button></li>";
    }
    std::string timeline;
    for (const MissionEvent& event : mission.timeline) {
      timeline += "<li data-tahai-timeline-kind=\"" +
                  base::EscapeForHTML(event.kind) + "\"><span class=scope>" +
                  base::EscapeForHTML(event.kind) + "</span> " +
                  base::EscapeForHTML(event.detail) + "<span class=muted> · " +
                  base::EscapeForHTML(event.created_at) + "</span></li>";
    }
    const auto render_generated_steps =
        [&mission, &mutability_disabled](const std::vector<MissionStep>& items,
                                         std::string_view action) {
          std::string result;
          for (size_t index = 0; index < items.size(); ++index) {
            const MissionStep& item = items[index];
            result +=
                "<li class=\"mission-step " +
                std::string(item.complete ? "complete" : "") +
                "\"><span class=mission-step-label>" +
                base::EscapeForHTML(item.label) +
                "</span><button class=chip type=button" + mutability_disabled +
                " "
                "data-tahai-mission-action=\"" +
                std::string(action) + "\" data-tahai-mission-id=\"" +
                base::EscapeForHTML(mission.id) +
                "\" data-tahai-step-index=\"" + base::NumberToString(index) +
                "\">" + (item.complete ? "Reopen" : "Complete") +
                "</button></li>";
          }
          return result;
        };
    const std::string validation =
        render_generated_steps(mission.validation_steps, "toggle-validation");
    const std::string rollback =
        render_generated_steps(mission.rollback_steps, "toggle-rollback");
    std::string evidence;
    for (const MissionEvidence& marker : mission.evidence) {
      evidence += "<li>" + base::EscapeForHTML(marker.label) +
                  "<span class=muted> · " +
                  base::EscapeForHTML(marker.capture_scope) + " · " +
                  base::EscapeForHTML(marker.captured_at) + "</span></li>";
    }
    if (evidence.empty()) {
      evidence =
          "<li class=muted>No evidence markers. Nothing from a page is "
          "captured.</li>";
    }
    const auto option = [&mission](std::string_view profile,
                                   std::string_view label) {
      return base::StrCat({"<option value=\"", profile, "\"",
                           mission.export_profile == profile ? " selected" : "",
                           ">", label, "</option>"});
    };
    const std::string lifecycle_controls =
        mission.archived
            ? base::StrCat(
                  {"<button class=button type=button "
                   "data-tahai-mission-action=restore "
                   "data-tahai-mission-id=\"",
                   base::EscapeForHTML(mission.id),
                   "\">Restore</button><button class=\"button danger\" "
                   "type=button data-tahai-mission-action=delete "
                   "data-tahai-mission-id=\"",
                   base::EscapeForHTML(mission.id), "\">Delete</button>"})
            : base::StrCat({"<button class=button type=button "
                            "data-tahai-mission-action=archive "
                            "data-tahai-mission-id=\"",
                            base::EscapeForHTML(mission.id),
                            "\">Archive</button>"});
    const std::string black_box_status =
        mission.timeline_integrity_verified
            ? "<p class=status>Mission Black Box: this bounded local event "
              "chain is internally consistent. It records generated browser "
              "events only; it is not proof of remote work.</p>"
            : "<p class=boundary>Mission Black Box: a legacy or malformed "
              "timeline was detected. This record is kept local but must not "
              "be presented as verified evidence.</p>";
    missions +=
        "<article class=\"panel mission-card\" data-tahai-mission-state=\"" +
        std::string(mission.archived ? "archived" : "active") +
        "\"><div "
        "class=mission-card-head><div><p class=eyebrow>" +
        base::EscapeForHTML(mission.type) +
        (mission.archived ? " · archived" : " · active") + "</p><h3>" +
        base::EscapeForHTML(mission.title) +
        "</h3></div><div class=actions><button class=button type=button "
        "data-tahai-mission-action=copy-handoff data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) +
        "\">Copy Sanitized Status</button><button class=button type=button "
        "data-tahai-mission-action=duplicate data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) + "\">Duplicate</button>" +
        lifecycle_controls +
        "</div></div><div><p class=eyebrow>Runbook "
        "checkpoints</p><ul class=\"list mission-steps\">" +
        steps +
        "</ul></div><div><p class=eyebrow>Validation rail</p><ul class=\"list "
        "mission-steps\">" +
        validation +
        "</ul></div><div><p class=eyebrow>Rollback rail</p><ul class=\"list "
        "mission-steps\">" +
        rollback + "</ul><div class=actions><button class=chip type=button" +
        mutability_disabled +
        " "
        "data-tahai-mission-action=toggle-escalation data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) + "\">" +
        (mission.escalation_required ? "Clear escalation required"
                                     : "Mark escalation required") +
        "</button></div></div><div><p class=eyebrow>Evidence Pack</p><p "
        "class=muted>Generated action markers only; no URL, title, page "
        "content, screenshot, cookie, token, header, or credential is "
        "collected.</p><ul class=\"list mission-timeline\">" +
        evidence + "</ul><div class=actions><button class=chip type=button" +
        mutability_disabled +
        " "
        "data-tahai-mission-action=add-evidence data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) +
        "\">Add data-free marker</button><select class=button" +
        mutability_disabled +
        " "
        "data-tahai-export-profile data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) + "\">" +
        option("sanitized-handoff", "Sanitized handoff") +
        option("internal", "Internal") +
        option("incident-packet", "Incident packet") +
        option("change-record", "Change record") +
        option("itdocs-sync", "IT Docs contract") +
        option("psa-ticket-note", "PSA ticket contract") +
        "</select><button class=chip type=button "
        "data-tahai-mission-action=copy-evidence data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) +
        "\">Copy sanitized Evidence Pack</button><button class=chip "
        "type=button data-tahai-mission-action=copy-capsule "
        "data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) +
        "\">Copy Mission Capsule</button><button class=chip type=button "
        "data-tahai-mission-action=copy-encrypted-capsule "
        "data-tahai-mission-id=\"" +
        base::EscapeForHTML(mission.id) +
        "\">Copy encrypted local capsule</button></div></div><div><p "
        "class=eyebrow>Mission Black Box</p>" +
        black_box_status +
        "<div class=chips><button class=chip "
        "type=button data-tahai-timeline-filter=all>All</button><button "
        "class=chip type=button "
        "data-tahai-timeline-filter=mission>Mission</button><button class=chip "
        "type=button "
        "data-tahai-timeline-filter=runbook>Runbook</button><button class=chip "
        "type=button "
        "data-tahai-timeline-filter=validation>Validation</button><button "
        "class=chip type=button "
        "data-tahai-timeline-filter=rollback>Rollback</button><button "
        "class=chip type=button "
        "data-tahai-timeline-filter=evidence>Evidence</button><button "
        "class=chip type=button "
        "data-tahai-timeline-filter=export>Export</button></div><ul "
        "class=\"list mission-timeline\">" +
        timeline + "</ul></div></article>";
  }
  if (missions.empty()) {
    missions =
        "<article class=panel><strong>No saved missions</strong><p class=muted>"
        "Create one in this Chromium profile. Mission metadata never captures "
        "page content, credentials, tokens, cookies, headers, screenshots, or "
        "arbitrary notes.</p></article>";
  }
  std::string content = R"TAHAI(
<section class=hero><p class=eyebrow>Native operational workspace</p><h2>Real tabs. Real WebContents. Bounded mission state.</h2><p class=muted>Mission metadata belongs to this Chromium profile. It supplies generated runbook checkpoints and a local completion timeline, but never simulates history, input, authentication, or remote page behavior.</p><form id=new-mission-form class=search><input name=title maxlength=128 required autocomplete=off placeholder="Mission name"><select name=type class=button aria-label="Mission type"><option value=investigation>Investigation</option><option value=incident>Incident</option><option value=change>Change</option><option value=deployment>Deployment</option><option value=migration>Migration</option><option value=audit>Audit</option><option value=maintenance>Maintenance</option><option value=documentation>Documentation</option><option value=admin>Administrative change</option><option value=support>Support</option><option value=development>Development</option></select><button class="button primary" type=submit>New Mission</button></form><p id=mission-status class=muted role=status aria-live=polite></p></section>
)TAHAI";
  content +=
      "<section class=section><div class=section-head><div><p "
      "class=eyebrow>Mission command deck</p><h2>Operational "
      "state</h2></div></div><div class=grid><article "
      "class=card><strong>Mission</strong><span>" +
      active_label + " · " + base::NumberToString(active_mission_count) +
      " active · " + base::NumberToString(archived_mission_count) +
      " archived</span></article><article "
      "class=card><strong>Active pane & layout</strong><span>Use native Dual, "
      "Tri, Quad, and Focus Pane controls; web content stays in real Chromium "
      "tabs.</span></article><article "
      "class=card><strong>Runbook</strong><span>" +
      base::NumberToString(complete_count) + "/" +
      base::NumberToString(checkpoint_count) +
      " generated checkpoints complete</span></article><article "
      "class=card><strong>Evidence</strong><span>" +
      base::NumberToString(evidence_count) +
      " data-free markers · no page data collected</span></article><article "
      "class=card><strong>Timeline</strong><span>" +
      base::NumberToString(timeline_count) +
      " bounded local events</span></article><article "
      "class=card><strong>Featured lane</strong><span class=product-lane>" +
      base::EscapeForHTML(mode_service->active_mode().featured_products) +
      "</span></article><article class=card><strong>Export "
      "safety</strong><span>" +
      export_profile +
      " · redaction-safe generated handoff "
      "only</span></article></div></section>";
  content += R"TAHAI(
<section class=section><div class=section-head><div><p class=eyebrow>Profile missions</p><h2>Saved locally</h2></div></div><div class=mission-grid>)TAHAI";
  content += missions;
  content += R"TAHAI(
<section class=section><div class=section-head><div><p class=eyebrow>Encrypted capsule import</p><h2>Create a fresh local Mission</h2></div></div><p class=muted>After the local-profile capsule below verifies, this explicit action creates a new local runbook from bounded completion state only. It never restores the source Mission identity, title, timestamps, event history, or browsing data.</p><div class=actions><button class="button secondary" type=button data-tahai-mission-action=import-encrypted-capsule disabled>Create fresh local Mission</button><button class=chip type=button data-tahai-mission-action=rotate-encrypted-capsule-key>Rotate local capsule key</button></div></section>
)TAHAI";
  content +=
      R"TAHAI(</div></section><section class=section><div class=section-head><div><p class=eyebrow>Encrypted capsule verification</p><h2>Local-profile cryptographic boundary</h2></div></div><p class=muted>Paste an encrypted capsule created by this same Chromium profile to decrypt and verify its integrity. The OS-protected key is never copied, uploaded, or shown here. Verification does not create, restore, or merge Mission state.</p><textarea id=encrypted-capsule-input class=search rows=5 maxlength=1048576 spellcheck=false placeholder="Paste an encrypted local-profile Mission Capsule"></textarea><div class=actions><button class="button" type=button data-tahai-mission-action=verify-encrypted-capsule>Verify encrypted capsule</button></div></section><section class=section><div class=section-head><div><p class=eyebrow>Mission recipe library</p><h2>Open a governed Quad View</h2></div></div><p class=muted>Each recipe is a reviewable fixed set of four HTTPS destinations. Launching it creates a bounded profile mission and four real Chromium tabs; it never accepts a URL, credential, token, script, connector, or arbitrary argument.</p><div class=grid><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=dns-migration><strong>DNS Migration</strong><span>Cloudflare, propagation, authority, and DNS documentation.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=m365-user-offboarding><strong>Microsoft 365 Offboarding</strong><span>Admin, Entra, security, and Microsoft guidance.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=firewall-change><strong>Firewall Change</strong><span>Vendor support and CISA advisory lanes.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=production-deployment><strong>Production Deployment</strong><span>GitHub, Vercel, status, and Actions docs.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=certificate-renewal><strong>Certificate Renewal</strong><span>Provider, certificate lookup, TLS test, and docs.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=incident-triage><strong>Incident Triage</strong><span>Provider status and public advisory lanes.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=github-actions-release><strong>GitHub Actions Release</strong><span>Repository, status, workflow, and run docs.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=cloudflare-cutover><strong>Cloudflare Cutover</strong><span>Zone, status, docs, and propagation checks.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=workstation-admin-setup><strong>Workstation / Admin Setup</strong><span>Microsoft admin, identity, Intune, and Windows docs.</span></button><button class=card type=button data-tahai-mission-action=launch-recipe data-tahai-recipe-id=vendor-support-handoff><strong>Vendor Support Handoff</strong><span>Vendor support sites and public security guidance.</span></button></div></section><section class="section three"><article class="panel mode-runbook-rail"><p class=eyebrow>Runbook rail</p><h2>Native checkpoint state</h2><p class=muted>Each mission carries a generated, type-specific checkpoint set. Completion changes are stored in the owning Chromium profile and survive restart.</p></article><article class=panel><p class=eyebrow>Quad View</p><h2>Native multi-pane workspace</h2><p class=muted>Use Command Center to open, focus, restore, and exit a real Chromium 2 × 2 split. No webview or renderer panes are involved.</p></article><article class=panel><p class=eyebrow>Evidence boundary</p><h2>Nothing secret-bearing is stored</h2><p class=boundary>Mission Control has no field for page contents, URLs, tokens, credentials, cookies, headers, screenshots, or arbitrary notes. Capture and sharing remain explicit Chromium actions and need their own verified release evidence.</p></article></section><script src=/mission.js></script>)TAHAI";
  return PageFrame("Mission Control", content, ActiveTheme(mode_service),
                   ActiveModeId(mode_service),
                   &mode_service->active_configuration());
}

std::string LocalOiHtml(MissionService* service,
                        ModeService* mode_service,
                        TahaiLocalOiService* local_oi_service,
                        PrefService* prefs) {
  CHECK(service);
  CHECK(mode_service);
  CHECK(prefs);
  const TahaiLocalOiPolicy local_oi_policy(prefs);
  const bool local_oi_enabled =
      local_oi_policy.IsEnabled(LocalOiPolicyControl::kEnabled);
  // The current surface is a WebUI read of the profile-owned service. Mission
  // ingestion is bounded to the explicitly persisted Mission schema.
  bool local_oi_sync_succeeded = false;
  if (local_oi_service && local_oi_enabled) {
    local_oi_sync_succeeded =
        local_oi_service->SyncMissions(service->missions());
  }
  const LocalOiSnapshot snapshot =
      local_oi_service && local_oi_enabled
          ? BuildLocalOiSnapshot(local_oi_service->data())
          : LocalOiSnapshot();
  const LocalOiDataInventory data_inventory =
      local_oi_service && local_oi_enabled
          ? BuildLocalOiDataInventory(local_oi_service->data())
          : LocalOiDataInventory();
  std::string local_oi_runtime_title = "Ready";
  std::string local_oi_runtime_detail =
      "Bounded local records are available in this profile.";
  if (!local_oi_enabled) {
    local_oi_runtime_title = "Disabled";
    local_oi_runtime_detail =
        "Local OI reads and writes are disabled by managed policy or this "
        "profile setting.";
  } else if (!local_oi_service || !local_oi_service->available()) {
    local_oi_runtime_title = "Unavailable";
    local_oi_runtime_detail =
        "The profile-local Local OI service is unavailable in this browser "
        "context.";
  } else if (local_oi_service->store_status() ==
             LocalOiStoreStatus::kRecoveredFromCorruption) {
    local_oi_runtime_title = "Recovered";
    local_oi_runtime_detail =
        "The local store recovered from invalid data; only validated records "
        "remain.";
  } else if (local_oi_service->store_status() ==
             LocalOiStoreStatus::kEphemeral) {
    local_oi_runtime_title = "Ephemeral";
    local_oi_runtime_detail =
        "This browser context does not keep Local OI records after it closes.";
  } else if (local_oi_service->store_status() ==
             LocalOiStoreStatus::kUnavailable) {
    local_oi_runtime_title = "Unavailable";
    local_oi_runtime_detail =
        "The Local OI store cannot persist records in this browser context.";
  } else if (!local_oi_sync_succeeded) {
    local_oi_runtime_title = "Refresh needs attention";
    local_oi_runtime_detail =
        "The bounded Mission projection did not refresh. Check Local OI "
        "policy and use the explicit refresh control; no browser data was "
        "substituted.";
  } else if (snapshot.entities.empty()) {
    local_oi_runtime_title = "First use";
    local_oi_runtime_detail =
        "Create a Mission or explicitly save a support record to begin this "
        "private local projection.";
  } else if (snapshot.mission_health.empty()) {
    local_oi_runtime_title = "Insufficient data";
    local_oi_runtime_detail =
        "Explicit local support metadata exists, but no active Mission is "
        "available for a readiness signal.";
  }
  const TahaiOiPromotionPreview promotion =
      BuildTahaiOiPromotionPreview(snapshot);
  const TahaiOiPromotionSurfaceState promotion_state =
      GetTahaiOiPromotionSurfaceState(prefs);
  const std::string portfolio_health_label =
      snapshot.mission_health.empty() ? "—" : "Local signals";
  const std::string promotion_button_disabled =
      promotion_state.is_managed ? " disabled" : "";
  const std::string promotion_toggle =
      promotion_state.show_referral
          ? "<button class=chip type=button data-tahai-oi-action="
            "promotion-setting data-tahai-oi-enabled=false>Hide hosted OI "
            "referrals</button>"
          : "<button class=chip type=button" + promotion_button_disabled +
                " data-tahai-oi-action=promotion-setting "
                "data-tahai-oi-enabled=true>Show hosted OI referrals</button>";
  const std::string promotion_cta =
      promotion_state.show_referral
          ? "<button class=\"button primary\" type=button "
            "data-tahai-oi-action=visit-msp "
            "data-tahai-oi-context=evidence-timeline>Explore OI for "
            "MSPs</button>"
          : "";

  std::string search_mission_options;
  for (const LocalOiMissionHealth& health : snapshot.mission_health) {
    search_mission_options += base::StrCat(
        {"<option value=\"", base::EscapeForHTML(health.mission_id), "\">",
         base::EscapeForHTML(health.mission_title),
         health.archived ? " · archived" : "", "</option>"});
  }

  // The explorer selector is bounded deliberately: all entities remain in
  // the local store and native traversal validates the chosen ID again, while
  // the page offers only a stable, readable working set rather than becoming
  // a bulk record browser.
  std::vector<const LocalOiEntity*> graph_entities;
  for (const LocalOiEntity& entity : snapshot.entities) {
    if (IsValidLocalOiId(entity.id)) {
      graph_entities.push_back(&entity);
    }
  }
  std::stable_sort(graph_entities.begin(), graph_entities.end(),
                   [](const LocalOiEntity* left, const LocalOiEntity* right) {
                     if (left->kind != right->kind) {
                       return left->kind < right->kind;
                     }
                     if (left->label != right->label) {
                       return left->label < right->label;
                     }
                     return left->id < right->id;
                   });
  std::string graph_entity_options;
  size_t rendered_graph_entities = 0u;
  for (const LocalOiEntity* entity : graph_entities) {
    if (rendered_graph_entities++ == 96u) {
      break;
    }
    graph_entity_options +=
        base::StrCat({"<option value=\"", base::EscapeForHTML(entity->id),
                      "\">", base::EscapeForHTML(entity->kind), " · ",
                      base::EscapeForHTML(entity->label), "</option>"});
  }

  struct LocalControl {
    std::string_view id;
    LocalOiPolicyControl control;
    std::string_view label;
    std::string_view description;
  };
  constexpr std::array<LocalControl, 8> kLocalControls = {{
      {"enabled", LocalOiPolicyControl::kEnabled, "Local OI",
       "Master switch for profile-local OI reads and writes."},
      {"mission-ingestion", LocalOiPolicyControl::kMissionIngestion,
       "Mission metadata", "Bounded Mission, runbook, and evidence state."},
      {"artifact-ingestion", LocalOiPolicyControl::kArtifactIngestion,
       "Artifacts and Change Lens",
       "Explicit digests and provenance metadata."},
      {"documentation-ingestion",
       LocalOiPolicyControl::kDocumentationReferenceIngestion,
       "Documentation pointers", "Operator-entered public reference pointers."},
      {"ops-tool-ingestion", LocalOiPolicyControl::kOpsToolIngestion,
       "Support tools", "Explicit DNS/TLS, Environment Guard, and rechecks."},
      {"reports", LocalOiPolicyControl::kReports, "Local reports",
       "Generate sanitized aggregate Local OI reports."},
      {"export", LocalOiPolicyControl::kExport, "Clipboard export",
       "Explicit local copy of a redacted safe report."},
      {"msp-promotion", LocalOiPolicyControl::kMspPromotion, "MSP referrals",
       "Fixed public OI referral buttons; never an upload."},
  }};
  std::string local_control_cards;
  for (const LocalControl& control : kLocalControls) {
    const bool enabled = local_oi_policy.IsEnabled(control.control);
    const bool managed = local_oi_policy.IsManaged(control.control);
    local_control_cards += base::StrCat(
        {"<article class=oi-control-card><p class=eyebrow>",
         base::EscapeForHTML(
             std::string(local_oi_policy.Source(control.control))),
         "</p><h3>", base::EscapeForHTML(std::string(control.label)),
         "</h3><p class=muted>",
         base::EscapeForHTML(std::string(control.description)),
         "</p><div class=actions><span class=chip>",
         enabled ? "Enabled" : "Disabled",
         "</span><button class=chip "
         "type=button data-tahai-oi-setting=\"",
         base::EscapeForHTML(std::string(control.id)),
         "\" data-tahai-oi-enabled=\"", enabled ? "false" : "true", "\"",
         managed ? " disabled" : "", ">",
         managed ? "Managed" : (enabled ? "Disable" : "Enable"),
         "</button></div></article>"});
  }

  std::string data_inventory_rows;
  for (const LocalOiDataInventoryEntry& entry :
       data_inventory.entity_categories) {
    data_inventory_rows += base::StrCat(
        {"<li><strong>",
         base::EscapeForHTML(
             std::string(LocalOiEntityTypeName(entry.entity_type))),
         "</strong><span>", base::NumberToString(entry.record_count), " record",
         entry.record_count == 1u ? "" : "s", "</span></li>"});
  }
  if (data_inventory_rows.empty()) {
    data_inventory_rows =
        "<li><strong>Local OI store</strong><span>Unavailable in this "
        "browser context.</span></li>";
  }

  std::string mission_health;
  for (const LocalOiMissionHealth& health : snapshot.mission_health) {
    const int progress =
        health.total_checkpoints == 0u
            ? 0
            : static_cast<int>(100u * health.completed_checkpoints /
                               health.total_checkpoints);
    const std::string search_text = base::EscapeForHTML(
        base::ToLowerASCII(health.mission_title + " " + health.mission_type +
                           " " + health.readiness));
    mission_health += base::StrCat(
        {"<article class=oi-mission data-oi-readiness=\"",
         base::EscapeForHTML(health.readiness),
         "\" data-tahai-oi-searchable data-tahai-oi-search=\"",
         search_text,
         "\"><div class=oi-mission-head><div><p class=eyebrow>",
         base::EscapeForHTML(health.mission_type),
         " · ",
         base::EscapeForHTML(health.readiness),
         "</p><h3>",
         base::EscapeForHTML(health.mission_title),
         "</h3></div><div class=oi-score aria-label=\"Mission health score ",
         base::NumberToString(health.score),
         "\">",
         base::NumberToString(health.score),
         "</div></div><div class=oi-progress aria-label=\"",
         base::NumberToString(progress),
         "% generated checkpoints complete\"><span style=\"width:",
         base::NumberToString(progress),
         "%\"></span></div><div class=chips><span class=chip>",
         base::NumberToString(health.completed_checkpoints),
         "/",
         base::NumberToString(health.total_checkpoints),
         " checkpoints</span><span class=chip>",
         base::NumberToString(health.evidence_markers),
         " evidence markers</span>",
         health.archived ? "<span class=chip>immutable archive</span>" : "",
         "</div></article>"});
  }
  if (mission_health.empty()) {
    mission_health =
        "<div class=oi-empty>No local Mission records yet. Create a bounded "
        "Mission in Mission Control to begin this private local "
        "projection.</div>";
  }

  std::string findings;
  for (const LocalOiFinding& finding : snapshot.findings) {
    const std::string state =
        std::string(LocalOiFindingStateName(finding.state));
    const std::string lifecycle_actions = base::StrCat(
        {finding.state == LocalOiFindingState::kSuppressed
             ? "<button class=chip type=button data-tahai-oi-action=reopen>"
               "Reopen</button>"
             : "<button class=chip type=button data-tahai-oi-action="
               "acknowledge>Acknowledge</button><button class=chip type=button "
               "data-tahai-oi-action=resolve>Resolve</button><button "
               "class=chip "
               "type=button data-tahai-oi-action=suppress>Suppress</button>",
         "<button class=chip type=button "
         "data-tahai-oi-action=add-to-local-brief>"
         "Add to local brief</button>"});
    findings +=
        base::StrCat({"<article class=oi-finding data-oi-severity=\"",
                      LocalOiSeverityLabel(finding.severity),
                      "\" data-tahai-oi-finding-id=\"",
                      base::EscapeForHTML(finding.id),
                      "\" data-oi-finding-state=\"",
                      base::EscapeForHTML(state),
                      "\" data-tahai-oi-searchable data-tahai-oi-search=\"",
                      base::EscapeForHTML(base::ToLowerASCII(
                          finding.mission_title + " " + finding.title + " " +
                          finding.summary + " " + finding.recommendation)),
                      "\"><div><p class=eyebrow>",
                      base::EscapeForHTML(finding.mission_title),
                      "</p><h3>",
                      base::EscapeForHTML(finding.title),
                      "</h3><p>",
                      base::EscapeForHTML(finding.summary),
                      "</p><p class=recommendation><strong>Next:</strong> ",
                      base::EscapeForHTML(finding.recommendation),
                      "</p><span class=oi-evidence-anchor>Local source: ",
                      base::EscapeForHTML(finding.evidence_anchor),
                      "</span><p class=muted>Lifecycle: ",
                      base::EscapeForHTML(state),
                      finding.acknowledged ? " · operator acknowledged" : "",
                      "</p><label class=visually-hidden for=\"oi-note-",
                      base::EscapeForHTML(finding.id),
                      "\">Finding rationale</label><input id=\"oi-note-",
                      base::EscapeForHTML(finding.id),
                      "\" data-tahai-oi-finding-note type=text maxlength=",
                      base::NumberToString(kTahaiLocalOiMaximumSummaryLength),
                      " placeholder=\"Local rationale required\"></div><div "
                      "class=actions>",
                      lifecycle_actions,
                      "</div></article>"});
  }
  if (findings.empty()) {
    findings =
        "<div class=oi-empty>No active Local OI knowledge gaps are derived "
        "from the current bounded Mission records.</div>";
  }

  std::string priority_actions;
  size_t rendered_actions = 0u;
  for (const LocalOiPriorityAction& action : snapshot.priority_actions) {
    if (rendered_actions++ == 12u) {
      break;
    }
    priority_actions += base::StrCat(
        {"<article class=oi-action data-oi-severity=\"",
         LocalOiSeverityLabel(action.severity),
         "\" data-tahai-oi-searchable data-tahai-oi-search=\"",
         base::EscapeForHTML(
             base::ToLowerASCII(action.mission_title + " " + action.title +
                                " " + action.rationale + " " + action.action +
                                " " + action.evidence_anchor)),
         "\"><p class=eyebrow>", base::EscapeForHTML(action.mission_title),
         " · priority ", base::NumberToString(action.priority), "</p><h3>",
         base::EscapeForHTML(action.title), "</h3><p>",
         base::EscapeForHTML(action.rationale),
         "</p><p class=action-next><strong>Next:</strong> ",
         base::EscapeForHTML(action.action),
         "</p><span class=oi-evidence-anchor>Local source: ",
         base::EscapeForHTML(action.evidence_anchor),
         "</span><div class=actions><a class=chip href=\"tahai://mission/\">"
         "Resolve in Mission Control</a></div></article>"});
  }
  if (priority_actions.empty()) {
    priority_actions =
        "<div class=oi-empty>No active operator actions are derived from the "
        "current bounded Mission records.</div>";
  }

  std::string scale_signal_cards;
  if (promotion_state.show_referral) {
    for (const LocalOiScaleSignal& signal : snapshot.scale_signals) {
      scale_signal_cards += base::StrCat(
          {"<article class=\"panel oi-promotion oi-scale-signal\" "
           "data-tahai-oi-searchable data-tahai-oi-search=\"",
           base::EscapeForHTML(base::ToLowerASCII(signal.title + " " +
                                                  signal.summary + " " +
                                                  signal.hosted_capability)),
           "\"><p class=eyebrow>Private-to-team boundary</p><h3>",
           base::EscapeForHTML(signal.title), "</h3><p class=muted>",
           base::EscapeForHTML(signal.summary), "</p><p class=boundary>",
           base::EscapeForHTML(signal.hosted_capability),
           "</p><div class=actions><button class=button type=button "
           "data-tahai-oi-action=visit-msp data-tahai-oi-context=\"",
           base::EscapeForHTML(signal.referral_context),
           "\">Explore OI for MSPs</button></div></article>"});
    }
  }
  const std::string scale_signal_section =
      scale_signal_cards.empty()
          ? ""
          : "<section class=section><div class=section-head><div><p "
            "class=eyebrow>When work needs organizational authority</p><h2>"
            "Keep local work private until coordination is actually needed."
            "</h2></div><p class=muted>These are local posture signals, not "
            "uploads, tenant checks, or pressure to promote.</p></div><div "
            "class=oi-action-queue>" +
                scale_signal_cards + "</div></section>";

  const std::string local_asset_section = base::StrCat(
      {R"TAHAI(<section class=section><div class=section-head><div><p class=eyebrow>Local operational inventory</p><h2>Evidence, diagnostics, and rechecks—profile local.</h2></div><p class=muted>Counts describe persisted typed metadata only; no source material is retained.</p></div><div class=oi-metric-grid><article class=oi-metric><span>Artifact integrity</span><strong>)TAHAI",
       base::NumberToString(snapshot.artifact_count),
       R"TAHAI(</strong></article><article class=oi-metric><span>Tool results</span><strong>)TAHAI",
       base::NumberToString(snapshot.diagnostic_result_count),
       R"TAHAI(</strong></article><article class=oi-metric><span>Change Lens</span><strong>)TAHAI",
       base::NumberToString(snapshot.change_capture_count),
       R"TAHAI(</strong></article><article class=oi-metric><span>Manual rechecks</span><strong>)TAHAI",
       base::NumberToString(snapshot.manual_watch_count),
       R"TAHAI(</strong></article><article class=oi-metric><span>Endpoints</span><strong>)TAHAI",
       base::NumberToString(snapshot.endpoint_count),
       R"TAHAI(</strong></article><article class=oi-metric><span>Documentation pointers</span><strong>)TAHAI",
       base::NumberToString(snapshot.document_reference_count),
       R"TAHAI(</strong></article><article class=oi-metric><span>Domains</span><strong>)TAHAI",
       base::NumberToString(snapshot.domain_count),
       R"TAHAI(</strong></article></div><div class=actions><a class=button href="tahai://support/">Open Support Engineer Tools</a></div></section>)TAHAI"});

  std::string technical_records;
  if (local_oi_service && local_oi_enabled) {
    size_t rendered_records = 0u;
    for (const LocalOiEntityRecord& record :
         local_oi_service->data().entities) {
      if (record.archived ||
          (record.type != LocalOiEntityType::kDomain &&
           record.type != LocalOiEntityType::kEndpoint &&
           record.type != LocalOiEntityType::kToolResult &&
           record.type != LocalOiEntityType::kArtifact &&
           record.type != LocalOiEntityType::kDocumentReference &&
           record.type != LocalOiEntityType::kWatch)) {
        continue;
      }
      if (rendered_records++ == 24u) {
        break;
      }
      std::string fields;
      size_t rendered_fields = 0u;
      for (const LocalOiField& field : record.fields) {
        if (rendered_fields++ == 10u) {
          break;
        }
        fields += base::StrCat(
            {"<li><strong>", base::EscapeForHTML(field.key), "</strong><span>",
             base::EscapeForHTML(field.value), "</span></li>"});
      }
      technical_records += base::StrCat(
          {"<article class=panel><p class=eyebrow>",
           base::EscapeForHTML(std::string(LocalOiEntityTypeName(record.type))),
           "</p><h3>", base::EscapeForHTML(record.title),
           "</h3><p class=muted>", base::EscapeForHTML(record.summary),
           "</p><ul class=list>", fields, "</ul></article>"});
    }
  }
  if (technical_records.empty()) {
    technical_records =
        "<div class=oi-empty>Run an explicit Support Engineer tool or save a "
        "local record to populate this profile-local technical explorer.</div>";
  }
  const std::string technical_record_section =
      "<section class=section><div class=section-head><div><p "
      "class=eyebrow>Technical record explorer</p><h2>Persisted typed "
      "operational metadata</h2></div><p class=muted>Local display only · "
      "limited to 24 recent typed records</p></div><div "
      "class=oi-action-queue>" +
      technical_records +
      "</div><p class=boundary>These are the bounded fields explicitly "
      "recorded by Local OI sources. They exclude page bodies, raw response "
      "headers, cookies, credentials, browser history, downloads, and "
      "authenticated-console data.</p></section>";

  std::string graph_edges;
  size_t rendered_edges = 0u;
  for (const LocalOiRelationship& edge : snapshot.relationships) {
    if (rendered_edges++ == 36u) {
      break;
    }
    graph_edges += base::StrCat(
        {"<div class=oi-edge><strong>", base::EscapeForHTML(edge.source_label),
         "</strong><span>", base::EscapeForHTML(edge.relationship),
         "</span><em>", base::EscapeForHTML(edge.target_label), "</em></div>"});
  }
  if (graph_edges.empty()) {
    graph_edges =
        "<div class=oi-empty>Relationship lanes appear when a local Mission "
        "exists.</div>";
  }

  std::string memory;
  size_t rendered_memory = 0u;
  for (const LocalOiMemoryItem& item : snapshot.memory) {
    if (rendered_memory++ == 40u) {
      break;
    }
    memory += base::StrCat(
        {"<div class=oi-memory-row data-tahai-oi-searchable "
         "data-tahai-oi-search=\"",
         base::EscapeForHTML(base::ToLowerASCII(item.kind + " " + item.detail)),
         "\"><span class=oi-memory-kind>", base::EscapeForHTML(item.kind),
         "</span><p>", base::EscapeForHTML(item.detail), "</p><time>",
         base::EscapeForHTML(item.created_at), "</time></div>"});
  }
  if (memory.empty()) {
    memory =
        "<div class=oi-empty>Operational memory will show generated Mission "
        "events here. It never reads browsing history or page content.</div>";
  }

  std::string local_report_ledger;
  if (local_oi_service && local_oi_enabled) {
    size_t rendered_reports = 0u;
    for (auto it = local_oi_service->data().reports.rbegin();
         it != local_oi_service->data().reports.rend() &&
         rendered_reports < 16u;
         ++it, ++rendered_reports) {
      local_report_ledger += base::StrCat(
          {"<article class=panel><p class=eyebrow>",
           base::EscapeForHTML(std::string(LocalOiReportKindName(it->kind))),
           "</p><h3>", base::EscapeForHTML(it->title), "</h3><p class=muted>",
           base::EscapeForHTML(it->provenance),
           "</p><ul class=list><li><strong>"
           "Created</strong><span>",
           base::EscapeForHTML(it->created_at),
           "</span></li><li><strong>"
           "Redactions</strong><span>",
           base::NumberToString(it->redaction_count),
           " applied to the safe report</span></li></ul></article>"});
    }
  }
  if (local_report_ledger.empty()) {
    local_report_ledger =
        "<div class=oi-empty>No aggregate Local OI reports have been "
        "generated in this profile.</div>";
  }
  const std::string local_data_inventory_section = base::StrCat(
      {"<section class=section><div class=section-head><div><p "
       "class=eyebrow>Profile-local data inventory</p><h2>Inspect what "
       "Local OI retains.</h2></div><p class=muted>Counts and categories "
       "only · no raw record export</p></div><div class=oi-command-deck>"
       "<article class=panel><p>This category ledger is derived from the "
       "current profile-local Local OI store. It exposes no record values, "
       "paths, identifiers, secrets, browser content, or cross-profile "
       "data.</p><ul class=list><li><strong>Schema</strong><span>v",
       base::NumberToString(data_inventory.schema_version),
       " · generation ",
       base::NumberToString(data_inventory.generation),
       "</span></li><li><strong>Relationships</strong><span>",
       base::NumberToString(data_inventory.relationship_count),
       " typed edge",
       data_inventory.relationship_count == 1u ? "" : "s",
       "</span></li><li><strong>Findings</strong><span>",
       base::NumberToString(data_inventory.finding_count),
       " lifecycle record",
       data_inventory.finding_count == 1u ? "" : "s",
       "</span></li><li><strong>Operational memory</strong><span>",
       base::NumberToString(data_inventory.memory_count),
       " event",
       data_inventory.memory_count == 1u ? "" : "s",
       "</span></li><li><strong>Generated reports</strong><span>",
       base::NumberToString(data_inventory.report_count),
       " ledger entr",
       data_inventory.report_count == 1u ? "y" : "ies",
       "</span></li>",
       data_inventory_rows,
       "</ul></article><aside class=\"panel oi-boundary\"><p "
       "class=eyebrow>Explicit exclusions</p><h3>Not present in this "
       "store.</h3><p class=boundary>Local OI does not retain passwords, "
       "cookies, session or OAuth tokens, authorization headers, form "
       "contents, raw page bodies, browser storage, screenshots, private "
       "paths, or a general browsing-history index. Use Clear Local OI "
       "data to delete this isolated store; Mission Control retains its own "
       "separate bounded Mission records.</p></aside></div></section>"});
  const std::string local_json_report_section = R"TAHAI(
<section class=section><div class=section-head><div><p class=eyebrow>Structured local handoff</p><h2>Copy a safe JSON summary.</h2></div><p class=muted>Aggregate counts only · explicit clipboard action</p></div><div class=oi-command-deck><article class=panel><p>Choose a report focus, then copy a bounded JSON document for a local tool, ticket, or review workflow. It contains no Mission names or IDs, URLs, digests, raw evidence, browser content, credentials, or provider data.</p><div class=actions><label class=sr-only for=local-oi-json-report-kind>JSON report focus</label><select id=local-oi-json-report-kind class=button><option value=overview>Mission Health Summary</option><option value=sanitized-handoff>Operational Handoff</option><option value=change-record>Change Record</option><option value=incident-packet>Knowledge Gap Report</option><option value=evidence-manifest>Evidence Summary</option><option value=artifact-integrity>Artifact Integrity Report</option><option value=diagnostic-report>Local OI Diagnostic Report</option></select><button class=button type=button data-tahai-oi-action=copy-json-report>Copy sanitized JSON</button></div></article><article class="panel oi-boundary"><p class=eyebrow>Format boundary</p><h3>Not an integration.</h3><p class=boundary>This JSON is an aggregate, local-only clipboard artifact. TAHAI Browser does not upload it, synchronize it, send it to TAHAI OI, or connect it to PSA, RMM, documentation, or ticketing systems.</p></article></div></section>
)TAHAI";
  const std::string local_report_section =
      "<section class=section><div class=section-head><div><p "
      "class=eyebrow>Local report ledger</p><h2>Generated safe reports</h2>"
      "</div><p class=muted>Metadata only · report contents are not rendered "
      "here</p></div><div class=oi-action-queue>" +
      local_report_ledger +
      "</div><p class=boundary>Reports remain local until you explicitly copy "
      "one to the clipboard. This ledger has no upload, team share, cloud "
      "sync, "
      "or hosted audit path.</p></section>";

  const std::string local_runtime_section = base::StrCat(
      {"<section class=section><div class=oi-command-deck><article "
       "id=local-oi-runtime-state class=\"panel oi-boundary\"><p "
       "class=eyebrow>Local OI runtime "
       "state</p><h2>",
       base::EscapeForHTML(local_oi_runtime_title), "</h2><p class=boundary>",
       base::EscapeForHTML(local_oi_runtime_detail),
       "</p></article><article class=panel><p class=eyebrow>Storage truth</p>"
       "<h2>Profile-local by design.</h2><p class=muted>Use Local controls "
       "to see whether a setting is managed. A disabled or ephemeral context "
       "never becomes a hidden cloud fallback.</p><div class=actions><a "
       "class=chip href=\"tahai://policy/\">View policy posture</a></div>"
       "</article></div></section>"});

  const std::
      string content = base::StrCat({R"TAHAI(
<section class=oi-hero><div class=hero><p class=eyebrow>TAHAI Local OI · private browser intelligence</p><h2>See operational readiness without giving up your browser data.</h2><p class=muted>Local OI turns TAHAI Mission Control's bounded, profile-scoped runbook, validation, rollback, evidence-marker, and Mission Black Box metadata into an on-device operational view. It works deterministically without a model, connector, account, or cloud upload.</p><div class=actions><a class="button primary" href="tahai://mission/">Open Mission Control</a><button class=button type=button data-tahai-oi-action=copy-report data-tahai-oi-report=overview>Copy Safe Local OI Report</button>)TAHAI",
                                     promotion_state.show_referral
                                         ? "<button class=button "
                                           "type=button "
                                           "data-tahai-oi-action=visit-"
                                           "msp "
                                           "data-tahai-oi-context="
                                           "overview>Explore OI for "
                                           "MSPs</button>"
                                         : "",
                                     R"TAHAI(</div></div><aside class=oi-privacy-rail><article class=oi-state-card><em>Portfolio health</em><strong>)TAHAI",
                                     portfolio_health_label,
                                     R"TAHAI(</strong><span>Derived only from generated local Mission state.</span></article><article class=oi-state-card><em>Local boundary</em><strong>Private</strong><span>No browser history, tabs, URLs, page bodies, credentials, cookies, screenshots, or account data enter Local OI.</span></article></aside></section>
<section class=section><div class=section-head><div><p class=eyebrow>Command deck</p><h2>Local operational posture</h2></div><p class=muted>Profile scoped · deterministic · no cloud dependency</p></div><div class=oi-metric-grid><article class=oi-metric><span>Active Missions</span><strong>)TAHAI",
                                     base::NumberToString(
                                         snapshot.active_mission_count),
                                     R"TAHAI(</strong></article><article class=oi-metric><span>Blocked</span><strong>)TAHAI",
                                     base::NumberToString(
                                         snapshot.blocked_finding_count),
                                     R"TAHAI(</strong></article><article class=oi-metric><span>Knowledge gaps</span><strong>)TAHAI",
                                     base::NumberToString(
                                         snapshot.knowledge_gap_count),
                                     R"TAHAI(</strong></article><article class=oi-metric><span>Evidence markers</span><strong>)TAHAI",
                                     base::NumberToString(
                                         snapshot.evidence_marker_count),
                                     R"TAHAI(</strong></article><article class=oi-metric><span>Black Box events</span><strong>)TAHAI",
                                     base::NumberToString(
                                         snapshot.timeline_event_count),
                                     R"TAHAI(</strong></article></div></section>
<section class=section><div class=oi-command-deck><article class=panel><p class=eyebrow>Local Command Center</p><h2>Find local operational context.</h2><form id=local-oi-search-form class=oi-search-form><input id=local-oi-search class=command-input type=search autocomplete=off placeholder="Search local Missions, action queue, knowledge gaps, graph entities, and generated timeline events" aria-label="Search local operational intelligence"><div class=actions><select id=local-oi-search-kind class=button aria-label="Record type filter"><option value=all>All record types</option><option value=mission>Missions</option><option value=endpoint>Endpoints</option><option value=artifact>Artifacts</option><option value=document_reference>Documentation pointers</option><option value=tool_result>Tool results</option><option value=watch>Manual rechecks</option><option value=finding>Findings</option><option value=memory>Operational memory</option></select><select id=local-oi-search-mission class=button aria-label="Mission context filter"><option value="">All Mission context</option>)TAHAI",
                                     search_mission_options,
                                     R"TAHAI(</select><select id=local-oi-search-severity class=button aria-label="Finding severity filter"><option value=all>All severities</option><option value=blocked>Blocked</option><option value=attention>Attention</option><option value=information>Information</option></select><select id=local-oi-search-state class=button aria-label="Finding state filter"><option value=all>All current states</option><option value=open>Open</option><option value=acknowledged>Acknowledged</option><option value=suppressed>Suppressed</option></select><select id=local-oi-search-age class=button aria-label="Recency filter"><option value=0>All retained records</option><option value=1>Past 24 hours</option><option value=7>Past 7 days</option><option value=30>Past 30 days</option><option value=90>Past 90 days</option></select><button class=button type=submit>Search local records</button></div></form><p id=local-oi-search-status class=muted role=status aria-live=polite></p><div id=local-oi-search-results class=oi-search-results><div class=oi-search-row><strong>Private local index</strong><span>Type, Mission, current finding severity/state, and recency filters are evaluated in the native Local OI handler. Nothing is sent to a search service.</span></div></div></article><aside class="panel oi-boundary"><p class=eyebrow>Scope truth</p><h2>Useful, but intentionally narrow.</h2><p class=boundary>Local OI is not a hosted tenant, RMM, PSA, documentation system, shared audit store, connector platform, or AI control plane. It makes no claim to replace TAHAI Operational Intelligence.</p></aside></div></section>
<section class=section><div class=section-head><div><p class=eyebrow>Local controls</p><h2>Choose the profile-local surface area.</h2></div><p class=muted>Managed settings remain visible and locked. Changing a local setting never uploads, deletes, or backfills data.</p></div><div class=oi-action-queue>)TAHAI",
                                     local_control_cards,
                                     R"TAHAI(</div><div class=actions><button class=button type=button data-tahai-oi-action=rebuild-local>Refresh bounded Mission projection</button><a class=chip href="tahai://policy/">Open policy posture</a></div><p id=local-oi-control-status class=muted role=status aria-live=polite>Refresh re-reads the existing bounded Mission schema only. It does not inspect browser history, tabs, URLs, pages, accounts, or the network.</p></section>
<section class=section><div class=section-head><div><p class=eyebrow>Mission intelligence</p><h2>Readiness by local Mission</h2></div><p class=muted>Scores are deterministic; they are signals, not remote-work proof.</p></div><div class=oi-mission-grid>)TAHAI",
                                     mission_health,
                                     R"TAHAI(</div></section>
<section class=section><div class=section-head><div><p class=eyebrow>Local operator queue</p><h2>Resolve the most consequential local gaps next.</h2></div><p class=muted>)TAHAI",
                                     base::NumberToString(
                                         snapshot.operator_action_count),
                                     R"TAHAI( deterministic actions · every change remains explicit</p></div><div class=oi-action-queue>)TAHAI",
                                     priority_actions,
                                     R"TAHAI(</div></section>
<section class=section><div class=section-head><div><p class=eyebrow>Private local reports</p><h2>Prepare the right aggregate handoff.</h2></div><p class=muted>Each copy is a local clipboard action. None uploads or includes Mission names, URLs, or browser data.</p></div><div class=grid><button class=card type=button data-tahai-oi-action=copy-report data-tahai-oi-report=sanitized-handoff><strong>Sanitized Handoff</strong><span>Aggregate readiness and action posture for manual review.</span></button><button class=card type=button data-tahai-oi-action=copy-report data-tahai-oi-report=change-record><strong>Change Record</strong><span>Change readiness with the explicit-capture boundary stated.</span></button><button class=card type=button data-tahai-oi-action=copy-report data-tahai-oi-report=incident-packet><strong>Knowledge Gap Report</strong><span>Local incident-readiness posture without raw evidence.</span></button><button class=card type=button data-tahai-oi-action=copy-report data-tahai-oi-report=evidence-manifest><strong>Evidence Summary</strong><span>Count-only evidence and Mission Black Box posture.</span></button><button class=card type=button data-tahai-oi-action=copy-report data-tahai-oi-report=artifact-integrity><strong>Artifact Integrity Report</strong><span>Safe provenance, digest-comparison, and gap posture.</span></button><button class=card type=button data-tahai-oi-action=copy-report data-tahai-oi-report=diagnostic-report><strong>Local OI Diagnostic Report</strong><span>Aggregate support-tool and endpoint posture without transport artifacts.</span></button></div></section>
                            local_json_report_section,
                            local_report_section,
                            local_data_inventory_section,
                            local_runtime_section,
                            scale_signal_section,
                            local_asset_section,
                            technical_record_section,
                            R"TAHAI(
<section class=section><div class=section-head><div><p class=eyebrow>Knowledge gaps</p><h2>What needs attention next</h2></div>)TAHAI",
                                     promotion_state.show_referral
                                         ? "<button class=chip type=button "
                                           "data-tahai-oi-action=visit-msp "
                                           "data-tahai-oi-context=knowledge-"
                                           "gaps>MSP operational intelligence"
                                           "</button>"
                                         : "",
                                     R"TAHAI(</div><div class=oi-findings>)TAHAI",
                                     findings,
                                     R"TAHAI(</div></section>
<section class=section><div class=section-head><div><p class=eyebrow>Relationship graph</p><h2>Missions, support records, and evidence</h2></div><p class=muted>)TAHAI",
                                     base::NumberToString(
                                         snapshot.relationship_entity_count),
                                     R"TAHAI( bounded local entities · graph lanes are generated only from persisted typed Local OI records.</p></div><div class=oi-command-deck><article class=panel><p class=eyebrow>Bounded graph explorer</p><h3>Follow one typed local relationship path.</h3><form id=local-oi-graph-form class=oi-search-form><div class=actions><select id=local-oi-graph-entity class=button aria-label="Local OI entity"><option value="">Choose a local record</option>)TAHAI",
                                     graph_entity_options,
                                     R"TAHAI(</select><select id=local-oi-graph-type class=button aria-label="Relationship type filter"><option value=all>All relationship types</option><option value=mission_contains>Mission contains</option><option value=mission_uses>Mission uses</option><option value=mission_targets>Mission targets</option><option value=mission_produced>Mission produced</option><option value=evidence_supports>Evidence supports</option><option value=evidence_validates>Evidence validates</option><option value=evidence_conflicts_with>Evidence conflicts</option><option value=artifact_belongs_to>Artifact belongs to</option><option value=endpoint_resolves_to>Endpoint resolves to</option><option value=finding_affects>Finding affects</option><option value=finding_supported_by>Finding supported by</option><option value=runbook_governs>Runbook governs</option><option value=reference_links_to>Reference links</option><option value=supersedes>Supersedes</option><option value=derived_from>Derived from</option></select><select id=local-oi-graph-depth class=button aria-label="Traversal depth"><option value=1>One hop</option><option value=2>Two hops maximum</option></select><button class=button type=submit>Explore local graph</button></div></form><p id=local-oi-graph-status class=muted role=status aria-live=polite>Choose a typed local record. Traversal stays in this profile, caps at two hops and 48 relationships, and never opens a page or endpoint.</p><div id=local-oi-graph-results class=oi-graph-explorer-results></div></article><aside class="panel oi-boundary"><p class=eyebrow>Evidence-aware, not speculative</p><h3>Every returned lane includes its persisted typed basis.</h3><p class=boundary>This explorer follows only saved Local OI entities and relationships. It cannot infer relationships from tabs, URLs, history, page text, cookies, accounts, files, or a network lookup.</p><div id=local-oi-entity-detail class=oi-entity-detail role=status aria-live=polite>Select either record name in a returned relationship to read its safe local detail.</div></aside></div><article class=panel><p class=eyebrow>Recent relationship lanes</p><div class=oi-graph>)TAHAI",
                                     graph_edges,
                                     R"TAHAI(</div></article></section>
<section class=section><div class="three"><article class=panel><p class=eyebrow>Operational memory</p><h2>Generated timeline</h2><div class=oi-memory>)TAHAI",
                                     memory,
                                     R"TAHAI(</div></article><article class=panel><p class=eyebrow>Watchlists & local assist</p><h2>Explicit operations only.</h2><p class=muted>No local watch is configured. Local OI does not observe browsing activity, schedule network checks, or collect page content without a separate operator-approved tool run.</p><ul class=list><li><strong>Local Watchlists:</strong> no watcher or scheduler is active in this profile.</li><li><strong>Optional local model:</strong> )TAHAI",
                                     base::EscapeForHTML(
                                         GetLocalOiAssistPosture().status),
                                     R"TAHAI(</li></ul><p class=boundary>Any future observation or model capability must be separately permissioned, bounded, and clear about what it stores. It will never silently inspect pages, browser data, or credentials.</p></article><article class="panel oi-promotion"><p class=eyebrow>TAHAI Operational Intelligence</p><h2>When private local work needs organizational governance.</h2><p class=muted>Hosted OI is the separate shared control plane for teams, clients, access controls, connectors, retention, and centralized evidence. The browser has no hosted upload client or sign-in grant today.</p><p class=muted>)TAHAI",
                                     base::EscapeForHTML(
                                         promotion_state.status),
                                     R"TAHAI(</p><div class=actions>)TAHAI",
                                     promotion_cta,
                                     promotion_toggle,
                                     R"TAHAI(</div><p class=boundary>Promotion preview: )TAHAI",
                                     base::NumberToString(
                                         promotion.mission_count),
                                     R"TAHAI( local Missions, )TAHAI",
                                     base::NumberToString(
                                         promotion.evidence_marker_count),
                                     R"TAHAI( data-free evidence markers, and )TAHAI",
                                     base::NumberToString(
                                         promotion.knowledge_gap_count),
                                     R"TAHAI( knowledge-gap signals and )TAHAI",
                                     base::NumberToString(
                                         promotion.opaque_oi_reference_count),
                                     R"TAHAI( inert opaque OI reference records and )TAHAI",
                                     base::NumberToString(
                                         promotion.scale_signal_count),
                                     R"TAHAI( local-to-team scale signals are counted only. Mission names, reference values, browsing data, credentials, and raw content are redacted. This button opens a fixed public page and uploads nothing.</p></article></div></section><script src=/local-oi.js></script>)TAHAI"});
  return PageFrame("TAHAI Local OI", content, ActiveTheme(mode_service),
                   ActiveModeId(mode_service),
                   &mode_service->active_configuration());
}

std::string OpsHtml(ModeService* mode_service) {
  CHECK(mode_service);
  std::string content = R"TAHAI(
<section class=command-layout><div class=panel><p class=eyebrow>Allowlisted browser actions</p><h2>Commands</h2><input id=command-input class=command-input type=search autocomplete=off placeholder="Type mode, mission, layout, profile, evidence, print, or save" aria-label="Find an approved command"><div id=command-list class=command-list><button class=command type=button data-tahai-command="modes.open" data-tahai-label="Open Work Modes" data-tahai-search="mode daily creator builder operator research support focus watch presentation"><span><strong>Open Work Modes</strong><span class=muted>Choose a profile-scoped TAHAI cockpit without changing tabs or identity</span></span><span class=scope>modes</span></button><button class=command type=button data-tahai-command="mission.open" data-tahai-label="Open Mission Control" data-tahai-search="mission runbook timeline evidence command center"><span><strong>Open Mission Control</strong><span class=muted>Open the bounded profile-scoped Mission Control surface</span></span><span class=scope>mission</span></button><button class=command type=button data-tahai-command="profiles.open" data-tahai-label="Open Profile Administration" data-tahai-search="profiles identity privacy profile picker administration"><span><strong>Open Profile Administration</strong><span class=muted>Open Chromium-owned profile and privacy controls</span></span><span class=scope>profiles</span></button><button class=command type=button data-tahai-command="support.open" data-tahai-label="Open Support" data-tahai-search="support recovery export safe handoff"><span><strong>Open Support</strong><span class=muted>Open a fixed, sanitized support handoff surface</span></span><span class=scope>support</span></button><button class=command type=button data-tahai-command="policy.open" data-tahai-label="Open Policy" data-tahai-search="policy enterprise managed diagnostics"><span><strong>Open Policy</strong><span class=muted>Inspect policy through the TAHAI native policy surface</span></span><span class=scope>policy</span></button><button class=command type=button data-tahai-command="quad.open" data-tahai-label="Open Quad View" data-tahai-search="layout open quad view show four real chromium tabs"><span><strong>Open Quad View</strong><span class=muted>Show four real Chromium tabs in a native 2 × 2 workspace</span></span><span class=scope>layout</span></button><button class=command type=button data-tahai-command="quad.focus" data-tahai-label="Focus active pane" data-tahai-search="layout focus active pane maximize"><span><strong>Focus active pane</strong><span class=muted>Maximize the active pane without losing Quad View</span></span><span class=scope>layout</span></button><button class=command type=button data-tahai-command="quad.restore" data-tahai-label="Restore Quad View" data-tahai-search="layout restore quad view"><span><strong>Restore Quad View</strong><span class=muted>Return from Focus Pane to the exact 2 × 2 workspace</span></span><span class=scope>layout</span></button><button class=command type=button data-tahai-command="quad.exit" data-tahai-label="Return to 1-Up" data-tahai-search="layout return 1 up exit quad view"><span><strong>Return to 1-Up</strong><span class=muted>Exit Quad View and keep the active native tab</span></span><span class=scope>layout</span></button><button class=command type=button data-tahai-command="tab.new" data-tahai-label="New tab" data-tahai-search="tabs new tab"><span><strong>New tab</strong><span class=muted>Open a native Chromium tab</span></span><span class=scope>tabs</span></button><button class=command type=button data-tahai-command="tab.reload" data-tahai-label="Reload active tab" data-tahai-search="tabs reload active tab"><span><strong>Reload active tab</strong><span class=muted>Reload the canonical active target</span></span><span class=scope>tabs</span></button><button class=command type=button data-tahai-command="tab.close" data-tahai-label="Close active tab" data-tahai-search="tabs close active tab"><span><strong>Close active tab</strong><span class=muted>Close the current native tab</span></span><span class=scope>tabs</span></button><button class=command type=button data-tahai-command="capture.print" data-tahai-label="Print active page" data-tahai-search="evidence print active page"><span><strong>Print active page</strong><span class=muted>Open Chromium print preview</span></span><span class=scope>evidence</span></button><button class=command type=button data-tahai-command="export.save-page" data-tahai-label="Save active page" data-tahai-search="evidence save page"><span><strong>Save active page</strong><span class=muted>Open Chromium Save Page</span></span><span class=scope>evidence</span></button></div><p id=command-status class=muted role=status aria-live=polite></p></div><aside class=panel><p class=eyebrow>Privilege boundary</p><h2>Fixed names only</h2><p class=boundary>Remote pages cannot call this surface. Commands accept no URLs, JavaScript, shell, executables, files, credentials, or arbitrary arguments.</p><ul class=list><li>Target: fixed browser surface or canonical active tab</li><li>Scope: current profile and browser</li><li>Policy: Chromium command must be enabled</li><li>Expected output: native Chromium UI</li></ul></aside></section><script src=/command-center.js></script>
)TAHAI";
  content += R"TAHAI(
<section class=section><div class=section-head><div><p class=eyebrow>Native workspace layouts</p><h2>Every pane is independently controlled</h2></div><p>Each pane below is a distinct Chromium tab and WebContents. Switching, navigation, history, reload, permissions, media, and authentication target only the active pane.</p></div><div class=grid><button class=card type=button data-tahai-command="dual.open"><strong>Dual — Side by Side</strong><span>Two equal columns. Alt+Shift+D.</span></button><button class=card type=button data-tahai-command="dual.stacked"><strong>Dual — Stacked</strong><span>Two equal full-width rows.</span></button><button class=card type=button data-tahai-command="tri.two-over-one"><strong>Tri — 2 over 1</strong><span>Two panes across the top; one full-width pane below. Alt+Shift+G.</span></button><button class=card type=button data-tahai-command="tri.one-over-two"><strong>Tri — 1 over 2</strong><span>One full-width pane above; two panes across the bottom.</span></button><button class=card type=button data-tahai-command="quad.open"><strong>Quad — 2 × 2</strong><span>Four independent native panes.</span></button></div></section>
)TAHAI";
  content += R"TAHAI(
<section class=section><article class="panel oi-boundary"><p class=eyebrow>Private operational intelligence</p><h2>Read local Mission posture before you hand work off.</h2><p class=muted>TAHAI Local OI derives readiness, safeguards, evidence markers, knowledge gaps, and generated operational memory from this profile's bounded Mission records. It is not a connector, tenant, or remote control plane.</p><div class=actions><button class="button primary" type=button data-tahai-command="local-oi.open">Open TAHAI Local OI</button><a class=button href="tahai://mission/">Open Mission Control</a></div></article></section>
)TAHAI";
  content += base::StrCat(
      {"<section class=section><article class=panel><p "
       "class=eyebrow>Active mode lane</p><h2>",
       base::EscapeForHTML(mode_service->active_mode().title),
       "</h2><p class=product-lane>",
       base::EscapeForHTML(mode_service->active_mode().featured_products),
       "</p><p class=muted>These are visible workflow lanes, "
       "not connected services. TAHAI does not request or "
       "store product API keys, tokens, URLs, or credentials "
       "here.</p></article></section>"});
  return PageFrame("Operator Command Center", content,
                   ActiveTheme(mode_service), ActiveModeId(mode_service),
                   &mode_service->active_configuration());
}

std::string SupportSummary() {
  return base::StrCat({
      "TAHAI Browser Support Summary\n",
      "Product: TAHAI Browser\n",
      "Version: ",
      version_info::GetVersionNumber(),
      "\n",
      "Build state: verify the installed package signature and version in "
      "Windows.\n",
      "Branding: native TAHAI Chromium browser.\n",
      "Policy: inspect chrome://policy directly.\n",
      "Privacy: no URLs, page content, form data, cookies, headers, tokens, "
      "credentials, profile data, local paths, screenshots, or logs are "
      "included.\n",
  });
}

base::DictValue GuardConfigurationValue(
    const TahaiGuardConfiguration& configuration) {
  base::DictValue value;
  value.Set("schema_version", configuration.schema_version);
  value.Set("mode", TahaiGuardModeName(configuration.mode));
  value.Set("local_statistics_enabled", configuration.local_statistics_enabled);
  base::ListValue site_overrides;
  for (const TahaiGuardSiteOverride& override : configuration.site_overrides) {
    base::DictValue entry;
    entry.Set("origin", override.canonical_origin);
    entry.Set("mode", override.mode == TahaiGuardSiteOverrideMode::kOff
                          ? "off"
                          : "cosmetic-off");
    site_overrides.Append(std::move(entry));
  }
  value.Set("site_overrides", std::move(site_overrides));
  return value;
}

std::string SupportHtml(ModeService* mode_service) {
  CHECK(mode_service);
  return PageFrame("Support",
                   base::StrCat({R"TAHAI(
<section class=hero><p class=eyebrow>Safe recovery</p><h2>Diagnose without exporting private browsing data.</h2><p class=muted>Copy a compact, explicit support summary for review. It is generated in the browser and contains only fixed build and privacy truth.</p><div class=actions><button class="button primary" type=button data-tahai-support-action=copy-summary>Copy Sanitized Support Summary</button><a class=button href="chrome://policy/">Open Chromium Policy</a><a class=button href="chrome://version/">Open Chromium Version</a></div><p id=support-status class=muted role=status aria-live=polite></p></section><section class=section><div class=oi-command-deck><article class=panel><p class=eyebrow>Support Engineer Tools</p><h2>DNS, TLS, and bounded HTTP posture inspection</h2><p class=muted>Run a one-time, credential-free DNS resolution and HTTPS TLS probe for a host you explicitly enter. The probe omits cookies, blocks redirects, fetches no body, and records only typed diagnostic metadata plus a presence-only count of six fixed HTTP security headers when Local OI operations-tool recording is enabled.</p><form id=network-inspection-form class=actions><label class=visually-hidden for=network-inspection-host>Host name or IPv4 address</label><input id=network-inspection-host class=command-input type=text inputmode=url autocomplete=off maxlength=253 placeholder="example.com" aria-label="Host name or IPv4 address"><button class="button primary" type=submit>Run DNS + TLS Inspection</button></form><div id=network-inspection-results class=oi-search-results><div class=oi-search-row><strong>Explicit run only</strong><span>No watch, scheduler, connector, browser-history scan, or authenticated-console inspection is active.</span></div></div></article><aside class="panel oi-boundary"><p class=eyebrow>Inspection boundary</p><h2>Transport metadata, not page capture.</h2><p class=boundary>The tool resolves A/AAAA addresses and DNS aliases exposed by Chromium's resolver, then sends one HTTPS HEAD request on port 443. MX, NS, TXT, header values, page content, cookies, forms, credentials, and session data are not queried or stored. It retains only a presence/count observation for six fixed public HTTP security headers.</p></aside></div></section><section class="section three"><article class=panel><h2>Browser recovery</h2><ul class=list><li>Restart and restore</li><li>Repair installation</li><li>Profile recovery</li></ul></article><article class=panel><h2>Sanitized handoff</h2><p class=boundary>Raw Authorization headers, cookies, private keys, page bodies, forms, credentials, profile data, local paths, and logs are never copied by this control.</p></article><article class=panel><h2>Known state</h2><p class=status>)TAHAI",
                                 base::EscapeForHTML(SupportSummary()),
                                 R"TAHAI(</p></article></section><script src=/support.js></script>
)TAHAI"}),
                   ActiveTheme(mode_service), ActiveModeId(mode_service),
                   &mode_service->active_configuration());
}

std::string ProfilesHtml(ModeService* mode_service, Profile* active_profile) {
  CHECK(mode_service);
  std::string lane_cards;
  ProfileManager* profile_manager =
      g_browser_process ? g_browser_process->profile_manager() : nullptr;
  for (const TahaiIdentityLane& lane :
       GetTahaiIdentityLanes(profile_manager, active_profile)) {
    const std::string name =
        base::EscapeForHTML(base::UTF16ToUTF8(lane.display_name));
    const std::string lane_id = base::EscapeForHTML(lane.lane_id);
    lane_cards += base::StrCat(
        {"<article class=panel><p class=eyebrow>",
         lane.is_active ? "Current Identity Lane" : "Chromium Profile Lane",
         "</p><h2>", name,
         "</h2><p class=boundary>Cookies, sessions, permissions, downloads, "
         "passwords, storage, and Mission state remain owned by this distinct "
         "Chromium Profile.</p><div class=actions><button class=\"button "
         "primary\" type=button data-tahai-identity-lane=\"",
         lane_id, "\" data-tahai-lane-destination=workspace",
         lane.signin_required ? " disabled" : "",
         ">Open Workspace</button><button class=button type=button "
         "data-tahai-identity-lane=\"",
         lane_id, "\" data-tahai-lane-destination=mission",
         lane.signin_required ? " disabled" : "",
         ">Open Mission</button></div><p class=muted>",
         lane.signin_required
             ? "Chromium sign-in is required before this lane can open."
             : "Opens a new window under this profile; no session is copied "
               "from the current lane.",
         "</p></article>"});
  }
  if (lane_cards.empty()) {
    lane_cards =
        "<article class=panel><h2>No available Identity Lanes</h2><p "
        "class=muted>Use Chromium’s native Profile Picker to create or unlock "
        "a persistent profile.</p></article>";
  }
  return PageFrame(
      "Profile Administration",
      base::StrCat(
          {R"TAHAI(
<section class=hero><p class=eyebrow>Profile-backed Identity Lanes</p><h2>Real Chromium isolation—not colored tab groups.</h2><p class=muted>Each lane below is an existing persistent Chromium Profile with its own browser-owned cookie jar, storage, permissions, downloads, passwords, and session state. TAHAI exposes only an opaque lane identifier and the local profile display name.</p><div class=actions><a class="button primary" href="chrome://profile-picker/">Open Profile Picker</a><a class=button href="chrome://settings/manageProfile">Manage Current Profile</a><a class=button href="chrome://settings/privacy">Open Privacy Controls</a></div><p id=identity-lane-status class=muted role=status aria-live=polite></p></section><section class="section three">)TAHAI",
           lane_cards,
           R"TAHAI(</section><section class="section three"><article class=panel><p class=eyebrow>Isolation boundary</p><h2>Separate by design</h2><p class=boundary>This surface never exposes profile paths, account identifiers, email addresses, cookies, history, saved passwords, local files, or credentials. Opening a lane never copies authentication state.</p></article><article class=panel><p class=eyebrow>Enterprise policy</p><h2>Chromium-enforced</h2><p class=muted>Managed policy remains authoritative for profile availability, sign-in, extensions, downloads, and permissions. Inspect effective policy through Chromium’s native policy page.</p><a class=button href="chrome://policy/">Open Chromium Policy</a></article><article class=panel><p class=eyebrow>Routing truth</p><h2>Explicit destinations only</h2><p class=muted>This release opens fixed TAHAI Workspace or Mission destinations. Automatic tenant-domain routing is not active and cannot be inferred from page content.</p></article></section><script src=/profiles.js></script>
)TAHAI"}),
      ActiveTheme(mode_service), ActiveModeId(mode_service),
      &mode_service->active_configuration());
}

std::string SyncContractStatusHtml() {
  std::string providers;
  for (const TahaiSyncProviderContract& contract :
       GetTahaiSyncProviderContracts()) {
    providers += base::StrCat(
        {"<li><strong>", base::EscapeForHTML(std::string(contract.label)),
         "</strong><span class=muted> · ",
         base::EscapeForHTML(std::string(
             GetTahaiSyncProviderAvailabilityMessage(contract.provider))),
         "</span></li>"});
  }
  return base::StrCat(
      {"<article class=panel><h2>TAHAI Sync boundary</h2><p class=boundary>"
       "TAHAI Sync is not Chrome Sync or Edge Sync. Cloud transport remains "
       "disabled until TAHAI-owned OAuth registrations, native consent, and "
       "client-side encryption are implemented and reviewed.</p><ul "
       "class=list>",
       providers,
       "</ul><p class=muted>Even when enabled, cookies, browser sessions, "
       "OAuth tokens, authorization headers, passwords, raw page content, "
       "and unapproved browsing data remain out of scope.</p></article>"});
}

std::string EnvironmentGuardStatusHtml() {
  const TahaiEnvironmentPosture& production =
      GetTahaiEnvironmentPosture(TahaiEnvironment::kProduction);
  const TahaiEnvironmentPosture& sensitive =
      GetTahaiEnvironmentPosture(TahaiEnvironment::kSensitive);
  return base::StrCat(
      {"<article class=panel><h2>Environment Guard</h2><p class=boundary>"
       "Explicit production, staging, development, customer, internal, and "
       "sensitive-origin rules will control the browser posture. A visual "
       "classification is never inferred from page content.</p><ul class=list>"
       "<li>",
       base::EscapeForHTML(std::string(production.label)),
       ": persistent boundary, paste confirmation, transfer warning, and "
       "redaction preview.</li><li>",
       base::EscapeForHTML(std::string(sensitive.label)),
       ": persistent boundary, transfer warning, redaction preview, and "
       "Pilot actions blocked.</li></ul></article>"});
}

std::string PackBundleStatusHtml() {
  return R"TAHAI(<article class=panel><h2>TAHAI Packs</h2><p class=muted>Packs are origin-scoped declarative manifests. Before a Pack can enter a future catalog, its exact manifest bytes must validate against a separately governed known Ed25519 public key. A Pack cannot supply its own trust key, JavaScript, shell command, filesystem access, credential, page script, or executable payload.</p><p class=boundary>No Pack catalog, download, installation, or automatic update path is enabled by this verification boundary.</p></article>)TAHAI";
}

std::string LocalOiPolicyStatusHtml(PrefService* prefs) {
  CHECK(prefs);
  const TahaiLocalOiPolicy policy(prefs);
  struct PolicyRow {
    LocalOiPolicyControl control;
    std::string_view label;
  };
  constexpr std::array<PolicyRow, 10> kRows = {{
      {LocalOiPolicyControl::kEnabled, "Local OI master switch"},
      {LocalOiPolicyControl::kMissionIngestion, "Bounded Mission metadata"},
      {LocalOiPolicyControl::kArtifactIngestion, "Artifact integrity metadata"},
      {LocalOiPolicyControl::kDocumentationReferenceIngestion,
       "Endpoint documentation pointers"},
      {LocalOiPolicyControl::kOpsToolIngestion, "Support engineer tools"},
      {LocalOiPolicyControl::kHistoryMetadata, "Browser history metadata"},
      {LocalOiPolicyControl::kReports, "Aggregate Local OI reports"},
      {LocalOiPolicyControl::kExport, "Explicit local clipboard export"},
      {LocalOiPolicyControl::kMspPromotion, "Hosted OI referral surface"},
      {LocalOiPolicyControl::kLocalAi, "Optional on-device model"},
  }};
  std::string rows;
  for (const PolicyRow& row : kRows) {
    rows += base::StrCat(
        {"<li><strong>", base::EscapeForHTML(std::string(row.label)),
         "</strong><span>",
         policy.IsEnabled(row.control) ? "Enabled" : "Disabled", " · ",
         base::EscapeForHTML(std::string(policy.Source(row.control))),
         "</span></li>"});
  }
  return base::StrCat(
      {"<article class=panel><p class=eyebrow>Local OI policy posture</p>"
       "<h2>Actual profile controls</h2><ul class=list>",
       rows, "</ul><p class=boundary>Retention: ",
       base::NumberToString(policy.RetentionDays()), " days · ",
       policy.IsRetentionManaged() ? "managed policy" : "profile setting",
       ". These controls restrict local features; none grants access, starts a "
       "connector, enables cloud sync, or authorizes browser automation.</p>"
       "</article>"});
}

std::optional<LocalOiPolicyControl> LocalOiPolicyControlFromUiSetting(
    std::string_view setting) {
  if (setting == "enabled") {
    return LocalOiPolicyControl::kEnabled;
  }
  if (setting == "mission-ingestion") {
    return LocalOiPolicyControl::kMissionIngestion;
  }
  if (setting == "artifact-ingestion") {
    return LocalOiPolicyControl::kArtifactIngestion;
  }
  if (setting == "documentation-ingestion") {
    return LocalOiPolicyControl::kDocumentationReferenceIngestion;
  }
  if (setting == "ops-tool-ingestion") {
    return LocalOiPolicyControl::kOpsToolIngestion;
  }
  if (setting == "reports") {
    return LocalOiPolicyControl::kReports;
  }
  if (setting == "export") {
    return LocalOiPolicyControl::kExport;
  }
  if (setting == "msp-promotion") {
    return LocalOiPolicyControl::kMspPromotion;
  }
  return std::nullopt;
}

std::string PolicyHtml(ModeService* mode_service, PrefService* prefs) {
  CHECK(mode_service);
  CHECK(prefs);
  const std::string content = base::StrCat(
      {R"TAHAI(
<section class=hero><p class=eyebrow>Enterprise truth</p><h2>Policy can restrict features. It cannot grant authorization.</h2><p class=muted>TAHAI uses Chromium policy precedence, refresh, diagnostics, and profile boundaries.</p></section><section class="section three"><article class=panel><h2>Browser</h2><ul class=list><li>Startup and search</li><li>Extensions and permissions</li><li>Downloads and protocols</li></ul></article><article class=panel><h2>Operator features</h2><ul class=list><li>Adaptation</li><li>Mission Control</li><li>Recipes and evidence</li></ul></article><article class=panel><h2>Security</h2><p class=boundary>Managed policy never supplies credentials, bypasses browser security, authorizes remote actions, or enables arbitrary execution.</p></article></section><section class=section><div class=three>)TAHAI",
       SyncContractStatusHtml(),
       R"TAHAI(<article class=panel><h2>Identity lanes</h2><p class=muted>Identity Lanes route fixed TAHAI destinations into separate existing Chromium Profiles. Cookies, sessions, permissions, downloads, passwords, and storage remain profile-owned; no visual-only lane or synthetic cookie jar is treated as a security boundary. Automatic tenant-domain routing is not active.</p></article><article class=panel><h2>Operator automation</h2><p class=muted>Pilot remains governed: no passwords, MFA fields, cookies, tokens, arbitrary shell commands, or unattended administrative clicking.</p></article></div></section><section class=section><div class=three>)TAHAI",
       EnvironmentGuardStatusHtml(), PackBundleStatusHtml(),
       R"TAHAI(<article class=panel><h2>Sentinel Watch</h2><p class=muted>Manual rechecks are bounded to explicitly configured public DNS, TLS, HTTPS status, redirect, response-header, and content-hash checks; they never browse authenticated consoles or run a background watch daemon.</p></article></div></section>)TAHAI",
       R"TAHAI(<section class=section><div class=three>)TAHAI",
       LocalOiPolicyStatusHtml(prefs),
       R"TAHAI(<article class=panel><p class=eyebrow>Collection baseline</p><h2>What remains off by default</h2><p class=boundary>Browser history metadata and any local model are disabled by default. Local OI does not collect page bodies, tabs, URLs, downloads, cookies, credentials, forms, raw headers, or account data through any policy setting.</p></article><article class=panel><p class=eyebrow>Operator truth</p><h2>Explicit actions stay explicit</h2><p class=muted>Support probes, digests, artifact entries, documentation pointers, Environment Guard classifications, and manual recheck entries each require an operator action in the browser. Policy does not turn them into background monitoring.</p></article></div></section>
)TAHAI"});
  return PageFrame("Policy", content, ActiveTheme(mode_service),
                   ActiveModeId(mode_service),
                   &mode_service->active_configuration());
}

std::optional<int> CommandId(std::string_view command) {
  if (command == "address.focus") {
    return IDC_FOCUS_LOCATION;
  }
  if (command == "tabs.find") {
    return IDC_TAB_SEARCH;
  }
  if (command == "workspaces.open") {
    return IDC_TAHAI_NAMED_WORKSPACES;
  }
  if (command == "tab.new") {
    return IDC_NEW_TAB;
  }
  if (command == "tab.reload") {
    return IDC_RELOAD;
  }
  if (command == "tab.close") {
    return IDC_CLOSE_TAB;
  }
  if (command == "capture.print") {
    return IDC_PRINT;
  }
  if (command == "export.save-page") {
    return IDC_SAVE_PAGE;
  }
  return std::nullopt;
}

std::optional<GURL> CommandSurfaceURL(std::string_view command) {
  // These are browser-owned, fixed WebUI destinations. The renderer submits a
  // command name only; it never selects a URL, query, or navigation target.
  if (command == "mission.open") {
    return GURL(kTahaiMissionURL);
  }
  if (command == "commands.open") {
    return GURL(kTahaiOpsToolsURL);
  }
  if (command == "profiles.open") {
    return GURL(kTahaiProfilesURL);
  }
  if (command == "support.open") {
    return GURL(kTahaiSupportURL);
  }
  if (command == "policy.open") {
    return GURL(kTahaiPolicyURL);
  }
  if (command == "modes.open") {
    return GURL(kTahaiModesURL);
  }
  if (command == "local-oi.open") {
    return GURL(kTahaiLocalOiURL);
  }
  return std::nullopt;
}

std::optional<TahaiOiReferralContext> ReferralContextFromString(
    std::string_view context) {
  if (context == "overview") {
    return TahaiOiReferralContext::kLocalOiHeader;
  }
  if (context == "relationship-graph") {
    return TahaiOiReferralContext::kMissionPromotion;
  }
  if (context == "evidence-timeline") {
    return TahaiOiReferralContext::kEvidenceRetention;
  }
  if (context == "knowledge-gaps") {
    return TahaiOiReferralContext::kKnowledgeGap;
  }
  if (context == "team-coordination") {
    return TahaiOiReferralContext::kTeamCoordination;
  }
  if (context == "governed-evidence") {
    return TahaiOiReferralContext::kEvidenceRetention;
  }
  return std::nullopt;
}

std::string_view ChangeComparisonLabel(TahaiChangeComparisonResult comparison) {
  switch (comparison) {
    case TahaiChangeComparisonResult::kUnchanged:
      return "unchanged";
    case TahaiChangeComparisonResult::kChanged:
      return "changed";
    case TahaiChangeComparisonResult::kDifferentSubject:
      return "different_subject";
    case TahaiChangeComparisonResult::kInvalidCapture:
      return "invalid";
  }
  NOTREACHED();
}

std::string_view IdentityLaneOpenResultName(
    TahaiIdentityLaneOpenResult result) {
  switch (result) {
    case TahaiIdentityLaneOpenResult::kOpened:
      return "opened";
    case TahaiIdentityLaneOpenResult::kUnknownLane:
      return "unknown_lane";
    case TahaiIdentityLaneOpenResult::kSigninRequired:
      return "signin_required";
    case TahaiIdentityLaneOpenResult::kInvalidDestination:
      return "invalid_destination";
    case TahaiIdentityLaneOpenResult::kProfileUnavailable:
      return "profile_unavailable";
  }
  NOTREACHED();
}

PrefService* ProfilePrefsForTahaiHandler(Profile* profile) {
  CHECK(profile);
  return profile->GetPrefs();
}

class TahaiCommandHandler : public content::WebUIMessageHandler {
 public:
  TahaiCommandHandler(MissionService* mission_service,
                      ModeService* mode_service,
                      TahaiLocalOiService* local_oi_service,
                      Profile* profile)
      : mission_service_(mission_service),
        mode_service_(mode_service),
        local_oi_service_(local_oi_service),
        profile_(profile),
        prefs_(ProfilePrefsForTahaiHandler(profile)),
        sync_key_service_(std::make_unique<TahaiSyncKeyService>(
            prefs_,
            g_browser_process ? g_browser_process->os_crypt_async() : nullptr,
            !profile->IsOffTheRecord())) {
    CHECK(profile);
  }
  TahaiCommandHandler(const TahaiCommandHandler&) = delete;
  TahaiCommandHandler& operator=(const TahaiCommandHandler&) = delete;
  ~TahaiCommandHandler() override = default;

  void RegisterMessages() override {
    web_ui()->RegisterMessageCallback(
        "executeTahaiCommand",
        base::BindRepeating(&TahaiCommandHandler::Execute,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "createTahaiMission",
        base::BindRepeating(&TahaiCommandHandler::CreateMission,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "toggleTahaiMissionStep",
        base::BindRepeating(&TahaiCommandHandler::ToggleMissionStep,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "toggleTahaiValidationStep",
        base::BindRepeating(&TahaiCommandHandler::ToggleValidationStep,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "toggleTahaiRollbackStep",
        base::BindRepeating(&TahaiCommandHandler::ToggleRollbackStep,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "toggleTahaiEscalation",
        base::BindRepeating(&TahaiCommandHandler::ToggleEscalation,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "addTahaiEvidenceMarker",
        base::BindRepeating(&TahaiCommandHandler::AddEvidenceMarker,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setTahaiExportProfile",
        base::BindRepeating(&TahaiCommandHandler::SetExportProfile,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "deleteTahaiMission",
        base::BindRepeating(&TahaiCommandHandler::DeleteMission,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "archiveTahaiMission",
        base::BindRepeating(&TahaiCommandHandler::ArchiveMission,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "restoreTahaiMission",
        base::BindRepeating(&TahaiCommandHandler::RestoreMission,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "duplicateTahaiMission",
        base::BindRepeating(&TahaiCommandHandler::DuplicateMission,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "launchTahaiRecipe",
        base::BindRepeating(&TahaiCommandHandler::LaunchRecipe,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "copyTahaiSupportSummary",
        base::BindRepeating(&TahaiCommandHandler::CopySupportSummary,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "getTahaiGuardConfiguration",
        base::BindRepeating(&TahaiCommandHandler::GetTahaiGuardConfiguration,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setTahaiGuardConfiguration",
        base::BindRepeating(&TahaiCommandHandler::SetTahaiGuardConfiguration,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "getTahaiGuardCustomRules",
        base::BindRepeating(&TahaiCommandHandler::GetTahaiGuardCustomRules,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "installTahaiGuardCustomRules",
        base::BindRepeating(&TahaiCommandHandler::InstallTahaiGuardCustomRules,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "clearTahaiGuardCustomRules",
        base::BindRepeating(&TahaiCommandHandler::ClearTahaiGuardCustomRules,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "openTahaiIdentityLane",
        base::BindRepeating(&TahaiCommandHandler::OpenIdentityLane,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "copyTahaiMissionHandoff",
        base::BindRepeating(&TahaiCommandHandler::CopyMissionHandoff,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "copyTahaiEvidencePack",
        base::BindRepeating(&TahaiCommandHandler::CopyEvidencePack,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "copyTahaiMissionCapsule",
        base::BindRepeating(&TahaiCommandHandler::CopyMissionCapsule,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "copyTahaiEncryptedMissionCapsule",
        base::BindRepeating(&TahaiCommandHandler::CopyEncryptedMissionCapsule,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "verifyTahaiEncryptedMissionCapsule",
        base::BindRepeating(&TahaiCommandHandler::VerifyEncryptedMissionCapsule,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "importTahaiVerifiedMissionCapsule",
        base::BindRepeating(&TahaiCommandHandler::ImportVerifiedMissionCapsule,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "rotateTahaiEncryptedMissionCapsuleKey",
        base::BindRepeating(
            &TahaiCommandHandler::RotateEncryptedMissionCapsuleKey,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setTahaiWorkMode",
        base::BindRepeating(&TahaiCommandHandler::SetWorkMode,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setTahaiWorkModeModifier",
        base::BindRepeating(&TahaiCommandHandler::SetWorkModeModifier,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setTahaiWorkModeConfiguration",
        base::BindRepeating(&TahaiCommandHandler::SetWorkModeConfiguration,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "resetTahaiWorkModeConfiguration",
        base::BindRepeating(&TahaiCommandHandler::ResetWorkModeConfiguration,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "createTahaiWorkModeTemplateMission",
        base::BindRepeating(&TahaiCommandHandler::CreateWorkModeTemplateMission,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "openTahaiOiMsp",
        base::BindRepeating(&TahaiCommandHandler::OpenTahaiOiMsp,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "copyTahaiLocalOiReport",
        base::BindRepeating(&TahaiCommandHandler::CopyLocalOiSafeReport,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "searchTahaiLocalOi",
        base::BindRepeating(&TahaiCommandHandler::SearchLocalOi,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "searchTahaiRecall",
        base::BindRepeating(&TahaiCommandHandler::SearchTahaiRecall,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "exploreTahaiLocalOiRelationships",
        base::BindRepeating(
            &TahaiCommandHandler::ExploreTahaiLocalOiRelationships,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "getTahaiLocalOiEntityDetail",
        base::BindRepeating(&TahaiCommandHandler::GetTahaiLocalOiEntityDetail,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "buildTahaiLocalDeterministicBrief",
        base::BindRepeating(
            &TahaiCommandHandler::BuildTahaiLocalDeterministicBrief,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setTahaiLocalOiControl",
        base::BindRepeating(&TahaiCommandHandler::SetTahaiLocalOiControl,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "rebuildTahaiLocalOiIndex",
        base::BindRepeating(&TahaiCommandHandler::RebuildTahaiLocalOiIndex,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "updateTahaiLocalOiFinding",
        base::BindRepeating(&TahaiCommandHandler::UpdateLocalOiFinding,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "setTahaiOiMspPromotion",
        base::BindRepeating(&TahaiCommandHandler::SetTahaiOiMspPromotion,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "inspectTahaiNetwork",
        base::BindRepeating(&TahaiCommandHandler::InspectTahaiNetwork,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "copyTahaiNetworkInspectionSummary",
        base::BindRepeating(
            &TahaiCommandHandler::CopyTahaiNetworkInspectionSummary,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "confirmTahaiNetworkInspectionSummary",
        base::BindRepeating(
            &TahaiCommandHandler::ConfirmTahaiNetworkInspectionSummary,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiNetworkInspectionHistory",
        base::BindRepeating(
            &TahaiCommandHandler::ListTahaiNetworkInspectionHistory,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "recordTahaiChangeCapture",
        base::BindRepeating(&TahaiCommandHandler::RecordTahaiChangeCapture,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiChangeCaptureHistory",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiChangeCaptureHistory,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiChangeMissions",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiChangeMissions,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "recordTahaiArtifactMetadata",
        base::BindRepeating(&TahaiCommandHandler::RecordTahaiArtifactMetadata,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiArtifactHistory",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiArtifactHistory,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "recordTahaiDocumentationReference",
        base::BindRepeating(
            &TahaiCommandHandler::RecordTahaiDocumentationReference,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiDocumentationReferences",
        base::BindRepeating(
            &TahaiCommandHandler::ListTahaiDocumentationReferences,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiLocalOiEndpoints",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiLocalOiEndpoints,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiDocumentationMissions",
        base::BindRepeating(
            &TahaiCommandHandler::ListTahaiDocumentationMissions,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiSupportMissions",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiSupportMissions,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiWatchMissions",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiWatchMissions,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "configureTahaiManualWatch",
        base::BindRepeating(&TahaiCommandHandler::ConfigureTahaiManualWatch,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiManualWatches",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiManualWatches,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "deleteTahaiLocalOiData",
        base::BindRepeating(&TahaiCommandHandler::DeleteLocalOiData,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "configureTahaiEnvironmentClassification",
        base::BindRepeating(
            &TahaiCommandHandler::ConfigureEnvironmentClassification,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiEnvironmentClassifications",
        base::BindRepeating(
            &TahaiCommandHandler::ListTahaiEnvironmentClassifications,
            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiEnvironmentMissions",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiEnvironmentMissions,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "listTahaiLocalOiMissions",
        base::BindRepeating(&TahaiCommandHandler::ListTahaiLocalOiMissions,
                            base::Unretained(this)));
  }

 private:
  void RefreshLocalOiAfterMissionMutation() {
    if (local_oi_service_ && mission_service_) {
      local_oi_service_->SyncMissions(mission_service_->missions());
    }
  }

  void Execute(const base::ListValue& args) {
    if (args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const std::string& command = args.front().GetString();
    if (const std::optional<GURL> surface_url = CommandSurfaceURL(command)) {
      web_ui()->GetWebContents()->GetController().LoadURLWithParams(
          content::NavigationController::LoadURLParams(*surface_url));
      return;
    }
    Browser* browser = FindBrowserForWebContents(web_ui()->GetWebContents());
    if (command == "dual.open") {
      chrome::OpenTahaiDualView(browser,
                                chrome::TahaiDualViewLayout::kSideBySide);
      return;
    }
    if (command == "dual.stacked") {
      chrome::OpenTahaiDualView(browser, chrome::TahaiDualViewLayout::kStacked);
      return;
    }
    if (command == "tri.two-over-one") {
      chrome::OpenTahaiTriView(browser,
                               chrome::TahaiTriViewLayout::kTwoOverOne);
      return;
    }
    if (command == "tri.one-over-two") {
      chrome::OpenTahaiTriView(browser,
                               chrome::TahaiTriViewLayout::kOneOverTwo);
      return;
    }
    if (command == "quad.open") {
      chrome::OpenTahaiQuadView(browser);
      return;
    }
    if (command == "quad.focus") {
      chrome::SetTahaiMultiViewFocusMode(browser, true);
      return;
    }
    if (command == "quad.restore") {
      chrome::SetTahaiMultiViewFocusMode(browser, false);
      return;
    }
    if (command == "quad.exit") {
      chrome::ExitTahaiMultiView(browser);
      return;
    }
    const std::optional<int> command_id = CommandId(command);
    if (!command_id) {
      return;
    }
    if (!browser || !chrome::SupportsCommand(browser, *command_id) ||
        !chrome::IsCommandEnabled(browser, *command_id)) {
      return;
    }
    chrome::ExecuteCommand(browser, *command_id);
  }

  void CreateMission(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_string()) {
      return;
    }
    if (!mission_service_->CreateMission(args[0].GetString(),
                                         args[1].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void ToggleMissionStep(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_int() || args[1].GetInt() < 0 ||
        !mission_service_->ToggleStep(args[0].GetString(),
                                      static_cast<size_t>(args[1].GetInt()))) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void ToggleValidationStep(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_int() || args[1].GetInt() < 0 ||
        !mission_service_->ToggleValidationStep(
            args[0].GetString(), static_cast<size_t>(args[1].GetInt()))) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void ToggleRollbackStep(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_int() || args[1].GetInt() < 0 ||
        !mission_service_->ToggleRollbackStep(
            args[0].GetString(), static_cast<size_t>(args[1].GetInt()))) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void ToggleEscalation(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args[0].is_string() ||
        !mission_service_->ToggleEscalation(args[0].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void AddEvidenceMarker(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args[0].is_string() ||
        !mission_service_->AddEvidenceMarker(args[0].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void SetExportProfile(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_string() ||
        !mission_service_->SetExportProfile(args[0].GetString(),
                                            args[1].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void DeleteMission(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args[0].is_string() ||
        !mission_service_->DeleteMission(args[0].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void ArchiveMission(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args[0].is_string() ||
        !mission_service_->ArchiveMission(args[0].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void RestoreMission(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args[0].is_string() ||
        !mission_service_->RestoreMission(args[0].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void DuplicateMission(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args[0].is_string() ||
        !mission_service_->DuplicateMission(args[0].GetString())) {
      return;
    }
    RefreshLocalOiAfterMissionMutation();
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void LaunchRecipe(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const RecipeDefinition* recipe = FindRecipe(args.front().GetString());
    Browser* browser = FindBrowserForWebContents(web_ui()->GetWebContents());
    if (!recipe || !LaunchRecipeWorkspace(browser, *recipe)) {
      return;
    }
    // Persist only the fixed library label and generated checkpoints. The
    // launched destinations, their content, and any authentication state are
    // intentionally not mission data.
    mission_service_->CreateMission(recipe->label, recipe->mission_type);
    RefreshLocalOiAfterMissionMutation();
  }

  void CopySupportSummary(const base::ListValue& args) {
    if (!args.empty()) {
      return;
    }
    ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
        .WriteText(base::UTF8ToUTF16(SupportSummary()));
    web_ui()->CallJavascriptFunctionUnsafe("tahaiSupportSummaryCopied");
  }

  base::DictValue GuardRuntimeValue() {
    base::DictValue value;
    auto* service = guard::GuardProfileServiceFactory::GetForProfile(profile_);
    value.Set("available", service != nullptr);
    if (!service) {
      value.Set("message",
                "Guard filtering is unavailable in this "
                "Guest or system profile.");
      return value;
    }
    const auto snapshot = service->GetSnapshot();
    value.Set("mode", TahaiGuardModeName(snapshot.mode));
    value.Set("private_session", snapshot.private_session);
    value.Set("managed", snapshot.managed);
    value.Set("rules_managed", profile_->GetPrefs()->IsManagedPreference(
                                   prefs::kTahaiGuardCustomRules));
    value.Set("statistics_enabled", snapshot.statistics_enabled);
    value.Set("allowed", base::NumberToString(snapshot.allowed));
    value.Set("blocked", base::NumberToString(snapshot.blocked));
    value.Set("unavailable", base::NumberToString(snapshot.unavailable));
    using Status = guard::GuardProfileService::Status;
    switch (snapshot.status) {
      case Status::kOff:
        value.Set("message", "Guard is off. Requests are not filtered.");
        break;
      case Status::kNoRules:
        value.Set("message",
                  "Custom mode has no loaded rules. No default list "
                  "is downloaded automatically.");
        break;
      case Status::kCompiling:
        value.Set("message",
                  "Compiling a new sandboxed Guard engine. It is "
                  "not ready for decisions yet.");
        break;
      case Status::kReady:
        value.Set("message", "Guard engine ready: " +
                                 base::NumberToString(snapshot.accepted_rules) +
                                 " parsed rules; " +
                                 base::NumberToString(snapshot.ignored_rules) +
                                 " unsupported or ignored lines. Network "
                                 "blocking and declarative ad hiding are ready.");
        break;
      case Status::kLastKnownGood:
        value.Set("message",
                  "The last update failed. The previous valid "
                  "rules remain in use.");
        break;
      case Status::kUnavailable:
        value.Set("message", snapshot.managed
                                 ? "Managed Guard engine unavailable. "
                                   "Non-exempt requests fail closed."
                                 : "Guard engine unavailable. Browsing may "
                                   "continue without Guard decisions.");
        break;
      case Status::kUnsupportedMode:
        value.Set("message",
                  "This Guard mode is unsupported. Choose Balanced, Strict, "
                  "Custom, or Off.");
        break;
      case Status::kInvalidConfiguration:
        value.Set("message",
                  "Guard configuration is invalid. It has not been "
                  "silently repaired or treated as protection.");
        break;
      case Status::kStopped:
        value.Set("message", "Guard is stopping with this profile.");
        break;
    }
    return value;
  }

  void GetTahaiGuardConfiguration(const base::ListValue& args) {
    if (!args.empty()) {
      return;
    }
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiGuardConfigurationLoaded",
        base::Value(GuardConfigurationValue(
            tahai::GetTahaiGuardConfigurationForProfile(profile_))),
        base::Value(GuardRuntimeValue()));
  }

  void SetTahaiGuardConfiguration(const base::ListValue& args) {
    if (args.size() != 1u || !args.front().is_dict()) {
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiGuardConfigurationStored", base::Value(false),
          base::Value(
              "Guard preference rejected by validation; nothing changed."));
      return;
    }
    TahaiGuardConfiguration configuration;
    const bool stored =
        ValidateTahaiGuardConfiguration(args.front().GetDict(),
                                        &configuration) ==
            TahaiGuardConfigurationValidationResult::kValid &&
        tahai::SetTahaiGuardConfigurationForProfile(profile_, configuration);
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiGuardConfigurationStored", base::Value(stored),
        base::Value(
            stored ? "Local mode preference stored. Check the native "
                     "engine state; a selected mode alone is not protection."
                   : "Preference rejected by validation, profile scope or "
                     "managed policy. Nothing changed."));
  }

  void GetTahaiGuardCustomRules(const base::ListValue& args) {
    if (!args.empty() || !profile_ || profile_->IsOffTheRecord() ||
        profile_->IsGuestSession() || profile_->IsSystemProfile() ||
        profile_->GetPrefs()->IsManagedPreference(
            prefs::kTahaiGuardCustomRules) ||
        profile_->GetPrefs()->IsManagedPreference(
            prefs::kTahaiGuardConfiguration)) {
      return;
    }
    const std::string& rules =
        profile_->GetPrefs()->GetString(prefs::kTahaiGuardCustomRules);
    if (rules.size() <= 4 * 1024 * 1024) {
      web_ui()->CallJavascriptFunctionUnsafe("tahaiGuardRulesLoaded",
                                             base::Value(rules));
    }
  }

  void InstallTahaiGuardCustomRules(const base::ListValue& args) {
    auto* service = guard::GuardProfileServiceFactory::GetForProfile(profile_);
    if (!service || args.size() != 1 || !args.front().is_string() ||
        args.front().GetString().size() > 4 * 1024 * 1024) {
      OnGuardRulesInstalled(guard::GuardProfileService::UpdateResult::kDenied);
      return;
    }
    service->InstallCustomRules(
        args.front().GetString(),
        base::BindOnce(&TahaiCommandHandler::OnGuardRulesInstalled,
                       weak_factory_.GetWeakPtr()));
  }

  void OnGuardRulesInstalled(guard::GuardProfileService::UpdateResult result) {
    using Result = guard::GuardProfileService::UpdateResult;
    const char* message = "Rules were not changed.";
    switch (result) {
      case Result::kInstalled:
        message =
            "Custom rules compiled and stored in this profile. Check "
            "the current native engine state for active decisions.";
        break;
      case Result::kDenied:
        message =
            "Rules were not changed. Select Custom mode in a regular "
            "profile; mandatory policy cannot be overridden here.";
        break;
      case Result::kBusy:
        message =
            "Another candidate is still compiling. No additional "
            "compile was queued.";
        break;
      case Result::kInvalidInput:
        message =
            "Rules were rejected: input must be non-empty, bounded UTF-8.";
        break;
      case Result::kCompileFailed:
        message =
            "The candidate failed compilation or had no supported "
            "network rules. Previous valid rules were retained.";
        break;
      case Result::kCancelled:
        message = "The update was cancelled by a profile or settings change.";
        break;
    }
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiGuardRulesUpdated", base::Value(result == Result::kInstalled),
        base::Value(message));
  }

  void ClearTahaiGuardCustomRules(const base::ListValue& args) {
    auto* service = guard::GuardProfileServiceFactory::GetForProfile(profile_);
    const bool cleared = args.empty() && service && service->ClearCustomRules();
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiGuardRulesUpdated", base::Value(cleared),
        base::Value(cleared ? "Custom rules cleared from this profile."
                            : "Rules were not cleared: profile or policy "
                              "does not permit the operation."));
  }

  void CopyMissionHandoff(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const std::string& mission_id = args.front().GetString();
    for (const MissionSummary& mission : mission_service_->missions()) {
      if (mission.id == mission_id) {
        ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
            .WriteText(base::UTF8ToUTF16(MissionHandoffSummary(mission)));
        web_ui()->CallJavascriptFunctionUnsafe("tahaiMissionHandoffCopied");
        return;
      }
    }
  }

  void CopyEvidencePack(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const std::string& mission_id = args.front().GetString();
    for (const MissionSummary& mission : mission_service_->missions()) {
      if (mission.id == mission_id) {
        ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
            .WriteText(base::UTF8ToUTF16(EvidencePackSummary(mission)));
        web_ui()->CallJavascriptFunctionUnsafe("tahaiEvidencePackCopied");
        return;
      }
    }
  }

  void CopyMissionCapsule(const base::ListValue& args) {
    if (!mission_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const std::string& mission_id = args.front().GetString();
    for (const MissionSummary& mission : mission_service_->missions()) {
      if (mission.id == mission_id) {
        ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
            .WriteText(base::UTF8ToUTF16(MissionCapsuleSummary(mission)));
        web_ui()->CallJavascriptFunctionUnsafe("tahaiMissionCapsuleCopied");
        return;
      }
    }
  }

  void CopyEncryptedMissionCapsule(const base::ListValue& args) {
    if (!mission_service_ || !sync_key_service_ || args.size() != 1u ||
        !args.front().is_string()) {
      return;
    }
    sync_key_service_->EnsureActiveKey(
        base::BindOnce(&TahaiCommandHandler::OnMissionCapsuleKeyReady,
                       weak_factory_.GetWeakPtr(), args.front().GetString()));
  }

  void OnMissionCapsuleKeyReady(std::string mission_id,
                                TahaiSyncKeyResult key_result,
                                std::optional<TahaiSyncEnvelopeKey> key) {
    if (key_result != TahaiSyncKeyResult::kOk || !key) {
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiEncryptedMissionCapsuleUpdate", base::Value("key_unavailable"));
      return;
    }
    for (const MissionSummary& mission : mission_service_->missions()) {
      if (mission.id != mission_id) {
        continue;
      }
      TahaiSyncEnvelopeResult envelope_result =
          TahaiSyncEnvelopeResult::kInvalidEnvelope;
      const std::optional<std::string> encrypted =
          SealTahaiMissionCapsuleWithKeyId(
              mission, TahaiSyncProvider::kLocalProfile, key->key_id, key->key,
              &envelope_result);
      if (!encrypted || envelope_result != TahaiSyncEnvelopeResult::kOk) {
        web_ui()->CallJavascriptFunctionUnsafe(
            "tahaiEncryptedMissionCapsuleUpdate", base::Value("failed"));
        return;
      }
      ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
          .WriteText(base::UTF8ToUTF16(*encrypted));
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiEncryptedMissionCapsuleUpdate", base::Value("copied"));
      return;
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiEncryptedMissionCapsuleUpdate",
                                           base::Value("failed"));
  }

  void VerifyEncryptedMissionCapsule(const base::ListValue& args) {
    pending_capsule_import_.reset();
    if (!sync_key_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const std::string& envelope = args.front().GetString();
    if (envelope.empty() || envelope.size() > 1048576u) {
      NotifyEncryptedMissionCapsule("invalid");
      return;
    }
    const std::optional<std::string> key_id =
        GetTahaiSyncEnvelopeKeyId(envelope);
    if (!key_id) {
      NotifyEncryptedMissionCapsule("invalid");
      return;
    }
    sync_key_service_->GetKeyForId(
        *key_id,
        base::BindOnce(&TahaiCommandHandler::OnMissionCapsuleKeyRetrieved,
                       weak_factory_.GetWeakPtr(), envelope));
  }

  void OnMissionCapsuleKeyRetrieved(std::string envelope,
                                    TahaiSyncKeyResult key_result,
                                    std::optional<TahaiSyncEnvelopeKey> key) {
    if (key_result != TahaiSyncKeyResult::kOk || !key) {
      NotifyEncryptedMissionCapsule("key_unavailable");
      return;
    }
    TahaiSyncEnvelopeResult envelope_result =
        TahaiSyncEnvelopeResult::kInvalidEnvelope;
    const std::optional<TahaiOpenedSyncEnvelope> opened =
        OpenTahaiSyncEnvelope(envelope, key->key, &envelope_result);
    const std::optional<TahaiMissionCapsuleImport> importable =
        opened && envelope_result == TahaiSyncEnvelopeResult::kOk &&
                opened->provider == TahaiSyncProvider::kLocalProfile &&
                opened->object_type == TahaiSyncObjectType::kMissionCapsule &&
                VerifyTahaiMissionCapsule(opened->plaintext)
            ? ExtractTahaiMissionCapsuleImport(opened->plaintext)
            : std::nullopt;
    // The plaintext remains only in this scope and is intentionally discarded.
    // The pending value contains solely bounded generated completion state; it
    // cannot restore a source identity, title, timestamps, event history, or
    // browsing data.
    if (!importable) {
      NotifyEncryptedMissionCapsule("invalid");
      return;
    }
    pending_capsule_import_ = *importable;
    NotifyEncryptedMissionCapsule("verified_ready");
  }

  void ImportVerifiedMissionCapsule(const base::ListValue& args) {
    if (!args.empty() || !mission_service_ || !pending_capsule_import_) {
      return;
    }
    const std::optional<MissionSummary> imported =
        mission_service_->ImportSanitizedMissionCapsule(
            *pending_capsule_import_);
    pending_capsule_import_.reset();
    NotifyEncryptedMissionCapsule(imported ? "imported" : "failed");
  }

  void RotateEncryptedMissionCapsuleKey(const base::ListValue& args) {
    if (!args.empty() || !sync_key_service_) {
      return;
    }
    sync_key_service_->RotateActiveKey(
        base::BindOnce(&TahaiCommandHandler::OnMissionCapsuleKeyRotated,
                       weak_factory_.GetWeakPtr()));
  }

  void OnMissionCapsuleKeyRotated(TahaiSyncKeyResult key_result,
                                  std::optional<TahaiSyncEnvelopeKey> key) {
    NotifyEncryptedMissionCapsule(key_result == TahaiSyncKeyResult::kOk && key
                                      ? "rotated"
                                      : "key_unavailable");
  }

  void NotifyEncryptedMissionCapsule(std::string_view result) {
    web_ui()->CallJavascriptFunctionUnsafe("tahaiEncryptedMissionCapsuleUpdate",
                                           base::Value(std::string(result)));
  }

  void SetWorkMode(const base::ListValue& args) {
    if (!mode_service_ || args.size() != 1u || !args.front().is_string() ||
        !mode_service_->SetActiveMode(args.front().GetString())) {
      return;
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiWorkModeUpdated");
  }

  void OpenIdentityLane(const base::ListValue& args) {
    if (args.size() != 2u || !args[0].is_string() || !args[1].is_string()) {
      return;
    }
    GURL destination;
    if (args[1].GetString() == "workspace") {
      destination = GURL(kTahaiNewTabURL);
    } else if (args[1].GetString() == "mission") {
      destination = GURL(kTahaiMissionURL);
    } else {
      OnIdentityLaneOpened(TahaiIdentityLaneOpenResult::kInvalidDestination);
      return;
    }
    ProfileManager* profile_manager =
        g_browser_process ? g_browser_process->profile_manager() : nullptr;
    if (!profile_manager ||
        !OpenTahaiIdentityLane(
            profile_manager, args[0].GetString(), destination,
            base::BindOnce(&TahaiCommandHandler::OnIdentityLaneOpened,
                           weak_factory_.GetWeakPtr()))) {
      OnIdentityLaneOpened(TahaiIdentityLaneOpenResult::kProfileUnavailable);
    }
  }

  void OnIdentityLaneOpened(TahaiIdentityLaneOpenResult result) {
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiIdentityLaneOpened",
        base::Value(std::string(IdentityLaneOpenResultName(result))));
  }

  void SetWorkModeModifier(const base::ListValue& args) {
    if (!mode_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_bool() ||
        !mode_service_->SetModifierEnabled(args[0].GetString(),
                                           args[1].GetBool())) {
      return;
    }

    // Focus is the one universal modifier with direct native layout behavior.
    // It only affects an existing multi-view workspace and cannot create,
    // close, move, or otherwise mutate tabs on its own.
    if (args[0].GetString() == "focus") {
      Browser* browser = FindBrowserForWebContents(web_ui()->GetWebContents());
      if (browser && chrome::IsTahaiMultiView(browser)) {
        chrome::SetTahaiMultiViewFocusMode(browser, args[1].GetBool());
      }
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiWorkModeUpdated");
  }

  void SetWorkModeConfiguration(const base::ListValue& args) {
    if (!mode_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_string() ||
        !mode_service_->SetActiveConfigurationValue(args[0].GetString(),
                                                    args[1].GetString())) {
      return;
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiWorkModeUpdated");
  }

  void ResetWorkModeConfiguration(const base::ListValue& args) {
    if (!mode_service_ || !args.empty() ||
        !mode_service_->ResetActiveConfiguration()) {
      return;
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiWorkModeUpdated");
  }

  void CreateWorkModeTemplateMission(const base::ListValue& args) {
    if (!mission_service_ || !mode_service_ || args.size() != 1u ||
        !args.front().is_string()) {
      return;
    }
    const WorkModeTemplate* work_template =
        ModeService::FindTemplate(args.front().GetString());
    if (!work_template ||
        work_template->mode_id != mode_service_->active_mode().id ||
        !mission_service_->CreateMission(work_template->title,
                                         work_template->mission_type)) {
      return;
    }
    web_ui()->GetWebContents()->GetController().LoadURLWithParams(
        content::NavigationController::LoadURLParams(GURL(kTahaiMissionURL)));
  }

  void OpenTahaiOiMsp(const base::ListValue& args) {
    if (args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const std::optional<TahaiOiReferralContext> context =
        ReferralContextFromString(args.front().GetString());
    Browser* browser = FindBrowserForWebContents(web_ui()->GetWebContents());
    Profile* profile = Profile::FromWebUI(web_ui());
    if (!context || !browser || !profile ||
        !GetTahaiOiPromotionSurfaceState(profile->GetPrefs()).show_referral) {
      return;
    }
    // This opens a fixed public product page in a new browser tab. It has no
    // access to the Local OI model, profile state, names, search text,
    // evidence, credentials, browser contents, or an upload pathway.
    chrome::AddTabAt(browser, TahaiOiMspReferralUrl(*context), -1,
                     /*foreground=*/true);
  }

  void CopyLocalOiSafeReport(const base::ListValue& args) {
    if (!local_oi_service_ || (args.size() != 1u && args.size() != 2u) ||
        !args.front().is_string() ||
        (args.size() == 2u && !args[1].is_string())) {
      return;
    }
    const std::optional<LocalOiSafeReportKind> report_kind =
        LocalOiSafeReportKindFromString(args.front().GetString());
    const std::optional<LocalOiSafeReportFormat> report_format =
        args.size() == 2u
            ? LocalOiSafeReportFormatFromString(args[1].GetString())
            : std::optional<LocalOiSafeReportFormat>(
                  LocalOiSafeReportFormat::kMarkdown);
    if (!report_kind || !report_format) {
      web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiReportCopyFailed");
      return;
    }
    const std::optional<std::string> report =
        local_oi_service_->GenerateSafeReport(*report_kind, *report_format);
    if (!report) {
      web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiReportCopyFailed");
      return;
    }
    ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
        .WriteText(base::UTF8ToUTF16(*report));
    const std::string format =
        report_format == LocalOiSafeReportFormat::kJson ? "json" : "markdown";
    web_ui()->CallJavascriptFunctionUnsafe(
        local_oi_service_->RecordSafeReportCopied(*report_kind)
            ? "tahaiLocalOiReportCopied"
            : "tahaiLocalOiReportCopiedUnrecorded",
        base::Value(format));
  }

  void SearchLocalOi(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 3u || !args.front().is_string() ||
        !args[1].is_dict() || !args[2].is_int() || args[2].GetInt() <= 0) {
      return;
    }
    const base::DictValue& filters = args[1].GetDict();
    const std::string* kind = filters.FindString("kind");
    const std::string* mission_id = filters.FindString("mission_id");
    const std::string* severity = filters.FindString("severity");
    const std::string* finding_state = filters.FindString("finding_state");
    const std::optional<int> maximum_age_days = filters.FindInt("age_days");
    if (filters.size() != 5u || !kind || !mission_id || !severity ||
        !finding_state || !maximum_age_days) {
      return;
    }
    LocalOiSearchOptions options;
    options.query = args.front().GetString();
    options.kind = *kind;
    options.mission_id = *mission_id;
    options.severity = *severity;
    options.finding_state = *finding_state;
    options.maximum_age_days = *maximum_age_days;
    base::ListValue values;
    for (const LocalOiSearchResult& result :
         local_oi_service_->Search(options)) {
      base::DictValue value;
      value.Set("kind", result.kind);
      value.Set("mission_id", result.mission_id);
      value.Set("title", result.title);
      value.Set("detail", result.detail);
      value.Set("severity", result.severity);
      value.Set("finding_state", result.finding_state);
      values.Append(std::move(value));
    }
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiLocalOiSearchResults", base::Value(args.front().GetString()),
        base::Value(args[2].GetInt()), base::Value(std::move(values)));
  }

  void SearchTahaiRecall(const base::ListValue& args) {
    if (args.size() != 3u || !args[0].is_int() || args[0].GetInt() <= 0 ||
        !args[1].is_string() || !args[2].is_string()) {
      return;
    }
    const int request_id = args[0].GetInt();
    const std::optional<std::string_view> kind =
        TahaiRecallScopeToLocalOiKind(args[1].GetString());
    base::ListValue values;
    std::string status = "ready";
    if (!kind) {
      status = "unsupported_scope";
    } else if (!local_oi_service_) {
      status = "unavailable";
    } else {
      LocalOiSearchOptions options;
      options.query = args[2].GetString();
      options.kind = std::string(*kind);
      for (const LocalOiSearchResult& result :
           local_oi_service_->Search(options)) {
        base::DictValue value;
        value.Set("kind", result.kind);
        value.Set("title", result.title);
        value.Set("detail", result.detail);
        value.Set("severity", result.severity);
        value.Set("finding_state", result.finding_state);
        values.Append(std::move(value));
      }
    }
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiRecallResults", base::Value(request_id), base::Value(status),
        base::Value(std::move(values)));
  }

  void ExploreTahaiLocalOiRelationships(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 4u || !args[0].is_string() ||
        !args[1].is_string() || !args[2].is_int() || !args[3].is_int() ||
        args[3].GetInt() <= 0) {
      return;
    }
    LocalOiRelationshipExplorerOptions options;
    options.entity_id = args[0].GetString();
    options.relationship = args[1].GetString();
    options.maximum_depth = args[2].GetInt();
    const LocalOiSnapshot snapshot =
        BuildLocalOiSnapshot(local_oi_service_->data());
    base::ListValue values;
    for (const LocalOiRelationshipExplorerItem& item :
         ExploreLocalOiRelationships(snapshot, options)) {
      base::DictValue value;
      value.Set("source_id", item.source_id);
      value.Set("target_id", item.target_id);
      value.Set("source_label", item.source_label);
      value.Set("target_label", item.target_label);
      value.Set("relationship", item.relationship);
      value.Set("basis", item.basis);
      value.Set("depth", item.depth);
      values.Append(std::move(value));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiRelationshipResults",
                                           base::Value(args[3].GetInt()),
                                           base::Value(std::move(values)));
  }

  void GetTahaiLocalOiEntityDetail(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_int() || args[1].GetInt() <= 0) {
      return;
    }
    const std::optional<LocalOiEntityDetail> detail = GetLocalOiEntityDetail(
        BuildLocalOiSnapshot(local_oi_service_->data()), args[0].GetString());
    base::DictValue value;
    if (detail) {
      value.Set("id", detail->id);
      value.Set("mission_id", detail->mission_id);
      value.Set("kind", detail->kind);
      value.Set("label", detail->label);
      value.Set("detail", detail->detail);
      value.Set("direct_relationship_count",
                static_cast<int>(detail->direct_relationship_count));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiEntityDetail",
                                           base::Value(args[1].GetInt()),
                                           base::Value(std::move(value)));
  }

  void BuildTahaiLocalDeterministicBrief(const base::ListValue& args) {
    base::ListValue lines;
    if (!local_oi_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_list()) {
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiLocalOiDeterministicBriefPrepared", base::Value(false),
          base::Value("The requested deterministic local brief was rejected."),
          base::Value(""), base::Value(std::move(lines)));
      return;
    }
    const std::optional<LocalOiAssistOperation> operation =
        LocalOiAssistOperationFromString(args[0].GetString());
    const base::ListValue& selected_values = args[1].GetList();
    if (!operation || selected_values.empty() || selected_values.size() > 8u) {
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiLocalOiDeterministicBriefPrepared", base::Value(false),
          base::Value("Select one to eight valid local records for a brief."),
          base::Value(""), base::Value(std::move(lines)));
      return;
    }
    LocalOiAssistRequest request;
    request.operation = *operation;
    request.selected_record_ids.reserve(selected_values.size());
    for (const base::Value& value : selected_values) {
      if (!value.is_string()) {
        web_ui()->CallJavascriptFunctionUnsafe(
            "tahaiLocalOiDeterministicBriefPrepared", base::Value(false),
            base::Value("Select one to eight valid local records for a brief."),
            base::Value(""), base::Value(std::move(lines)));
        return;
      }
      request.selected_record_ids.push_back(value.GetString());
    }
    const std::optional<LocalOiDeterministicBrief> brief =
        local_oi_service_->BuildDeterministicLocalBrief(request);
    if (!brief) {
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiLocalOiDeterministicBriefPrepared", base::Value(false),
          base::Value("The brief was not created. Local OI may be disabled by "
                      "policy, or a selected record is no longer available."),
          base::Value(""), base::Value(std::move(lines)));
      return;
    }
    for (const std::string& line : brief->lines) {
      lines.Append(line);
    }
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiLocalOiDeterministicBriefPrepared", base::Value(true),
        base::Value(base::StrCat(
            {"Created from exactly ", base::NumberToString(lines.size()),
             " deterministic local line(s). No model was invoked."})),
        base::Value(brief->title), base::Value(std::move(lines)));
  }

  void SetTahaiLocalOiControl(const base::ListValue& args) {
    if (args.size() != 2u || !args[0].is_string() || !args[1].is_bool()) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    const std::optional<LocalOiPolicyControl> control =
        LocalOiPolicyControlFromUiSetting(args[0].GetString());
    if (!profile || !control) {
      return;
    }
    const bool updated = TahaiLocalOiPolicy(profile->GetPrefs())
                             .SetEnabled(*control, args[1].GetBool());
    if (updated && args[1].GetBool() &&
        (*control == LocalOiPolicyControl::kEnabled ||
         *control == LocalOiPolicyControl::kMissionIngestion)) {
      RefreshLocalOiAfterMissionMutation();
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiControlUpdated",
                                           base::Value(args[0].GetString()),
                                           base::Value(updated));
  }

  void RebuildTahaiLocalOiIndex(const base::ListValue& args) {
    if (!args.empty() || !local_oi_service_ || !mission_service_) {
      return;
    }
    const bool refreshed =
        local_oi_service_->SyncMissions(mission_service_->missions());
    web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiProjectionRefreshed",
                                           base::Value(refreshed));
  }

  void UpdateLocalOiFinding(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 3u || !args[0].is_string() ||
        !args[1].is_string() || !args[2].is_string()) {
      return;
    }
    const std::string& finding_id = args[0].GetString();
    const std::string& action = args[1].GetString();
    const std::string& rationale = args[2].GetString();
    bool updated = false;
    if (action == "acknowledge") {
      updated = local_oi_service_->AcknowledgeFinding(finding_id, rationale);
    } else if (action == "resolve") {
      updated = local_oi_service_->ResolveFinding(finding_id, rationale);
    } else if (action == "suppress") {
      updated = local_oi_service_->SuppressFinding(finding_id, rationale);
    } else if (action == "reopen") {
      updated = local_oi_service_->ReopenFinding(finding_id, rationale);
    }
    if (updated) {
      web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiFindingUpdated");
    }
  }

  void SetTahaiOiMspPromotion(const base::ListValue& args) {
    if (args.size() != 1u || !args.front().is_bool()) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    if (!profile || !SetTahaiOiMspPromotionEnabled(profile->GetPrefs(),
                                                   args.front().GetBool())) {
      return;
    }
    web_ui()->GetWebContents()->GetController().Reload(
        content::ReloadType::NORMAL, false);
  }

  void InspectTahaiNetwork(const base::ListValue& args) {
    if (network_inspection_in_flight_) {
      web_ui()->CallJavascriptFunctionUnsafe("tahaiNetworkInspectionRejected");
      return;
    }
    if ((args.size() != 1u && args.size() != 2u && args.size() != 3u) ||
        !args.front().is_string() ||
        (args.size() >= 2u && !args[1].is_string()) ||
        (args.size() == 3u && !args[2].is_string())) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    if (!profile) {
      return;
    }
    const std::string mission_id =
        args.size() >= 2u ? args[1].GetString() : std::string();
    const std::string watch_id =
        args.size() == 3u ? args[2].GetString() : std::string();
    // A clipboard handoff is valid only for the most recently completed
    // explicit run. Do not leave a prior target available while a new run is
    // being requested.
    last_network_inspection_.reset();
    last_network_inspection_recorded_ = false;
    pending_network_inspection_summary_.reset();
    pending_network_inspection_origin_.reset();
    pending_network_inspection_review_decision_.reset();
    network_inspection_in_flight_ = true;
    TahaiNetworkInspector::Inspect(
        profile, args.front().GetString(),
        base::BindOnce(&TahaiCommandHandler::OnTahaiNetworkInspection,
                       weak_factory_.GetWeakPtr(), mission_id, watch_id));
  }

  void OnTahaiNetworkInspection(std::string mission_id,
                                std::string watch_id,
                                TahaiNetworkInspectionResult result) {
    network_inspection_in_flight_ = false;
    base::DictValue value;
    value.Set("host", result.host);
    base::ListValue addresses;
    for (const std::string& address : result.resolved_addresses) {
      addresses.Append(address);
    }
    value.Set("resolved_addresses", std::move(addresses));
    base::ListValue aliases;
    for (const std::string& alias : result.dns_aliases) {
      aliases.Append(alias);
    }
    value.Set("dns_aliases", std::move(aliases));
    value.Set("resolved_ipv4_count", result.resolved_ipv4_count);
    value.Set("resolved_ipv6_count", result.resolved_ipv6_count);
    value.Set("dns_alias_count", result.dns_alias_count);
    value.Set("dns_net_error", result.dns_net_error);
    value.Set("request_net_error", result.request_net_error);
    value.Set("target_rejected", result.target_rejected);
    value.Set("public_address_guard_blocked",
              result.public_address_guard_blocked);
    value.Set("http_status", result.http_status);
    value.Set("security_header_observation_available",
              result.security_header_observation_available);
    value.Set("observed_security_header_count",
              result.observed_security_header_count);
    value.Set("tls_info_available", result.tls_info_available);
    value.Set("certificate_valid", result.certificate_valid);
    value.Set("issued_by_known_root", result.issued_by_known_root);
    value.Set("certificate_status", result.certificate_status);
    value.Set("certificate_name_mismatch", result.certificate_name_mismatch);
    value.Set("certificate_authority_invalid",
              result.certificate_authority_invalid);
    value.Set("certificate_revoked", result.certificate_revoked);
    value.Set("certificate_subject", result.certificate_subject);
    value.Set("certificate_issuer", result.certificate_issuer);
    value.Set("certificate_expiry", result.certificate_expiry);
    value.Set("certificate_days_remaining", result.certificate_days_remaining);
    value.Set("certificate_expired", result.certificate_expired);
    base::ListValue subject_alt_names;
    for (const std::string& name : result.subject_alt_names) {
      subject_alt_names.Append(name);
    }
    value.Set("subject_alt_names", std::move(subject_alt_names));
    value.Set("tls_version", result.tls_version);
    value.Set("cipher_suite", result.cipher_suite);
    value.Set("elapsed_milliseconds", result.elapsed_milliseconds);
    base::ListValue guidance;
    for (const std::string& step :
         BuildTahaiNetworkInspectionGuidance(result)) {
      guidance.Append(step);
    }
    value.Set("guidance", std::move(guidance));
    const bool recorded =
        local_oi_service_ && local_oi_service_->RecordNetworkInspection(
                                 result, mission_id, watch_id);
    last_network_inspection_ = result;
    last_network_inspection_recorded_ = recorded;
    value.Set("recorded", recorded);
    web_ui()->CallJavascriptFunctionUnsafe("tahaiNetworkInspectionComplete",
                                           base::Value(std::move(value)));
  }

  void CopyTahaiNetworkInspectionSummary(const base::ListValue& args) {
    if (!args.empty() || !last_network_inspection_) {
      return;
    }
    const std::string summary = BuildTahaiNetworkInspectionSafeSummary(
        *last_network_inspection_, last_network_inspection_recorded_);
    const GURL inspected_origin("https://" + last_network_inspection_->host +
                                "/");
    const std::optional<TahaiEnvironmentGuardDecision> decision =
        EvaluateTahaiEnvironmentGuardForUrl(
            prefs_, inspected_origin, TahaiEnvironmentAction::kClipboardExport);
    if (decision && !decision->allowed) {
      pending_network_inspection_summary_.reset();
      pending_network_inspection_origin_.reset();
      pending_network_inspection_review_decision_.reset();
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiNetworkInspectionSummaryCopyBlocked",
          base::Value(std::string(decision->reason)));
      return;
    }
    if (decision && (decision->require_confirmation ||
                     decision->require_redaction_preview)) {
      pending_network_inspection_summary_ = summary;
      pending_network_inspection_origin_ = inspected_origin;
      pending_network_inspection_review_decision_ = *decision;
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiNetworkInspectionSummaryReviewRequired", base::Value(summary),
          base::Value(std::string(decision->reason)));
      return;
    }
    pending_network_inspection_summary_.reset();
    pending_network_inspection_origin_.reset();
    pending_network_inspection_review_decision_.reset();
    ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
        .WriteText(base::UTF8ToUTF16(summary));
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiNetworkInspectionSummaryCopied");
  }

  void ConfirmTahaiNetworkInspectionSummary(const base::ListValue& args) {
    if (!args.empty() || !pending_network_inspection_summary_ ||
        !pending_network_inspection_origin_) {
      return;
    }
    const std::optional<TahaiEnvironmentGuardDecision> decision =
        EvaluateTahaiEnvironmentGuardForUrl(
            prefs_, *pending_network_inspection_origin_,
            TahaiEnvironmentAction::kClipboardExport);
    if (decision && !decision->allowed) {
      pending_network_inspection_summary_.reset();
      pending_network_inspection_origin_.reset();
      pending_network_inspection_review_decision_.reset();
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiNetworkInspectionSummaryCopyBlocked",
          base::Value(std::string(decision->reason)));
      return;
    }
    // The classification may have changed while the review dialog was open.
    // A newly required confirmation or redaction preview needs a fresh
    // operator review; an earlier weaker review cannot satisfy it.
    if (decision && pending_network_inspection_review_decision_ &&
        IsTahaiEnvironmentReviewEscalated(
            *pending_network_inspection_review_decision_, *decision)) {
      pending_network_inspection_review_decision_ = *decision;
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiNetworkInspectionSummaryReviewRequired",
          base::Value(*pending_network_inspection_summary_),
          base::Value(std::string(decision->reason)));
      return;
    }
    ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
        .WriteText(base::UTF8ToUTF16(*pending_network_inspection_summary_));
    pending_network_inspection_summary_.reset();
    pending_network_inspection_origin_.reset();
    pending_network_inspection_review_decision_.reset();
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiNetworkInspectionSummaryCopied");
  }

  void ListTahaiNetworkInspectionHistory(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    const std::string host = args.front().GetString();
    base::ListValue history;
    for (const LocalOiNetworkInspectionHistoryItem& item :
         local_oi_service_->NetworkInspectionHistory(host)) {
      base::DictValue value;
      value.Set("inspected_at", item.inspected_at);
      value.Set("comparison", item.comparison);
      value.Set("changed_fields", item.changed_fields);
      value.Set("resolved_ipv4_count", item.resolved_ipv4_count);
      value.Set("resolved_ipv6_count", item.resolved_ipv6_count);
      value.Set("dns_alias_count", item.dns_alias_count);
      value.Set("security_header_observation_available",
                item.security_header_observation_available);
      value.Set("observed_security_header_count",
                item.observed_security_header_count);
      value.Set("dns_net_error", item.dns_net_error);
      value.Set("request_net_error", item.request_net_error);
      value.Set("public_address_guard_blocked",
                item.public_address_guard_blocked);
      value.Set("http_status", item.http_status);
      value.Set("tls_info_available", item.tls_info_available);
      value.Set("certificate_valid", item.certificate_valid);
      value.Set("certificate_expired", item.certificate_expired);
      value.Set("certificate_days_remaining", item.certificate_days_remaining);
      history.Append(std::move(value));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiNetworkInspectionHistory",
                                           base::Value(host),
                                           base::Value(std::move(history)));
  }

  void RecordTahaiChangeCapture(const base::ListValue& args) {
    if (!local_oi_service_ || (args.size() != 3u && args.size() != 4u) ||
        !args[0].is_string() || !args[1].is_string() || !args[2].is_string() ||
        (args.size() == 4u && !args[3].is_string())) {
      return;
    }
    const std::optional<TahaiChangeCaptureKind> kind =
        TahaiChangeCaptureKindFromName(args[0].GetString());
    if (!kind) {
      return;
    }
    const std::optional<LocalOiChangeCaptureOutcome> outcome =
        local_oi_service_->RecordChangeCapture(
            {*kind, args[1].GetString(), args[2].GetString()},
            args.size() == 4u ? args[3].GetString() : "");
    if (!outcome) {
      web_ui()->CallJavascriptFunctionUnsafe(
          "tahaiChangeCaptureComplete", base::Value(false),
          base::Value("rejected"), base::Value(""), base::Value(""));
      return;
    }
    const std::string_view state =
        outcome->created_baseline ? "baseline"
                                  : ChangeComparisonLabel(outcome->comparison);
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiChangeCaptureComplete", base::Value(true), base::Value(state),
        base::Value(outcome->capture.canonical_target),
        base::Value(
            std::string(TahaiChangeCaptureKindName(outcome->capture.kind))));
  }

  void ListTahaiChangeCaptureHistory(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 2u || !args[0].is_string() ||
        !args[1].is_string()) {
      return;
    }
    const std::optional<TahaiChangeCaptureKind> kind =
        TahaiChangeCaptureKindFromName(args[0].GetString());
    if (!kind) {
      return;
    }
    base::ListValue history;
    for (const LocalOiChangeCaptureHistoryItem& item :
         local_oi_service_->ChangeCaptureHistory(*kind, args[1].GetString())) {
      base::DictValue value;
      value.Set("recorded_at", item.recorded_at);
      value.Set("comparison", item.comparison);
      value.Set("is_current", item.is_current);
      history.Append(std::move(value));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiChangeCaptureHistory",
                                           base::Value(std::move(history)));
  }

  void RecordTahaiArtifactMetadata(const base::ListValue& args) {
    if (!local_oi_service_ || (args.size() != 3u && args.size() != 4u) ||
        !args[0].is_string() || !args[1].is_string() || !args[2].is_string() ||
        (args.size() == 4u && !args[3].is_string())) {
      return;
    }
    const std::optional<LocalOiArtifactOutcome> outcome =
        local_oi_service_->RecordArtifactMetadata(
            {args[0].GetString(), args[1].GetString(), args[2].GetString(),
             args.size() == 4u ? args[3].GetString() : ""});
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiArtifactMetadataComplete", base::Value(outcome.has_value()),
        base::Value(outcome ? outcome->canonical_source_url : ""));
  }

  void ListTahaiArtifactHistory(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    base::ListValue history;
    for (const LocalOiArtifactHistoryItem& item :
         local_oi_service_->ArtifactHistory(args.front().GetString())) {
      base::DictValue value;
      value.Set("recorded_at", item.recorded_at);
      value.Set("label", item.label);
      value.Set("digest_recorded", item.digest_recorded);
      history.Append(std::move(value));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiArtifactHistory",
                                           base::Value(std::move(history)));
  }

  void RecordTahaiDocumentationReference(const base::ListValue& args) {
    if (!local_oi_service_ || (args.size() != 3u && args.size() != 4u) ||
        !args[0].is_string() || !args[1].is_string() || !args[2].is_string() ||
        (args.size() == 4u && !args[3].is_string())) {
      return;
    }
    const std::optional<LocalOiDocumentReferenceOutcome> outcome =
        local_oi_service_->RecordDocumentReference(
            {args[0].GetString(), args[1].GetString(), args[2].GetString(),
             args.size() == 4u ? args[3].GetString() : ""});
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiDocumentationReferenceComplete", base::Value(outcome.has_value()),
        base::Value(outcome ? outcome->canonical_reference_url : ""),
        base::Value(outcome ? outcome->endpoint_id : ""));
  }

  void ListTahaiDocumentationReferences(const base::ListValue& args) {
    if (!local_oi_service_ || args.size() != 1u || !args.front().is_string()) {
      return;
    }
    base::ListValue references;
    for (const LocalOiDocumentReferenceItem& item :
         local_oi_service_->DocumentReferencesForEndpoint(
             args.front().GetString())) {
      base::DictValue value;
      value.Set("recorded_at", item.recorded_at);
      value.Set("label", item.label);
      value.Set("reference_url", item.reference_url);
      references.Append(std::move(value));
    }
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiDocumentationReferenceRegistry",
        base::Value(std::move(references)));
  }

  void ListTahaiLocalOiEndpoints(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue endpoints;
    for (const LocalOiEntityRecord& entity :
         local_oi_service_->data().entities) {
      if (entity.type != LocalOiEntityType::kEndpoint || entity.archived) {
        continue;
      }
      base::DictValue endpoint;
      endpoint.Set("id", entity.id);
      endpoint.Set("title", entity.title);
      endpoints.Append(std::move(endpoint));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiEndpointList",
                                           base::Value(std::move(endpoints)));
  }

  void ListTahaiDocumentationMissions(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue missions;
    for (const LocalOiEntityRecord& entity :
         local_oi_service_->data().entities) {
      if (entity.type != LocalOiEntityType::kMission || entity.archived) {
        continue;
      }
      base::DictValue mission;
      mission.Set("id", entity.id);
      mission.Set("title", entity.title);
      missions.Append(std::move(mission));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiDocumentationMissionList",
                                           base::Value(std::move(missions)));
  }

  void ListTahaiSupportMissions(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue missions;
    for (const LocalOiEntityRecord& entity :
         local_oi_service_->data().entities) {
      if (entity.type != LocalOiEntityType::kMission || entity.archived) {
        continue;
      }
      base::DictValue mission;
      mission.Set("id", entity.id);
      mission.Set("title", entity.title);
      missions.Append(std::move(mission));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiSupportMissionList",
                                           base::Value(std::move(missions)));
  }

  void ListTahaiChangeMissions(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue missions;
    for (const LocalOiEntityRecord& entity :
         local_oi_service_->data().entities) {
      if (entity.type != LocalOiEntityType::kMission || entity.archived) {
        continue;
      }
      base::DictValue mission;
      mission.Set("id", entity.id);
      mission.Set("title", entity.title);
      missions.Append(std::move(mission));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiChangeMissionList",
                                           base::Value(std::move(missions)));
  }

  void ListTahaiLocalOiMissions(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue missions;
    for (const LocalOiEntityRecord& entity :
         local_oi_service_->data().entities) {
      if (entity.type != LocalOiEntityType::kMission || entity.archived) {
        continue;
      }
      base::DictValue mission;
      mission.Set("id", entity.id);
      mission.Set("title", entity.title);
      missions.Append(std::move(mission));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiMissionList",
                                           base::Value(std::move(missions)));
  }

  void ListTahaiWatchMissions(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue missions;
    for (const LocalOiEntityRecord& entity :
         local_oi_service_->data().entities) {
      if (entity.type != LocalOiEntityType::kMission || entity.archived) {
        continue;
      }
      base::DictValue mission;
      mission.Set("id", entity.id);
      mission.Set("title", entity.title);
      missions.Append(std::move(mission));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiWatchMissionList",
                                           base::Value(std::move(missions)));
  }

  void ConfigureTahaiManualWatch(const base::ListValue& args) {
    if (!local_oi_service_ || (args.size() != 3u && args.size() != 4u) ||
        !args[0].is_string() || !args[1].is_string() || !args[2].is_int() ||
        (args.size() == 4u && !args[3].is_string())) {
      return;
    }
    const std::optional<TahaiSentinelWatchKind> kind =
        TahaiSentinelWatchKindFromName(args[0].GetString());
    if (!kind) {
      return;
    }
    const std::optional<LocalOiManualWatchOutcome> outcome =
        local_oi_service_->ConfigureManualWatch(
            {*kind, args[1].GetString(), args[2].GetInt()},
            args.size() == 4u ? args[3].GetString() : "");
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiManualWatchConfigured", base::Value(outcome.has_value()),
        base::Value(outcome ? outcome->canonical_target : ""));
  }

  void ListTahaiManualWatches(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue watches;
    for (const LocalOiManualWatchItem& item :
         local_oi_service_->ManualWatches()) {
      base::DictValue watch;
      watch.Set("record_id", item.record_id);
      watch.Set("title", item.title);
      watch.Set("target", item.target);
      watch.Set("watch_kind", item.kind);
      watch.Set("mission_id", item.mission_id);
      watch.Set("interval_seconds", item.interval_seconds);
      watch.Set("execution_mode", "manual_only");
      watch.Set("last_completed_at", item.last_completed_at);
      watch.Set("schedule_state", item.schedule_state);
      watch.Set("seconds_until_due", item.seconds_until_due);
      watches.Append(std::move(watch));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiManualWatchList",
                                           base::Value(std::move(watches)));
  }

  void DeleteLocalOiData(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty() ||
        !local_oi_service_->DeleteAllData()) {
      return;
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiLocalOiDataDeleted");
  }

  void ConfigureEnvironmentClassification(const base::ListValue& args) {
    if (!local_oi_service_ || (args.size() != 2u && args.size() != 3u) ||
        !args[0].is_string() || !args[1].is_string() ||
        (args.size() == 3u && !args[2].is_string())) {
      return;
    }
    const std::optional<TahaiEnvironment> environment =
        TahaiEnvironmentFromName(args[0].GetString());
    if (!environment) {
      return;
    }
    const std::optional<LocalOiEnvironmentClassificationOutcome> outcome =
        local_oi_service_->ConfigureEnvironmentClassification(
            *environment, args[1].GetString(),
            args.size() == 3u ? args[2].GetString() : "");
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiEnvironmentClassificationConfigured",
        base::Value(outcome.has_value()),
        base::Value(outcome ? outcome->canonical_origin : ""));
  }

  void ListTahaiEnvironmentClassifications(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue classifications;
    for (const LocalOiEnvironmentClassificationItem& item :
         local_oi_service_->EnvironmentClassifications()) {
      base::DictValue value;
      value.Set("origin", item.origin);
      value.Set("environment", item.environment);
      value.Set("persistent_boundary", item.persistent_boundary);
      value.Set("redaction_preview", item.redaction_preview);
      value.Set("pilot_actions_blocked", item.pilot_actions_blocked);
      classifications.Append(std::move(value));
    }
    web_ui()->CallJavascriptFunctionUnsafe(
        "tahaiEnvironmentClassificationRegistry",
        base::Value(std::move(classifications)));
  }

  void ListTahaiEnvironmentMissions(const base::ListValue& args) {
    if (!local_oi_service_ || !args.empty()) {
      return;
    }
    base::ListValue missions;
    for (const LocalOiEntityRecord& entity :
         local_oi_service_->data().entities) {
      if (entity.type != LocalOiEntityType::kMission || entity.archived) {
        continue;
      }
      base::DictValue mission;
      mission.Set("id", entity.id);
      mission.Set("title", entity.title);
      missions.Append(std::move(mission));
    }
    web_ui()->CallJavascriptFunctionUnsafe("tahaiEnvironmentMissionList",
                                           base::Value(std::move(missions)));
  }

  const raw_ptr<MissionService> mission_service_;
  const raw_ptr<ModeService> mode_service_;
  const raw_ptr<TahaiLocalOiService> local_oi_service_;
  const raw_ptr<Profile> profile_;
  const raw_ptr<PrefService> prefs_;
  const std::unique_ptr<TahaiSyncKeyService> sync_key_service_;
  std::optional<TahaiMissionCapsuleImport> pending_capsule_import_;
  bool network_inspection_in_flight_ = false;
  std::optional<TahaiNetworkInspectionResult> last_network_inspection_;
  bool last_network_inspection_recorded_ = false;
  std::optional<std::string> pending_network_inspection_summary_;
  std::optional<GURL> pending_network_inspection_origin_;
  std::optional<TahaiEnvironmentGuardDecision>
      pending_network_inspection_review_decision_;
  base::WeakPtrFactory<TahaiCommandHandler> weak_factory_{this};
};

}  // namespace

TahaiPlaceholderSource::TahaiPlaceholderSource(Profile* profile)
    : source_name_(kTahaiChromeHost), profile_(profile) {}

TahaiPlaceholderSource::~TahaiPlaceholderSource() = default;

std::string TahaiPlaceholderSource::GetSource() {
  return source_name_;
}

void TahaiPlaceholderSource::StartDataRequest(
    const GURL& url,
    const content::WebContents::Getter& wc_getter,
    GotDataCallback callback) {
  if (url.path() == "/brand.png") {
    std::string_view logo =
        ui::ResourceBundle::GetSharedInstance().GetRawDataResource(
            IDR_PRODUCT_LOGO_256);
    std::move(callback).Run(
        base::MakeRefCounted<base::RefCountedString>(std::string(logo)));
    return;
  }
  std::string html;
  if (url.path() == "/app.css") {
    html =
        base::StrCat({kSharedCss, kModeCss, kModeActionCss, kModeSignatureCss,
                      kLocalOiCss, kLocalOiSearchCss, kLocalOiGraphExplorerCss,
                      kLocalOiControlCss, kLocalOiCapabilityCss});
  } else if (url.path() == "/actions.js") {
    html = kActionsJs;
  } else if (url.path() == "/command-center.js") {
    html = base::StrCat({kCommandJs, kRecallJs});
  } else if (url.path() == "/mission.js") {
    html = base::StrCat({kMissionJs, kMissionKeyRotationJs});
  } else if (url.path() == "/local-oi.js") {
    html = base::StrCat({kLocalOiJs, kLocalOiGraphExplorerJs,
                         kLocalOiControlsJs, kLocalOiRuntimeJs, kLocalOiWatchJs,
                         kLocalOiDeterministicBriefJs, kLocalOiJsonReportJs,
                         kLocalOiPrivacyControlsJs, kLocalOiBoundaryTruthJs});
  } else if (url.path() == "/support.js") {
    html = base::StrCat({kSupportJs,
                         kSupportClipboardReviewJs,
                         kSupportChangeJs,
                         kSupportChangeMissionJs,
                         kSupportChangeHistoryJs,
                         kSupportArtifactJs,
                         kSupportArtifactMissionJs,
                         kSupportArtifactHistoryJs,
                         kSupportWatchJs,
                         kSupportWatchMissionJs,
                         kSupportManualWatchRegistryJs,
                         kSupportEnvironmentJs,
                         kSupportEnvironmentMissionJs,
                         kSupportEnvironmentRegistryJs,
                         kSupportGuardJs,
                         kSupportDocumentationReferenceJs,
                         kSupportDocumentationMissionJs,
                         kSupportDocumentationRegistryJs,
                         kSupportNetworkMissionJs,
                         kSupportNetworkHistoryJs,
                         kSupportManualWatchRunJs,
                         kSupportInspectionOutcomeJs,
                         kSupportArtifactBoundaryTruthJs});
  } else if (url.path() == "/modes.js") {
    html = kModesJs;
  } else if (url.path() == "/profiles.js") {
    html = kProfilesJs;
  } else {
    Profile* request_profile = profile_;
    if (content::WebContents* web_contents = wc_getter.Run()) {
      request_profile = Profile::FromBrowserContext(
          web_contents->GetBrowserContext());
    }
    CHECK(request_profile);
    MissionService* mission_service =
        MissionServiceFactory::GetForProfile(request_profile);
    ModeService* mode_service =
        ModeServiceFactory::GetForProfile(request_profile);
    TahaiLocalOiService* local_oi_service =
        TahaiLocalOiServiceFactory::GetForProfile(request_profile);
    PrefService* prefs = request_profile->GetPrefs();
    const std::optional<TahaiSurfaceDefinition> surface =
        GetSurfaceDefinition(url);
    // URLDataSource also receives subresource requests. A malformed or stale
    // subresource must not terminate the browser process merely because it is
    // not one of the allowlisted TAHAI document routes.
    if (!surface) {
      html = "<!doctype html><title>Not found</title>";
    } else if (surface->surface == kNewTabSurface) {
      html = NewTabHtml(mission_service, mode_service);
    } else if (surface->surface == kModesSurface) {
      html = ModeHtml(mode_service);
    } else if (surface->surface == kMissionSurface) {
      html = MissionHtml(mission_service, mode_service);
    } else if (surface->surface == kLocalOiSurface) {
      html = LocalOiHtml(mission_service, mode_service, local_oi_service, prefs);
    } else if (surface->surface == kOpsToolsSurface) {
      html = OpsHtml(mode_service);
    } else if (surface->surface == kProfilesSurface) {
      content::WebContents* web_contents = wc_getter.Run();
      Profile* active_profile =
          web_contents
              ? Profile::FromBrowserContext(web_contents->GetBrowserContext())
              : nullptr;
      html = ProfilesHtml(mode_service, active_profile);
    } else if (surface->surface == kSupportSurface) {
      html = SupportHtml(mode_service);
    } else {
      html = PolicyHtml(mode_service, prefs);
    }
  }
  std::move(callback).Run(
      base::MakeRefCounted<base::RefCountedString>(std::move(html)));
}

std::string TahaiPlaceholderSource::GetMimeType(const GURL& url) {
  if (url.path() == "/brand.png") {
    return "image/png";
  }
  if (url.path() == "/app.css") {
    return "text/css";
  }
  if (url.path() == "/command-center.js") {
    return "text/javascript";
  }
  if (url.path() == "/mission.js") {
    return "text/javascript";
  }
  if (url.path() == "/local-oi.js") {
    return "text/javascript";
  }
  if (url.path() == "/support.js") {
    return "text/javascript";
  }
  if (url.path() == "/modes.js") {
    return "text/javascript";
  }
  if (url.path() == "/profiles.js") {
    return "text/javascript";
  }
  if (url.path() == "/actions.js") {
    return "text/javascript";
  }
  return "text/html";
}

std::string TahaiPlaceholderSource::GetContentSecurityPolicy(
    network::mojom::CSPDirectiveName directive) {
  if (directive == network::mojom::CSPDirectiveName::ScriptSrc) {
    return "script-src 'self';";
  }
  if (directive == network::mojom::CSPDirectiveName::StyleSrc) {
    return "style-src 'self';";
  }
  if (directive == network::mojom::CSPDirectiveName::ImgSrc) {
    return "img-src 'self' data:;";
  }
  if (directive == network::mojom::CSPDirectiveName::FormAction) {
    return "form-action https://www.google.com;";
  }
  return content::URLDataSource::GetContentSecurityPolicy(directive);
}

TahaiUI::TahaiUI(content::WebUI* web_ui,
                 std::string_view surface,
                 std::string_view title)
    : content::WebUIController(web_ui) {
  Profile* profile = Profile::FromWebUI(web_ui);
  CHECK(profile);
  MissionService* mission_service =
      MissionServiceFactory::GetForProfile(profile);
  ModeService* mode_service = ModeServiceFactory::GetForProfile(profile);
  TahaiLocalOiService* local_oi_service =
      TahaiLocalOiServiceFactory::GetForProfile(profile);
  CHECK(mission_service);
  CHECK(mode_service);
  content::URLDataSource::Add(
      profile, std::make_unique<TahaiPlaceholderSource>(profile));
  // Every TAHAI surface hosts the same fixed command palette. The handler is
  // deliberately route- and command-allowlisted; it never accepts a URL,
  // script, connector, or profile-selection value from page content.
  web_ui->AddMessageHandler(std::make_unique<TahaiCommandHandler>(
      mission_service, mode_service, local_oi_service, profile));
}

TahaiUI::~TahaiUI() = default;

TahaiUIConfig::TahaiUIConfig()
    : content::WebUIConfig(content::kChromeUIScheme, kTahaiChromeHost) {}

TahaiUIConfig::~TahaiUIConfig() = default;

bool TahaiUIConfig::IsWebUIEnabled(content::BrowserContext* browser_context) {
  Profile* profile = Profile::FromBrowserContext(browser_context);
  return profile != nullptr;
}

bool TahaiUIConfig::ShouldHandleURL(const GURL& url) {
  return url.SchemeIs(content::kChromeUIScheme) &&
         url.host() == kTahaiChromeHost &&
         GetSurfaceDefinition(url).has_value();
}

std::unique_ptr<content::WebUIController> TahaiUIConfig::CreateWebUIController(
    content::WebUI* web_ui,
    const GURL& url) {
  const std::optional<TahaiSurfaceDefinition> surface =
      GetSurfaceDefinition(url);
  CHECK(surface);
  return std::make_unique<TahaiUI>(web_ui, surface->surface, surface->title);
}

}  // namespace tahai
