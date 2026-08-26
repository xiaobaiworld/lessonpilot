import React from 'react';
import { richDocumentFromHtml, richDocumentToHtml } from '@v1/web/shared';
import { ScriptNode } from '../api';
import { RichTextEditor } from './RichTextEditor';

interface Props {
  node: ScriptNode;
  disabled: boolean;
  onChange: (node: ScriptNode) => void;
}

const WINDOW_SIZE_OPTIONS = [
  { value: 's', label: '小卡片' },
  { value: 'm', label: '中等' },
  { value: 'l', label: '大文档' },
  { value: 'overlay', label: '铺开' },
] as const;

const WINDOW_STYLE_OPTIONS = [
  { value: 'card', label: '卡片' },
  { value: 'document', label: '文档' },
] as const;

/** 各字段名由后端校验固定，见 v1/backend/app/modules/authoring_release/application_service.py */
export const NodeForm: React.FC<Props> = ({ node, disabled, onChange }) => {
  const setHints = (patch: Record<string, unknown>) =>
    onChange({ ...node, presentationHints: { ...node.presentationHints, ...patch } });

  const setInteractionData = (patch: Record<string, unknown>) =>
    onChange({
      ...node,
      interactionData: { ...(node.interactionData ?? {}), ...patch },
    });

  const data = (node.interactionData ?? {}) as Record<string, any>;

  const setPageHtml = (html: string) => {
    onChange({ ...node, content: richDocumentFromHtml(html) });
  };

  return (
    <div className="node-fields">
      <Field
        label="标题"
        value={node.title}
        onChange={(title) => onChange({ ...node, title })}
        disabled={disabled}
      />
      <label className="field-group">
        <span>窗口大小</span>
        <select
          value={node.presentationHints?.windowSize ?? 'm'}
          onChange={(event) => setHints({ windowSize: event.target.value })}
          disabled={disabled}
        >
          {WINDOW_SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-group">
        <span>窗口样式</span>
        <select
          value={node.presentationHints?.windowStyle ?? 'document'}
          onChange={(event) => setHints({ windowStyle: event.target.value })}
          disabled={disabled}
        >
          {WINDOW_STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <RichTextEditor
        label="页面正文"
        value={richDocumentToHtml(node.content)}
        disabled={disabled}
        onChange={setPageHtml}
      />

      {node.interaction === 'choice' && (
        <ChoiceFields
          options={data.options ?? []}
          answer={data.answer ?? ''}
          explanation={data.explanation ?? ''}
          disabled={disabled}
          onOptions={(options) => setInteractionData({ options })}
          onAnswer={(answer) => setInteractionData({ answer })}
          onExplanation={(explanation) => setInteractionData({ explanation })}
        />
      )}

      {node.interaction === 'blank' && (
        <>
          <Field
            label="可接受答案（多个用 | 分隔）"
            value={(data.acceptedAnswers ?? []).join(' | ')}
            onChange={(v) =>
              setInteractionData({
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
            value={data.explanation ?? ''}
            onChange={(v) => setInteractionData({ explanation: v })}
            disabled={disabled}
          />
        </>
      )}

      {node.interaction === 'free_text' && (
        <Area
          label="参考答案"
          value={data.referenceFeedback ?? ''}
          onChange={(v) => setInteractionData({ referenceFeedback: v })}
          disabled={disabled}
          hint="学生作答后展示，不做自动判分"
        />
      )}
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
