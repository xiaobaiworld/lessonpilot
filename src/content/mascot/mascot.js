/**
 * Lightweight 2D mascot rendered on canvas.
 * States: idle, playing, paused.
 */
(function initMascot(global) {
  const COLORS = {
    skin: '#f4c99a',
    hair: '#3d2b1f',
    shirt: '#00a1d6',
    pants: '#2f3542',
    eye: '#1a1a1a',
    blush: '#f08a8a'
  };

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {'idle' | 'playing' | 'paused'} state
   * @param {number} frame
   */
  function drawMascot(ctx, state, frame) {
    ctx.clearRect(0, 0, 72, 96);

    const bounce = state === 'playing' ? Math.sin(frame * 0.25) * 2 : 0;
    const armSwing = state === 'playing' ? Math.sin(frame * 0.3) * 8 : 0;
    const blink = frame % 120 < 4;

    ctx.save();
    ctx.translate(0, bounce);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(36, 90, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.pants;
    ctx.fillRect(26, 62, 8, 18);
    ctx.fillRect(38, 62, 8, 18);

    ctx.fillStyle = COLORS.shirt;
    ctx.fillRect(24, 42, 24, 22);

    ctx.save();
    ctx.translate(24, 48);
    ctx.rotate(((-10 + armSwing) * Math.PI) / 180);
    ctx.fillStyle = COLORS.shirt;
    ctx.fillRect(-6, 0, 6, 16);
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(-7, 14, 8, 8);
    ctx.restore();

    ctx.save();
    ctx.translate(48, 48);
    ctx.rotate(((10 - armSwing) * Math.PI) / 180);
    ctx.fillStyle = COLORS.shirt;
    ctx.fillRect(0, 0, 6, 16);
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(-1, 14, 8, 8);
    ctx.restore();

    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(22, 16, 28, 26);

    ctx.fillStyle = COLORS.hair;
    ctx.fillRect(20, 12, 32, 10);
    ctx.fillRect(20, 12, 6, 18);
    ctx.fillRect(46, 12, 6, 18);

    ctx.fillStyle = COLORS.blush;
    ctx.fillRect(24, 30, 4, 3);
    ctx.fillRect(44, 30, 4, 3);

    ctx.fillStyle = COLORS.eye;
    if (blink) {
      ctx.fillRect(28, 26, 6, 1);
      ctx.fillRect(38, 26, 6, 1);
    } else {
      ctx.fillRect(28, 24, 4, 4);
      ctx.fillRect(40, 24, 4, 4);
    }

    ctx.strokeStyle = COLORS.eye;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (state === 'playing') {
      ctx.arc(36, 34, 4, 0, Math.PI);
    } else if (state === 'paused') {
      ctx.moveTo(32, 34);
      ctx.lineTo(40, 34);
    } else {
      ctx.arc(36, 34, 3, 0.1 * Math.PI, 0.9 * Math.PI);
    }
    ctx.stroke();

    ctx.fillStyle = state === 'paused' ? '#fb7299' : '#00a1d6';
    ctx.beginPath();
    ctx.arc(58, 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    if (state === 'paused') {
      ctx.fillRect(55, 16, 2, 8);
      ctx.fillRect(59, 16, 2, 8);
    } else {
      ctx.beginPath();
      ctx.moveTo(56, 16);
      ctx.lineTo(56, 24);
      ctx.lineTo(63, 20);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  class MascotWidget {
    constructor() {
      /** @type {'idle' | 'playing' | 'paused'} */
      this.state = 'idle';
      this.frame = 0;
      this.dragging = false;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
      this.movedDuringDrag = false;
      this.animationId = 0;

      this.shell = document.createElement('div');
      this.shell.id = 'lessonpilot-mascot-shell';

      this.controls = document.createElement('div');
      this.controls.id = 'lessonpilot-mascot-controls';

      this.pauseButton = this.createControlButton('暂停', 'lessonpilot:pause');
      this.seek30Button = this.createControlButton('30秒', 'lessonpilot:seek-30');
      this.seek35Button = this.createControlButton('35秒', 'lessonpilot:seek-35');
      this.controls.append(this.pauseButton, this.seek30Button, this.seek35Button);

      this.root = document.createElement('div');
      this.root.id = 'lessonpilot-mascot-root';
      this.root.dataset.state = 'idle';
      this.root.setAttribute('role', 'button');
      this.root.setAttribute('tabindex', '0');
      this.root.setAttribute('aria-label', 'LessonPilot 学习助手，点击控制视频播放');

      this.canvas = document.createElement('canvas');
      this.canvas.width = 72;
      this.canvas.height = 96;
      this.ctx = this.canvas.getContext('2d');

      this.hint = document.createElement('span');
      this.hint.id = 'lessonpilot-mascot-hint';
      this.hint.textContent = '点击暂停 / 继续';

      this.dialog = document.createElement('div');
      this.dialog.id = 'lessonpilot-mascot-dialog';
      this.dialog.hidden = true;
      this.dialog.innerHTML = `
        <div id="lessonpilot-mascot-dialog-card" role="dialog" aria-modal="true" aria-labelledby="lessonpilot-mascot-dialog-title">
          <p id="lessonpilot-mascot-dialog-title">到达 35 秒</p>
          <p id="lessonpilot-mascot-dialog-body">这里是 LessonPilot 的示例互动点，后续可替换为提问或练习。</p>
          <button type="button" id="lessonpilot-mascot-dialog-close">知道了</button>
        </div>
      `;

      this.root.append(this.canvas, this.hint);
      this.shell.append(this.controls, this.root, this.dialog);
      this.bindEvents();
      this.renderLoop();
    }

    /**
     * @param {string} label
     * @param {string} eventName
     */
    createControlButton(label, eventName) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lessonpilot-mascot-control-btn';
      button.textContent = label;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.shell.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
      });
      return button;
    }

    mount() {
      if (!document.getElementById('lessonpilot-mascot-shell')) {
        document.documentElement.appendChild(this.shell);
      }
    }

    /**
     * @param {'idle' | 'playing' | 'paused'} state
     */
    setState(state) {
      this.state = state;
      this.root.dataset.state = state;
      this.hint.textContent =
        state === 'playing' ? '点击暂停' : state === 'paused' ? '点击继续' : '等待视频…';
    }

    showDialog() {
      this.dialog.hidden = false;
    }

    hideDialog() {
      this.dialog.hidden = true;
    }

    bindEvents() {
      this.dialog.querySelector('#lessonpilot-mascot-dialog-close')?.addEventListener('click', () => {
        this.hideDialog();
      });

      this.dialog.addEventListener('click', (event) => {
        if (event.target === this.dialog) {
          this.hideDialog();
        }
      });

      this.root.addEventListener('pointerdown', (event) => {
        this.dragging = true;
        this.movedDuringDrag = false;
        this.dragOffsetX = event.clientX - this.shell.getBoundingClientRect().left;
        this.dragOffsetY = event.clientY - this.shell.getBoundingClientRect().top;
        this.root.setPointerCapture(event.pointerId);
      });

      this.root.addEventListener('pointermove', (event) => {
        if (!this.dragging) {
          return;
        }
        this.movedDuringDrag = true;
        const maxX = window.innerWidth - this.shell.offsetWidth;
        const maxY = window.innerHeight - this.shell.offsetHeight;
        const nextLeft = Math.min(Math.max(event.clientX - this.dragOffsetX, 0), maxX);
        const nextTop = Math.min(Math.max(event.clientY - this.dragOffsetY, 0), maxY);
        this.shell.style.left = `${nextLeft}px`;
        this.shell.style.top = `${nextTop}px`;
        this.shell.style.right = 'auto';
        this.shell.style.bottom = 'auto';
      });

      const finishDrag = () => {
        this.dragging = false;
      };
      this.root.addEventListener('pointerup', finishDrag);
      this.root.addEventListener('pointercancel', finishDrag);

      this.root.addEventListener('click', (event) => {
        if (this.movedDuringDrag) {
          return;
        }
        event.preventDefault();
        this.shell.dispatchEvent(new CustomEvent('lessonpilot:mascot-toggle', { bubbles: true }));
      });

      this.root.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.shell.dispatchEvent(new CustomEvent('lessonpilot:mascot-toggle', { bubbles: true }));
        }
      });

      this.root.addEventListener('dblclick', () => {
        this.shell.style.left = '';
        this.shell.style.top = '';
        this.shell.style.right = '24px';
        this.shell.style.bottom = '96px';
      });
    }

    renderLoop() {
      this.frame += 1;
      drawMascot(this.ctx, this.state, this.frame);
      this.animationId = window.requestAnimationFrame(() => this.renderLoop());
    }

    destroy() {
      window.cancelAnimationFrame(this.animationId);
      this.shell.remove();
    }
  }

  global.LessonPilotMascot = {
    MascotWidget
  };
})(window);
