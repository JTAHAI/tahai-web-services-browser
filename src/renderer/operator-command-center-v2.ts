import type { MissionState } from '../shared/mission-types';
import {
  buildOperatorCommandCenterV2Report,
  type OperatorCommandCenterV2Family,
  type OperatorCommandCenterV2Report
} from '../shared/operator-command-center-v2';

function clearElement(element: HTMLElement): void {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function commandInput(): HTMLInputElement | null {
  return document.getElementById('command-palette-input') as HTMLInputElement | null;
}

function runCommandSearch(query: string): void {
  const input = commandInput();
  if (!input) return;
  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}

function ensurePanel(): HTMLElement | null {
  const dialog = document.getElementById('command-palette-dialog') as HTMLDialogElement | null;
  if (!dialog) return null;
  dialog.dataset.pass204OperatorCommandCenterV2 = 'true';

  let panel = dialog.querySelector<HTMLElement>('#operator-command-center-v2');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'operator-command-center-v2';
    panel.className = 'operator-command-center-v2';
    panel.setAttribute('aria-label', 'Operator Command Center v2 scope and command families');
    const search = dialog.querySelector<HTMLElement>('.command-search');
    if (search?.nextSibling) search.parentElement?.insertBefore(panel, search.nextSibling);
    else search?.parentElement?.appendChild(panel);
  }

  return panel;
}

function statusLabel(family: OperatorCommandCenterV2Family): string {
  if (family.enabled && family.status === 'ready') return 'Ready';
  if (family.status === 'needs-mission') return 'Needs mission';
  if (family.status === 'needs-evidence') return 'Needs evidence';
  return 'Reference-only';
}

function familyCard(family: OperatorCommandCenterV2Family): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'operator-command-family-card';
  card.dataset.commandFamily = family.id;
  card.dataset.commandStatus = family.status;
  card.disabled = false;
  card.addEventListener('click', () => runCommandSearch(family.searchHint));

  const top = document.createElement('span');
  top.className = 'operator-command-family-top';
  const title = document.createElement('strong');
  title.textContent = family.label;
  const status = document.createElement('em');
  status.textContent = statusLabel(family);
  top.append(title, status);

  const detail = document.createElement('span');
  detail.className = 'operator-command-family-detail';
  detail.textContent = family.disabledReason || family.examples.join(' · ');

  card.append(top, detail);
  return card;
}

function quickFilterButton(label: string, query: string): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'operator-command-quick-filter';
  button.textContent = label;
  button.addEventListener('click', () => runCommandSearch(query));
  return button;
}

function renderPanel(report: OperatorCommandCenterV2Report): void {
  const panel = ensurePanel();
  if (!panel) return;
  clearElement(panel);

  const header = document.createElement('header');
  header.className = 'operator-command-center-v2-header';
  const titleWrap = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'PASS204 · Ctrl+K Power Surface';
  const title = document.createElement('strong');
  title.textContent = 'Operator Command Center v2';
  titleWrap.append(eyebrow, title);
  const scope = document.createElement('span');
  scope.className = 'operator-command-target-scope';
  scope.textContent = report.summary;
  header.append(titleWrap, scope);

  const summary = document.createElement('p');
  summary.className = 'operator-command-family-summary';
  const readyCount = report.families.filter((family) => family.enabled && family.status === 'ready').length;
  summary.textContent = `${readyCount}/${report.families.length} command families ready · type to narrow results · disabled commands explain why`;

  const filters = document.createElement('div');
  filters.className = 'operator-command-quick-filters';
  for (const filter of report.quickFilters.slice(0, 6)) filters.appendChild(quickFilterButton(filter.label, filter.query));

  const details = document.createElement('details');
  details.className = 'operator-command-family-details';
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'Show command families';
  const grid = document.createElement('div');
  grid.className = 'operator-command-family-grid';
  for (const family of report.families) grid.appendChild(familyCard(family));
  details.append(detailsSummary, grid);

  const guardrail = document.createElement('p');
  guardrail.className = 'operator-command-guardrail';
  guardrail.textContent = 'Browser-side only · IT Docs/PSA writeback requires authorized server-side contracts.';

  panel.append(header, summary, filters, details, guardrail);
}

export function installOperatorCommandCenterV2(getMission: () => MissionState | undefined): { refresh: () => void } {
  const refresh = () => renderPanel(buildOperatorCommandCenterV2Report(getMission()));

  window.addEventListener('DOMContentLoaded', () => {
    refresh();
    const dialog = document.getElementById('command-palette-dialog');
    if (dialog) new MutationObserver(refresh).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const missionDialog = document.getElementById('mission-dialog');
    if (missionDialog) new MutationObserver(refresh).observe(missionDialog, { childList: true, subtree: true, attributes: true });
  });

  window.addEventListener('tahai-renderer-ready', refresh);
  window.setInterval(refresh, 2600);
  refresh();
  return { refresh };
}
