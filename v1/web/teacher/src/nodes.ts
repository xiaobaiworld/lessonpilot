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
        display: { title: '重点', body: '' },
        evaluation: null,
      };
    case 'choice':
      return {
        ...base,
        display: {
          title: '选择题',
          prompt: '',
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
        display: { title: '填空题', prompt: '' },
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
        display: { title: '问答题', prompt: '' },
        evaluation: { referenceFeedback: '' },
      };
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
