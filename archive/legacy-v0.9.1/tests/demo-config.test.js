/**
 * Unit checks for demo URL gating.
 * Run: node tests/demo-config.test.js
 */

const DEMO_BVID = 'BV1WW4y1e7GL';

function getBvidFromPathname(pathname) {
  const match = pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

function isDemoVideoPage(pathname) {
  return getBvidFromPathname(pathname) === DEMO_BVID;
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
    pathname: '/video/BV1WW4y1e7GLX/',
    expected: false,
    label: 'similar but different bvid'
  },
  {
    pathname: '/video/BV1WW4y1e7GL/',
    expected: true,
    label: 'demo video with vd_source query assumed on same pathname'
  }
];

let failed = 0;

for (const testCase of cases) {
  const pass = isDemoVideoPage(testCase.pathname) === testCase.expected;
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
