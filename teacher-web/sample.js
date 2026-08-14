/* Sales sample page only. Pair with index.html and sample.css. */
(function initTeacherSample() {
  const toast = document.querySelector('#toast');
  const previewDialog = document.querySelector('#preview-dialog');
  const previewBody = document.querySelector('#preview-dialog-body');
  const addPanel = document.querySelector('#add-node-panel');
  let toastTimer = null;

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toast.setAttribute('aria-hidden', 'false');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.setAttribute('aria-hidden', 'true');
    }, 2600);
  };

  const focusNode = (id) => {
    const nodeId = String(id);
    document.querySelectorAll('.sample-mark').forEach((mark) => {
      const active = mark.dataset.node === nodeId;
      mark.classList.toggle('is-active', active);
      if (active) mark.setAttribute('aria-current', 'true');
      else mark.removeAttribute('aria-current');
    });
    document.querySelectorAll('.sample-node').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.node === nodeId);
    });
    document.getElementById(`node-${nodeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  document.querySelectorAll('[data-node], [data-focus-node]').forEach((button) => {
    button.addEventListener('click', () => {
      focusNode(button.dataset.node || button.dataset.focusNode);
    });
  });

  document.querySelectorAll('.sample-node').forEach((node) => {
    node.addEventListener('click', (event) => {
      if (event.target.closest('button, textarea, select, label')) return;
      focusNode(node.dataset.node);
    });
  });

  document.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(`edit-${button.dataset.edit}`);
      const nextHidden = !panel.hidden;
      panel.hidden = nextHidden;
      button.textContent = nextHidden ? '编辑节点' : '收起编辑';
      focusNode(button.dataset.edit);
    });
  });

  const familySelect = document.querySelector('#add-node-family');
  const fieldsRoot = document.querySelector('#add-node-fields');
  const previewRoot = document.querySelector('#add-node-preview');
  const shotRoot = document.querySelector('#add-node-shot');

  const familyForms = {
    attention: [
      { name: 'title', label: '标题', kind: 'input', value: '把习惯说成可证明的行动' },
      { name: 'highlights', label: '标出的关键词', kind: 'input', value: 'keep exercising' },
      { name: 'body', label: '提醒正文', kind: 'textarea', value: '“我喜欢运动”还不够。标出 keep exercising，提醒学生补上频率和结果。' }
    ],
    voice: [
      { name: 'title', label: '标题', kind: 'input', value: '把习惯再落成一句可说的话' },
      { name: 'transcript', label: '老师补充文稿', kind: 'textarea', value: '不要只说 I like exercising。补上多久一次、坚持了多久、身体或工作上有什么变化。' }
    ],
    practice: [
      { name: 'interaction', label: '练习方式', kind: 'select', value: 'blank', options: [
        { value: 'choice', label: '选择题' },
        { value: 'blank', label: '填空题' },
        { value: 'order', label: '排序题' }
      ] },
      { name: 'prompt', label: '题目', kind: 'textarea', value: 'I keep exercising three times a week, so I ______ more energy at work.' },
      { name: 'answer', label: '标准答案', kind: 'input', value: 'have' }
    ],
    followup: [
      { name: 'prompt', label: '追问', kind: 'textarea', value: '用自己的习惯回答：你如何保持状态？' },
      { name: 'scaffold', label: '评价方向', kind: 'textarea', value: '具体习惯 · 频率 · 可观察的结果' }
    ]
  };

  const fieldValue = (form, name) => form.querySelector(`[name="${name}"]`)?.value.trim() || '';

  const renderFamilyFields = (family) => {
    fieldsRoot.replaceChildren();
    familyForms[family].forEach((field) => {
      const label = document.createElement('label');
      label.append(field.label);
      let control;
      if (field.kind === 'textarea') {
        control = document.createElement('textarea');
        control.rows = 2;
        control.value = field.value;
      } else if (field.kind === 'select') {
        control = document.createElement('select');
        field.options.forEach((option) => {
          const item = document.createElement('option');
          item.value = option.value;
          item.textContent = option.label;
          if (option.value === field.value) item.selected = true;
          control.append(item);
        });
      } else {
        control = document.createElement('input');
        control.value = field.value;
      }
      control.name = field.name;
      label.append(control);
      fieldsRoot.append(label);
    });
    previewRoot.hidden = true;
  };

  const appendShot = (parent, className, lines) => {
    const block = document.createElement('div');
    block.className = className;
    lines.forEach(([tag, text]) => {
      const node = document.createElement(tag);
      node.textContent = text;
      block.append(node);
    });
    parent.append(block);
  };

  const renderAddPreview = () => {
    const family = familySelect.value;
    const title = fieldValue(fieldsRoot, 'title');
    const highlights = fieldValue(fieldsRoot, 'highlights');
    const body = fieldValue(fieldsRoot, 'body');
    const transcript = fieldValue(fieldsRoot, 'transcript');
    const prompt = fieldValue(fieldsRoot, 'prompt');
    const scaffold = fieldValue(fieldsRoot, 'scaffold');
    const shotClass = family === 'voice' ? 'voice' : family === 'practice' ? 'activity' : family === 'followup' ? 'followup' : 'attention';
    shotRoot.className = `sample-preview-shot is-${shotClass}`;
    shotRoot.replaceChildren();
    if (family === 'voice') {
      appendShot(shotRoot, 'shot-card', [['span', title || '老师补充'], ['p', transcript], ['b', '继续']]);
    } else if (family === 'practice') {
      appendShot(shotRoot, 'shot-card', [['span', '互动练习'], ['p', prompt], ['b', '检查']]);
    } else if (family === 'followup') {
      appendShot(shotRoot, 'shot-card', [['span', prompt], ['p', ''], ['small', `评价方向：${scaffold}`]]);
      shotRoot.querySelector('p').className = 'shot-lines';
    } else {
      appendShot(shotRoot, 'shot-video', [['span', '视频已暂停'], ['strong', highlights || title]]);
      const note = document.createElement('p');
      note.textContent = body;
      shotRoot.append(note);
    }
  };

  const toggleAddPanel = () => {
    addPanel.hidden = !addPanel.hidden;
    if (!addPanel.hidden) addPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  familySelect.addEventListener('change', () => renderFamilyFields(familySelect.value));
  document.querySelector('#add-node').addEventListener('click', toggleAddPanel);
  document.querySelector('#add-node-demo').addEventListener('click', () => {
    renderAddPreview();
    previewRoot.hidden = false;
    showToast('节点效果已按当前内容生成，可继续完善课堂设计。');
  });

  document.querySelectorAll('[data-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      focusNode(button.dataset.preview);
      previewBody.replaceChildren(button.cloneNode(true));
      previewBody.querySelector('button')?.setAttribute('tabindex', '-1');
      previewDialog.showModal();
    });
  });

  document.querySelector('#close-preview').addEventListener('click', () => previewDialog.close());
  previewDialog.addEventListener('click', (event) => {
    if (event.target === previewDialog) previewDialog.close();
  });

  document.querySelectorAll('[data-expand-student]').forEach((button) => {
    button.addEventListener('click', () => {
      const detail = document.getElementById(`student-${button.dataset.expandStudent}-detail`);
      detail.hidden = !detail.hidden;
    });
  });
})();
