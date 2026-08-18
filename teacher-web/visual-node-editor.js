(function initKnownMapVisualNodeEditor(global, factory) {
  const api = factory(
    global.KnownMapNodePlugins,
    global.KnownMapTimelineModel,
    global.KnownMapEditorLogger
  );
  global.KnownMapVisualNodeEditor = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function createEditorModule(
  defaultRegistry,
  defaultTimeline,
  loggerModule
) {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const noop = () => {};

  function createEditor(options = {}) {
    const registry = options.registry || defaultRegistry;
    const timeline = options.timeline || defaultTimeline;
    const logger = options.logger
      || loggerModule?.createEditorLogger()
      || { debug: noop, info: noop, warn: noop, error: noop };
    const doc = options.document || null;
    const callbacks = {
      onChange: options.onChange || noop,
      onSelection: options.onSelection || noop,
      onDirty: options.onDirty || noop
    };
    const idFactory = options.idFactory;
    const minimumDurationSeconds = Math.max(0, Number(options.minimumDurationSeconds) || 0);
    let dialogOpener = null;
    const state = {
      captions: clone(options.captions || []),
      nodes: timeline.sortNodes(clone(options.nodes || [])),
      durationSeconds: timeline.durationFromContent(
        options.captions || [],
        options.nodes || [],
        minimumDurationSeconds
      ),
      keyboardTimeSeconds: 0,
      zoom: 1,
      selectedNodeId: null,
      armedPluginId: null,
      dialog: { mode: null, nodeId: null, draft: null, source: null }
    };

    const elements = options.elements || {};
    const find = (selector) => elements[selector] || doc?.querySelector?.(selector) || null;
    const ui = {
      pluginList: find('#node-plugin-list'),
      track: find('#visual-timeline-track'),
      nodeLayer: find('#timeline-node-layer'),
      ruler: find('#timeline-ruler'),
      empty: find('#timeline-empty'),
      placementStatus: find('#placement-status'),
      dropIndicator: find('#timeline-drop-indicator'),
      endLabel: find('#timeline-end-label'),
      zoomLabel: find('#timeline-zoom-label'),
      subtitleList: find('#timeline-subtitle-list'),
      subtitleEmpty: find('#timeline-subtitle-empty'),
      subtitleTime: find('#subtitle-rail-time'),
      dialog: find('#node-editor-dialog'),
      form: find('#node-editor-form'),
      fields: find('#node-editor-fields'),
      title: find('#node-editor-title'),
      meta: find('#node-editor-meta'),
      error: find('#node-editor-error'),
      cancel: find('#node-editor-cancel'),
      delete: find('#node-editor-delete')
    };

    function currentNode() {
      return state.nodes.find((node) => node.id === state.selectedNodeId) || null;
    }

    function emit(nodes, meta) {
      state.nodes = timeline.sortNodes(nodes);
      callbacks.onChange(clone(state.nodes), meta);
      callbacks.onDirty(meta);
      render();
    }

    function placementFromTime(timeSeconds, explicitCaptionId) {
      const caption = explicitCaptionId === undefined
        ? timeline.nearestCaption(state.captions, timeSeconds)
        : null;
      return {
        timeSeconds: Math.min(state.durationSeconds, Math.max(0, Number(timeSeconds) || 0)),
        captionId: explicitCaptionId === undefined ? caption?.id ?? null : explicitCaptionId
      };
    }

    function setStatus(text) {
      if (ui.placementStatus) ui.placementStatus.textContent = text;
    }

    function armPlugin(pluginId) {
      registry.getPlugin(pluginId);
      state.armedPluginId = state.armedPluginId === pluginId ? null : pluginId;
      logger.debug('plugin.arm', { pluginId, result: state.armedPluginId ? 'success' : 'cancelled' });
      setStatus(state.armedPluginId
        ? `已选择${registry.getPlugin(pluginId).label}。`
        : '未选择节点');
      render();
      if (state.armedPluginId) ui.track?.focus?.();
      return state.armedPluginId;
    }

    function cancelPlacement() {
      state.armedPluginId = null;
      setStatus('未选择节点');
      render();
    }

    function createAtTime(pluginId, timeSeconds, source = 'click', captionId) {
      const placement = placementFromTime(timeSeconds, captionId);
      const node = registry.createNode(pluginId, { ...placement, idFactory });
      state.dialog = { mode: 'create', nodeId: node.id, draft: node, source };
      state.selectedNodeId = node.id;
      state.armedPluginId = null;
      logger.debug('node.create.open', {
        pluginId,
        timeSeconds: placement.timeSeconds,
        source,
        mode: 'create'
      });
      setStatus('正在编辑新节点，保存后才会加入草稿。');
      render();
      openDialog();
      return node;
    }

    function handleTimelineClick({ left, width, clientX }) {
      if (!state.armedPluginId) return false;
      const timeSeconds = timeline.secondsFromClientX({
        left,
        width,
        clientX,
        durationSeconds: state.durationSeconds
      });
      createAtTime(state.armedPluginId, timeSeconds, 'click');
      return true;
    }

    function handleDrop(pluginId, { left, width, clientX }) {
      if (!registry.listPlugins().some((plugin) => plugin.id === pluginId)) return false;
      const timeSeconds = timeline.secondsFromClientX({
        left,
        width,
        clientX,
        durationSeconds: state.durationSeconds
      });
      createAtTime(pluginId, timeSeconds, 'drag');
      return true;
    }

    function selectNode(nodeId) {
      if (!state.nodes.some((node) => node.id === nodeId)) return null;
      state.selectedNodeId = nodeId;
      const node = currentNode();
      callbacks.onSelection(clone(node));
      logger.debug('node.select', {
        nodeId,
        pluginId: registry.pluginIdForNode(node),
        timeSeconds: node.trigger.timeSeconds
      });
      render();
      return node;
    }

    function openEdit(nodeId = state.selectedNodeId, opener = null) {
      const node = state.nodes.find((item) => item.id === nodeId);
      if (!node) return false;
      state.selectedNodeId = node.id;
      state.dialog = {
        mode: 'edit',
        nodeId: node.id,
        draft: clone(node),
        source: 'dialog'
      };
      logger.debug('node.edit.open', {
        nodeId: node.id,
        pluginId: registry.pluginIdForNode(node),
        timeSeconds: node.trigger.timeSeconds,
        mode: 'edit'
      });
      renderDialog();
      openDialog(opener);
      return true;
    }

    function dialogPluginId() {
      return ui.fields?.querySelector?.('[data-node-field="pluginId"]')?.value
        || registry.pluginIdForNode(state.dialog.draft);
    }

    function fieldValue(id) {
      return ui.fields?.querySelector?.(`[data-node-field="${id}"]`)?.value ?? null;
    }

    function collectDialogDraft() {
      const draft = clone(state.dialog.draft);
      if (!draft) return null;
      const pluginId = dialogPluginId();
      const currentPluginId = registry.pluginIdForNode(draft);
      const next = pluginId !== currentPluginId
        ? registry.convertNode(pluginId, draft, {
            timeSeconds: draft.trigger.timeSeconds,
            captionId: draft.trigger.captionId,
            idFactory: () => draft.id
          })
        : draft;
      next.display.title = String(fieldValue('title') ?? next.display.title).trim();
      if (next.interaction === 'notice') {
        next.display.body = String(fieldValue('body') ?? next.display.body).trim();
      } else if (next.interaction === 'choice') {
        next.display.prompt = String(fieldValue('prompt') ?? next.display.prompt).trim();
        next.display.options = [
          {
            id: 'a',
            label: String(fieldValue('optionA') ?? next.display.options?.[0]?.label ?? '').trim()
          },
          {
            id: 'b',
            label: String(fieldValue('optionB') ?? next.display.options?.[1]?.label ?? '').trim()
          }
        ];
        next.evaluation = {
          answer: String(fieldValue('answer') ?? next.evaluation?.answer ?? 'b'),
          explanation: String(
            fieldValue('explanation') ?? next.evaluation?.explanation ?? ''
          ).trim()
        };
      } else if (next.interaction === 'blank') {
        next.display.prompt = String(fieldValue('prompt') ?? next.display.prompt).trim();
        const acceptedAnswers = fieldValue('acceptedAnswers');
        next.evaluation = {
          acceptedAnswers: acceptedAnswers === null
            ? clone(next.evaluation?.acceptedAnswers || [])
            : String(acceptedAnswers)
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
          normalize: ['trim', 'casefold'],
          explanation: String(
            fieldValue('explanation') ?? next.evaluation?.explanation ?? ''
          ).trim()
        };
      } else if (next.interaction === 'free_text') {
        next.display.prompt = String(fieldValue('prompt') ?? next.display.prompt).trim();
        next.evaluation = {
          referenceFeedback: String(
            fieldValue('referenceFeedback') ?? next.evaluation?.referenceFeedback ?? ''
          ).trim()
        };
      }
      return next;
    }

    function saveDialog() {
      if (!state.dialog.draft) return false;
      const draft = collectDialogDraft();
      if (!draft) return false;
      const dialogMode = state.dialog.mode;
      try {
        registry.validateNode(draft);
      } catch (error) {
        if (ui.error) {
          ui.error.textContent = error.message || '请先补齐节点内容。';
          ui.error.hidden = false;
        }
        return false;
      }
      const remaining = state.nodes.filter((node) => node.id !== draft.id);
      state.selectedNodeId = draft.id;
      const dialogSource = state.dialog.source || 'dialog';
      state.dialog = { mode: null, nodeId: null, draft: null, source: null };
      emit([...remaining, draft], {
        action: dialogMode === 'create' ? 'node.create' : 'node.update',
        nodeId: draft.id,
        pluginId: registry.pluginIdForNode(draft),
        timeSeconds: draft.trigger.timeSeconds,
        source: dialogMode === 'create' ? dialogSource : 'dialog'
      });
      logger.info('node.save', {
        nodeId: draft.id,
        pluginId: registry.pluginIdForNode(draft),
        timeSeconds: draft.trigger.timeSeconds
      });
      setStatus('节点已加入时间轴。');
      closeDialog();
      return true;
    }

    function cancelDialog() {
      if (!state.dialog.draft) return false;
      const edited = collectDialogDraft();
      const changed = JSON.stringify(edited) !== JSON.stringify(state.dialog.draft);
      const confirmDiscard = options.confirmDiscard
        || ((message) => globalThis.confirm?.(message) !== false);
      if (changed && !confirmDiscard('节点有未保存的修改，确定放弃吗？')) return false;
      const mode = state.dialog.mode;
      state.dialog = { mode: null, nodeId: null, draft: null, source: null };
      logger.debug('node.dialog.cancel', { mode, result: 'cancelled' });
      setStatus('未选择节点');
      render();
      closeDialog();
      return true;
    }

    function deleteSelectedNode() {
      const nodeId = state.dialog.nodeId || state.selectedNodeId;
      if (!nodeId || !state.nodes.some((node) => node.id === nodeId)) return false;
      const confirmDelete = options.confirmDelete
        || ((message) => globalThis.confirm?.(message) !== false);
      if (!confirmDelete('确定删除这个节点吗？')) return false;
      state.dialog = { mode: null, nodeId: null, draft: null, source: null };
      state.selectedNodeId = null;
      emit(state.nodes.filter((node) => node.id !== nodeId), {
        action: 'node.delete',
        nodeId,
        source: 'dialog'
      });
      logger.info('node.delete', { nodeId });
      setStatus('节点已删除。');
      closeDialog();
      return true;
    }

    function moveSelectedNode(timeSeconds) {
      if (!state.selectedNodeId) return false;
      const placement = placementFromTime(timeSeconds);
      const moved = timeline.moveNode(state.nodes, state.selectedNodeId, placement);
      const node = moved.find((item) => item.id === state.selectedNodeId);
      emit(moved, {
        action: 'node.move',
        nodeId: state.selectedNodeId,
        timeSeconds: node.trigger.timeSeconds,
        source: 'pointer'
      });
      logger.info('node.move', {
        nodeId: state.selectedNodeId,
        timeSeconds: node.trigger.timeSeconds,
        source: 'pointer'
      });
      return true;
    }

    function setCaptions(captions) {
      state.captions = clone(captions || []);
      state.durationSeconds = timeline.durationFromContent(
        state.captions,
        state.nodes,
        minimumDurationSeconds
      );
      if (state.captions.length) {
        state.nodes = state.nodes.map((node) => ({
          ...node,
          trigger: {
            ...node.trigger,
            captionId: timeline.nearestCaption(state.captions, node.trigger.timeSeconds)?.id ?? null
          }
        }));
      }
      render();
    }

    function setNodes(nodes) {
      const incomingNodes = clone(nodes || []);
      state.nodes = timeline.sortNodes(state.captions.length
        ? incomingNodes.map((node) => ({
            ...node,
            trigger: {
              ...node.trigger,
              captionId: timeline.nearestCaption(state.captions, node.trigger.timeSeconds)?.id ?? null
            }
          }))
        : incomingNodes);
      state.durationSeconds = timeline.durationFromContent(
        state.captions,
        state.nodes,
        minimumDurationSeconds
      );
      state.keyboardTimeSeconds = Math.min(state.keyboardTimeSeconds, state.durationSeconds);
      state.selectedNodeId = state.nodes[0]?.id || null;
      if (state.selectedNodeId) callbacks.onSelection(clone(currentNode()));
      render();
    }

    function setZoom(value) {
      state.zoom = Math.min(1.5, Math.max(0.75, Math.round(Number(value) * 4) / 4));
      if (ui.track) ui.track.style.minWidth = `${Math.round(760 * state.zoom)}px`;
      if (ui.zoomLabel) ui.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
      return state.zoom;
    }

    function adjustZoom(delta) {
      return setZoom(state.zoom + Number(delta || 0));
    }

    function renderKeyboardCursor() {
      if (!ui.dropIndicator) return;
      ui.dropIndicator.hidden = !state.armedPluginId;
      if (!state.armedPluginId) return;
      ui.dropIndicator.style.left = `${timeline.percentFromSeconds(
        state.keyboardTimeSeconds,
        state.durationSeconds
      )}%`;
      const label = ui.dropIndicator.querySelector('b');
      if (label) label.textContent = timeline.formatTime(state.keyboardTimeSeconds);
    }

    function handleTimelineKeydown(key) {
      if (!state.armedPluginId) return false;
      const step = Math.max(1, Math.round(state.durationSeconds / 20));
      if (key === 'Home') state.keyboardTimeSeconds = 0;
      else if (key === 'End') state.keyboardTimeSeconds = state.durationSeconds;
      else if (key === 'ArrowLeft') {
        state.keyboardTimeSeconds = Math.max(0, state.keyboardTimeSeconds - step);
      } else if (key === 'ArrowRight') {
        state.keyboardTimeSeconds = Math.min(
          state.durationSeconds,
          state.keyboardTimeSeconds + step
        );
      } else if (key === 'Enter' || key === ' ') {
        createAtTime(state.armedPluginId, state.keyboardTimeSeconds, 'keyboard');
        return true;
      } else {
        return false;
      }
      setStatus(`节点位置 ${timeline.formatTime(state.keyboardTimeSeconds)}`);
      renderKeyboardCursor();
      return true;
    }

    function getState() {
      return clone(state);
    }

    function openDialog(explicitOpener = null) {
      const opener = explicitOpener || doc?.activeElement || null;
      dialogOpener = {
        element: opener,
        nodeId: opener?.dataset?.nodeId || null,
        pluginId: opener?.dataset?.pluginId || null
      };
      renderDialog();
      if (ui.dialog?.showModal && !ui.dialog.open) ui.dialog.showModal();
      ui.fields?.querySelector?.('[data-node-field="title"]')?.focus?.();
    }

    function closeDialog() {
      if (ui.dialog?.close && ui.dialog.open) ui.dialog.close();
      let focusTarget = dialogOpener?.element || null;
      if (dialogOpener?.nodeId && ui.nodeLayer?.querySelectorAll) {
        focusTarget = Array.from(ui.nodeLayer.querySelectorAll('.timeline-marker'))
          .find((element) => element.dataset.nodeId === dialogOpener.nodeId)
          || ui.track
          || focusTarget;
      } else if (dialogOpener?.pluginId && ui.pluginList?.querySelectorAll) {
        focusTarget = Array.from(ui.pluginList.querySelectorAll('.node-plugin'))
          .find((element) => element.dataset.pluginId === dialogOpener.pluginId)
          || ui.track
          || focusTarget;
      }
      focusTarget?.focus?.();
      dialogOpener = null;
    }

    function renderPluginBar() {
      if (!ui.pluginList) return;
      ui.pluginList.replaceChildren();
      registry.listPlugins().forEach((plugin) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = `node-plugin node-plugin-${plugin.tone}`;
        button.dataset.pluginId = plugin.id;
        button.draggable = true;
        button.setAttribute('aria-pressed', String(state.armedPluginId === plugin.id));
        button.append(
          Object.assign(doc.createElement('span'), { className: 'node-plugin-icon', textContent: plugin.icon }),
          Object.assign(doc.createElement('span'), { className: 'node-plugin-copy' })
        );
        button.querySelector('.node-plugin-copy').append(
          Object.assign(doc.createElement('strong'), { textContent: plugin.label }),
          Object.assign(doc.createElement('small'), { textContent: '加入时间轴' })
        );
        button.addEventListener('click', () => armPlugin(plugin.id));
        button.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            armPlugin(plugin.id);
          }
        });
        button.addEventListener('dragstart', (event) => {
          event.dataTransfer?.setData('text/plain', plugin.id);
          event.dataTransfer?.setData('application/x-knownmap-node', plugin.id);
          logger.debug('plugin.drag.start', { pluginId: plugin.id, source: 'drag' });
        });
        ui.pluginList.append(button);
      });
    }

    function renderRuler() {
      if (!ui.ruler || !doc) return;
      ui.ruler.replaceChildren();
      const steps = 7;
      for (let index = 0; index <= steps; index += 1) {
        const span = doc.createElement('span');
        span.textContent = timeline.formatTime((state.durationSeconds / steps) * index);
        ui.ruler.append(span);
      }
      if (ui.endLabel) ui.endLabel.textContent = timeline.formatTime(state.durationSeconds);
    }

    function renderNodes() {
      if (!ui.nodeLayer || !doc) return;
      ui.nodeLayer.replaceChildren();
      const visible = timeline.assignLanes(state.nodes, {
        durationSeconds: state.durationSeconds,
        minGapPercent: 7
      });
      visible.forEach((node) => {
        const plugin = registry.getPlugin(registry.pluginIdForNode(node));
        const marker = doc.createElement('button');
        marker.type = 'button';
        marker.className = `timeline-marker marker-${plugin.tone}${node.id === state.selectedNodeId ? ' is-selected' : ''}`;
        marker.style.left = `${node.percent}%`;
        marker.dataset.nodeId = node.id;
        marker.dataset.lane = String(node.lane);
        marker.setAttribute('aria-label', `${plugin.label}，${timeline.formatTime(node.trigger.timeSeconds)}，${node.display.title}`);
        marker.append(
          Object.assign(doc.createElement('span'), { className: 'timeline-marker-icon', textContent: plugin.icon }),
          Object.assign(doc.createElement('small'), { textContent: timeline.formatTime(node.trigger.timeSeconds) })
        );
        marker.addEventListener('click', (event) => {
          event.stopPropagation();
          selectNode(node.id);
        });
        marker.addEventListener('dblclick', (event) => {
          event.stopPropagation();
          openEdit(node.id, event.currentTarget);
        });
        marker.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openEdit(node.id, event.currentTarget);
        });
        marker.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openEdit(node.id, event.currentTarget);
          }
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            deleteSelectedNode();
          }
        });
        marker.addEventListener('pointerdown', (event) => beginMarkerDrag(event, node.id));

        const summary = doc.createElement('button');
        summary.type = 'button';
        summary.className = `timeline-node-summary summary-${plugin.tone}${node.id === state.selectedNodeId ? ' is-selected' : ''}`;
        summary.style.left = `${node.percent}%`;
        summary.dataset.lane = String(node.lane);
        summary.dataset.nodeId = node.id;
        summary.textContent = node.display.title;
        summary.addEventListener('click', () => selectNode(node.id));
        summary.addEventListener('dblclick', (event) => openEdit(node.id, event.currentTarget));
        summary.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          openEdit(node.id, event.currentTarget);
        });
        ui.nodeLayer.append(summary, marker);
      });
      if (ui.empty) ui.empty.hidden = state.nodes.length > 0;
    }

    function renderSubtitles() {
      if (!ui.subtitleList || !doc) return;
      const node = currentNode();
      const seconds = node?.trigger?.timeSeconds || 0;
      if (ui.subtitleTime) ui.subtitleTime.textContent = timeline.formatTime(seconds);
      ui.subtitleList.replaceChildren();
      if (!state.captions.length) {
        if (ui.subtitleEmpty) ui.subtitleEmpty.hidden = false;
        return;
      }
      if (ui.subtitleEmpty) ui.subtitleEmpty.hidden = true;
      const helper = globalThis.LessonPilotSubtitleContext;
      const result = helper?.selectSubtitleContext
        ? helper.selectSubtitleContext({ captions: state.captions, timeSeconds: seconds })
        : { items: state.captions.slice(0, 5).map((caption, index) => ({ caption, isCenter: index === 0 })) };
      result.items.forEach((item) => {
        const row = doc.createElement('li');
        row.className = `subtitle-item${item.isCenter ? ' is-center' : ''}`;
        const time = doc.createElement('time');
        time.textContent = item.caption.time || timeline.formatTime(item.caption.startSeconds);
        const text = doc.createElement('p');
        text.textContent = item.caption.text;
        row.append(time, text);
        ui.subtitleList.append(row);
      });
    }

    function renderDialog() {
      if (!ui.fields || !doc || !state.dialog.draft) return;
      const draft = state.dialog.draft;
      const pluginId = registry.pluginIdForNode(draft);
      const plugin = registry.getPlugin(pluginId);
      ui.fields.replaceChildren();
      const typeLabel = doc.createElement('label');
      typeLabel.className = 'node-field';
      typeLabel.append(Object.assign(doc.createElement('span'), { textContent: '节点类型' }));
      const typeSelect = doc.createElement('select');
      typeSelect.dataset.nodeField = 'pluginId';
      registry.listPlugins().forEach((item) => {
        const option = doc.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        option.selected = item.id === pluginId;
        typeSelect.append(option);
      });
      typeSelect.addEventListener('change', () => {
        const converted = registry.convertNode(typeSelect.value, draft, { idFactory: () => draft.id });
        state.dialog.draft = converted;
        renderDialog();
      });
      typeLabel.append(typeSelect);
      ui.fields.append(typeLabel);
      plugin.fields.forEach((definition) => {
        const label = doc.createElement('label');
        label.className = 'node-field';
        const caption = doc.createElement('span');
        caption.textContent = definition.label;
        label.append(caption);
        const value = readFieldValue(draft, definition.id);
        const control = definition.control === 'select' ? doc.createElement('select')
          : definition.control === 'input' ? doc.createElement('input')
            : doc.createElement('textarea');
        control.dataset.nodeField = definition.id;
        control.value = value;
        if (definition.id === 'answer') {
          [['a', '选项 A'], ['b', '选项 B']].forEach(([id, text]) => {
            const option = doc.createElement('option');
            option.value = id;
            option.textContent = text;
            option.selected = id === value;
            control.append(option);
          });
        }
        label.append(control);
        ui.fields.append(label);
      });
      if (ui.title) ui.title.textContent = `${plugin.label} · 编辑节点`;
      if (ui.meta) ui.meta.textContent = timeline.formatTime(draft.trigger.timeSeconds);
      if (ui.delete) ui.delete.hidden = state.dialog.mode === 'create';
      if (ui.error) ui.error.hidden = true;
    }

    function readFieldValue(node, fieldId) {
      if (fieldId === 'title') return node.display.title || '';
      if (fieldId === 'body') return node.display.body || '';
      if (fieldId === 'prompt') return node.display.prompt || '';
      if (fieldId === 'optionA') return node.display.options?.[0]?.label || '';
      if (fieldId === 'optionB') return node.display.options?.[1]?.label || '';
      if (fieldId === 'answer') return node.evaluation?.answer || 'b';
      if (fieldId === 'acceptedAnswers') return (node.evaluation?.acceptedAnswers || []).join(', ');
      if (fieldId === 'explanation') return node.evaluation?.explanation || '';
      if (fieldId === 'referenceFeedback') return node.evaluation?.referenceFeedback || '';
      return '';
    }

    function beginMarkerDrag(event, nodeId) {
      selectNode(nodeId);
      const startX = event.clientX;
      let moved = false;
      const move = (moveEvent) => {
        if (Math.abs(moveEvent.clientX - startX) > 4) moved = true;
      };
      const up = (upEvent) => {
        doc.removeEventListener('pointermove', move);
        doc.removeEventListener('pointerup', up);
        if (!moved || !ui.track) return;
        const rect = ui.track.getBoundingClientRect();
        const timeSeconds = timeline.secondsFromClientX({
          left: rect.left,
          width: rect.width,
          clientX: upEvent.clientX,
          durationSeconds: state.durationSeconds
        });
        moveSelectedNode(timeSeconds);
      };
      doc.addEventListener('pointermove', move);
      doc.addEventListener('pointerup', up, { once: true });
    }

    function bindDomEvents() {
      if (!doc) return;
      ui.track?.addEventListener('click', (event) => {
        if (event.target.closest?.('.timeline-marker, .timeline-node-summary')) return;
        const rect = ui.track.getBoundingClientRect();
        handleTimelineClick({ left: rect.left, width: rect.width, clientX: event.clientX });
      });
      ui.track?.addEventListener('keydown', (event) => {
        if (!handleTimelineKeydown(event.key)) return;
        event.preventDefault();
      });
      ui.track?.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (ui.dropIndicator) {
          const rect = ui.track.getBoundingClientRect();
          const timeSeconds = timeline.secondsFromClientX({
            left: rect.left,
            width: rect.width,
            clientX: event.clientX,
            durationSeconds: state.durationSeconds
          });
          ui.dropIndicator.hidden = false;
          ui.dropIndicator.style.left = `${timeline.percentFromSeconds(timeSeconds, state.durationSeconds)}%`;
          const label = ui.dropIndicator.querySelector('b');
          if (label) label.textContent = timeline.formatTime(timeSeconds);
        }
      });
      ui.track?.addEventListener('dragleave', () => {
        if (ui.dropIndicator) ui.dropIndicator.hidden = true;
      });
      ui.track?.addEventListener('drop', (event) => {
        event.preventDefault();
        const pluginId = event.dataTransfer?.getData('application/x-knownmap-node')
          || event.dataTransfer?.getData('text/plain');
        const rect = ui.track.getBoundingClientRect();
        if (handleDrop(pluginId, { left: rect.left, width: rect.width, clientX: event.clientX })) {
          if (ui.dropIndicator) ui.dropIndicator.hidden = true;
        }
      });
      ui.form?.addEventListener('submit', (event) => {
        event.preventDefault();
        saveDialog();
      });
      ui.cancel?.addEventListener('click', cancelDialog);
      ui.delete?.addEventListener('click', deleteSelectedNode);
      ui.dialog?.addEventListener('cancel', (event) => {
        event.preventDefault();
        cancelDialog();
      });
      doc.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.armedPluginId) cancelPlacement();
      });
    }

    function render() {
      renderPluginBar();
      renderRuler();
      renderNodes();
      renderSubtitles();
      renderKeyboardCursor();
    }

    bindDomEvents();
    setZoom(1);
    render();

    return {
      getState,
      setCaptions,
      setNodes,
      setZoom,
      adjustZoom,
      armPlugin,
      cancelPlacement,
      createAtTime,
      handleTimelineClick,
      handleTimelineKeydown,
      handleDrop,
      selectNode,
      openEdit,
      saveDialog,
      cancelDialog,
      deleteSelectedNode,
      moveSelectedNode
    };
  }

  return { createEditor };
});
