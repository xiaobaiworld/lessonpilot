/**
 * 构建目标。
 *
 * API 地址和 host permission 在构建期定死，运行时不猜环境、不接受
 * 任意 endpoint（4F）。生产包不含本机权限——带着它发出去，等于给
 * 每个装了插件的人开了一条指向他自己机器的通道。
 */

export type TargetName = 'local' | 'production';

export interface BuildTarget {
  name: TargetName;
  apiOrigin: string;
  /** 除 B 站外额外需要的 host permission */
  extraHostPermissions: string[];
}

export const TARGETS: Record<TargetName, BuildTarget> = {
  local: {
    name: 'local',
    apiOrigin: 'http://127.0.0.1:8000',
    extraHostPermissions: ['http://127.0.0.1:8000/*'],
  },
  production: {
    name: 'production',
    apiOrigin: 'https://knownmap.com',
    extraHostPermissions: ['https://knownmap.com/*'],
  },
};

export const EXTENSION_VERSION = '1.0.0';

export function buildManifest(target: BuildTarget): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: target.name === 'local' ? 'KnownMap（本机）' : 'KnownMap',
    version: EXTENSION_VERSION,
    description: '把 B 站课程变成可互动的学习路径。',
    // 只申请真正用到的权限：课程库读写需要 storage，其余都不需要
    permissions: ['storage'],
    host_permissions: ['https://www.bilibili.com/*', ...target.extraHostPermissions],
    action: {
      default_title: '打开 KnownMap',
      default_popup: 'popup/index.html',
    },
    background: {
      service_worker: 'background/service-worker.js',
      type: 'module',
    },
    content_scripts: [
      {
        // 只在投稿视频页注入；其它页面不加载任何课程代码
        matches: ['https://www.bilibili.com/video/*'],
        js: ['content/index.js'],
        css: ['content/window.css'],
        run_at: 'document_idle',
      },
    ],
  };
}

/** 构建产物清单。固定 ZIP 由它生成，便于按精确提交重复构建 */
export const BUILD_ARTIFACTS = [
  'manifest.json',
  'background/service-worker.js',
  'content/index.js',
  'content/window.css',
  'popup/index.html',
  'popup/index.js',
] as const;
