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

  const toggleAddPanel = () => {
    addPanel.hidden = !addPanel.hidden;
    if (!addPanel.hidden) addPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  document.querySelector('#add-node').addEventListener('click', toggleAddPanel);
  document.querySelector('#add-node-on-track').addEventListener('click', toggleAddPanel);
  document.querySelector('#add-node-demo').addEventListener('click', () => {
    showToast('示例图只演示增加节点的入口，不会新增已保存的第四个节点。');
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
