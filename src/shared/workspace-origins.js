/**
 * The exact workspace locations allowed to reach the extension (A-BRIDGE-02).
 *
 * This list is the whole trust boundary for the bridge, so it is defined once and
 * consumed by the content script, the background and the tests. Adding an entry
 * here grants a page the ability to read and replace the teacher's stored course.
 *
 * Why origin and pathname are checked in JavaScript rather than left to the
 * manifest: a Chrome match pattern cannot pin a port. `http://localhost/...`
 * matches localhost on *any* port, so any local dev server the teacher happens to
 * be running would be inside the boundary. The manifest therefore injects on a
 * coarse pattern and the content script asserts the exact origin and pathname
 * before registering a single listener.
 *
 * Origin and pathname are paired, not two independent lists: the public site
 * serves the workspace under /lessonpilot/ (a GitHub Pages project path) while the
 * local server serves it at the repository root. Checking the two halves
 * separately would accept combinations that do not exist.
 */
(function initWorkspaceOrigins(global, factory) {
  const api = factory();
  global.LessonPilotWorkspaceOrigins = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createWorkspaceOrigins() {
  /**
   * Each entry is one deployable workspace location.
   * `origin` must equal `location.origin` exactly; `pathname` must equal
   * `location.pathname` exactly. No prefixes, no wildcards, no trailing-slash
   * tolerance — D-007 forbids adding vague sources when deployment is uncertain.
   */
  const ALLOWED_WORKSPACES = [
    { label: 'public', origin: 'https://xiaobaiworld.github.io', pathname: '/lessonpilot/teacher-web/workspace.html' },
    { label: 'local', origin: 'http://localhost:4173', pathname: '/teacher-web/workspace.html' }
  ];

  function findWorkspace(origin, pathname) {
    if (typeof origin !== 'string' || typeof pathname !== 'string') return null;
    return ALLOWED_WORKSPACES.find(
      (entry) => entry.origin === origin && entry.pathname === pathname
    ) ?? null;
  }

  /** True only when origin and pathname belong to the same allowed entry. */
  function isAllowedWorkspace(origin, pathname) {
    return findWorkspace(origin, pathname) !== null;
  }

  function isAllowedOrigin(origin) {
    if (typeof origin !== 'string') return false;
    return ALLOWED_WORKSPACES.some((entry) => entry.origin === origin);
  }

  /** Whether this pathname is the workspace path for this specific origin. */
  function isAllowedPathname(origin, pathname) {
    return findWorkspace(origin, pathname) !== null;
  }

  return { ALLOWED_WORKSPACES, findWorkspace, isAllowedWorkspace, isAllowedOrigin, isAllowedPathname };
});
