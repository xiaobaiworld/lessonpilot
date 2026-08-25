const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeAccessCode,
  buildBilibiliCourseUrl,
  buildCourseRecord,
  buildCourseRecords,
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

test('course list uses visible v2 course records', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync('src/content/access-code/access-panel.js', 'utf8');

  assert.match(source, /class="lessonpilot-course-record" hidden/);
  assert.match(source, /class="lessonpilot-course-url"/);
  assert.match(source, /this\.courseRecord\.hidden = !record/);
  assert.match(source, /this\.courseEmpty\.hidden = Boolean\(record\)/);
});

test('multi-lesson course records display the course name instead of an internal id', () => {
  assert.deepEqual(buildCourseRecord({
    courseId: 'd2045bc7-4ba2-4aff-8f27-3bc336be4f55',
    title: '英语面试表达：把答案说得具体',
    lessons: [{
      lessonId: 'a1cc724e-19f4-4f12-9377-8ff71753e8c4',
      title: '第一课',
      videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' }
    }]
  }), {
    courseId: 'd2045bc7-4ba2-4aff-8f27-3bc336be4f55',
    lessonId: 'a1cc724e-19f4-4f12-9377-8ff71753e8c4',
    label: '英语面试表达：把答案说得具体',
    url: 'https://www.bilibili.com/video/BV1WW4y1e7GL/'
  });
  assert.equal(buildCourseRecord(null), null);
});

test('builds one visible link for every lesson in a course', () => {
  const records = buildCourseRecords([{
    course: {
      courseId: 'd2045bc7-4ba2-4aff-8f27-3bc336be4f55',
      title: '英语面试表达',
      lessons: [{
        lessonId: 'a1cc724e-19f4-4f12-9377-8ff71753e8c4',
        title: '第一课',
        videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' }
      }, {
        lessonId: '0eb6fdbf-0ba6-4a1c-9fc4-96fe637129a2',
        title: '第二课',
        videoRef: { platform: 'bilibili', videoId: 'BV1xx411c7mD' }
      }]
    }
  }]);

  assert.deepEqual(records.map((record) => record.label), [
    '英语面试表达 · 第一课',
    '英语面试表达 · 第二课'
  ]);
});

test('download request contains the access code but never a client-selected course id', async () => {
  const calls = [];
  const controller = createAccessCodeController({
    download: async (payload) => {
      calls.push(payload);
      return { ok: true, status: 'installed', courses: [] };
    }
  });

  await controller.submit('  km-abcde-fghij-klmno-pqrst  ');

  assert.deepEqual(calls, [{ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' }]);
  assert.equal(Object.hasOwn(calls[0], 'courseId'), false);
});

test('runtime rejection becomes a stable unavailable error instead of escaping the form handler', async () => {
  const controller = createAccessCodeController({
    download: async () => { throw new Error('extension context invalidated'); }
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
  const mascotCss = fs.readFileSync('src/content/mascot/mascot.css', 'utf8');
  const player = fs.readFileSync('src/content/video/bili-player.js', 'utf8');
  assert.match(worker, /GET_INSTALLED_STUDENT_COURSES/);
  assert.match(worker, /DOWNLOAD_STUDENT_COURSE/);
  assert.match(worker, /RECORD_STUDENT_NODE_ATTEMPT/);
  assert.match(contentEntry, /timeline\.complete\(node\.id\)/);
  assert.match(contentEntry, /player\.play\(\)/);
  assert.match(contentEntry, /completedNodeIds/);
  assert.match(mascot, /showNode\(node, onSubmit, onContinue\)/);
  assert.match(player, /async function play\(\)/);
  assert.match(contentEntry, /player\.pause\(\)/);
  assert.match(mascot, /node\.interaction === 'notice' \? '确认并继续'/);
  assert.match(mascotCss, /width: min\(520px, calc\(100vw - 32px\)\)/);
  assert.equal(manifest.version, '0.9.2');

  const v1Targets = fs.readFileSync('v1/extension/manifest/targets.ts', 'utf8');
  assert.match(v1Targets, /export const EXTENSION_VERSION = '1\.0\.1'/);
  assert.match(mascot, /lessonpilot:video-mode-toggle/);
  assert.match(mascot, /确认并继续/);
  assert.match(mascot, /setVideoMode/);
  assert.match(mascotCss, /lessonpilot-mascot-mode-btn/);
});
