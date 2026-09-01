import { CourseUpdateSummary } from '../background/redeem';
import { StudentSettings } from '../storage/settings';
import { CourseView, LibraryView } from '../shared/library-view';
import { requestPluginDownload } from './update';

declare const __TEACHER_URL__: string;
declare const __STUDENT_PLUGIN_DOWNLOAD_URL__: string;

type Reply<T> = { ok: true; data: T } | { ok: false; message: string };
type CompanionState = 'idle' | 'focus' | 'prompt' | 'correct' | 'wrong' | 'complete';
type CompanionAsset = {
  state: CompanionState;
  image: string;
  audio: string | null;
  durationMs: number | null;
  message?: string;
};

const companionStates: readonly CompanionState[] = [
  'idle', 'focus', 'prompt', 'correct', 'wrong', 'complete',
];
const companionStateLabels: Record<CompanionState, string> = {
  idle: '安静等待',
  focus: '开始注意',
  prompt: '提示与等待',
  correct: '答对反馈',
  wrong: '答错反馈',
  complete: '完成庆祝',
};
const companionSounds = ['focus', 'prompt', 'correct', 'wrong', 'complete'] as const;

const root = document.getElementById('root')!;
let settings: StudentSettings = {
  showRedeemEntry: true,
  showRecommendations: true,
  syncMode: 'prompt',
  shortcut: 'Alt+K',
  mascot: 'standard',
};
let soundEnabled = true;
let updates: CourseUpdateSummary[] = [];
let previewAudio: HTMLAudioElement | null = null;

async function ask<T>(message: unknown): Promise<Reply<T>> {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    if (!reply || typeof reply !== 'object') return { ok: false, message: '扩展需要重新加载，请在扩展页面点刷新。' };
    return (reply as any).ok
      ? { ok: true, data: (reply as any).data as T }
      : { ok: false, message: (reply as any).message ?? '操作失败。' };
  } catch {
    return { ok: false, message: '扩展未响应，请重新加载扩展。' };
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(message: string): void {
  root.querySelector('.error')?.remove();
  root.prepend(el('p', 'error', message));
}

function wordmark(): HTMLElement {
  const title = el('strong', 'wordmark');
  title.append(el('span', 'brand-letter-k', 'K'), document.createTextNode('nown'), el('span', 'brand-letter-m', 'M'), document.createTextNode('ap'));
  return title;
}

function brandHeader(onSettings: () => void, onBack?: () => void, backLabel = '返回首页'): HTMLElement {
  const head = el('header', 'brand');
  if (onBack) {
    const back = el('button', 'back-button', '‹');
    back.type = 'button';
    back.title = backLabel;
    back.setAttribute('aria-label', backLabel);
    back.addEventListener('click', onBack);
    head.append(back);
  }
  const mark = el('img');
  mark.src = '../assets/icon-48.png';
  mark.alt = '';
  const copy = el('div');
  copy.append(wordmark(), el('span', undefined, `课程助手 · v${chrome.runtime.getManifest().version}`));
  const button = el('button', 'avatar-settings-button');
  button.type = 'button';
  button.textContent = onBack ? '×' : '⚙';
  button.title = onBack ? '关闭设置' : '打开插件设置';
  button.setAttribute('aria-label', onBack ? '关闭设置' : '打开插件设置');
  button.addEventListener('click', onSettings);
  head.append(mark, copy, button);
  return head;
}

function accountPanel(): HTMLElement {
  const section = el('section', 'account-panel');
  const copy = el('div', 'account-copy');
  copy.append(el('strong', undefined, '学生账号'), el('span', undefined, '未登录 · 本机课程仍可正常使用'));
  const button = el('button', 'secondary-button', '登录 / 注册');
  button.type = 'button';
  button.disabled = true;
  button.title = '学生账号服务将在后端接口完成后开放';
  section.append(el('span', 'account-mark', '◎'), copy, button);
  return section;
}

function introPanel(): HTMLElement {
  const intro = el('section', 'intro');
  intro.append(el('p', 'eyebrow', '学生入口'), el('h1', undefined, '把课程放进你的学习路径'), el('p', undefined, '领取课程、继续学习和查看升级，都从这里开始。'));
  return intro;
}

function redeemForm(onDone: (message: string) => void): HTMLElement {
  const form = el('form', 'redeem');
  const heading = el('div', 'redeem-heading');
  heading.append(el('strong', undefined, '领取新课程'), el('span', undefined, '使用老师发来的授权码'));
  const row = el('div', 'redeem-row');
  const input = el('input', 'redeem-input');
  input.id = 'redeem-code';
  input.name = 'access-code';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.maxLength = 28;
  input.placeholder = 'KM-XXXXX-XXXXX-XXXXX-XXXXX';
  input.required = true;
  const submit = el('button', 'primary', '领取');
  submit.type = 'submit';
  row.append(input, submit);
  form.append(heading, row);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = '领取中…';
    const reply = await ask<{ installed: { title: string }[] }>({ type: 'redeem', code: input.value });
    submit.disabled = false;
    submit.textContent = '领取';
    if (reply.ok) { input.value = ''; onDone('课程已保存，可以开始学习。'); } else showError(reply.message);
  });
  return form;
}

