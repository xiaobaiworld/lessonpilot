import { LibraryView, CourseView } from '../shared/library-view';

/**
 * 工具栏首页。
 *
 * 只渲染，不做判断——课程列表规则和进度算法在 shared/library-view.ts，
 * 与 B 站页面里的书包共用同一份，两处不会给出不同结论。
 * 所有存储访问经 background，popup 自己不碰 chrome.storage。
 */

const root = document.getElementById('root')!;

async function ask<T>(message: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    // 扩展刚更新时 sendMessage 可能返回 undefined 而不抛错
    if (!reply || typeof reply !== 'object') {
      return { ok: false, message: '扩展需要重新加载，请在扩展页面点刷新。' };
    }
    return (reply as any).ok
      ? { ok: true, data: (reply as any).data }
      : { ok: false, message: (reply as any).message ?? '操作失败。' };
  } catch {
    return { ok: false, message: '扩展未响应，请重新加载扩展。' };
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function courseCard(course: CourseView, onRefresh: () => void): HTMLElement {
  const card = el('section', 'course');

  card.append(el('strong', 'course-title', course.title));

  const meta = el('div', 'course-meta');
  meta.append(
    el('span', undefined, `${course.lessons.length} 课节`),
    el('span', undefined, `${course.doneCount}/${course.nodeCount} 个互动`)
  );
  if (course.codeHint) {
    meta.append(el('span', 'course-code', `码尾 ${course.codeHint}`));
  }
  card.append(meta);

  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${course.percent}%`;
  bar.append(fill);
  card.append(bar);

  const lessons = el('ul', 'lessons');
  for (const lesson of course.lessons) {
    const li = el('li', lesson.finished ? 'lesson done' : 'lesson');
    const open = el('a', 'lesson-link', lesson.title);
    // 直接打开 B 站原页面，运行时在那里接管
    open.href = `https://www.bilibili.com/video/${lesson.videoId}`;
    open.target = '_blank';
    open.rel = 'noreferrer';
    li.append(open, el('span', 'lesson-count', `${lesson.doneCount}/${lesson.nodeCount}`));
    lessons.append(li);
  }
  card.append(lessons);

  const actions = el('div', 'course-actions');

  const reset = el('button', 'link-button', '重置进度');
  reset.addEventListener('click', async () => {
    const r = await ask({ type: 'resetProgress', courseId: course.courseId });
    if (r.ok) onRefresh();
    else showError(r.message);
  });

  const remove = el('button', 'link-button danger', '删除课程');
  remove.addEventListener('click', async () => {
    const impact = await ask<{ lessonCount: number; attemptCount: number }>({
      type: 'removalImpact',
      courseId: course.courseId,
    });
    // 先说明会失去什么，再确认，而不是删完才知道
    const detail = impact.ok
      ? `将删除 ${impact.data.lessonCount} 个课节和 ${impact.data.attemptCount} 条作答记录。`
      : '';
    if (!confirm(`删除《${course.title}》？${detail}此操作无法撤销。`)) return;
    const r = await ask({ type: 'removeCourse', courseId: course.courseId });
    if (r.ok) onRefresh();
    else showError(r.message);
  });

  actions.append(reset, remove);
  card.append(actions);
  return card;
}

function showError(message: string): void {
  root.querySelector('.error')?.remove();
  root.prepend(el('p', 'error', message));
}

function redeemForm(onDone: () => void): HTMLElement {
  const form = el('form', 'redeem');
  const input = el('input', 'redeem-input');
  input.placeholder = '输入老师给的授权码';
  input.required = true;

  const submit = el('button', 'primary', '领取课程');
  submit.type = 'submit';

  form.append(input, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = '领取中…';
    const r = await ask<{ installed: { title: string }[] }>({
      type: 'redeem',
      code: input.value,
    });
    submit.disabled = false;
    submit.textContent = '领取课程';
    if (r.ok) {
      input.value = '';
      onDone();
    } else {
      showError(r.message);
    }
  });

  return form;
}

async function render(): Promise<void> {
  const r = await ask<LibraryView>({ type: 'library' });
  root.replaceChildren();

  const head = el('header', 'head');
  const brand = el('strong', 'brand');
  const brandMark = el('img', 'brand-mark');
  brandMark.src = '../assets/icon-48.png';
  brandMark.alt = 'KnownMap';
  brand.append(
    brandMark,
    Object.assign(el('span', 'k'), { textContent: 'K' }),
    document.createTextNode('nown'),
    Object.assign(el('span', 'm'), { textContent: 'M' }),
    document.createTextNode('ap')
  );
  head.append(brand, el('small', undefined, '我的课程'));
  root.append(head);

  if (!r.ok) {
    showError(r.message);
    return;
  }

  root.append(redeemForm(render));

  if (!r.data.hasCourses) {
    root.append(el('p', 'empty', '还没有课程。输入老师给的授权码即可领取。'));
  } else {
    for (const course of r.data.courses) {
      root.append(courseCard(course, render));
    }
  }

  if (r.data.hasQuarantine) {
    root.append(
      el('p', 'notice', '有一份本机数据无法识别，已隔离。它不影响其它课程。')
    );
  }
}

void render();
