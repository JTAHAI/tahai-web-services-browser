// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_CAPABILITY_REVIEW_UI_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_CAPABILITY_REVIEW_UI_H_

namespace tahai {

// No granting/invocation channel is exposed by this review surface.
inline constexpr char kCapabilityReviewJs[] = R"TAHAI(
(() => {
  'use strict';
  const list = document.querySelector('#capability-grants');
  const status = document.querySelector('#capability-status');
  const refresh = document.querySelector('#capability-refresh');
  if (!list || !status || !refresh) return;
  let generation = 0;
  window.tahaiCapabilityGrants = (available, token, grants) => {
    const current = ++generation;
    list.replaceChildren();
    status.textContent = !available
        ? 'Grant review is unavailable in this profile, managed by policy, or the stored format is not supported. Nothing was changed.'
        : grants.length ? 'Review the exact provider, revision, origin and operation before revoking.'
                        : 'No stored capability grants.';
    if (!available) return;
    for (const [index, grant] of grants.entries()) {
      const item = document.createElement('li');
      const details = document.createElement('p');
      const revoke = document.createElement('button');
      details.textContent = `${grant.provider} · revision ${grant.revision} · ${grant.origin} · ${grant.operation}`;
      revoke.type = 'button'; revoke.className = 'button';
      revoke.textContent = 'Revoke this grant';
      revoke.addEventListener('click', () => {
        if (current !== generation || !revoke.isConnected || revoke.disabled) return;
        ++generation;
        for (const button of list.querySelectorAll('button')) button.disabled = true;
        status.textContent = 'Revoking the reviewed grant…';
        chrome.send('revokeTahaiCapabilityGrant', [token, index]);
      });
      item.append(details, revoke); list.append(item);
    }
  };
  window.tahaiCapabilityRevoked = revoked => {
    ++generation; list.replaceChildren();
    status.textContent = revoked
        ? 'Grant revoked. Refresh to review remaining grants. Revocation does not undo work already performed.'
        : 'Nothing was revoked. Refresh and review current grants before trying again.';
  };
  refresh.addEventListener('click', () => {
    ++generation; list.replaceChildren(); status.textContent = 'Loading grant review…';
    chrome.send('getTahaiCapabilityGrants', []);
  });
  chrome.send('getTahaiCapabilityGrants', []);
})();
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_CAPABILITY_REVIEW_UI_H_