function updateFor(courseId: string): CourseUpdateSummary | undefined {
  return updates.find((item) => item.courseId === courseId && item.status === 'update');
}

function courseCard(course: CourseView, onRefresh: () => void): HTMLElement {
  const card = el('article', 'course course-card');
  const heading = el('div', 'course-title-row');
  heading.append(el('strong', 'course-title', course.title));
  if (course.readOnly) heading.append(el('span', 'demo-tag', '示例课'));
  card.append(heading);
  const meta = el('div', 'course-meta');
  meta.append(el('span', undefined, `${course.lessons.length} 课节`), el('span', undefined, `${course.doneCount}/${course.nodeCount} 个互动`));
  if (course.codeHint) meta.append(el('span', 'course-code', `码尾 ${course.codeHint}`));
  card.append(meta);
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${course.percent}%`;
  bar.append(fill);
  card.append(bar);

  const action = updateFor(course.courseId);
  if (action) {
    const update = el('div', 'course-update');
    update.append(el('span', undefined, `有新版本 v${action.releaseNumber}`));
    const button = el('button', 'update-course-button', '需要升级');
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '升级中…';
      const reply = await ask({ type: 'upgradeCourse', courseId: course.courseId, expectedReleaseId: action.releaseId });
      if (reply.ok) onRefresh();
      else { button.disabled = false; button.textContent = '需要升级'; showError(reply.message); }
    });
    update.append(button);
    card.append(update);
  }

  const lessons = el('ul', 'lessons');
  for (const lesson of course.lessons) {
    const li = el('li', lesson.finished ? 'lesson done' : 'lesson');
    const open = el('a', 'lesson-link', lesson.title);
    const query = new URLSearchParams();
    if (lesson.page && lesson.page !== 1) query.set('p', String(lesson.page));
    if (lesson.cid) query.set('cid', lesson.cid);
    open.href = `https://www.bilibili.com/video/${lesson.videoId}/${query.toString() ? `?${query}` : ''}`;
    open.target = '_blank';
    open.rel = 'noreferrer';
    li.append(open, el('span', 'lesson-count', `${lesson.doneCount}/${lesson.nodeCount}`));
    lessons.append(li);
  }
  card.append(lessons);

  const actions = el('div', 'course-actions');
  const reset = el('button', 'link-button', '重置进度');
  reset.type = 'button';
  reset.addEventListener('click', async () => {
    const reply = await ask({ type: 'resetProgress', courseId: course.courseId });
    if (reply.ok) onRefresh(); else showError(reply.message);
  });
  actions.append(reset);
  if (!course.readOnly) {
    const remove = el('button', 'link-button danger', '删除课程');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      const impact = await ask<{ lessonCount: number; attemptCount: number }>({ type: 'removalImpact', courseId: course.courseId });
      const detail = impact.ok ? `将删除 ${impact.data.lessonCount} 个课节和 ${impact.data.attemptCount} 条作答记录。` : '';
      if (!confirm(`删除《${course.title}》？${detail}此操作无法撤销。`)) return;
      const reply = await ask({ type: 'removeCourse', courseId: course.courseId });
      if (reply.ok) onRefresh(); else showError(reply.message);
    });
    actions.append(remove);
  }
  card.append(actions);
  return card;
}

