(function initKnownMapNodePlugins(global, factory) {
  const api = factory();
  global.KnownMapNodePlugins = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function createNodePlugins() {
  const printableId = /^[\x21-\x7e]{1,80}$/;

  const field = (id, label, control = 'textarea') => Object.freeze({ id, label, control });
  const commonFields = Object.freeze([field('title', '标题', 'input')]);

  const plugins = Object.freeze({
    attention: Object.freeze({
      id: 'attention',
      label: '重点标注',
      icon: '✦',
      tone: 'attention',
      family: 'attention',
      interaction: 'notice',
      fields: Object.freeze([...commonFields, field('body', '提醒内容')]),
      createDefault() {
        return {
          display: {
            title: '重点标注',
            body: '请记住这一句，并注意它和上一句的区别。'
          },
          evaluation: null
        };
      }
    }),
    choice: Object.freeze({
      id: 'choice',
      label: '选择题',
      icon: '◉',
      tone: 'choice',
      family: 'practice',
      interaction: 'choice',
      fields: Object.freeze([
        ...commonFields,
        field('prompt', '题目'),
        field('optionA', '选项 A', 'input'),
        field('optionB', '选项 B', 'input'),
        field('answer', '正确答案', 'select'),
        field('explanation', '答案解释')
      ]),
      createDefault() {
        return {
          display: {
            title: '选择题',
            prompt: '哪一个选项最能说明这句话的重点？',
            options: [
              { id: 'a', label: '只说自己的品质' },
              { id: 'b', label: '给出具体经历' }
            ]
          },
          evaluation: {
            answer: 'b',
            explanation: '具体经历能让答案可验证。'
          }
        };
      }
    }),
    blank: Object.freeze({
      id: 'blank',
      label: '填空题',
      icon: '□',
      tone: 'blank',
      family: 'practice',
      interaction: 'blank',
      fields: Object.freeze([
        ...commonFields,
        field('prompt', '题目'),
        field('acceptedAnswers', '可接受答案', 'input'),
        field('explanation', '答案解释')
      ]),
      createDefault() {
        return {
          display: {
            title: '填空题',
            prompt: '请填入这句话中最关键的表达。'
          },
          evaluation: {
            acceptedAnswers: ['suggested'],
            normalize: ['trim', 'casefold'],
            explanation: '答案需要保留具体动作和结果。'
          }
        };
      }
    }),
    qa: Object.freeze({
      id: 'qa',
      label: '问答题',
      icon: '⌁',
      tone: 'qa',
      family: 'followup',
      interaction: 'free_text',
      fields: Object.freeze([
        ...commonFields,
        field('prompt', '问题'),
        field('referenceFeedback', '教师参考反馈')
      ]),
      createDefault() {
        return {
          display: {
            title: '问答题',
            prompt: '请用自己的经历说明你如何解决一个困难情况。'
          },
          evaluation: {
            referenceFeedback: '回答应包含情境、行动和结果三个部分。'
          }
        };
      }
    })
  });

  function listPlugins() {
    return Object.values(plugins);
  }

  function getPlugin(pluginId) {
    const plugin = plugins[pluginId];
    if (!plugin) throw new Error(`未知节点组件：${pluginId}`);
    return plugin;
  }

  function validatePlacement(placement) {
    const timeSeconds = Number(placement && placement.timeSeconds);
    if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
      throw new Error('节点触发时间必须是非负有限数字。');
    }
    const captionId = placement && placement.captionId;
    if (captionId !== null && captionId !== undefined && !printableId.test(captionId)) {
      throw new Error('字幕引用必须是合法 ID。');
    }
    const idFactory = placement && placement.idFactory;
    const id = typeof idFactory === 'function'
      ? idFactory()
      : `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!printableId.test(id)) throw new Error('节点 ID 必须是合法 ID。');
    return {
      id,
      timeSeconds: Math.round(timeSeconds * 10) / 10,
      captionId: captionId ?? null
    };
  }

  function createNode(pluginId, placement = {}) {
    const plugin = getPlugin(pluginId);
    const safePlacement = validatePlacement(placement);
    const defaults = plugin.createDefault();
    return {
      id: safePlacement.id,
      enabled: true,
      family: plugin.family,
      interaction: plugin.interaction,
      trigger: {
        kind: 'time_cross',
        timeSeconds: safePlacement.timeSeconds,
        captionId: safePlacement.captionId
      },
      display: defaults.display,
      evaluation: defaults.evaluation,
      effects: { pause: true }
    };
  }

  function convertNode(pluginId, node, placement = {}) {
    const nextPlacement = {
      timeSeconds: placement.timeSeconds ?? node?.trigger?.timeSeconds,
      captionId: placement.captionId === undefined
        ? node?.trigger?.captionId ?? null
        : placement.captionId,
      idFactory: placement.idFactory || (() => node?.id)
    };
    return createNode(pluginId, nextPlacement);
  }

  function pluginIdForNode(node) {
    return listPlugins().find((plugin) => (
      plugin.family === node?.family && plugin.interaction === node?.interaction
    ))?.id || null;
  }

  return {
    listPlugins,
    getPlugin,
    createNode,
    convertNode,
    pluginIdForNode
  };
});
