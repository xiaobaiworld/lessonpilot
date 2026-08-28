import { CourseLibrary } from '../storage';
import { AuthorizationSource, InstalledCourse } from '../storage/types';
import {
  AssetCacheError,
  AssetStoreLike,
  CachedAsset,
  sha256Hex,
} from '../storage/assets';
import { checkCoursePackage } from './validate';
import { migrateLearningState } from '../runtime/course-upgrade';

export interface RedeemDeps {
  library: CourseLibrary;
  assetStore?: AssetStoreLike;
  /** 由构建目标注入，不在运行时猜环境 */
  apiOrigin: string;
  fetch: typeof globalThis.fetch;
  now: () => Date;
  timeoutMs?: number;
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export type RedeemResult =
  | { ok: true; installed: InstalledCourse[] }
  | { ok: false; code: RedeemErrorCode; message: string };

export type RedeemErrorCode =
  | 'EMPTY_CODE'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'REJECTED'
  | 'SERVER'
  | 'MALFORMED'
  | 'EMPTY_RESULT'
  | 'STORAGE';

export interface CourseUpdateDeps {
  library: CourseLibrary;
  assetStore?: AssetStoreLike;
  apiOrigin: string;
  fetch: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface CourseUpdateSummary {
  courseId: string;
  title: string | null;
  releaseId: string | null;
  releaseNumber: number | null;
  status: 'unchanged' | 'update' | 'unauthorized';
}

export type CourseUpdateResult =
  | { ok: true; courses: CourseUpdateSummary[] }
  | { ok: false; code: CourseUpdateErrorCode; message: string };

export type CourseUpdateErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER'
  | 'UNAUTHORIZED'
  | 'STALE'
  | 'MALFORMED'
  | 'NOT_INSTALLED'
  | 'STORAGE';

const COURSE_UPDATE_MESSAGES: Record<CourseUpdateErrorCode, string> = {
  NETWORK: '连不上服务，请检查网络后重试。',
  TIMEOUT: '请求超时，请重试。',
  SERVER: '服务暂时出错，请稍后重试。',
  UNAUTHORIZED: '当前没有这门课程的在线更新资格。',
  STALE: '课程已有更新，请重新检查后再升级。',
  MALFORMED: '课程更新数据不完整，已取消升级。',
  NOT_INSTALLED: '本机没有这门课程。',
  STORAGE: '本机存储写入失败，已保留原有课程。',
};

/** 错误目录集中在一处，popup 与页面书包共用同一套文案 */
export const REDEEM_MESSAGES: Record<RedeemErrorCode, string> = {
  EMPTY_CODE: '请输入授权码。',
  NETWORK: '连不上服务，请检查网络后重试。',
  TIMEOUT: '请求超时，请重试。',
  REJECTED: '授权码无效或已过期。',
  SERVER: '服务暂时出错，请稍后重试。',
  MALFORMED: '课程数据不完整，已取消安装。',
  EMPTY_RESULT: '这个授权码没有对应可下载的课程。',
  STORAGE: '本机存储写入失败，已保留原有课程。',
};

function fail(code: RedeemErrorCode, detail?: string): RedeemResult {
  return {
    ok: false,
    code,
    message: detail ? `${REDEEM_MESSAGES[code]}（${detail}）` : REDEEM_MESSAGES[code],
  };
}

function updateFail(
  code: CourseUpdateErrorCode,
  detail?: string
): CourseUpdateResult {
  return {
    ok: false,
    code,
    message: detail
      ? `${COURSE_UPDATE_MESSAGES[code]}（${detail}）`
      : COURSE_UPDATE_MESSAGES[code],
  };
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = []
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => key in value) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

async function ensureIdentity(deps: CourseUpdateDeps): Promise<{
  clientId: string;
  proof: string;
}> {
  const identity = await deps.library.ensureIdentity(() => ({
    clientId: crypto.randomUUID(),
    proof: randomSecret(),
    proofSalt: randomSecret(),
  }));
  if (!identity) throw new Error('identity unavailable');
  return { clientId: identity.clientId, proof: identity.proof };
}

function clientInfo() {
  return {
    extensionVersion:
      (globalThis as any).chrome?.runtime?.getManifest?.().version ?? '0.0.0',
    browserFamily: 'chrome',
  };
}

async function requestWithTimeout(
  deps: CourseUpdateDeps,
  path: string,
  body: unknown
): Promise<Response | CourseUpdateErrorCode> {
  return requestResponseWithTimeout(
    deps.fetch,
    deps.timeoutMs,
    `${deps.apiOrigin}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

type RequestError = 'NETWORK' | 'TIMEOUT';

async function requestResponseWithTimeout(
  fetcher: typeof globalThis.fetch,
  timeoutMs: number | undefined,
  url: string,
  init: RequestInit
): Promise<Response | RequestError> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 15000);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError'
      ? 'TIMEOUT'
      : 'NETWORK';
  } finally {
    clearTimeout(timeout);
  }
}

function assetResponseError(response: Response): RedeemErrorCode | null {
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return 'REJECTED';
  }
  if (response.status >= 500) return 'SERVER';
  if (!response.ok) return 'MALFORMED';
  return null;
}

async function downloadCourseAssets(
  course: InstalledCourse,
  identity: { clientId: string; proof: string },
  deps: RedeemDeps | CourseUpdateDeps
): Promise<RedeemErrorCode | null> {
  if (course.assets.length === 0) return null;
  if (!deps.assetStore) return 'STORAGE';
  if (!course.releaseId) return 'MALFORMED';

  const authorizeResponse = await requestResponseWithTimeout(
    deps.fetch,
    deps.timeoutMs,
    `${deps.apiOrigin}/api/v1/student/course-assets/authorize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        courseId: course.courseId,
        releaseId: course.releaseId,
        assets: course.assets.map((asset) => ({
          assetId: asset.assetId,
          sha256: asset.sha256,
        })),
        localIdentityId: identity.clientId,
        localProof: identity.proof,
        client: clientInfo(),
      }),
    }
  );
  if (typeof authorizeResponse === 'string') return authorizeResponse;

  const authorizationError = assetResponseError(authorizeResponse);
  if (authorizationError) return authorizationError;

  let body: unknown;
  try {
    body = await authorizeResponse.json();
  } catch {
    return 'MALFORMED';
  }
  const data = isObject(body) ? body.data : undefined;
  if (
    !isObject(data) ||
    typeof data.token !== 'string' ||
    data.token.length === 0 ||
    !Array.isArray(data.assetIds) ||
    data.assetIds.length !== course.assets.length ||
    data.assetIds.some((assetId) => typeof assetId !== 'string') ||
    new Set(data.assetIds).size !== course.assets.length ||
    course.assets.some((asset) => !data.assetIds.includes(asset.assetId))
  ) {
    return 'MALFORMED';
  }

  try {
    for (const asset of course.assets) {
      const assetResponse = await requestResponseWithTimeout(
        deps.fetch,
        deps.timeoutMs,
        `${deps.apiOrigin}/api/v1/student/course-assets/${encodeURIComponent(
          asset.assetId
        )}?token=${encodeURIComponent(data.token)}`,
        { method: 'GET' }
      );
      if (typeof assetResponse === 'string') throw new Error(assetResponse);
      const downloadError = assetResponseError(assetResponse);
      if (downloadError) throw new Error(downloadError);

      const mimeType = (assetResponse.headers.get('content-type') ?? '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (mimeType !== asset.mimeType.toLowerCase()) throw new Error('MALFORMED');

      const bytes = await assetResponse.arrayBuffer();
      if (bytes.byteLength !== asset.byteSize) throw new Error('MALFORMED');
      const digest = await sha256Hex(bytes);
      if (digest.toLowerCase() !== asset.sha256.toLowerCase()) {
        throw new Error('MALFORMED');
      }

      const cached: CachedAsset = {
        courseId: course.courseId,
        releaseId: course.releaseId,
        assetId: asset.assetId,
        sha256: asset.sha256,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        blob: new Blob([bytes], { type: asset.mimeType }),
      };
      await deps.assetStore.put(cached);
    }
  } catch (error) {
    await deps.assetStore
      .clearRelease(course.courseId, course.releaseId)
      .catch(() => undefined);
    if (error instanceof AssetCacheError && error.code === 'STORAGE') return 'STORAGE';
    if (error instanceof Error && error.message === 'NETWORK') return 'NETWORK';
    if (error instanceof Error && error.message === 'TIMEOUT') return 'TIMEOUT';
    if (error instanceof Error && error.message === 'REJECTED') return 'REJECTED';
    if (error instanceof Error && error.message === 'SERVER') return 'SERVER';
    return 'MALFORMED';
  }
  return null;
}