function coursesPanel(courses: CourseView[], onRefresh: () => void): HTMLElement {
  const section = el('section', 'courses');
  const heading = el('div', 'section-heading');
  heading.append(el('h2', undefined, '全部课程'), el('span', undefined, `当前 ${courses.length} 门`));
  section.append(heading);
  const list = el('div', 'course-list');
  for (const course of courses) list.append(courseCard(course, onRefresh));
  section.append(list);
  if (courses.length === 0) section.append(el('p', 'empty', '还没有课程，领取新课程后会显示在这里。'));
  return section;
}

function upgradeNotice(): HTMLElement | null {
  const count = updates.filter((item) => item.status === 'update').length;
  if (!count) return null;
  const section = el('section', 'upgrade-notice');
  section.append(el('span', undefined, `${count} 门课程可以升级，当前学习不会被打断`));
  const button = el('button', 'link-button', '查看');
  button.type = 'button';
  button.addEventListener('click', () => root.querySelector('.course-update')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  section.append(button);
  return section;
}

function recommendationsPanel(): HTMLElement {
  const section = el('section', 'recommendations');
  const heading = el('div', 'section-heading');
  heading.append(el('h2', undefined, '为你推荐'), el('span', undefined, '登录后更准确'));
  section.append(heading, el('p', 'empty', '学生账号和推荐目录尚未接入，暂不展示虚构课程。'));
  return section;
}

function teacherEntry(): HTMLElement {
  const section = el('section', 'teacher-entry');
  const copy = el('div');
  copy.append(el('p', 'eyebrow', '老师使用'), el('h2', undefined, '创建和发布课程'));
  const link = el('a', undefined, '教师登录');
  link.href = __TEACHER_URL__;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  section.append(copy, link);
  return section;
}

function pluginUpdatePanel(): HTMLElement {
  const section = el('section', 'plugin-update');
  const copy = el('div');
  copy.append(el('p', 'eyebrow', '插件维护'), el('h2', undefined, '在线更新学生插件'));
  const button = el('button', 'update-button', '在线更新');
  button.type = 'button';
  const status = el('p', 'update-status');
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '正在下载最新插件…';
    try {
      await requestPluginDownload(chrome.downloads.download.bind(chrome.downloads), () => chrome.runtime.lastError?.message, __STUDENT_PLUGIN_DOWNLOAD_URL__);
      status.textContent = '更新包已下载，请替换插件目录后刷新。';
    } catch { status.textContent = '更新包下载失败，请稍后重试。'; }
    finally { button.disabled = false; }
  });
  section.append(copy, button, status);
  return section;
}

async function refreshData(): Promise<LibraryView | null> {
  const [libraryReply, settingsReply, soundReply] = await Promise.all([
    ask<LibraryView>({ type: 'library' }),
    ask<StudentSettings>({ type: 'getStudentSettings' }),
    ask<{ soundEnabled: boolean }>({ type: 'companionSound' }),
  ]);
  if (!libraryReply.ok) { showError(libraryReply.message); return null; }
  if (settingsReply.ok) settings = settingsReply.data;
  if (soundReply.ok) soundEnabled = soundReply.data.soundEnabled;
  const updateReply = await ask<{ courses: CourseUpdateSummary[] }>({ type: 'checkCourseUpdates' });
  updates = updateReply.ok ? updateReply.data.courses : [];
  return libraryReply.data;
}

async function saveSetting(patch: Partial<StudentSettings>): Promise<void> {
  const reply = await ask<StudentSettings>({ type: 'setStudentSettings', settings: patch });
  if (!reply.ok) { showError(reply.message); return; }
  settings = reply.data;
  renderSettings();
}

function settingRow(title: string, description: string, action: HTMLElement): HTMLElement {
  const row = el('div', 'setting-item');
  const copy = el('div', 'setting-copy');
  copy.append(el('strong', undefined, title), el('span', undefined, description));
  row.append(copy, action);
  return row;
}

function toggle(title: string, description: string, enabled: boolean, onChange: (next: boolean) => void): HTMLElement {
  const button = el('button', enabled ? 'toggle active' : 'toggle', enabled ? '开' : '关');
  button.type = 'button';
  button.setAttribute('aria-pressed', String(enabled));
  button.addEventListener('click', () => onChange(!enabled));
  return settingRow(title, description, button);
}

