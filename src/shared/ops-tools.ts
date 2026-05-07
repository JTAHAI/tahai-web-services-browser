export type OpsToolKind = 'json-format' | 'yaml-clean' | 'jwt-inspect' | 'cidr-summary' | 'curl-builder';

export type OpsToolResult = {
  ok: boolean;
  tool: OpsToolKind;
  title: string;
  markdown: string;
  warnings: string[];
};

function text(value: unknown, max = 120000): string {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max);
}

function md(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function b64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function formatJsonTool(input: unknown): OpsToolResult {
  try {
    const parsed = JSON.parse(text(input));
    const formatted = JSON.stringify(parsed, null, 2);
    return { ok: true, tool: 'json-format', title: 'JSON formatter', warnings: [], markdown: `# JSON Formatter\n\n\`\`\`json\n${formatted}\n\`\`\`\n` };
  } catch (error) {
    return { ok: false, tool: 'json-format', title: 'JSON formatter', warnings: ['Invalid JSON input.'], markdown: `# JSON Formatter\n\nInvalid JSON: ${md(error instanceof Error ? error.message : error)}\n` };
  }
}

export function cleanYamlTool(input: unknown): OpsToolResult {
  const lines = text(input).split(/\r?\n/).map((line) => line.replace(/[\t ]+$/g, '')).filter((line, index, all) => line.trim() || all[index - 1]?.trim());
  return { ok: true, tool: 'yaml-clean', title: 'YAML cleaner', warnings: ['Formatting only; no schema validation performed.'], markdown: `# YAML Cleaner\n\n\`\`\`yaml\n${lines.join('\n').trim()}\n\`\`\`\n` };
}

export function inspectJwtTool(input: unknown): OpsToolResult {
  const raw = text(input, 10000).trim();
  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false, tool: 'jwt-inspect', title: 'JWT inspector', warnings: ['JWT must have three dot-separated segments.'], markdown: '# JWT Inspector\n\nInvalid JWT shape.\n' };
  try {
    const header = JSON.parse(b64UrlDecode(parts[0]));
    const payload = JSON.parse(b64UrlDecode(parts[1]));
    const claims = Object.entries(payload).filter(([key]) => ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti', 'scope', 'scp'].includes(key)).map(([key, value]) => `| ${md(key)} | ${md(JSON.stringify(value))} |`).join('\n');
    return {
      ok: true,
      tool: 'jwt-inspect',
      title: 'JWT inspector',
      warnings: ['Signature is not verified. Do not paste production tokens into tickets or handoffs.'],
      markdown: `# JWT Inspector\n\n> Header and claim preview only. Signature is not verified.\n\n## Header\n\n\`\`\`json\n${JSON.stringify(header, null, 2)}\n\`\`\`\n\n## Selected claims\n\n| Claim | Value |\n| --- | --- |\n${claims || '| _none_ |  |'}\n`
    };
  } catch (error) {
    return { ok: false, tool: 'jwt-inspect', title: 'JWT inspector', warnings: ['Unable to decode JWT.'], markdown: `# JWT Inspector\n\nDecode failed: ${md(error instanceof Error ? error.message : error)}\n` };
  }
}

function ipToInt(ip: string): number | undefined {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function intToIp(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

export function cidrSummaryTool(input: unknown): OpsToolResult {
  const raw = text(input, 200).trim();
  const match = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/);
  if (!match) return { ok: false, tool: 'cidr-summary', title: 'CIDR summary', warnings: ['IPv4 CIDR expected, for example 10.0.0.0/24.'], markdown: '# CIDR Summary\n\nInvalid CIDR.\n' };
  const ip = ipToInt(match[1]);
  const prefix = Number(match[2]);
  if (ip === undefined) return { ok: false, tool: 'cidr-summary', title: 'CIDR summary', warnings: ['Invalid IPv4 address.'], markdown: '# CIDR Summary\n\nInvalid IPv4 address.\n' };
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = ip & mask;
  const broadcast = network | (~mask >>> 0);
  const usable = prefix >= 31 ? 0 : Math.max(0, broadcast - network - 1);
  return { ok: true, tool: 'cidr-summary', title: 'CIDR summary', warnings: [], markdown: `# CIDR Summary\n\n| Field | Value |\n| --- | --- |\n| CIDR | ${md(raw)} |\n| Network | ${intToIp(network)} |\n| Broadcast | ${intToIp(broadcast)} |\n| Netmask | ${intToIp(mask)} |\n| Usable hosts | ${usable} |\n` };
}

export function curlBuilderTool(input: unknown, urlInput?: unknown): OpsToolResult {
  const body = text(input, 50000).trim();
  const url = text(urlInput || '', 2048).trim() || 'https://example.com';
  let parsed: URL;
  try { parsed = new URL(url); } catch { parsed = new URL('https://example.com'); }
  const command = body
    ? `curl --fail --show-error --silent --request POST --header 'Content-Type: application/json' --data '${body.replace(/'/g, `'\\''`)}' '${parsed.toString()}'`
    : `curl --fail --show-error --silent '${parsed.toString()}'`;
  return { ok: true, tool: 'curl-builder', title: 'curl builder', warnings: ['Review before running. Do not include bearer tokens, cookies, or secrets in handoff commands.'], markdown: `# curl Builder\n\n\`\`\`bash\n${command}\n\`\`\`\n` };
}

export function runOpsTool(kind: OpsToolKind, input: unknown, targetUrl?: unknown): OpsToolResult {
  if (kind === 'json-format') return formatJsonTool(input);
  if (kind === 'yaml-clean') return cleanYamlTool(input);
  if (kind === 'jwt-inspect') return inspectJwtTool(input);
  if (kind === 'cidr-summary') return cidrSummaryTool(input);
  if (kind === 'curl-builder') return curlBuilderTool(input, targetUrl);
  return { ok: false, tool: kind, title: 'Unknown OpsTool', warnings: ['Tool not recognized.'], markdown: '# Unknown OpsTool\n' };
}
