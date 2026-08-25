import React from 'react';
import { ScriptNode } from '../api';

interface Props {
  node: ScriptNode;
  disabled: boolean;
  onChange: (node: ScriptNode) => void;
}

/** 各字段名由后端 schema 固定，见 backend/app/schemas/script.py */
export const NodeForm: React.FC<Props> = ({ node, disabled, onChange }) => {
  const setDisplay = (patch: Record<string, unknown>) =>
    onChange({ ...node, display: { ...node.display, ...patch } });

  const setEval = (patch: Record<string, unknown>) =>
    onChange({ ...node, evaluation: { ...(node.evaluation ?? {}), ...patch } });

  const d = node.display as Record<string, any>;
  const e = (node.evaluation ?? {}) as Record<string, any>;

  return (
    <div className="node-fields">
      <Field
        label="标题"
        value={d.title ?? ''}
        onChange={(v) => setDisplay({ title: v })}
        disabled={disabled}
      />

      {node.interaction === 'notice' && (
        <>
          <Area
            label="正文（旧版回退）"
            value={d.body ?? ''}
            onChange={(v) => setDisplay({ body: v })}
            disabled={disabled}
            hint="保留给旧版插件和没有结构化排版的场景"
          />
          <NoticeSummaryFields
            display={d}
            disabled={disabled}
            onEnable={() =>
              setDisplay({
                eyebrow: '本节学习重点',
                intro: '这节课会带你理解并练习一个关键方法。',
                sections: [
                  { label: '先理解', body: '先理解本节要掌握的概念。' },
                  { label: '再练习', body: '通过题目回顾并练习。' },
                  { label: '最后巩固', body: '用总结确认自己已经掌握。' },
                ],
                summary: { title: '本节重点', body: '请用自己的话复述重点。加油。' },
              })
            }
            onClear={() =>
              onChange({
                ...node,
                display: Object.fromEntries(
                  Object.entries(node.display).filter(
                    ([key]) => !['eyebrow', 'intro', 'sections', 'summary'].includes(key)
                  )
                ),
              })
            }
            onChange={setDisplay}
          />
        </>
      )}

      {node.interaction !== 'notice' && (
        <Area
          label="题目"
          value={d.prompt ?? ''}
          onChange={(v) => setDisplay({ prompt: v })}
          disabled={disabled}
        />
      )}

      {node.interaction === 'choice' && (
        <ChoiceFields
          options={d.options ?? []}
          answer={e.answer ?? ''}
          explanation={e.explanation ?? ''}
          disabled={disabled}
          onOptions={(options) => setDisplay({ options })}
          onAnswer={(answer) => setEval({ answer })}
          onExplanation={(explanation) => setEval({ explanation })}
        />
      )}

      {node.interaction === 'blank' && (
        <>
          <Field
            label="可接受答案（多个用 | 分隔）"
            value={(e.acceptedAnswers ?? []).join(' | ')}
            onChange={(v) =>
              setEval({
                acceptedAnswers: v
                  .split('|')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            disabled={disabled}
            hint="比对时会去空白并忽略大小写"
          />
          <Area
            label="解析"
            value={e.explanation ?? ''}
            onChange={(v) => setEval({ explanation: v })}
            disabled={disabled}
          />
        </>
      )}

      {node.interaction === 'free_text' && (
        <Area
          label="参考答案"
          value={e.referenceFeedback ?? ''}
          onChange={(v) => setEval({ referenceFeedback: v })}
          disabled={disabled}
          hint="学生作答后展示，不做自动判分"
        />
      )}
    </div>
  );
};

const NoticeSummaryFields: React.FC<{
  display: Record<string, any>;
  disabled: boolean;
  onEnable: () => void;
  onClear: () => void;
  onChange: (patch: Record<string, unknown>) => void;
}> = ({ display, disabled, onEnable, onClear, onChange }) => {
  const sections = Array.isArray(display.sections) ? display.sections : null;
  if (!sections) {
    return (
      <div className="node-field-group">
        <span className="node-field-label">结构化重点提示</span>
        <button className="text-button" type="button" onClick={onEnable} disabled={disabled}>
          启用 C 方案排版
        </button>
        <small>显示“先理解、再练习、最后巩固”的摘要结构。</small>
      </div>
    );
  }

  const updateSection = (index: number, patch: Record<string, string>) => {
    onChange({
      sections: sections.map((section: Record<string, string>, i: number) =>
        i === index ? { ...section, ...patch } : section
      ),
    });
  };

  return (
    <div className="node-field-group">
      <div className="node-field-heading">
        <span className="node-field-label">结构化重点提示</span>
        <button className="text-button" type="button" onClick={onClear} disabled={disabled}>
          使用旧版正文
        </button>
      </div>
      <Field
        label="副标题"
        value={display.eyebrow ?? ''}
        onChange={(value) => onChange({ eyebrow: value })}
        disabled={disabled}
      />
      <Area
        label="开场说明"
        value={display.intro ?? ''}
        onChange={(value) => onChange({ intro: value })}
        disabled={disabled}
      />
      {sections.map((section: Record<string, string>, index: number) => (
        <div className="node-field-group" key={index}>
          <Field
            label={`摘要标题 ${index + 1}`}
            value={section.label ?? ''}
            onChange={(value) => updateSection(index, { label: value })}
            disabled={disabled}
          />
          <Area
            label={`摘要内容 ${index + 1}`}
            value={section.body ?? ''}
            onChange={(value) => updateSection(index, { body: value })}
            disabled={disabled}
          />
        </div>
      ))}
      <Field
        label="总结标题"
        value={display.summary?.title ?? ''}
        onChange={(value) => onChange({ summary: { ...display.summary, title: value } })}
        disabled={disabled}
      />
      <Area
        label="总结内容"
        value={display.summary?.body ?? ''}
        onChange={(value) => onChange({ summary: { ...display.summary, body: value } })}
        disabled={disabled}
      />
    </div>
  );
};

const ChoiceFields: React.FC<{
  options: { id: string; label: string }[];
  answer: string;
  explanation: string;
  disabled: boolean;
  onOptions: (o: { id: string; label: string }[]) => void;
  onAnswer: (a: string) => void;
  onExplanation: (s: string) => void;
}> = ({
  options,
  answer,
  explanation,
  disabled,
  onOptions,
  onAnswer,
  onExplanation,
}) => {
  const nextId = () =>
    String.fromCharCode(97 + options.length); // a, b, c...

  return (
    <>
      <div className="choice-options">
        <span className="node-field-label">选项（选中正确答案）</span>
        {options.map((opt, i) => (
          <label key={opt.id} className="choice-row">
            <input
              type="radio"
              name={`answer-${opt.id}-${i}`}
              checked={answer === opt.id}
              onChange={() => onAnswer(opt.id)}
              disabled={disabled}
              aria-label={`选项 ${opt.id} 为正确答案`}
            />
            <input
              type="text"
              value={opt.label}
              onChange={(ev) =>
                onOptions(
                  options.map((o, j) =>
                    j === i ? { ...o, label: ev.target.value } : o
                  )
                )
              }
              placeholder={`选项 ${opt.id.toUpperCase()}`}
              disabled={disabled}
            />
            {options.length > 2 && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  const kept = options.filter((_, j) => j !== i);
                  onOptions(kept);
                  if (answer === opt.id) onAnswer(kept[0]?.id ?? '');
                }}
                disabled={disabled}
              >
                移除
              </button>
            )}
          </label>
        ))}
        {options.length < 6 && (
          <button
            className="text-button"
            type="button"
            onClick={() => onOptions([...options, { id: nextId(), label: '' }])}
            disabled={disabled}
          >
            + 增加选项
          </button>
        )}
      </div>
      <Area
        label="解析"
        value={explanation}
        onChange={onExplanation}
        disabled={disabled}
      />
    </>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  hint?: string;
}> = ({ label, value, onChange, disabled, hint }) => (
  <label className="field-group">
    <span>{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
    {hint && <small>{hint}</small>}
  </label>
);

const Area: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  hint?: string;
}> = ({ label, value, onChange, disabled, hint }) => (
  <label className="field-group">
    <span>{label}</span>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={3}
    />
    {hint && <small>{hint}</small>}
  </label>
);