function asCourseUpdateError(code: RedeemErrorCode): CourseUpdateErrorCode {
  if (code === 'REJECTED') return 'UNAUTHORIZED';
  if (code === 'EMPTY_CODE' || code === 'EMPTY_RESULT') return 'MALFORMED';
  return code;
}

async function parseJsonResponse(
  response: Response
): Promise<Record<string, any> | CourseUpdateErrorCode> {
  if (response.status === 409) return 'STALE';
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return 'UNAUTHORIZED';
  }
  if (response.status >= 500) return 'SERVER';
  if (!response.ok) return 'MALFORMED';
  try {
    const body: unknown = await response.json();
    return isObject(body) ? body : 'MALFORMED';
  } catch {
    return 'MALFORMED';
  }
}

function validReleaseId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function parseUpdateSummary(value: unknown): CourseUpdateSummary | null {
  if (
    !isObject(value) ||
    !onlyKeys(value, ['courseId', 'title', 'releaseId', 'releaseNumber', 'status']) ||
    typeof value.courseId !== 'string' ||
    value.courseId.trim().length === 0 ||
    !['unchanged', 'update', 'unauthorized'].includes(String(value.status))
  ) {
    return null;
  }
  const status = value.status as CourseUpdateSummary['status'];
  if (status === 'unauthorized') {
    if (
      value.title !== null ||
      value.releaseId !== null ||
      value.releaseNumber !== null
    ) {
      return null;
    }
    return {
      courseId: value.courseId,
      title: null,
      releaseId: null,
      releaseNumber: null,
      status,
    };
  }
  if (typeof value.title !== 'string' || value.title.trim().length === 0) {
    return null;
  }
  if (
    !validReleaseId(value.releaseId) ||
    !Number.isSafeInteger(value.releaseNumber) ||
    value.releaseNumber < 1
  ) {
    return null;
  }
  return {
    courseId: value.courseId,
    title: value.title,
    releaseId: value.releaseId,
    releaseNumber: value.releaseNumber,
    status,
  };
}

