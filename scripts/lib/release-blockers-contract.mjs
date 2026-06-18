function normalizeContract(value) {
  return String(value || '').trim();
}

function combineContracts(...contracts) {
  const unique = [];
  for (const contract of contracts.map(normalizeContract).filter(Boolean)) {
    if (!unique.includes(contract)) unique.push(contract);
  }
  return unique.join(' && ');
}

export function getDirectReleaseBlockersCommand(pkg) {
  return normalizeContract(pkg?.scripts?.['verify:release-blockers']);
}

export function getActiveReleaseBlockersContract(pkg) {
  const direct = getDirectReleaseBlockersCommand(pkg);
  const contract = normalizeContract(pkg?.scripts?.['verify:release-blockers:contract']);
  const legacy = normalizeContract(pkg?.scripts?.['verify:release-blockers:legacy']);
  if (direct.includes('run-release-blockers.mjs')) {
    return contract || legacy;
  }
  return direct;
}

export function getLegacyReleaseBlockersContract(pkg) {
  return normalizeContract(pkg?.scripts?.['verify:release-blockers:legacy']);
}

export function getReleaseBlockersContract(pkg) {
  const direct = getDirectReleaseBlockersCommand(pkg);
  if (!direct.includes('run-release-blockers.mjs')) {
    return direct;
  }

  return combineContracts(
    getLegacyReleaseBlockersContract(pkg),
    getActiveReleaseBlockersContract(pkg),
  );
}
