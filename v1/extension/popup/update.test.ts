import { describe, expect, it, vi } from 'vitest';
import { requestPluginDownload } from './update';

describe('学生插件在线更新', () => {
  it('请求下载 V1 兼容包并返回下载编号', async () => {
    const download = vi.fn((_options, callback) => callback(42));

    await expect(
      requestPluginDownload(
        download,
        () => undefined,
        'https://knownmap.com/downloads/student-plugin/knownmapplugin.zip'
      )
    ).resolves.toBe(42);

    expect(download).toHaveBeenCalledWith(
      {
        url: 'https://knownmap.com/downloads/student-plugin/knownmapplugin.zip',
        filename: 'knownmapplugin.zip',
        saveAs: true,
      },
      expect.any(Function)
    );
  });

  it('把 Chrome 下载错误转成可显示的失败', async () => {
    const download = vi.fn((_options, callback) => callback(undefined));

    await expect(
      requestPluginDownload(
        download,
        () => '网络不可用',
        'https://knownmap.com/downloads/student-plugin/knownmapplugin.zip'
      )
    ).rejects.toThrow('网络不可用');
  });
});
