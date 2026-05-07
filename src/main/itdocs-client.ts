import { net } from 'electron';
import {
  ITDOCS_DEFAULT_ORIGIN,
  itDocsCapabilityMarkdown,
  localOnlyItDocsCapabilities,
  normalizeItDocsOrigin,
  sanitizeItDocsCapabilities,
  type ItDocsMissionCapabilities
} from '../shared/itdocs-contract';

const ITDOCS_CAPABILITIES_PATH = '/api/browser/mission-capabilities';
const ITDOCS_CAPABILITY_TIMEOUT_MS = 6500;

function capabilityUrl(originInput?: string): string {
  const origin = normalizeItDocsOrigin(originInput || process.env.TAHAI_ITDOCS_ORIGIN || ITDOCS_DEFAULT_ORIGIN);
  return `${origin}${ITDOCS_CAPABILITIES_PATH}`;
}

export function itDocsHomeUrl(originInput?: string): string {
  return normalizeItDocsOrigin(originInput || process.env.TAHAI_ITDOCS_ORIGIN || ITDOCS_DEFAULT_ORIGIN);
}

export function itDocsCapabilitiesMarkdown(capabilities: ItDocsMissionCapabilities): string {
  return itDocsCapabilityMarkdown(capabilities);
}

export function getItDocsMissionCapabilities(originInput?: string): Promise<ItDocsMissionCapabilities> {
  const url = capabilityUrl(originInput);
  const origin = itDocsHomeUrl(originInput);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (capabilities: ItDocsMissionCapabilities) => {
      if (settled) return;
      settled = true;
      resolve(capabilities);
    };
    const request = net.request({ method: 'GET', url });
    const timeout = setTimeout(() => {
      request.abort();
      finish({
        ...localOnlyItDocsCapabilities(origin, 'IT Docs capability check timed out. Local-only mission work remains available.'),
        ok: false,
        state: 'offline',
        disabledReason: 'Could not reach IT Docs capability endpoint before timeout.'
      });
    }, ITDOCS_CAPABILITY_TIMEOUT_MS);

    request.setHeader('Accept', 'application/json');
    request.on('response', (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk.toString('utf8');
        if (body.length > 48 * 1024) request.abort();
      });
      response.on('end', () => {
        clearTimeout(timeout);
        if (response.statusCode === 401 || response.statusCode === 403) {
          finish({
            ...localOnlyItDocsCapabilities(origin, 'Sign in to TAHAI IT Docs to link this mission.'),
            ok: true,
            state: response.statusCode === 403 ? 'permission-denied' : 'not-signed-in',
            disabledReason: response.statusCode === 403 ? 'IT Docs did not authorize this browser session.' : 'No signed-in IT Docs session was available to the browser.'
          });
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          finish({
            ...localOnlyItDocsCapabilities(origin, `IT Docs capability endpoint returned HTTP ${response.statusCode}.`),
            ok: false,
            state: 'contract-error',
            disabledReason: 'IT Docs did not return a successful browser mission-capabilities response.'
          });
          return;
        }
        try {
          finish(sanitizeItDocsCapabilities(JSON.parse(body || '{}'), origin));
        } catch {
          finish({
            ...localOnlyItDocsCapabilities(origin, 'IT Docs capability response was not valid JSON.'),
            ok: false,
            state: 'contract-error',
            disabledReason: 'The browser only accepts the documented JSON capability contract.'
          });
        }
      });
    });
    request.on('error', (error) => {
      clearTimeout(timeout);
      finish({
        ...localOnlyItDocsCapabilities(origin, 'IT Docs capability check failed. Local-only mission work remains available.'),
        ok: false,
        state: 'offline',
        disabledReason: String(error?.message || 'IT Docs endpoint unavailable.').slice(0, 220)
      });
    });
    request.end();
  });
}
