import { RuntimeCandidate } from '../shared/library-view';

/**
 * 多候选选择。
 *
 * 同一 BVID 可能落在多门课程里——老师可以把同一个视频用在不同课程。
 * 这时必须让学生显式选择，不能静默取第一个（D-V1-010）：取错了学生会
 * 在一门课里做另一门课的题，而界面上看不出发生了什么。
 *
 * 与学习窗口一样用 Shadow DOM，避免与 B 站样式互相污染。
 */

export class CandidatePicker {
  private host: HTMLElement | null = null;

  constructor(private styleText: string) {}

  /**
   * 显示选择面板，等学生点一个。
   * 学生关掉面板时返回 null —— 这时不启动任何课程，也不留 UI。
   */
  choose(candidates: RuntimeCandidate[]): Promise<RuntimeCandidate | null> {
    return new Promise((resolve) => {
      this.host = document.createElement('div');
      this.host.id = 'knownmap-candidate-picker';
      const root = this.host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = this.styleText;
      root.append(style);

      const panel = document.createElement('div');
      panel.className = 'km-panel';
      panel.setAttribute('role', 'dialog');

      const title = document.createElement('h2');
      title.className = 'km-title';
      title.textContent = '这个视频对应多个课节';
      panel.append(title);

      const hint = document.createElement('p');
      hint.className = 'km-body';
      hint.textContent = '选择要学习的那一个。选错了可以关掉面板重新进入页面。';
      panel.append(hint);

      const list = document.createElement('div');
      list.className = 'km-options';

      const finish = (picked: RuntimeCandidate | null) => {
        this.destroy();
        resolve(picked);
      };

      for (const candidate of candidates) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'km-candidate';

        const course = document.createElement('strong');
        course.textContent = candidate.courseTitle;
        const lesson = document.createElement('span');
        lesson.textContent = candidate.lessonTitle;

        button.append(course, lesson);
        button.addEventListener('click', () => finish(candidate));
        list.append(button);
      }
      panel.append(list);

      const actions = document.createElement('div');
      actions.className = 'km-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'km-button km-ghost';
      cancel.textContent = '先不学';
      cancel.addEventListener('click', () => finish(null));
      actions.append(cancel);
      panel.append(actions);

      root.append(panel);
      // 同学习窗口：全屏时必须挂进全屏元素，否则不可见
      (document.fullscreenElement ?? document.body).append(this.host);
      panel.querySelector<HTMLElement>('button')?.focus();
    });
  }

  destroy(): void {
    this.host?.remove();
    this.host = null;
  }
}
