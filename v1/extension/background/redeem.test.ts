import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkCourseUpdates,
  redeemAccessCode,
  RedeemDeps,
  upgradeCourse,
} from './redeem';
import { checkCoursePackage } from './validate';
import { CourseLibrary, StorageArea } from '../storage';
import { STORAGE_ROOT_KEY } from '../storage/types';
import {
  AssetCache,
  AssetDatabase,
  AssetStoreLike,
  CachedAsset,
} from '../storage/assets';

class FakeArea implements StorageArea {
  data: Record<string, unknown> = {};
  failOn: 'set' | null = null;
  async get(keys: string[]) {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in this.data) out[k] = this.data[k];
    return out;
  }
  async set(items: Record<string, unknown>) {
    if (this.failOn === 'set') throw new Error('disk full');
    Object.assign(this.data, JSON.parse(JSON.stringify(items)));
  }
  async remove(keys: string[]) {
    for (const k of keys) delete this.data[k];
  }
  root() {
    return this.data[STORAGE_ROOT_KEY] as any;
  }
}

class MemoryAssetDatabase implements AssetDatabase {
  blobs = new Map<string, Blob>();
  references = new Map<string, Omit<CachedAsset, 'blob'>>();

  private blobKey(sha256: string, mimeType: string): string {
    return `${sha256}\u0000${mimeType}`;
  }

  async write(asset: CachedAsset): Promise<'stored' | 'reused'> {
    const reused = this.blobs.has(this.blobKey(asset.sha256, asset.mimeType));
    if (!reused) {
      this.blobs.set(this.blobKey(asset.sha256, asset.mimeType), asset.blob);
    }
    const { blob: _blob, ...reference } = asset;
    this.references.set(
      `${asset.courseId}\u0000${asset.releaseId}\u0000${asset.assetId}`,
      reference
    );
    return reused ? 'reused' : 'stored';
  }

  async readReference(courseId: string, releaseId: string, assetId: string) {
    return (
      this.references.get(`${courseId}\u0000${releaseId}\u0000${assetId}`) ?? null
    );
  }

  async readBlob(sha256: string, mimeType: string) {
    return this.blobs.get(this.blobKey(sha256, mimeType)) ?? null;
  }

  async clearRelease(courseId: string, releaseId: string) {
    const prefix = `${courseId}\u0000${releaseId}\u0000`;
    for (const key of this.references.keys()) {
      if (key.startsWith(prefix)) this.references.delete(key);
    }
  }

  async removeCourse(courseId: string) {
    const prefix = `${courseId}\u0000`;
    for (const key of this.references.keys()) {
      if (key.startsWith(prefix)) this.references.delete(key);
    }
  }
}

const uuid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
const node = (timeSeconds: unknown, id = 'n1') => ({
  id,
  enabled: true,
  family: 'attention',
  interaction: 'notice',
  anchor: { kind: 'time_cross', timeSeconds },
  title: '重点',
  content: { schemaVersion: 1, blocks: [{ type: 'paragraph', children: [{ text: '提示' }] }] },
  interactionData: null,
  presentationHints: { windowSize: 'm', windowStyle: 'document' },
  effects: { pause: true },
});

const pkg = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 3,
  courseId: uuid(1),
  releaseId: uuid(5),
  releaseNumber: 1,
  title: '英文面试问答',
  assets: [],
  updatedAt: '2026-08-23T11:00:00.000Z',
  lessons: [
    {
      lessonId: uuid(2),
      title: '第一节',
      videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
      nodes: [node(30)],
    },
  ],
  ...over,
});