async function loadCompanionAssets(): Promise<Map<CompanionState, CompanionAsset>> {
  const loaded = await Promise.all(companionStates.map(async (state) => {
    const reply = await ask<CompanionAsset>({ type: 'companionAsset', packId: 'cat-v1', state });
    return reply.ok ? [state, reply.data] as const : null;
  }));
  return new Map(loaded.filter((entry): entry is readonly [CompanionState, CompanionAsset] => entry !== null));
}

function stopPreviewAudio(): void {
  if (!previewAudio) return;
  previewAudio.pause();
  previewAudio.currentTime = 0;
  previewAudio = null;
}

function playPreviewAudio(url: string): void {
  stopPreviewAudio();
  const audio = new Audio(url);
  previewAudio = audio;
  audio.addEventListener('ended', () => {
    if (previewAudio === audio) previewAudio = null;
  });
  void audio.play().catch(() => showError('声音暂时无法试听。'));
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs) return '—';
  return `${durationMs % 1000 === 0 ? durationMs / 1000 : (durationMs / 1000).toFixed(1)} 秒`;
}

function companionCategory(name: string, subtitle: string, description: string, emoji: string): HTMLElement {
  const card = el('button', 'companion-category unavailable');
  card.type = 'button';
  card.disabled = true;
  card.append(
    el('span', 'companion-category-emoji', emoji),
    el('strong', undefined, name),
    el('span', 'companion-category-subtitle', subtitle),
    el('span', 'companion-category-copy', description),
    el('span', 'future', '下一版本完成'),
  );
  return card;
}