export async function checkCourseUpdates(
  deps: CourseUpdateDeps,
  courseIds?: string[]
): Promise<CourseUpdateResult> {
  let identity;
  let root;
  try {
    identity = await ensureIdentity(deps);
    root = await deps.library.read();
  } catch {
    return updateFail('STORAGE');
  }

  const selected = Object.values(root.installedCourses).filter(
    (course) => courseIds === undefined || courseIds.includes(course.courseId)
  );
  const response = await requestWithTimeout(
    deps,
    '/api/v1/student/course-updates/check',
    {
      schemaVersion: 1,
      installedCourses: selected.map((course) => ({
        courseId: course.courseId,
        releaseId: course.releaseId ?? null,
        releaseNumber: course.releaseNumber ?? null,
      })),
      ...(courseIds === undefined ? {} : { courseIds }),
      localIdentityId: identity.clientId,
      localProof: identity.proof,
      client: clientInfo(),
    }
  );
  if (typeof response === 'string') return updateFail(response);

  const body = await parseJsonResponse(response);
  if (typeof body === 'string') return updateFail(body);
  const data = body.data;
  if (!isObject(data) || !Array.isArray(data.courses)) {
    return updateFail('MALFORMED', '响应缺少 courses');
  }

  const selectedIds = new Set(selected.map((course) => course.courseId));
  const courses = data.courses.map(parseUpdateSummary);
  if (
    courses.some((course) => course === null) ||
    courses.some((course) => !selectedIds.has(course!.courseId))
  ) {
    return updateFail('MALFORMED', '响应包含未知课程');
  }
  return { ok: true, courses: courses as CourseUpdateSummary[] };
}

export type CourseUpgradeResult =
  | { ok: true; course: InstalledCourse }
  | { ok: false; code: CourseUpdateErrorCode; message: string };

export async function upgradeCourse(
  courseId: string,
  expectedReleaseId: string,
  deps: CourseUpdateDeps
): Promise<CourseUpgradeResult> {
  if (!courseId || !validReleaseId(expectedReleaseId)) {
    return updateFail('MALFORMED', '课程或期望版本无效') as CourseUpgradeResult;
  }

  let identity;
  let root;
  try {
    identity = await ensureIdentity(deps);
    root = await deps.library.read();
  } catch {
    return updateFail('STORAGE') as CourseUpgradeResult;
  }
  const current = root.installedCourses[courseId];
  if (!current) return updateFail('NOT_INSTALLED') as CourseUpgradeResult;
  const source = root.authorizationSourceCache.sources.find(
    (item) => item.sourceId === current.sourceId
  );
  if (!source) return updateFail('UNAUTHORIZED') as CourseUpgradeResult;

  const response = await requestWithTimeout(
    deps,
    '/api/v1/student/course-updates/apply',
    {
      schemaVersion: 1,
      courseId,
      expectedReleaseId,
      localIdentityId: identity.clientId,
      localProof: identity.proof,
      client: clientInfo(),
    }
  );
  if (typeof response === 'string') {
    return updateFail(response) as CourseUpgradeResult;
  }
  const body = await parseJsonResponse(response);
  if (typeof body === 'string') return updateFail(body) as CourseUpgradeResult;
  const data = body.data;
  const rawPackage = isObject(data) ? data.package : undefined;
  const checked = checkCoursePackage(rawPackage, source.sourceId);
  if (
    !checked.ok ||
    checked.value.courseId !== courseId ||
    checked.value.releaseId !== expectedReleaseId
  ) {
    return updateFail('MALFORMED', checked.ok ? '课程或版本不匹配' : checked.reason) as CourseUpgradeResult;
  }

  const assetError = await downloadCourseAssets(checked.value, identity, deps);
  if (assetError) {
    return updateFail(asCourseUpdateError(assetError)) as CourseUpgradeResult;
  }

  try {
    await deps.library.replaceCourseWithMigration(
      checked.value,
      source,
      (previousCourse, previousState) =>
        migrateLearningState(previousCourse, checked.value, previousState)
    );
  } catch {
    return updateFail('STORAGE') as CourseUpgradeResult;
  }
  return { ok: true, course: checked.value };
}

