/**
 * v1 Version Manifest
 *
 * Defines the supported versions across all contracts and build artifacts.
 * Each component declares its version independently; compatibility is checked
 * before switching production code.
 *
 * Version schema: <major>.<minor>.<patch>
 * - Major: breaking contract changes (requires binary incompatibility handling)
 * - Minor: backwards-compatible additions
 * - Patch: bug fixes
 */

export interface VersionEntry {
  component: string;
  version: string;
  releaseDate?: string; // ISO 8601
  status: 'development' | 'stable' | 'deprecated';
  notes?: string;
}

export interface VersionSupport {
  schemaVersion: '1.0';
  timestamp: string; // ISO 8601
  components: VersionEntry[];
  supportMatrix: SupportMatrixEntry[];
}

export interface SupportMatrixEntry {
  release: string; // e.g., 'v1.0.0'
  httpApi: string;
  coursePackage: string;
  extensionMessages: string;
  extensionStorage: string;
  webBuild: string;
  extensionBuild: string;
}

// Typed compatibility view. The machine-readable source is versions.json.
export const VERSIONS: VersionSupport = {
  schemaVersion: '1.0',
  timestamp: new Date().toISOString(),
  components: [
    {
      component: 'httpApi',
      version: '2.2.0',
      status: 'development',
      notes: 'Code-generated from design/v1/06-interface-contracts.md'
    },
    {
      component: 'coursePackage',
      version: '3.2.0',
      status: 'development',
      notes: 'Portable structured node documents and asset manifest; Bilibili remains playback-only'
    },
    {
      component: 'extensionMessages',
      version: '2.2.0',
      status: 'development',
      notes: 'Extension-to-page messaging contract; replaces localStorage passthrough'
    },
    {
      component: 'extensionStorage',
      version: '2.3.0',
      status: 'development',
      notes: 'Extension local storage schema; stage 0B task'
    },
    {
      component: 'analyticsEvent',
      version: '1.0.0',
      status: 'development',
      notes: 'Low-cardinality product analytics envelope; no student remote learning records'
    },
    {
      component: 'webBuild',
      version: '1.0.0',
      status: 'development',
      notes: 'Teacher and admin web applications; stage 3'
    },
    {
      component: 'extensionBuild',
      version: '1.0.0',
      status: 'development',
      notes: 'Student extension; stage 4'
    }
  ],
  supportMatrix: [
    {
      release: 'v1.0.0',
      httpApi: '2.2.0',
      coursePackage: '3.2.0',
      extensionMessages: '2.2.0',
      extensionStorage: '2.3.0',
      webBuild: '1.0.0',
      extensionBuild: '1.0.0'
    }
  ]
};
