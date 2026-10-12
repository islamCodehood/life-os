import type { MilestoneKey } from './world';
export type WorldRegion =
  'HOME' | 'PATH' | 'BRIDGE' | 'FAMILY_TREE' | 'GARDEN' | 'LIBRARY' | 'HARBOR' | 'OBSERVATORY';
export interface SemanticIslandRegion {
  region: WorldRegion;
  semanticKey: MilestoneKey | null;
  cx: number;
  cy: number;
  labelKey: WorldRegion;
  visualKey: string;
}
export const islandRegions: readonly SemanticIslandRegion[] = [
  { region: 'HOME', semanticKey: null, cx: 188, cy: 240, labelKey: 'HOME', visualKey: 'home' },
  {
    region: 'PATH',
    semanticKey: 'HOME_PATH',
    cx: 307,
    cy: 269,
    labelKey: 'PATH',
    visualKey: 'path',
  },
  {
    region: 'BRIDGE',
    semanticKey: 'BRIDGE_READY',
    cx: 413,
    cy: 234,
    labelKey: 'BRIDGE',
    visualKey: 'bridge',
  },
  {
    region: 'FAMILY_TREE',
    semanticKey: 'FAMILY_TREE',
    cx: 528,
    cy: 234,
    labelKey: 'FAMILY_TREE',
    visualKey: 'family-tree',
  },
  {
    region: 'GARDEN',
    semanticKey: 'GIVING_GARDEN',
    cx: 216,
    cy: 357,
    labelKey: 'GARDEN',
    visualKey: 'garden',
  },
  {
    region: 'LIBRARY',
    semanticKey: 'LIBRARY_OPEN',
    cx: 306,
    cy: 142,
    labelKey: 'LIBRARY',
    visualKey: 'library',
  },
  {
    region: 'HARBOR',
    semanticKey: null,
    cx: 484,
    cy: 348,
    labelKey: 'HARBOR',
    visualKey: 'harbor',
  },
  {
    region: 'OBSERVATORY',
    semanticKey: 'OBSERVATORY_LIT',
    cx: 557,
    cy: 132,
    labelKey: 'OBSERVATORY',
    visualKey: 'observatory',
  },
] as const;
export const milestoneRegions: Readonly<Record<MilestoneKey, WorldRegion>> = {
  HOME_PATH: 'PATH',
  BRIDGE_READY: 'BRIDGE',
  LIBRARY_OPEN: 'LIBRARY',
  OBSERVATORY_LIT: 'OBSERVATORY',
  GIVING_GARDEN: 'GARDEN',
  FAMILY_TREE: 'FAMILY_TREE',
  FAMILY_GARDEN: 'FAMILY_TREE',
};
export function islandManifest(themeKey: string) {
  // Theme is a presentation choice only. Unknown themes safely use the island manifest;
  // stored milestones must never reference SVG filenames, positions, or theme-specific assets.
  return { theme: themeKey === 'island' ? 'island' : 'island', regions: islandRegions };
}