/** 授权码尾段，用于在课程库里说明这门课是哪个码带来的。不存明文 */
function codeHint(code: string): string {
  const tail = code.trim().split('-').pop() ?? '';
  return tail.slice(-5);
}

/**
 * 兑换授权码并安装课程。
 *
 * 顺序是固定的：取回 → 全部复验 → 逐门原子提交。
 *
 * 任一门课复验不过就整批放弃，一门也不装。半装的批次会让老师说的
 * "这个码给你三门课" 变成学生看到一门，而学生无法自查缺了什么。
 * 中途取消、超时、存储失败，磁盘上都仍是上一份有效数据。
 */
export async function redeemAccessCode(
  code: string,
  deps: RedeemDeps,
  signal?: AbortSignal
): Promise<RedeemResult> {
  const trimmed = code.trim();
  if (!trimmed) return fail('EMPTY_CODE');

  let identity;
  try {
    identity = await deps.library.ensureIdentity(() => ({
      clientId: crypto.randomUUID(),
      proof: randomSecret(),
      proofSalt: randomSecret(),
    }));
  } catch {
    return fail('STORAGE');
  }
  if (!identity) return fail('STORAGE');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 15000);
  // 调用方取消也要中断在途请求
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await deps.fetch(`${deps.apiOrigin}/api/v1/student/redemptions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        accessCode: trimmed,
        localIdentityId: identity.clientId,
        localProof: identity.proof,
        client: {
          extensionVersion:
            (globalThis as any).chrome?.runtime?.getManifest?.().version ?? '0.0.0',
          browserFamily: 'chrome',
        },
      }),
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return fail(aborted ? 'TIMEOUT' : 'NETWORK');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404 || response.status === 400 || response.status === 410) {
    return fail('REJECTED');
  }
  if (response.status >= 500) return fail('SERVER');
  if (!response.ok) return fail('REJECTED');

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fail('MALFORMED', '响应不是 JSON');
  }

  const data = typeof body === 'object' && body !== null ? (body as any).data : null;
  const courses =
    typeof data === 'object' && data !== null && Array.isArray(data.courses)
      ? data.courses
      : null;
  if (!courses) return fail('MALFORMED', '响应缺少 courses');
  if (courses.length === 0) return fail('EMPTY_RESULT');

  const sourceId = String(data.redemption?.sourceRef ?? '');
  if (!sourceId) return fail('MALFORMED', '响应缺少兑换引用');

  // 先全部验完再写任何一条：验到一半失败不留半装状态
  const checked: InstalledCourse[] = [];
  for (const raw of courses) {
    const result = checkCoursePackage(raw?.package, sourceId);
    if (!result.ok) return fail('MALFORMED', result.reason);
    checked.push(result.value);
  }

  const source: AuthorizationSource = {
    sourceId,
    codeHint: codeHint(trimmed),
    redeemedAt: deps.now().toISOString(),
    courseIds: checked.map((c) => c.courseId),
    expiresAt: null,
  };

  const stagedCourses: InstalledCourse[] = [];
  for (const course of checked) {
    const assetError = await downloadCourseAssets(course, identity, deps);
    if (assetError) {
      await Promise.all(
        stagedCourses
          .concat(course)
          .filter((item) => item.releaseId)
          .map((item) =>
            deps.assetStore
              ?.clearRelease(item.courseId, item.releaseId!)
              .catch(() => undefined)
          )
      );
      return fail(assetError);
    }
    stagedCourses.push(course);
  }

  try {
    for (const course of checked) {
      // 逐门提交，每门自己是一次原子写入
      await deps.library.installCourse(course, source);
    }
  } catch {
    return fail('STORAGE');
  }

  return { ok: true, installed: checked };
}
