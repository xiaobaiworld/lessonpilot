# V1.0.5 Popup Parity Design

## Goal

Restore the user-visible student plugin entry points that existed in the 0.9.2
popup while keeping the V1 course library and progress controls.

## Scope

The V1.0.5 popup will contain:

- KnownMap student branding and course authorization input.
- "我的课程" with the V1 course list, progress, reset, and remove actions.
- A trial-course link.
- A teacher-login link pointing to the V1 teacher app at `/teacher/`.
- An online update action that downloads the current V1 compatibility package
  from `/downloads/student-plugin/knownmapplugin.zip`.

The old popup HTML, old storage keys, old background message names, and old
runtime will not be copied back into the V1 bundle. The V1 background worker
remains the only owner of course storage and course redemption.

## Architecture

The popup keeps its current TypeScript renderer and adds a small static
navigation/update section. Trial and teacher links are built from the compile
target's API origin so local testing points at the local teacher app while the
production package points at `https://knownmap.com`.

The update button uses `chrome.downloads.download`, so the V1 manifest gains
only the `downloads` permission required by this restored 0.9.2 behavior. The
download URL is target-derived and is not read from runtime storage or user
input.

## Acceptance Criteria

1. Both local and production manifests report extension version `1.0.5`.
2. The built popup includes visible trial and teacher-login links.
3. The teacher link resolves to `/teacher/` for production and the local
   teacher development origin for local testing.
4. Clicking update requests `knownmapplugin.zip` and reports success/failure.
5. Existing V1 library, redeem, reset, remove, and progress behavior remains.
6. Targeted V1 tests and both extension builds pass.
