import type { AssetRecord } from './types';

export type AssetCacheErrorCode = 'ASSET_MISSING' | 'ASSET_CORRUPT' | 'STORAGE';

export class AssetCacheError extends Error {
  constructor(public readonly code: AssetCacheErrorCode) {
    super(code);
    this.name = 'AssetCacheError';
  }
}

export interface CachedAsset {
  courseId: string;
  releaseId: string;
  assetId: string;
  sha256: string;
  mimeType: string;
  byteSize: number;
  blob: Blob;
}

export type AssetReference = Omit<CachedAsset, 'blob'>;

/**
 * The small database boundary keeps the cache logic testable without making
 * tests depend on a browser-specific IndexedDB implementation.
 */
export interface AssetDatabase {
  write(asset: CachedAsset): Promise<'stored' | 'reused'>;
  readReference(
    courseId: string,
    releaseId: string,
    assetId: string
  ): Promise<AssetReference | null>;
  readBlob(sha256: string, mimeType: string): Promise<Blob | null>;
  clearRelease(courseId: string, releaseId: string): Promise<void>;
  removeCourse(courseId: string): Promise<void>;
}

export interface AssetStoreLike {
  put(asset: CachedAsset): Promise<'stored' | 'reused'>;
  get(
    courseId: string,
    releaseId: string,
    assetId: string
  ): Promise<CachedAsset | null>;
  clearRelease(courseId: string, releaseId: string): Promise<void>;
  removeCourse(courseId: string): Promise<void>;
}

function asAssetReference(asset: CachedAsset): AssetReference {
  return {
    courseId: asset.courseId,
    releaseId: asset.releaseId,
    assetId: asset.assetId,
    sha256: asset.sha256,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
  };
}

export async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function contentKey(sha256: string, mimeType: string): string {
  return `${sha256.toLowerCase()}\u0000${mimeType.toLowerCase()}`;
}

export class AssetCache implements AssetStoreLike {
  constructor(private readonly database: AssetDatabase) {}

  async put(asset: CachedAsset): Promise<'stored' | 'reused'> {
    if (
      asset.blob.size !== asset.byteSize ||
      asset.blob.type.toLowerCase() !== asset.mimeType.toLowerCase()
    ) {
      throw new AssetCacheError('ASSET_CORRUPT');
    }
    const digest = await sha256Hex(await asset.blob.arrayBuffer());
    if (digest.toLowerCase() !== asset.sha256.toLowerCase()) {
      throw new AssetCacheError('ASSET_CORRUPT');
    }
    return this.database.write(asset);
  }

  async get(
    courseId: string,
    releaseId: string,
    assetId: string
  ): Promise<CachedAsset | null> {
    let reference: AssetReference | null;
    try {
      reference = await this.database.readReference(courseId, releaseId, assetId);
    } catch {
      throw new AssetCacheError('STORAGE');
    }
    if (!reference) return null;

    let blob: Blob | null;
    try {
      blob = await this.database.readBlob(reference.sha256, reference.mimeType);
    } catch {
      throw new AssetCacheError('STORAGE');
    }
    if (
      !blob ||
      blob.size !== reference.byteSize ||
      blob.type.toLowerCase() !== reference.mimeType.toLowerCase()
    ) {
      throw new AssetCacheError('ASSET_CORRUPT');
    }
    const digest = await sha256Hex(await blob.arrayBuffer());
    if (digest.toLowerCase() !== reference.sha256.toLowerCase()) {
      throw new AssetCacheError('ASSET_CORRUPT');
    }
    return { ...reference, blob };
  }

  clearRelease(courseId: string, releaseId: string): Promise<void> {
    return this.database.clearRelease(courseId, releaseId);
  }

  removeCourse(courseId: string): Promise<void> {
    return this.database.removeCourse(courseId);
  }
}

const DB_NAME = 'knownmap-course-assets';
const DB_VERSION = 1;
const BLOBS_STORE = 'blobs';
const REFERENCES_STORE = 'references';

interface BlobRow {
  key: string;
  sha256: string;
  mimeType: string;
  byteSize: number;
  blob: Blob;
}

interface ReferenceRow extends AssetReference {
  key: string;
}

