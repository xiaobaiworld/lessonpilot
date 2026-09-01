import { describe, expect, it } from 'vitest';
import {
  AssetCache,
  AssetCacheError,
  AssetDatabase,
  CachedAsset,
} from './assets';

class MemoryAssetDatabase implements AssetDatabase {
  blobs = new Map<string, Blob>();
  references = new Map<string, Omit<CachedAsset, 'blob'>>();
  blobWrites = 0;

  private blobKey(sha256: string, mimeType: string): string {
    return `${sha256}\u0000${mimeType}`;
  }

  private key(courseId: string, releaseId: string, assetId: string): string {
    return `${courseId}\u0000${releaseId}\u0000${assetId}`;
  }

  async write(asset: CachedAsset): Promise<'stored' | 'reused'> {
    const reused = this.blobs.has(this.blobKey(asset.sha256, asset.mimeType));
    if (!reused) {
      this.blobWrites += 1;
      this.blobs.set(this.blobKey(asset.sha256, asset.mimeType), asset.blob);
    }
    const reference = {
      courseId: asset.courseId,
      releaseId: asset.releaseId,
      assetId: asset.assetId,
      sha256: asset.sha256,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
    };
    this.references.set(
      this.key(asset.courseId, asset.releaseId, asset.assetId),
      reference
    );
    return reused ? 'reused' : 'stored';
  }

  async readReference(courseId: string, releaseId: string, assetId: string) {
    return (
      this.references.get(this.key(courseId, releaseId, assetId)) ?? null
    );
  }

  async readBlob(sha256: string, mimeType: string) {
    return this.blobs.get(this.blobKey(sha256, mimeType)) ?? null;
  }

  async clearRelease(courseId: string, releaseId: string): Promise<void> {
    const prefix = `${courseId}\u0000${releaseId}\u0000`;
    for (const key of this.references.keys()) {
      if (key.startsWith(prefix)) this.references.delete(key);
    }
  }

  async removeCourse(courseId: string): Promise<void> {
    const prefix = `${courseId}\u0000`;
    for (const key of this.references.keys()) {
      if (key.startsWith(prefix)) this.references.delete(key);
    }
  }
}

const asset = (
  over: Partial<CachedAsset> = {}
): CachedAsset => ({
  courseId: 'course-1',
  releaseId: 'release-1',
  assetId: 'asset-1',
  sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  mimeType: 'image/png',
  byteSize: 5,
  blob: new Blob(['hello'], { type: 'image/png' }),
  ...over,
});

describe('IndexedDB 课程资源缓存边界', () => {
  it('相同 sha256 + MIME 的不同资源引用共用一个 Blob', async () => {
    const database = new MemoryAssetDatabase();
    const cache = new AssetCache(database);

    await expect(cache.put(asset())).resolves.toBe('stored');
    await expect(
      cache.put(
        asset({
          releaseId: 'release-2',
          assetId: 'asset-2',
        })
      )
    ).resolves.toBe('reused');

    expect(database.blobWrites).toBe(1);
    expect(database.references.size).toBe(2);
    await expect(
      (await cache.get('course-1', 'release-2', 'asset-2'))?.blob.text()
    ).resolves.toBe('hello');
  });

  it('同一 assetId 换 hash 时按发布版本隔离，禁止原地覆盖旧 Blob', async () => {
    const database = new MemoryAssetDatabase();
    const cache = new AssetCache(database);

    await cache.put(asset());
    await cache.put(
      asset({
        releaseId: 'release-2',
        sha256: '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7',
        blob: new Blob(['world'], { type: 'image/png' }),
      })
    );

    expect(await (await cache.get('course-1', 'release-1', 'asset-1'))?.blob.text()).toBe(
      'hello'
    );
    expect(await (await cache.get('course-1', 'release-2', 'asset-1'))?.blob.text()).toBe(
      'world'
    );
    expect(database.blobWrites).toBe(2);
  });

  it('相同字节但 MIME 不同不共用逻辑资源', async () => {
    const database = new MemoryAssetDatabase();
    const cache = new AssetCache(database);
    const jpeg = asset({
      mimeType: 'image/jpeg',
      blob: new Blob(['hello'], { type: 'image/jpeg' }),
    });

    await cache.put(asset());
    await cache.put(jpeg);

    expect(database.blobWrites).toBe(2);
  });

  it('缺失引用返回 null，Blob 元数据或字节损坏进入稳定错误', async () => {
    const database = new MemoryAssetDatabase();
    const cache = new AssetCache(database);

    await expect(cache.get('course-1', 'missing', 'asset-1')).resolves.toBeNull();
    await cache.put(asset());
    database.blobs.set(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824\u0000image/png',
      new Blob(['wrong'], { type: 'image/png' })
    );

    await expect(cache.get('course-1', 'release-1', 'asset-1')).rejects.toMatchObject({
      code: 'ASSET_CORRUPT',
    } satisfies Partial<AssetCacheError>);
  });

  it('失败下载清理目标发布版本，不影响其它版本引用', async () => {
    const database = new MemoryAssetDatabase();
    const cache = new AssetCache(database);

    await cache.put(asset());
    await cache.put(asset({ releaseId: 'release-2', assetId: 'asset-2' }));
    await cache.clearRelease('course-1', 'release-2');

    await expect(cache.get('course-1', 'release-1', 'asset-1')).resolves.not.toBeNull();
    await expect(cache.get('course-1', 'release-2', 'asset-2')).resolves.toBeNull();
  });
});
