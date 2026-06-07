export function getReleaseBlockersContract(pkg) {
  const direct = String(pkg?.scripts?.['verify:release-blockers'] || '');
  const legacy = String(
    pkg?.scripts?.['verify:release-blockers:contract']
    || pkg?.scripts?.['verify:release-blockers:legacy']
    || '',
  );

  if (direct.includes('run-release-blockers.mjs') && legacy) {
    return legacy;
  }

  return direct;
}