function referenceKey(courseId: string, releaseId: string, assetId: string): string {
  return `${courseId}\u0000${releaseId}\u0000${assetId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/**
 * IndexedDB layout:
 * - blobs are keyed by content hash + MIME, so different course references share bytes;
 * - references are keyed by course + release + asset, so a replaced asset never
 *   overwrites the old release before the course JSON is committed.
 */
export class IndexedDbAssetDatabase implements AssetDatabase {
  private database: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    const indexedDB = globalThis.indexedDB;
    if (!indexedDB) throw new AssetCacheError('STORAGE');

    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BLOBS_STORE)) {
          db.createObjectStore(BLOBS_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(REFERENCES_STORE)) {
          const store = db.createObjectStore(REFERENCES_STORE, { keyPath: 'key' });
          store.createIndex('courseId', 'courseId', { unique: false });
          store.createIndex('courseRelease', ['courseId', 'releaseId'], {
            unique: false,
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new AssetCacheError('STORAGE'));
      request.onblocked = () => reject(new AssetCacheError('STORAGE'));
    });
    return this.database;
  }

  async write(asset: CachedAsset): Promise<'stored' | 'reused'> {
    const db = await this.open();
    const transaction = db.transaction([BLOBS_STORE, REFERENCES_STORE], 'readwrite');
    const blobs = transaction.objectStore(BLOBS_STORE);
    const references = transaction.objectStore(REFERENCES_STORE);
    const existing = await requestResult<BlobRow | undefined>(
      blobs.get(contentKey(asset.sha256, asset.mimeType))
    );
    const reused = Boolean(existing);
    if (!existing) {
      blobs.put({
        key: contentKey(asset.sha256, asset.mimeType),
        sha256: asset.sha256,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        blob: asset.blob,
      } satisfies BlobRow);
    }
    references.put({
      ...asAssetReference(asset),
      key: referenceKey(asset.courseId, asset.releaseId, asset.assetId),
    } satisfies ReferenceRow);
    await transactionDone(transaction);
    return reused ? 'reused' : 'stored';
  }

  async readReference(
    courseId: string,
    releaseId: string,
    assetId: string
  ): Promise<AssetReference | null> {
    const db = await this.open();
    const transaction = db.transaction(REFERENCES_STORE, 'readonly');
    const row = await requestResult<ReferenceRow | undefined>(
      transaction.objectStore(REFERENCES_STORE).get(referenceKey(courseId, releaseId, assetId))
    );
    if (!row) return null;
    return {
      courseId: row.courseId,
      releaseId: row.releaseId,
      assetId: row.assetId,
      sha256: row.sha256,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
    };
  }

  async readBlob(sha256: string, mimeType: string): Promise<Blob | null> {
    const db = await this.open();
    const transaction = db.transaction(BLOBS_STORE, 'readonly');
    const row = await requestResult<BlobRow | undefined>(
      transaction.objectStore(BLOBS_STORE).get(contentKey(sha256, mimeType))
    );
    return row?.blob ?? null;
  }

  async clearRelease(courseId: string, releaseId: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(REFERENCES_STORE, 'readwrite');
    const index = transaction.objectStore(REFERENCES_STORE).index('courseRelease');
    const keys = await requestResult<IDBValidKey[]>(
      index.getAllKeys(IDBKeyRange.only([courseId, releaseId]))
    );
    const store = transaction.objectStore(REFERENCES_STORE);
    keys.forEach((key) => store.delete(key));
    await transactionDone(transaction);
  }

  async removeCourse(courseId: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(REFERENCES_STORE, 'readwrite');
    const index = transaction.objectStore(REFERENCES_STORE).index('courseId');
    const keys = await requestResult<IDBValidKey[]>(
      index.getAllKeys(IDBKeyRange.only(courseId))
    );
    const store = transaction.objectStore(REFERENCES_STORE);
    keys.forEach((key) => store.delete(key));
    await transactionDone(transaction);
  }
}

export function cachedAssetFromRecord(
  courseId: string,
  releaseId: string,
  record: AssetRecord,
  blob: Blob
): CachedAsset {
  return {
    courseId,
    releaseId,
    assetId: record.assetId,
    sha256: record.sha256,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    blob,
  };
}
