export const RENDERER_MODULARIZATION_PASS = 'PASS161' as const;
export const RENDERER_MODULARIZATION_CONTRACT_ID = 'enterprise-renderer-modularization-v1' as const;
export const RENDERER_MODULARIZATION_SCHEMA_VERSION = 1 as const;

export type RendererModuleBoundary = {
  id: string;
  path: string;
  owner: 'renderer' | 'shared';
  owns: string[];
  forbidden: string[];
};

export const PASS161_RENDERER_MODULE_BOUNDARIES: RendererModuleBoundary[] = [
  {
    id: 'renderer-shell-lifecycle',
    path: 'src/renderer/renderer-shell-lifecycle.ts',
    owner: 'renderer',
    owns: ['boot diagnostics', 'renderer ready marker', 'fallback browser config', 'preload config timeout guard'],
    forbidden: ['raw ipcRenderer', 'Node filesystem access', 'webview privilege changes', 'PSA direct fetch']
  },
  {
    id: 'mission-model',
    path: 'src/renderer/mission-model.ts',
    owner: 'renderer',
    owns: ['mission model projection', 'runbook creation helpers', 'layout labels', 'recipe evidence helpers'],
    forbidden: ['DOM writes', 'IPC calls', 'webview creation', 'secret storage']
  },
  {
    id: 'responsive-toolbar',
    path: 'src/renderer/responsive-toolbar.ts',
    owner: 'renderer',
    owns: ['toolbar overflow measurement', 'compact command routing', 'resize reaction'],
    forbidden: ['mission persistence', 'webview preferences', 'secret handling', 'filesystem paths']
  },
  {
    id: 'site-view-mission-rail',
    path: 'src/renderer/site-view-mission-rail.ts',
    owner: 'renderer',
    owns: ['site-view mission rail rendering', 'pane state mirroring', 'mission rail commands'],
    forbidden: ['main-process policy decisions', 'privileged IPC exposure', 'direct external open']
  }
];

export function rendererModularizationSummary(): string {
  return `${RENDERER_MODULARIZATION_PASS} ${RENDERER_MODULARIZATION_CONTRACT_ID}: modules=${PASS161_RENDERER_MODULE_BOUNDARIES.length}; app.ts remains orchestration-only target; lifecycle extracted=true`;
}
