/**
 * v1 Cross-Platform Contracts
 *
 * Authoritative sources:
 * - Course Package: schemas/course-package.schema.json
 * - Extension Messages: schemas/extension-messages.schema.json
 * - HTTP API: schemas/openapi.schema.json (code-generated from design doc 06)
 * - Extension Storage: schemas/extension-storage.schema.json
 *
 * Version manifest: versions.json
 * Version checker: check-versions.mjs
 * Dual-language validation: tools/contract-check.mjs
 *
 * This file is documentation index and type exports only.
 */

export type { VersionEntry, VersionSupport, SupportMatrixEntry } from './version-manifest';
export { VERSIONS } from './version-manifest';

