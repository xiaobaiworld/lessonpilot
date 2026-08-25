chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    const frames = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'ISOLATED',
      func: () => {
        const video = document.querySelector('video');
        return {
          url: location.href,
          frame: window === window.top ? 'top' : 'child',
          hasVideo: Boolean(video),
          currentTime: video?.currentTime ?? null,
          paused: video?.paused ?? null,
          readyState: video?.readyState ?? null
        };
      }
    });

    const rows = frames.map(({ frameId, result }) => ({ frameId, ...result }));
    const hit = rows.find(
      ({ hasVideo, currentTime }) => hasVideo && Number.isFinite(currentTime)
    );

    console.table(rows);
    console.log(hit ? 'PASS: readable video found' : 'FAIL: no readable video', hit ?? '');
    await chrome.action.setBadgeBackgroundColor({
      tabId: tab.id,
      color: hit ? '#15803d' : '#b91c1c'
    });
    await chrome.action.setBadgeText({ tabId: tab.id, text: hit ? 'YES' : 'NO' });
  } catch (error) {
    console.error('Probe failed:', error);
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#b91c1c' });
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'ERR' });
  }
});
