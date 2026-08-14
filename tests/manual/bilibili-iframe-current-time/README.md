# Bilibili iframe `currentTime` probe

This disposable MV3 extension checks whether `allFrames` injection can read
`document.querySelector('video').currentTime` inside the Bilibili player iframe.
It does not change the production LessonPilot extension.

## Run

1. From the repository root, run `python3 -m http.server 4173`.
2. In `chrome://extensions/`, enable Developer mode and load this directory as
   an unpacked extension.
3. Open `http://localhost:4173/teacher-web/`, wait for the embedded Bilibili
   player to load, start playback, and click the probe extension icon.
4. `YES` means at least one injected frame returned a finite `currentTime`;
   `NO` means injection ran but found no readable video; `ERR` means the
   injection itself failed.
5. Open this extension's service-worker console to inspect every frame URL and
   result. Seek the video and click again; a changed `currentTime` confirms the
   value is live rather than a one-off default.

Expected positive evidence is a child-frame row whose URL starts with
`https://player.bilibili.com/`, with `hasVideo: true` and a numeric
`currentTime`.

This does not make the iframe same-origin with the parent page. The parent page
still cannot read `iframe.contentWindow.document`; the extension is instead
injecting code directly into each permitted frame and reading that frame's own
document.
