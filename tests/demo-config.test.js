/**
 * Unit checks for demo URL gating.
 * Run: node tests/demo-config.test.js
 */

const DEMO_BVID = 'BV1WW4y1e7GL';

function isDemoVideoPage(pathname) {
  return pathname.includes(`/video/${DEMO_BVID}`);
}

const cases = [
  {
    pathname: '/video/BV1WW4y1e7GL/',
    expected: true,
    label: 'demo video with trailing slash'
  },
  {
    pathname: '/video/BV1WW4y1e7GL',
    expected: true,
    label: 'demo video without trailing slash'
  },
  {
    pathname: '/video/BV1abc123xyz/',
    expected: false,
    label: 'other bilibili video'
  },
  {
    pathname: '/video/BV1WW4y1e7GL/',
    search: '?vd_source=e7c7f9591fda9ac995d213b1cf10137c',
    expected: true,
    label: 'demo video with vd_source query'
  }
];

let failed = 0;

for (const testCase of cases) {
  const pathname = testCase.pathname;
  const pass = isDemoVideoPage(pathname) === testCase.expected;
  if (!pass) {
    failed += 1;
    console.error(`FAIL: ${testCase.label}`);
  } else {
    console.log(`PASS: ${testCase.label}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('All demo-config checks passed.');
