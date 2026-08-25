export interface DownloadOptions {
  url: string;
  filename: string;
  saveAs: boolean;
}

export type DownloadFunction = (
  options: DownloadOptions,
  callback: (downloadId?: number) => void
) => void;

/**
 * 把 Chrome 的 callback 下载 API 收拢成 Promise，方便弹窗显示明确的成功或失败。
 */
export function requestPluginDownload(
  download: DownloadFunction,
  getLastError: () => string | undefined,
  url: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      download(
        {
          url,
          filename: 'knownmapplugin.zip',
          saveAs: true,
        },
        (downloadId) => {
          const error = getLastError();
          if (error) {
            reject(new Error(error));
            return;
          }
          if (typeof downloadId !== 'number') {
            reject(new Error('下载未返回编号。'));
            return;
          }
          resolve(downloadId);
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error('下载失败。'));
    }
  });
}
