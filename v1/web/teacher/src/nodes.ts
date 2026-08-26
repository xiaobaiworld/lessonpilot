import { NodeKind, ScriptNode } from './api';

/**
 * 四种互动节点的元数据与构造。
 *
 * family / interaction 的组合由后端 schema 固定死（const），
 * 写错就整份草稿被拒，所以集中在这里，不散在表单里。
 */

export interface NodeMeta {
  kind: NodeKind;
  family: 'attention' | 'practice';
  label: string;
  hint: string;
}

export const NODE_KINDS: NodeMeta[] = [
  {
    kind: 'notice',
    family: 'attention',
    label: '重点标注',
    hint: '到点暂停并显示一段提示，学生读完继续',
  },
  {
    kind: 'choice',
    family: 'practice',
    label: '选择题',
    hint: '给出选项，学生选中正确答案后继续',
  },
  {
    kind: 'blank',
    family: 'practice',
    label: '填空题',
    hint: '学生输入答案，与可接受答案比对',
  },
  {
    kind: 'free_text',
    family: 'practice',
    label: '问答题',
    hint: '学生自由作答，随后看参考答案',
  },
];

export const metaOf = (kind: NodeKind): NodeMeta =>
  NODE_KINDS.find((m) => m.kind === kind)!;

function newId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const WINDOW_DEFAULTS = {
  windowSize: 'm' as const,
  windowStyle: 'document' as const,
};

/** 建一个字段已填到最小可通过校验的节点 */
export function createNode(kind: NodeKind, timeSeconds: number): ScriptNode {
  const meta = metaOf(kind);
  const base = {
    id: newId(),
    enabled: true,
    family: meta.family,
    interaction: kind,
    trigger: { kind: 'time_cross' as const, timeSeconds },
    effects: { pause: true as const },
  };

  switch (kind) {
    case 'notice':
      return {
        ...base,
        display: { title: '重点', richBody: '', ...WINDOW_DEFAULTS },
        evaluation: null,
      };
    case 'choice':
      return {
        ...base,
        display: {
          title: '选择题',
          prompt: '',
          richBody: '',
          ...WINDOW_DEFAULTS,
          options: [
            { id: 'a', label: '' },
            { id: 'b', label: '' },
          ],
        },
        evaluation: { answer: 'a', explanation: '' },
      };
    case 'blank':
      return {
        ...base,
        display: { title: '填空题', prompt: '', richBody: '', ...WINDOW_DEFAULTS },
        evaluation: {
          acceptedAnswers: [''],
          // 数组，合法值只有 trim / casefold
          normalize: ['trim', 'casefold'],
          explanation: '',
        },
      };
    case 'free_text':
      return {
        ...base,
        display: { title: '问答题', prompt: '', richBody: '', ...WINDOW_DEFAULTS },
        evaluation: { referenceFeedback: '' },
      };
  }
}

/** 切换类型时只迁移通用标题和时间，不携带旧类型的无效字段。 */
export function changeNodeKind(node: ScriptNode, kind: NodeKind): ScriptNode {
  if (node.interaction === kind) return node;
  const next = createNode(kind, node.trigger.timeSeconds);
  const oldDisplay = node.display as Record<string, any>;
  const title = typeof oldDisplay.title === 'string' ? oldDisplay.title : next.display.title;
  const sourceText =
    typeof oldDisplay.prompt === 'string'
      ? oldDisplay.prompt
      : typeof oldDisplay.richBody === 'string'
        ? oldDisplay.richBody
        : '';

  if (kind === 'notice') {
    next.display = { ...next.display, title, richBody: sourceText };
  } else {
    next.display = {
      ...next.display,
      title,
      richBody: typeof oldDisplay.richBody === 'string' ? oldDisplay.richBody : sourceText,
      prompt: richTextToPlainText(sourceText),
    };
  }
  return {
    ...next,
    id: node.id,
    enabled: node.enabled,
    trigger: { ...next.trigger, captionId: node.trigger.captionId ?? null },
  };
}

/**
 * 保存前的本地检查。
 *
 * 后端对每个文本字段都要求非空（`文本不能为空。`），整份草稿一处不合格就
 * 全部拒绝。在这里先挡一遍，老师能直接看到是哪个节点的哪一项，
 * 而不是提交后收到一条 422。
 *
 * 这里只重复"非空"这一条最稳定的规则；判定权仍在后端，本地检查通过
 * 也可能被后端拒绝，那种情况按后端返回的字段名提示。
 */
export function findEmptyField(node: ScriptNode): string | null {
  const d = node.display as Record<string, unknown>;
  const e = (node.evaluation ?? {}) as Record<string, unknown>;
  const blank = (v: unknown) => typeof v !== 'string' || !v.trim();

  if (blank(d.title)) return '标题';

  if (node.interaction === 'notice') {
    if (blank(richTextToPlainText(d.richBody))) return '正文';
    return null;
  }

  if (blank(richTextToPlainText(d.richBody)) && blank(d.prompt)) return '题目';

  switch (node.interaction) {
    case 'choice': {
      const options = (d.options ?? []) as { id: string; label: string }[];
      if (options.some((o) => blank(o.label))) return '选项文字';
      if (!options.some((o) => o.id === e.answer)) return '正确答案';
      return blank(e.explanation) ? '解析' : null;
    }
    case 'blank': {
      const answers = (e.acceptedAnswers ?? []) as unknown[];
      if (answers.length === 0 || answers.some(blank)) return '可接受答案';
      return blank(e.explanation) ? '解析' : null;
    }
    case 'free_text':
      return blank(e.referenceFeedback) ? '参考答案' : null;
  }
}

export function richTextToPlainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|blockquote|li)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** mm:ss ⇄ 秒。编辑器只用整秒，够定位一句话 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseTime(text: string): number | null {
  const t = text.trim();
  const m = t.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  // 必须显式挡掉空串：Number('') 是 0，会把节点悄悄挪到片头
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}