const json = (body: unknown, status = 200) => {
  const value =
    status === 200 && body && typeof body === 'object' && 'courses' in body
      ? {
          data: {
            redemption: { sourceRef: 'redemption-1' },
            courses: (body as any).courses.map((course: unknown) => ({ package: course })),
          },
        }
      : body;
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const updateJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let area: FakeArea;
let deps: RedeemDeps;
let assetStore: AssetStoreLike;

function withFetch(fn: RedeemDeps['fetch']): RedeemDeps {
  return { ...deps, fetch: fn };
}

beforeEach(() => {
  area = new FakeArea();
  deps = {
    library: new CourseLibrary(area),
    apiOrigin: 'https://knownmap.test',
    fetch: vi.fn(),
    now: () => new Date('2026-08-23T12:00:00.000Z'),
    timeoutMs: 50,
  };
  assetStore = new AssetCache(new MemoryAssetDatabase());
});

describe('成功路径', () => {
  it('安装课程并记下授权来源', async () => {
    const r = await redeemAccessCode(
      'KM-AAAAA-BBBBB-CCCCC-DDDDD',
      withFetch(async () => json({ courses: [pkg()] }))
    );
    expect(r.ok).toBe(true);
    const root = area.root();
    expect(Object.keys(root.installedCourses)).toEqual([uuid(1)]);
    expect(root.installedCourses[uuid(1)]).toMatchObject({
      releaseId: uuid(5),
      releaseNumber: 1,
    });
    expect(root.authorizationSourceCache.sources).toHaveLength(1);
  });

  it('只存授权码尾段，不留明文', async () => {
    await redeemAccessCode(
      'KM-AAAAA-BBBBB-CCCCC-SECRET',
      withFetch(async () => json({ courses: [pkg()] }))
    );
    const dump = JSON.stringify(area.data);
    expect(dump).not.toContain('KM-AAAAA');
    expect(dump).toContain('ECRET'); // 尾段用于界面说明
  });

  it('一个码带多门课时全部安装', async () => {
    const second = pkg({
      courseId: uuid(3),
      title: '简历写作',
      lessons: [
        {
          lessonId: uuid(4),
          title: '第一节',
          videoRef: { platform: 'bilibili', videoId: 'BV1Bc41187Lm' },
          nodes: [node(5)],
        },
      ],
    });
    const r = await redeemAccessCode(
      'KM-X',
      withFetch(async () => json({ courses: [pkg(), second] }))
    );
    expect(r.ok).toBe(true);
    expect(Object.keys(area.root().installedCourses).sort()).toEqual(
      [uuid(1), uuid(3)].sort()
    );
  });

  it('领取课程后先授权并下载资源，再提交课程 JSON', async () => {
    const image = {
      assetId: 'image-1',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 5,
      sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      sourceType: 'uploaded',
    };
    const course = pkg({ assets: [image] });
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/student/redemptions')) {
        return json({ courses: [course] });
      }
      if (path.endsWith('/student/course-assets/authorize')) {
        return updateJson({
          data: {
            token: 'asset-token',
            assetIds: ['image-1'],
          },
        });
      }
      expect(init?.method).toBe('GET');
      return new Response('hello', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    });

    const result = await redeemAccessCode('KM-ASSET', {
      ...deps,
      assetStore,
      fetch,
    });

    expect(result.ok).toBe(true);
    const cached = await assetStore.get(
      uuid(1),
      uuid(5),
      'image-1'
    );
    expect(await cached?.blob.text()).toBe('hello');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/student/course-assets/authorize'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('课程升级消息链路', () => {
  it('检查只提交本机已安装课程，并解析版本摘要', async () => {
    await redeemAccessCode('KM-FIRST', withFetch(async () => json({ courses: [pkg()] })));
    const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      updateJson({
        data: {
          courses: [
            {
              courseId: uuid(1),
              title: '英文面试问答',
              releaseId: uuid(6),
              releaseNumber: 2,
              status: 'update',
            },
          ],
        },
      })
    );

    const result = await checkCourseUpdates({ library: deps.library, apiOrigin: deps.apiOrigin, fetch });

    expect(result).toMatchObject({
      ok: true,
      courses: [{ courseId: uuid(1), status: 'update', releaseId: uuid(6) }],
    });
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.installedCourses).toEqual([
      { courseId: uuid(1), releaseId: uuid(5), releaseNumber: 1 },
    ]);
    expect(body).not.toHaveProperty('coursePackage');
  });

  it('版本摘要响应畸形时不返回可执行候选', async () => {
    const result = await checkCourseUpdates({
      library: deps.library,
      apiOrigin: deps.apiOrigin,
      fetch: async () => updateJson({ data: { courses: [{ courseId: 'bad', status: 'update' }] } }),
    });

    expect(result).toMatchObject({ ok: false, code: 'MALFORMED' });
  });

  it('未授权摘要不携带课程标题或版本元数据', async () => {
    await redeemAccessCode('KM-FIRST', withFetch(async () => json({ courses: [pkg()] })));
    const result = await checkCourseUpdates({
      library: deps.library,
      apiOrigin: deps.apiOrigin,
      fetch: async () =>
        updateJson({
          data: {
            courses: [
              {
                courseId: uuid(1),
                title: null,
                releaseId: null,
                releaseNumber: null,
                status: 'unauthorized',
              },
            ],
          },
        }),
    });

    expect(result).toMatchObject({
      ok: true,
      courses: [{ courseId: uuid(1), title: null, status: 'unauthorized' }],
    });
  });

  it('升级重新校验课程包并迁移本机学习状态', async () => {
    await redeemAccessCode('KM-FIRST', withFetch(async () => json({ courses: [pkg()] })));
    await deps.library.recordAttempt(uuid(1), uuid(2), 'n1', {
      at: '2026-08-28T00:00:00.000Z',
      answer: 'old',
      correct: true,
    });
    const replacement = pkg({
      releaseId: uuid(6),
      releaseNumber: 2,
      lessons: [
        {
              lessonId: uuid(2),
              title: '第一节',
              videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
              nodes: [node(30, 'n1')],
        },
      ],
    });
    const result = await upgradeCourse(
      uuid(1),
      uuid(6),
      {
        library: deps.library,
        apiOrigin: deps.apiOrigin,
        fetch: async () => updateJson({ data: { package: replacement } }),
      }
    );

    expect(result).toMatchObject({ ok: true, course: { releaseId: uuid(6), releaseNumber: 2 } });
    const root = await area.root();
    expect(root.installedCourses[uuid(1)].releaseNumber).toBe(2);
    expect(root.localLearningState[uuid(1)][uuid(2)].done).toEqual(['n1']);
    expect(root.localLearningState[uuid(1)][uuid(2)].attempts.n1).toHaveLength(1);
  });

  it('课程升级后保留新的连续展示配置', async () => {
    await redeemAccessCode('KM-FIRST', withFetch(async () => json({ courses: [pkg()] })));
    const replacement = pkg({
      releaseId: uuid(6),
      releaseNumber: 2,
      lessons: [{
        ...pkg().lessons[0],
        nodes: [{
          ...node(30, 'n1'),
          presentationHints: {
            windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
            windowStyle: 'document',
            windowPosition: { xPercent: 63.4, yPercent: 28.7 },
          },
        }],
      }],
    });

    const result = await upgradeCourse(uuid(1), uuid(6), {
      library: deps.library,
      apiOrigin: deps.apiOrigin,
      fetch: async () => updateJson({ data: { package: replacement } }),
    });

    expect(result).toMatchObject({ ok: true });
    expect((await area.root()).installedCourses[uuid(1)].lessons[0].nodes[0].presentationHints).toEqual({
      windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
      windowStyle: 'document',
      windowPosition: { xPercent: 63.4, yPercent: 28.7 },
    });
  });

  it('服务端拒绝过期期望版本时保留旧课程', async () => {
    await redeemAccessCode('KM-FIRST', withFetch(async () => json({ courses: [pkg()] })));
    const result = await upgradeCourse(uuid(1), uuid(4), {
      library: deps.library,
      apiOrigin: deps.apiOrigin,
      fetch: async () => updateJson({ detail: 'stale release' }, 409),
    });

    expect(result).toMatchObject({ ok: false, code: 'STALE' });
    expect(area.root().installedCourses[uuid(1)].releaseId).toBe(uuid(5));
  });
});

