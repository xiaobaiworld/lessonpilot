/**
 * Unit checks for subtitle blocker timing and layout.
 * Run: node tests/subtitle-blocker.test.js
 */

function resolveMetric(value, base, min = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(min, Math.round(value));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
      const ratio = Number.parseFloat(trimmed) / 100;
      if (Number.isFinite(ratio)) {
        return Math.max(min, Math.round(base * ratio));
      }
    }

    if (trimmed.endsWith('px')) {
      const pixels = Number.parseFloat(trimmed);
      if (Number.isFinite(pixels)) {
        return Math.max(min, Math.round(pixels));
      }
    }
  }

  return min;
}

function findActiveBlocker(blockers, currentTime) {
  return blockers.find(
    (blocker) => currentTime >= blocker.start && currentTime < blocker.end
  );
}

function computeBarRect(videoRect, layout = {}) {
  const minHeight = layout.minHeight ?? 0;
  const height = resolveMetric(layout.height ?? '12%', videoRect.height, minHeight);
  const bottom = resolveMetric(layout.bottom ?? '8%', videoRect.height, 0);
  const left = resolveMetric(layout.left ?? '0%', videoRect.width, 0);
  const width = resolveMetric(layout.width ?? '100%', videoRect.width, 0);
  const top = videoRect.bottom - bottom - height;

  return {
    left: Math.round(videoRect.left + left),
    top: Math.round(top),
    width,
    height,
    background: layout.background ?? '#000000',
    opacity: layout.opacity ?? 0.96
  };
}

const blockers = [
  {
    id: 'demo-15-20',
    start: 15,
    end: 20,
    layout: {
      bottom: '8%',
      height: '12%',
      left: '0%',
      width: '100%',
      minHeight: 48
    }
  },
  {
    id: 'demo-40-45',
    start: 40,
    end: 45,
    layout: {
      bottom: '15%',
      height: 64,
      left: '10%',
      width: '80%'
    }
  }
];

const timeCases = [
  { time: 14.9, expectedId: undefined, label: 'before first range' },
  { time: 15, expectedId: 'demo-15-20', label: 'first range start' },
  { time: 19.9, expectedId: 'demo-15-20', label: 'inside first range' },
  { time: 20, expectedId: undefined, label: 'first range end exclusive' },
  { time: 42, expectedId: 'demo-40-45', label: 'second range active' }
];

let failed = 0;

for (const testCase of timeCases) {
  const active = findActiveBlocker(blockers, testCase.time);
  const pass = (active?.id ?? undefined) === testCase.expectedId;
  if (!pass) {
    failed += 1;
    console.error(`FAIL: ${testCase.label}`);
  } else {
    console.log(`PASS: ${testCase.label}`);
  }
}

const videoRect = { left: 100, top: 50, width: 800, height: 450, bottom: 500, right: 900 };
const defaultBar = computeBarRect(videoRect, blockers[0].layout);
if (defaultBar.height !== 54 || defaultBar.width !== 800 || defaultBar.left !== 100) {
  failed += 1;
  console.error('FAIL: default percent layout');
} else {
  console.log('PASS: default percent layout');
}

const customBar = computeBarRect(videoRect, blockers[1].layout);
if (customBar.height !== 64 || customBar.width !== 640 || customBar.left !== 180) {
  failed += 1;
  console.error('FAIL: custom px and percent layout');
} else {
  console.log('PASS: custom px and percent layout');
}

if (failed > 0) {
  process.exit(1);
}

console.log('All subtitle-blocker checks passed.');