async function renderCompanionSettings(): Promise<void> {
  stopPreviewAudio();
  root.replaceChildren();
  const shell = el('main', 'shell companion-shell');
  shell.append(brandHeader(() => window.close(), () => renderSettings(), '返回插件设置'));
  shell.append(el('p', 'status', '正在准备学习伙伴…'));
  root.append(shell);

  const assets = await loadCompanionAssets();
  const idle = assets.get('idle');
  if (!idle) {
    shell.replaceChildren(brandHeader(() => window.close(), () => renderSettings(), '返回插件设置'));
    shell.append(el('p', 'error', '学习伙伴资源暂时无法读取，请重新加载插件。'));
    return;
  }

  shell.replaceChildren(brandHeader(() => window.close(), () => renderSettings(), '返回插件设置'));
  const title = el('div', 'settings-title');
  title.append(el('h1', undefined, '学习伙伴'), el('p', undefined, '选择一位陪你学习的伙伴。它会带着自己的状态图和声音，在合适的时刻出现。'));
  shell.append(title);

  const hero = el('section', 'companion-hero');
  const heroImage = el('img', 'companion-hero-image') as HTMLImageElement;
  heroImage.src = idle.image;
  heroImage.alt = '神秘猫精灵当前形象';
  const heroCopy = el('div', 'companion-hero-copy');
  heroCopy.append(el('span', 'eyebrow', '当前伙伴'), el('h2', undefined, '神秘猫精灵'), el('p', undefined, '能够给你温柔陪伴，并带来特殊力量，让你的学习效率倍增。'));
  hero.append(heroImage, heroCopy, el('span', 'companion-selected', '已选择'));
  shell.append(hero);

  const stateSection = el('section', 'companion-section');
  stateSection.append(el('h2', 'setting-group-title', '它在学习中的样子'));
  const stateGrid = el('div', 'companion-state-grid');
  for (const state of companionStates) {
    const asset = assets.get(state);
    if (!asset) continue;
    const button = el('button', 'companion-thumb') as HTMLButtonElement;
    button.type = 'button';
    button.title = companionStateLabels[state];
    button.setAttribute('aria-label', `查看${companionStateLabels[state]}`);
    const image = el('img') as HTMLImageElement;
    image.src = asset.image;
    image.alt = companionStateLabels[state];
    button.append(image);
    button.addEventListener('mouseenter', () => { heroImage.src = asset.image; });
    button.addEventListener('focus', () => { heroImage.src = asset.image; });
    button.addEventListener('mouseleave', () => { heroImage.src = idle.image; });
    button.addEventListener('blur', () => { heroImage.src = idle.image; });
    stateGrid.append(button);
  }
  stateSection.append(stateGrid);
  shell.append(stateSection);

  const soundSection = el('section', 'companion-section');
  soundSection.append(el('h2', 'setting-group-title', '神秘猫精灵声音组'));
  for (const state of companionSounds) {
    const asset = assets.get(state);
    if (!asset?.audio) continue;
    const row = el('div', 'sound-row');
    const copy = el('div', 'sound-copy');
    copy.append(el('strong', undefined, companionStateLabels[state]), el('span', undefined, `${formatDuration(asset.durationMs)} · 角色专属声音`));
    const preview = el('button', 'sound-preview', '试听') as HTMLButtonElement;
    preview.type = 'button';
    preview.dataset.audioPreview = state;
    preview.addEventListener('click', () => playPreviewAudio(asset.audio!));
    row.append(copy, preview);
    soundSection.append(row);
  }
  const soundSwitch = el('button', soundEnabled ? 'sound-switch active' : 'sound-switch', soundEnabled ? '学习时播放声音' : '学习时静音') as HTMLButtonElement;
  soundSwitch.type = 'button';
  soundSwitch.addEventListener('click', async () => {
    const reply = await ask<{ soundEnabled: boolean }>({ type: 'setCompanionSound', enabled: !soundEnabled });
    if (!reply.ok) { showError(reply.message); return; }
    soundEnabled = reply.data.soundEnabled;
    void renderCompanionSettings();
  });
  soundSection.append(soundSwitch);
  shell.append(soundSection);

  const categories = el('section', 'companion-section');
  categories.append(el('h2', 'setting-group-title', '选择伙伴类别'));
  const categoryGrid = el('div', 'companion-categories');
  const cat = el('button', 'companion-category selected') as HTMLButtonElement;
  cat.type = 'button';
  cat.setAttribute('aria-pressed', 'true');
  const catImage = el('img', 'companion-category-image') as HTMLImageElement;
  catImage.src = idle.image;
  catImage.alt = '';
  cat.append(catImage, el('strong', undefined, '神秘猫精灵'), el('span', 'companion-category-subtitle', '温柔陪伴 · 特殊力量'), el('span', 'companion-category-copy', '用安静又有力量的陪伴，帮你把每一次专注变得更有收获。'), el('span', 'companion-category-check', '✓'));
  categoryGrid.append(
    cat,
    companionCategory('元气伙伴', '热情鼓励 · 持续动力', '用满满的热情陪你坚持，让每一次尝试都更有动力。', '🐶'),
    companionCategory('森林伙伴', '轻松陪伴 · 保持好奇', '带来轻松新鲜的陪伴，帮助你保持好奇与专注。', '🦊'),
    companionCategory('未知世界伙伴', '空灵相遇 · 专属陪伴', '来自未知世界的特别伙伴，更多能力正在准备中。', '🧑‍🚀'),
  );
  categories.append(categoryGrid);
  shell.append(categories, el('p', 'companion-tip', '选对伙伴，让你的学习事半功倍。'));
}

