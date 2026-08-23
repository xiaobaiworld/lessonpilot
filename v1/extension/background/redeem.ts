import { CourseLibrary } from '../storage';
import { AuthorizationSource, InstalledCourse } from '../storage/types';
import { checkCoursePackage } from './validate';

export interface RedeemDeps {
  library: CourseLibrary;
  /** 由构建目标注入，不在运行时猜环境 */
  apiOrigin: string;
  fetch: typeof globalThis.fetch;
  now: () => Date;
  timeoutMs?: number;
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 15000);
  // 调用方取消也要中断在途请求
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await deps.fetch(`${deps.apiOrigin}/api/v1/public/course-download`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_code: trimmed }),
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

  const courses =
    typeof body === 'object' && body !== null && Array.isArray((body as any).courses)
      ? (body as any).courses
      : null;
  if (!courses) return fail('MALFORMED', '响应缺少 courses');
  if (courses.length === 0) return fail('EMPTY_RESULT');

  const sourceId = `redeem-${deps.now().getTime()}-${codeHint(trimmed)}`;

  // 先全部验完再写任何一条：验到一半失败不留半装状态
  const checked: InstalledCourse[] = [];
  for (const raw of courses) {
    const result = checkCoursePackage(raw, sourceId);
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
