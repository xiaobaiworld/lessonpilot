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
  /**
   * 额外注入内容脚本的来源。
   *
   * 只给本机目标用：B 站不向自动化浏览器下发 <video>，播放器路径无法在
   * 真实 B 站页面上自动验。本机构建额外注入一个带真实 <video> 的夹具页面，
   * 让注入按真实 manifest 规则发生。生产目标为空。
   *
   * 注意模式里不能写端口：Chrome 匹配模式不支持锁定端口，带端口的模式
   * 非法，整条内容脚本会被拒绝注入且没有报错。旧 manifest 在
   * src/manifest.json 里记过同一条。所以只能匹配到主机，
   * 由 currentVideoId() 的路径判断把范围收窄回 /video/BV...。
   */
  harnessMatches: string[];
}

export const TARGETS: Record<TargetName, BuildTarget> = {
  local: {
    name: 'local',
    apiOrigin: 'http://127.0.0.1:8000',
    extraHostPermissions: ['http://127.0.0.1:8000/*'],
    harnessMatches: ['http://127.0.0.1/*'],
  },
  production: {
    name: 'production',
    apiOrigin: 'https://knownmap.com',
    extraHostPermissions: ['https://knownmap.com/*'],
    // 生产包绝不注入夹具来源
    harnessMatches: [],
  },
};

export const EXTENSION_VERSION = '1.0.1';

export function buildManifest(target: BuildTarget): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: target.name === 'local' ? 'KnownMap（本机）' : 'KnownMap',
    version: EXTENSION_VERSION,
    description: '把 B 站课程变成可互动的学习路径。',
    // 只申请真正用到的权限：课程库读写需要 storage，其余都不需要
    permissions: ['storage'],
    host_permissions: [
      'https://www.bilibili.com/*',
      ...target.extraHostPermissions,
      ...target.harnessMatches,
    ],
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
        matches: [
          'https://www.bilibili.com/video/*',
          ...target.harnessMatches,
        ],
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