function renderSettings(): void {
  root.replaceChildren();
  const shell = el('main', 'shell settings-shell');
  shell.append(brandHeader(() => void renderHome(), () => void renderHome()));
  const title = el('div', 'settings-title');
  title.append(el('h1', undefined, '插件设置'), el('p', undefined, '课程领取和继续学习留在首页，这里集中管理账号、升级和学习偏好。'));
  shell.append(title);

  const account = el('section', 'setting-group');
  account.append(el('h2', 'setting-group-title', '学生账号'));
  const login = el('button', 'secondary-button', '登录 / 注册');
  login.type = 'button';
  login.disabled = true;
  login.title = '学生账号服务将在后端接口完成后开放';
  account.append(settingRow('未登录', '登录后可同步课程；当前本机授权码课程不受影响。', login));
  shell.append(account);

  const home = el('section', 'setting-group');
  home.append(el('h2', 'setting-group-title', '首页显示'));
  home.append(toggle('显示领取新课程', '在首页保留课程授权码入口。', settings.showRedeemEntry, (next) => void saveSetting({ showRedeemEntry: next })));
  home.append(toggle('显示为你推荐', '没有真实推荐数据时显示清晰的空状态。', settings.showRecommendations, (next) => void saveSetting({ showRecommendations: next })));
  shell.append(home);

  const upgrade = el('section', 'setting-group');
  upgrade.append(el('h2', 'setting-group-title', '课程升级'));
  const mode = document.createElement('select');
  mode.className = 'setting-select';
  for (const option of [['auto', '自动升级'], ['prompt', '提示升级'], ['manual', '手动检查']] as const) {
    const item = document.createElement('option');
    item.value = option[0];
    item.textContent = option[1];
    item.selected = settings.syncMode === option[0];
    mode.append(item);
  }
  mode.addEventListener('change', () => void saveSetting({ syncMode: mode.value as StudentSettings['syncMode'] }));
  upgrade.append(settingRow('升级方式', '默认提示升级，确认后才替换本机课程。', mode));
  const check = el('button', 'secondary-button', '检查');
  check.type = 'button';
  check.addEventListener('click', async () => {
    check.disabled = true;
    check.textContent = '检查中…';
    const reply = await ask<{ courses: CourseUpdateSummary[] }>({ type: 'checkCourseUpdates' });
    if (reply.ok) updates = reply.data.courses; else showError(reply.message);
    check.disabled = false;
    check.textContent = '检查';
  });
  upgrade.append(settingRow('检查课程更新', '只检查本机已经安装的课程。', check));
  shell.append(upgrade);

  const companion = el('section', 'setting-group');
  companion.append(el('h2', 'setting-group-title', '学习伙伴'));
  const companionButton = el('button', 'secondary-button', '设置');
  companionButton.type = 'button';
  companionButton.addEventListener('click', () => void renderCompanionSettings());
  companion.append(settingRow('神秘猫精灵', '6 种状态 · 角色声音 · 完成时增加小鱼。', companionButton));
  shell.append(companion);

  const playback = el('section', 'setting-group');
  playback.append(el('h2', 'setting-group-title', '播放与声音'));
  playback.append(settingRow('快捷键', '默认 Alt+K，可修改。', el('span', 'setting-value', settings.shortcut)));
  playback.append(toggle('学习伙伴声音', '提示、答题反馈和完成庆祝声音。', soundEnabled, async (next) => {
    const reply = await ask({ type: 'setCompanionSound', enabled: next });
    if (!reply.ok) showError(reply.message); else { soundEnabled = next; renderSettings(); }
  }));
  playback.append(settingRow('视频模式', '课程模式 / 原视频模式。', el('span', 'setting-value', '课程页可切换')));
  shell.append(playback);

  const maintenance = el('section', 'setting-group');
  maintenance.append(el('h2', 'setting-group-title', '插件维护'));
  maintenance.append(settingRow('KnownMap 学生插件', `当前版本 v${chrome.runtime.getManifest().version} · 在线更新`, el('span', 'version-badge', '当前')));
  shell.append(maintenance);

  const future = el('section', 'setting-group');
  future.append(el('h2', 'setting-group-title', '后续功能'));
  future.append(settingRow('更多角色包与外观变体', '波斯猫、黑猫、英短、毛色等。', el('span', 'future', '下一版本完成')));
  future.append(settingRow('自定义头像与个性设定', '上传图片、头像编辑和自定义声音。', el('span', 'future', '下一版本完成')));
  shell.append(future);
  shell.append(el('p', 'settings-footnote', '设置保存在本机偏好中；学生账号和推荐服务接入后可继续扩展。'));
  root.append(shell);
}

async function renderHome(): Promise<void> {
  const library = await refreshData();
  if (!library) return;
  root.replaceChildren();
  const shell = el('main', 'shell');
  shell.append(brandHeader(() => renderSettings()), accountPanel(), introPanel());
  const notice = upgradeNotice();
  if (notice) shell.append(notice);
  if (settings.showRedeemEntry) shell.append(redeemForm(() => void renderHome()));
  shell.append(coursesPanel(library.courses, () => void renderHome()));
  if (settings.showRecommendations) shell.append(recommendationsPanel());
  shell.append(teacherEntry(), pluginUpdatePanel());
  if (library.hasQuarantine) shell.append(el('p', 'notice', '有一份本机数据无法识别，已隔离。它不影响其它课程。'));
  root.append(shell);
}

void renderHome();
