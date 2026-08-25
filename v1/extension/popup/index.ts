import { LibraryView, CourseView } from '../shared/library-view';
import { requestPluginDownload } from './update';

declare const __TEACHER_URL__: string;
declare const __STUDENT_PLUGIN_DOWNLOAD_URL__: string;

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
  const card = el('article', 'course course-card');

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

function redeemForm(onDone: (message: string) => void): HTMLElement {
  const form = el('form', 'redeem');
  const label = el('label', 'redeem-label', '课程授权码');
  label.htmlFor = 'redeem-code';
  const input = el('input', 'redeem-input');
  input.id = 'redeem-code';
  input.name = 'access-code';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.maxLength = 28;
  input.placeholder = 'KM-XXXXX-XXXXX-XXXXX-XXXXX';
  input.required = true;

  const submit = el('button', 'primary', '领取课程');
  submit.type = 'submit';

  form.append(label, input, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = '领取中…';
    const status = root.querySelector<HTMLElement>('.status');
    if (status) status.textContent = '正在下载并校验课程…';
    const r = await ask<{ installed: { title: string }[] }>({
      type: 'redeem',
      code: input.value,
    });
    submit.disabled = false;
    submit.textContent = '领取课程';
    if (r.ok) {
      input.value = '';
      onDone('课程已保存，可以开始学习。');
    } else {
      if (status) status.textContent = r.message;
    }
  });

  return form;
}

function pluginUpdatePanel(): HTMLElement {
  const section = el('section', 'plugin-update');
  const copy = el('div');
  copy.append(
    el('p', 'eyebrow', '插件维护'),
    el('h2', undefined, '在线更新学生插件')
  );

  const button = el('button', 'update-button', '在线更新');
  button.type = 'button';
  const status = el('p', 'update-status');
  status.setAttribute('role', 'status');

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '正在下载最新插件…';
    try {
      await requestPluginDownload(
        chrome.downloads.download.bind(chrome.downloads),
        () => chrome.runtime.lastError?.message,
        __STUDENT_PLUGIN_DOWNLOAD_URL__
      );
      status.textContent = '更新包已下载，请替换插件目录后刷新 KnownMap。';
    } catch {
      status.textContent = '更新包下载失败，请稍后重试。';
    } finally {
      button.disabled = false;
    }
  });

  section.append(copy, button, status);
  return section;
}

function brandHeader(): HTMLElement {
  const head = el('header', 'brand');
  const mark = el('img');
  mark.src = '../assets/icon-48.png';
  mark.alt = '';
  const copy = el('div');
  copy.append(el('strong', undefined, 'KnownMap'), el('span', undefined, '课程助手'));
  head.append(mark, copy, el('span', 'role-badge', '学生'));
  return head;
}

function introPanel(): HTMLElement {
  const intro = el('section', 'intro');
  intro.append(
    el('p', 'eyebrow', '学生入口'),
    el('h1', undefined, '使用授权码，无需注册'),
    el('p', undefined, '输入老师发来的课程授权码，课程会保存到这台浏览器。')
  );
  return intro;
}

function coursesPanel(courses: CourseView[], onRefresh: () => void): HTMLElement {
  const section = el('section', 'courses');
  const heading = el('div', 'section-heading');
  heading.append(
    el('h2', undefined, '我的课程'),
    el('span', undefined, `当前 ${courses.length} 门`)
  );
  section.append(heading);

  if (courses.length === 0) {
    section.append(el('p', 'empty', '还没有课程，输入授权码后会显示在这里。'));
    return section;
  }

  const list = el('div', 'course-list');
  for (const course of courses) list.append(courseCard(course, onRefresh));
  section.append(list);
  return section;
}

function teacherEntry(): HTMLElement {
  const section = el('section', 'teacher-entry');
  const copy = el('div');
  copy.append(
    el('p', 'eyebrow', '老师使用'),
    el('h2', undefined, '创建和发布课程')
  );
  const link = el('a', undefined, '教师登录');
  link.href = __TEACHER_URL__;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  section.append(copy, link);
  return section;
}

async function render(statusMessage = ''): Promise<void> {
  const r = await ask<LibraryView>({ type: 'library' });
  root.replaceChildren();

  const shell = el('main', 'shell');
  shell.append(brandHeader(), introPanel());

  if (!r.ok) {
    shell.append(redeemForm(render), el('p', 'status', r.message));
    root.append(shell);
    return;
  }

  shell.append(
    redeemForm(render),
    el('p', 'status', statusMessage),
    coursesPanel(r.data.courses, render),
    teacherEntry(),
    pluginUpdatePanel()
  );

  if (r.data.hasQuarantine) {
    shell.append(
      el('p', 'notice', '有一份本机数据无法识别，已隔离。它不影响其它课程。')
    );
  }
  root.append(shell);
}

void render();