describe('失败时保住上一份有效数据', () => {
  beforeEach(async () => {
    // 先装好一门课，后续每种失败都不该动它
    await redeemAccessCode('KM-FIRST', withFetch(async () => json({ courses: [pkg()] })));
  });

  const survives = () => {
    expect(Object.keys(area.root().installedCourses)).toEqual([uuid(1)]);
  };

  it('空授权码', async () => {
    const r = await redeemAccessCode('   ', deps);
    expect(r).toMatchObject({ ok: false, code: 'EMPTY_CODE' });
    survives();
  });

  it('网络错误', async () => {
    const r = await redeemAccessCode(
      'KM-X',
      withFetch(async () => {
        throw new TypeError('failed to fetch');
      })
    );
    expect(r).toMatchObject({ ok: false, code: 'NETWORK' });
    survives();
  });

  it('超时', async () => {
    const r = await redeemAccessCode(
      'KM-X',
      withFetch(
        (_u, o) =>
          new Promise((_res, rej) =>
            (o!.signal as AbortSignal).addEventListener('abort', () =>
              rej(Object.assign(new Error('x'), { name: 'AbortError' }))
            )
          )
      )
    );
    expect(r).toMatchObject({ ok: false, code: 'TIMEOUT' });
    survives();
  });

  it('调用方取消也算超时路径，不留半装', async () => {
    const ac = new AbortController();
    const p = redeemAccessCode(
      'KM-X',
      withFetch(
        (_u, o) =>
          new Promise((_res, rej) =>
            (o!.signal as AbortSignal).addEventListener('abort', () =>
              rej(Object.assign(new Error('x'), { name: 'AbortError' }))
            )
          )
      ),
      ac.signal
    );
    ac.abort();
    expect(await p).toMatchObject({ ok: false, code: 'TIMEOUT' });
    survives();
  });

  it('授权码被拒', async () => {
    const r = await redeemAccessCode('KM-X', withFetch(async () => json({}, 404)));
    expect(r).toMatchObject({ ok: false, code: 'REJECTED' });
    survives();
  });

  it('服务端 5xx 与被拒分开报', async () => {
    const r = await redeemAccessCode('KM-X', withFetch(async () => json({}, 503)));
    expect(r).toMatchObject({ ok: false, code: 'SERVER' });
    survives();
  });

  it('响应不是 JSON', async () => {
    const r = await redeemAccessCode(
      'KM-X',
      withFetch(async () => new Response('<html>', { status: 200 }))
    );
    expect(r).toMatchObject({ ok: false, code: 'MALFORMED' });
    survives();
  });

  it('响应缺 courses 字段', async () => {
    const r = await redeemAccessCode('KM-X', withFetch(async () => json({ data: [] })));
    expect(r).toMatchObject({ ok: false, code: 'MALFORMED' });
    survives();
  });

  it('courses 为空数组时说清是码没对应课程', async () => {
    const r = await redeemAccessCode('KM-X', withFetch(async () => json({ courses: [] })));
    expect(r).toMatchObject({ ok: false, code: 'EMPTY_RESULT' });
    survives();
  });

  it('批次里有一门畸形则整批放弃，不半装', async () => {
    const broken = pkg({ courseId: uuid(9), lessons: [{ lessonId: 'not-a-uuid' }] });
    const fresh = pkg({
      courseId: uuid(7),
      lessons: [
        {
          lessonId: uuid(8),
          title: 'ok',
          videoRef: { platform: 'bilibili', videoId: 'BV1Cc41187Lm' },
          nodes: [node(1, 'n')],
        },
      ],
    });
    const r = await redeemAccessCode(
      'KM-X',
      withFetch(async () => json({ courses: [fresh, broken] }))
    );
    expect(r).toMatchObject({ ok: false, code: 'MALFORMED' });
    // fresh 也不该被装进去
    expect(Object.keys(area.root().installedCourses)).toEqual([uuid(1)]);
  });

  it('存储写入失败时明确告知已保留原有课程', async () => {
    area.failOn = 'set';
    const r = await redeemAccessCode(
      'KM-X',
      withFetch(async () => json({ courses: [pkg({ courseId: uuid(5) })] }))
    );
    expect(r).toMatchObject({ ok: false, code: 'STORAGE' });
    if (!r.ok) expect(r.message).toContain('保留原有课程');
  });
});

