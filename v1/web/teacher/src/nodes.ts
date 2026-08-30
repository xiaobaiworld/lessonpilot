import { NodeKind, ScriptNode } from './api';
import {
  emptyRichPageDocument,
  richDocumentToPlainText,
} from '@v1/web/shared';

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
  defaultTitle: string;
}

export const NODE_KINDS: NodeMeta[] = [
  {
    kind: 'notice',
    family: 'attention',
    label: '重点提示',
    hint: '暂停视频，提醒学生记住一个关键点',
    defaultTitle: '本节重点',
  },
  {
    kind: 'choice',
    family: 'practice',
    label: '选择题',
    hint: '提出一个问题，让学生通过选项判断依据',
    defaultTitle: '想一想',
  },
  {
    kind: 'blank',
    family: 'practice',
    label: '填空题',
    hint: '让学生补出课程中的关键表达',
    defaultTitle: '补全关键词',
  },
  {
    kind: 'free_text',
    family: 'practice',
    label: '问答题',
    hint: '让学生结合课程内容说出自己的理解',
    defaultTitle: '说说你的理解',
  },
];

export const metaOf = (kind: NodeKind): NodeMeta =>
  NODE_KINDS.find((m) => m.kind === kind)!;

function newId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const WINDOW_DEFAULTS = {
  windowSize: { widthPercent: 40, heightPercent: 30 },
  windowStyle: 'document' as const,
  windowPosition: { xPercent: 50, yPercent: 50 },
};

/** 建一个字段已填到最小可通过校验的节点 */
export function createNode(kind: NodeKind, timeSeconds: number): ScriptNode {
  const meta = metaOf(kind);
  const base = {
    id: newId(),
    enabled: true,
    family: meta.family,
    interaction: kind,
    anchor: { kind: 'time_cross' as const, timeSeconds, captionId: null },
    effects: { pause: true as const },
  };

  switch (kind) {
    case 'notice':
      return {
        ...base,
        title: meta.defaultTitle,
        content: emptyRichPageDocument(),
        interactionData: null,
        presentationHints: WINDOW_DEFAULTS,
      };
    case 'choice':
      return {
        ...base,
        title: meta.defaultTitle,
        content: emptyRichPageDocument(),
        interactionData: {
          options: [
            { id: 'a', label: '' },
            { id: 'b', label: '' },
          ],
        },
        presentationHints: WINDOW_DEFAULTS,
      };
    case 'blank':
      return {
        ...base,
        title: meta.defaultTitle,
        content: emptyRichPageDocument(),
        interactionData: {
          acceptedAnswers: [''],
          // 数组，合法值只有 trim / casefold
          normalize: ['trim', 'casefold'],
          explanation: '',
        },
        presentationHints: WINDOW_DEFAULTS,
      };
    case 'free_text':
      return {
        ...base,
        title: meta.defaultTitle,
        content: emptyRichPageDocument(),
        interactionData: { referenceFeedback: '' },
        presentationHints: WINDOW_DEFAULTS,
      };
  }
}

/** 切换类型时只迁移通用标题和时间，不携带旧类型的无效字段。 */
export function changeNodeKind(node: ScriptNode, kind: NodeKind): ScriptNode {
  if (node.interaction === kind) return node;
  const next = createNode(kind, node.anchor.timeSeconds);
  const title = node.title.trim() ? node.title : next.title;
  return {
    ...next,
    id: node.id,
    enabled: node.enabled,
    title,
    anchor: { ...next.anchor, captionId: node.anchor.captionId ?? null },
    content: node.content,
    presentationHints: node.presentationHints ?? next.presentationHints,
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
  const e = (node.interactionData ?? {}) as Record<string, any>;
  const blank = (v: unknown) => typeof v !== 'string' || !v.trim();

  if (blank(node.title)) return '节点标题';

  if (blank(richDocumentToPlainText(node.content))) {
    if (node.interaction === 'notice') return '重点内容';
    return node.interaction === 'free_text' ? '问题' : '题目主干';
  }
  if (node.interaction === 'notice') return null;

  switch (node.interaction) {
    case 'choice': {
      const options = (e.options ?? []) as { id: string; label: string }[];
      if (options.some((o) => blank(o.label))) return '选项文字';
      if (!options.some((o) => o.id === e.answer)) return '正确答案';
      return blank(e.explanation) ? '学生作答后的解释' : null;
    }
    case 'blank': {
      const answers = (e.acceptedAnswers ?? []) as unknown[];
      if (answers.length === 0 || answers.some(blank)) return '标准答案 / 可接受说法';
      return blank(e.explanation) ? '学生提交后的解释' : null;
    }
    case 'free_text':
      return blank(e.referenceFeedback) ? '学生提交后的参考反馈' : null;
  }
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
