// 定位: 授权码控制器对空响应、畸形响应和消息超时的回归测试。
// 入口参数: 模拟的 runtime 下载函数和有效格式授权码。
// 返回参数: Node test 断言结果，确保所有异常消息都转为 EXTENSION_UNAVAILABLE。
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAccessCodeController
} = require('../src/content/access-code/access-panel.js');

const VALID_CODE = 'KM-ABCDE-FGHIJ-KLMNO-PQRST';

test('an empty runtime reply becomes a stable unavailable result', async () => {
  const controller = createAccessCodeController({
    download: async () => undefined,
    confirmReplace: () => true
  });

  assert.deepEqual(await controller.submit(VALID_CODE), {
    ok: false,
    error: 'EXTENSION_UNAVAILABLE'
  });
});

test('a non-object runtime reply becomes a stable unavailable result', async () => {
  const controller = createAccessCodeController({
    download: async () => 'unexpected response',
    confirmReplace: () => true
  });

  assert.deepEqual(await controller.submit(VALID_CODE), {
    ok: false,
    error: 'EXTENSION_UNAVAILABLE'
  });
});

test('a runtime reply that never arrives times out instead of leaving the form loading', async () => {
  const controller = createAccessCodeController({
    download: () => new Promise(() => {}),
    confirmReplace: () => true,
    timeoutMs: 5
  });

  assert.deepEqual(await controller.submit(VALID_CODE), {
    ok: false,
    error: 'EXTENSION_UNAVAILABLE'
  });
});
