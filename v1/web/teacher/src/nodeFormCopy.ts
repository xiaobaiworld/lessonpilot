import type { NodeKind } from './api';

export interface NodeFormCopy {
  contentHeading: string;
  contentAside: string;
  titleLabel: string;
  titleHint: string;
  titlePlaceholder: string;
  contentLabel: string;
  contentHint: string;
  contentPlaceholder: string;
  detailHeading: string;
  detailAside: string;
  optionHint: string;
  optionPlaceholder: string;
  answerLabel: string;
  answerHint: string;
  answerPlaceholder: string;
  feedbackLabel: string;
  feedbackHint: string;
  feedbackPlaceholder: string;
  previewBadge: string;
  previewEmptyText: string;
  previewInputPlaceholder: string;
}

export const NODE_FORM_COPY = {
  notice: {
    contentHeading: '先讲清这一刻的重点',
    contentAside: '告诉学生这一刻要理解或记住什么',
    titleLabel: '重点主题',
    titleHint: '用一句话概括学生此刻要记住的重点。',
    titlePlaceholder: '例如：先说结论，再用证据说明',
    contentLabel: '重点内容',
    contentHint: '建议先写清结论，再补充必要解释；可以用小标题、列表或引用整理层次。',
    contentPlaceholder: '例如：回答问题时，先给出清晰结论，再用具体经历和结果证明。',
    detailHeading: '重点内容编排',
    detailAside: '可用小标题、列表或引用整理重点。',
    optionHint: '本节点无此项。',
    optionPlaceholder: '本节点不需要填写选项。',
    answerLabel: '本节点无答案字段',
    answerHint: '本节点无此项。',
    answerPlaceholder: '本节点不需要填写答案。',
    feedbackLabel: '本节点无反馈字段',
    feedbackHint: '本节点无此项。',
    feedbackPlaceholder: '本节点不需要填写反馈。',
    previewBadge: '本节重点',
    previewEmptyText: '这里会显示本节需要记住的重点。',
    previewInputPlaceholder: '本节点不需要输入。',
  },
  choice: {
    contentHeading: '先写清学生要判断什么',
    contentAside: '提出一个需要学生判断的问题',
    titleLabel: '题目名称',
    titleHint: '用一句话说明这道题要学生判断什么。',
    titlePlaceholder: '例如：回答问题时，第一步应该做什么？',
    contentLabel: '题目主干',
    contentHint: '题干只提出问题，不要把正确答案或答案提示写进去。',
    contentPlaceholder: '例如：面对同事冲突时，第一步应该做什么？',
    detailHeading: '请手工填写选项',
    detailAside: '先写出不同判断，再标记唯一正确答案。',
    optionHint: '标记为正确答案',
    optionPlaceholder: '例如：先说清楚结论',
    answerLabel: '正确答案',
    answerHint: '从选项中标记一个正确答案。',
    answerPlaceholder: '请在选项中标记正确答案。',
    feedbackLabel: '学生作答后的解释',
    feedbackHint: '答对或答错后，学生都会看到这段解释，然后继续学习。',
    feedbackPlaceholder: '例如：先给出清晰结论，再用经历和结果说明原因。',
    previewBadge: '想一想',
    previewEmptyText: '这里会显示选择题题干和选项。',
    previewInputPlaceholder: '选择一个答案',
  },
  blank: {
    contentHeading: '先写出需要补全的课程表达',
    contentAside: '让学生补出这一段课程中的关键表达',
    titleLabel: '题目名称',
    titleHint: '用一句话概括学生要补出的课程关键词。',
    titlePlaceholder: '例如：回答问题的第一步',
    contentLabel: '题目主干',
    contentHint: '请在需要学生填写的位置使用 ______，不要把答案直接写进空格。',
    contentPlaceholder: '例如：回答问题时，先给出 ______，再补充具体经历。',
    detailHeading: '答案与反馈',
    detailAside: '明确答案范围，再说明为什么这样回答。',
    optionHint: '本节点无选项。',
    optionPlaceholder: '本节点不需要填写选项。',
    answerLabel: '标准答案 / 可接受说法',
    answerHint: '多个说法用 | 分隔，例如：结论 | 明确结论 | 清晰结论。',
    answerPlaceholder: '例如：结论 | 明确结论 | 清晰结论',
    feedbackLabel: '学生提交后的解释',
    feedbackHint: '提交后展示这段解释，帮助学生理解关键表达。',
    feedbackPlaceholder: '例如：先说结论，再用具体经历和结果证明。',
    previewBadge: '补全关键词',
    previewEmptyText: '这里会显示填空题题干和输入框。',
    previewInputPlaceholder: '输入课程中的关键词',
  },
  free_text: {
    contentHeading: '先写出学生要回答的问题',
    contentAside: '让学生结合课程内容说出自己的理解',
    titleLabel: '问题名称',
    titleHint: '用一句话概括这道问题希望学生理解什么。',
    titlePlaceholder: '例如：你会怎样说明自己的判断？',
    contentLabel: '问题',
    contentHint: '问题应能让学生联系刚刚学到的内容，而不是只回答“是”或“不是”。',
    contentPlaceholder: '例如：结合刚才的内容，你会怎样说明自己的判断？',
    detailHeading: '提交后的参考反馈',
    detailAside: '用反馈帮助学生对照自己的理解。',
    optionHint: '本节点无选项。',
    optionPlaceholder: '本节点不需要填写选项。',
    answerLabel: '本节点无标准答案',
    answerHint: '问答题不自动判分。',
    answerPlaceholder: '本节点不需要填写标准答案。',
    feedbackLabel: '学生提交后的参考反馈',
    feedbackHint: '学生提交后展示；不自动判分。',
    feedbackPlaceholder: '例如：你的回答抓住了结论，还可以补充具体经历和结果。',
    previewBadge: '说说你的理解',
    previewEmptyText: '这里会显示问题和回答输入框。',
    previewInputPlaceholder: '写下你对这段内容的理解',
  },
} satisfies Record<NodeKind, NodeFormCopy>;

export function nodeFormCopy(kind: NodeKind): NodeFormCopy {
  return NODE_FORM_COPY[kind];
}
