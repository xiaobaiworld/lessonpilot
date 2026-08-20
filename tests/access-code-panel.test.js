const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeAccessCode,
  buildBilibiliCourseUrl,
  buildCourseRecord,
  createAccessCodeController
} = require('../src/content/access-code/access-panel.js');

test('normalizes an access code without retaining or logging the original value', () => {
  assert.equal(
    normalizeAccessCode('  km-abcde-fghij-klmno-pqrst  '),
    'KM-ABCDE-FGHIJ-KLMNO-PQRST'
  );
});

test('builds a fixed Bilibili URL only from a validated course video reference', () => {
  assert.equal(
    buildBilibiliCourseUrl({ platform: 'bilibili', videoId: 'BV1WW4y1e7GL' }),
    'https://www.bilibili.com/video/BV1WW4y1e7GL/'
  );
  assert.equal(buildBilibiliCourseUrl({ platform: 'other', videoId: 'BV1WW4y1e7GL' }), null);
  assert.equal(buildBilibiliCourseUrl({ platform: 'bilibili', videoId: 'javascript:alert(1)' }), null);
});

test('builds one visible course record from an installed course', () => {
  assert.deepEqual(buildCourseRecord({
    courseId: 'bilibili:BV1WW4y1e7GL',
    videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' }
  }), {
    courseId: 'bilibili:BV1WW4y1e7GL',
    label: 'B 站课程 · BV1WW4y1e7GL',
    url: 'https://www.bilibili.com/video/BV1WW4y1e7GL/'
  });
  assert.equal(buildCourseRecord(null), null);
  assert.equal(buildCourseRecord({
    courseId: 'invalid',
    videoRef: { platform: 'other', videoId: 'BV1WW4y1e7GL' }
  }), null);

  const fs = require('node:fs');
  const source = fs.readFileSync('src/content/access-code/access-panel.js', 'utf8');

  assert.match(source, /class="lessonpilot-course-record" hidden/);
  assert.match(source, /class="lessonpilot-course-url"/);
  assert.match(source, /this\.courseRecord\.hidden = !record/);
  assert.match(source, /this\.courseEmpty\.hidden = Boolean\(record\)/);
});

test('download request contains the access code but never a client-selected course id', async () => {
  const calls = [];
  const controller = createAccessCodeController({
    download: async (payload) => {
      calls.push(payload);
      return { ok: true, status: 'installed', course: { courseId: 'bilibili:BV1WW4y1e7GL' } };
    },
    confirmReplace: () => true
  });

  await controller.submit('  km-abcde-fghij-klmno-pqrst  ');

  assert.deepEqual(calls, [{ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' }]);
  assert.equal(Object.hasOwn(calls[0], 'courseId'), false);
});

test('different-course replacement is retried only after explicit confirmation', async () => {
  const calls = [];
  const controller = createAccessCodeController({
    download: async (payload) => {
      calls.push(payload);
      if (calls.length === 1) {
        return {
          ok: false,
          error: 'COURSE_REPLACEMENT_REQUIRED',
          currentCourseId: 'bilibili:BV-old',
          incomingCourseId: 'bilibili:BV-new'
        };
      }
      return { ok: true, status: 'replaced', course: { courseId: 'bilibili:BV-new' } };
    },
    confirmReplace: () => true
  });

  const result = await controller.submit('KM-ABCDE-FGHIJ-KLMNO-PQRST');

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    { authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' },
    {
      authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST',
      replaceCourse: true,
      expectedCourseId: 'bilibili:BV-old'
    }
  ]);
});

test('cancelling replacement preserves the first refusal and makes no second request', async () => {
  let callCount = 0;
  const controller = createAccessCodeController({
    download: async () => {
      callCount += 1;
      return {
        ok: false,
        error: 'COURSE_REPLACEMENT_REQUIRED',
        currentCourseId: 'bilibili:BV-old',
        incomingCourseId: 'bilibili:BV-new'
      };
    },
    confirmReplace: () => false
  });

  const result = await controller.submit('KM-ABCDE-FGHIJ-KLMNO-PQRST');

  assert.equal(result.error, 'COURSE_REPLACEMENT_CANCELLED');
  assert.equal(callCount, 1);
});

test('runtime rejection becomes a stable unavailable error instead of escaping the form handler', async () => {
  const controller = createAccessCodeController({
    download: async () => { throw new Error('extension context invalidated'); },
    confirmReplace: () => true
  });

  const result = await controller.submit('KM-ABCDE-FGHIJ-KLMNO-PQRST');

  assert.deepEqual(result, { ok: false, error: 'EXTENSION_UNAVAILABLE' });
});

test('manifest wires the student modules and grants only the fixed local API origin', () => {
  const fs = require('node:fs');
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'));
  const bilibili = manifest.content_scripts.find((entry) => entry.matches.includes('https://www.bilibili.com/video/*'));

  assert.ok(bilibili.js.includes('content/access-code/access-panel.js'));
  assert.ok(bilibili.js.includes('content/course-runtime.js'));
  assert.ok(bilibili.js.includes('content/index.js'));
  assert.ok(bilibili.css.includes('content/access-code/access-panel.css'));
  assert.ok(manifest.host_permissions.includes('http://127.0.0.1:8000/*'));
  assert.equal(manifest.host_permissions.some((origin) => origin === 'http://*/*'), false);
  assert.equal(manifest.host_permissions.some((origin) => origin === '<all_urls>'), false);

  const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');
  const contentEntry = fs.readFileSync('src/content/index.js', 'utf8');
  const mascot = fs.readFileSync('src/content/mascot/mascot.js', 'utf8');
  const player = fs.readFileSync('src/content/video/bili-player.js', 'utf8');
  assert.match(worker, /GET_INSTALLED_STUDENT_COURSE/);
  assert.match(worker, /DOWNLOAD_STUDENT_COURSE/);
  assert.match(worker, /RECORD_STUDENT_NODE_ATTEMPT/);
  assert.match(contentEntry, /timeline\.complete\(node\.id\)/);
  assert.match(contentEntry, /player\.play\(\)/);
  assert.match(contentEntry, /completedNodeIds/);
  assert.match(mascot, /showNode\(node, onSubmit, onContinue\)/);
  assert.match(player, /async function play\(\)/);
});