describe('课程包复验', () => {
  const bad = (over: Record<string, unknown>) => checkCoursePackage(pkg(over), 's');

  it('主版本不认识时安全拒绝', () => {
    expect(bad({ schemaVersion: 2 })).toMatchObject({ ok: false });
    expect(bad({ schemaVersion: undefined })).toMatchObject({ ok: false });
  });

  it('拒绝缺失或非法发布版本字段', () => {
    expect(bad({ releaseId: undefined })).toMatchObject({ ok: false });
    expect(bad({ releaseId: 'not-a-uuid' })).toMatchObject({ ok: false });
    expect(bad({ releaseNumber: undefined })).toMatchObject({ ok: false });
    expect(bad({ releaseNumber: 0 })).toMatchObject({ ok: false });
  });

  it('拒绝空课节与空节点', () => {
    expect(bad({ lessons: [] })).toMatchObject({ ok: false });
    expect(
      bad({
        lessons: [
          {
            lessonId: uuid(2),
            title: 't',
            videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
            nodes: [],
          },
        ],
      })
    ).toMatchObject({ ok: false });
  });

  it('拒绝非法 BVID 与非 B 站平台', () => {
    const lesson = (videoRef: unknown) => ({
      lessonId: uuid(2),
      title: 't',
      videoRef,
      nodes: [node(0, 'n')],
    });
    expect(bad({ lessons: [lesson({ platform: 'bilibili', videoId: 'AV123' })] })).toMatchObject(
      { ok: false }
    );
    expect(
      bad({ lessons: [lesson({ platform: 'youtube', videoId: 'BV1Ac41187Lm' })] })
    ).toMatchObject({ ok: false });
  });

  it('拒绝同一课程内重复 BVID：运行时无法确定该跑哪个课节', () => {
    const l = (id: number) => ({
      lessonId: uuid(id),
      title: `第 ${id}`,
      videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
      nodes: [node(0, 'n')],
    });
    const r = bad({ lessons: [l(2), l(3)] });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toContain('BVID 重复');
  });

  it('允许同一 BVID 的不同分 P 作为不同课节', () => {
    const l = (id: number, page: number) => ({
      lessonId: uuid(id),
      title: `第 ${id}`,
      videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm', page, cid: null },
      nodes: [node(0, `n${id}`)],
    });
    const r = checkCoursePackage(
      pkg({ lessons: [l(2, 1), l(3, 4)] }),
      'source-1'
    );
    expect(r).toMatchObject({ ok: true });
  });

  it('接受节点的连续尺寸和位置展示配置', () => {
    const lesson = {
      ...pkg().lessons[0],
      nodes: [{
        ...node(30),
        presentationHints: {
          windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
          windowStyle: 'document',
          windowPosition: { xPercent: 63.4, yPercent: 28.7 },
        },
      }],
    };

    expect(checkCoursePackage(pkg({ lessons: [lesson] }), 'source-1')).toMatchObject({ ok: true });
  });

  it('拒绝重复的课节 UUID', () => {
    const l = (video: string) => ({
      lessonId: uuid(2),
      title: 't',
      videoRef: { platform: 'bilibili', videoId: video },
      nodes: [node(0, 'n')],
    });
    expect(bad({ lessons: [l('BV1Ac41187Lm'), l('BV1Bc41187Lm')] })).toMatchObject({
      ok: false,
    });
  });

  it('拒绝负数或非数字的触发时刻', () => {
    const l = (t: unknown) => ({
      lessonId: uuid(2),
      title: 't',
      videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
      nodes: [node(t, 'n')],
    });
    expect(bad({ lessons: [l(-1)] })).toMatchObject({ ok: false });
    expect(bad({ lessons: [l('30')] })).toMatchObject({ ok: false });
    expect(bad({ lessons: [l(Number.NaN)] })).toMatchObject({ ok: false });
  });

  it('拒绝未知字段和不匹配的节点媒体资源', () => {
    expect(bad({ unexpected: true })).toMatchObject({ ok: false });
    const image = {
      assetId: 'image-1',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 4,
      sha256: 'a'.repeat(64),
      sourceType: 'uploaded',
    };
    const video = {
      assetId: 'video-1',
      kind: 'video',
      mimeType: 'video/mp4',
      byteSize: 4,
      sha256: 'b'.repeat(64),
      sourceType: 'uploaded',
    };
    expect(
      bad({
        assets: [image],
        lessons: [
          {
            lessonId: uuid(2),
            title: 't',
            videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
            nodes: [{ ...node(0, 'n'), content: { schemaVersion: 1, blocks: [{ type: 'image', assetId: 'video-1', alt: '图' }] } }],
          },
        ],
      })
    ).toMatchObject({ ok: false });
    expect(
      bad({
        assets: [image, video],
        lessons: [
          {
            lessonId: uuid(2),
            title: 't',
            videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
            nodes: [
              {
                ...node(0, 'n'),
                content: {
                  schemaVersion: 1,
                  blocks: [{ type: 'video', assetId: 'video-1', posterAssetId: 'image-1' }],
                },
              },
            ],
          },
        ],
      })
    ).toMatchObject({ ok: true });
    expect(
      bad({
        assets: [video],
        lessons: [
          {
            lessonId: uuid(2),
            title: 't',
            videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm' },
            nodes: [{ ...node(0, 'n'), content: { schemaVersion: 1, blocks: [{ type: 'video', assetId: 'video-1', posterAssetId: 'missing' }] } }],
          },
        ],
      })
    ).toMatchObject({ ok: false });
  });
});
