import React, { useState } from 'react';
import { AssetRecord, richDocumentFromHtml, richDocumentToHtml, richDocumentToPlainText } from '@v1/web/shared';
import { ScriptNode } from '../api';
import { RichTextEditor } from './RichTextEditor';

interface Props {
  node: ScriptNode;
  disabled: boolean;
  onChange: (node: ScriptNode) => void;
  onUploadAsset?: (file: File) => Promise<AssetRecord>;
  onImportAsset?: (url: string) => Promise<AssetRecord>;
  assetUrlForId?: (assetId: string) => string;
  onAssetCreated?: (asset: AssetRecord) => void;
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

const WINDOW_POSITION_OPTIONS = [
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
  { value: 'center', label: '居中' },
] as const;

/** 各字段名由后端校验固定，见 v1/backend/app/modules/authoring_release/application_service.py */
export const NodeForm: React.FC<Props> = ({ node, disabled, onChange, onUploadAsset, onImportAsset, assetUrlForId, onAssetCreated }) => {
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
      <div className="node-editor-column">
        <section className="node-section node-content-section">
          <div className="node-section-heading">
            <div>
              <span className="node-section-eyebrow">核心内容</span>
              <h3>页面正文</h3>
            </div>
            <span>学生将在视频中看到</span>
          </div>
          <Field
            label="标题"
            value={node.title}
            onChange={(title) => onChange({ ...node, title })}
            disabled={disabled}
          />
          <RichTextEditor
            label="正文内容"
            value={richDocumentToHtml(node.content)}
            disabled={disabled}
            onChange={setPageHtml}
            onUploadAsset={onUploadAsset}
            onImportAsset={onImportAsset}
            assetUrlForId={assetUrlForId}
            onAssetCreated={onAssetCreated}
          />
        </section>

        <div className="node-detail-fields">
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
      </div>

      <StudentNodePreview node={node} disabled={disabled} onChange={setHints} />
    </div>
  );
};

const StudentNodePreview: React.FC<{
  node: ScriptNode;
  disabled: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}> = ({ node, disabled, onChange }) => {
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const previewText = richDocumentToPlainText(node.content) || '这里会显示节点正文。';
  const windowSize = node.presentationHints?.windowSize ?? 'm';
  const windowStyle = node.presentationHints?.windowStyle ?? 'document';
  const windowPosition = node.presentationHints?.windowPosition ?? 'bottom-right';
  const data = (node.interactionData ?? {}) as Record<string, any>;
  const options = Array.isArray(data.options) ? data.options : [];
  const interactionLabel =
    node.interaction === 'notice'
      ? '重点标注'
      : node.interaction === 'choice'
        ? '选择题'
        : node.interaction === 'blank'
          ? '填空题'
          : '问答题';

  return (
    <section
      className={`student-node-preview student-node-preview-${node.interaction} student-node-preview-${windowSize} student-node-preview-${windowStyle} student-node-preview-${windowPosition}${previewConfirmed ? ' is-confirmed' : ''}`}
      aria-label="学生端预览"
    >
      <header className="student-node-preview-head">
        <div>
          <span className="node-section-eyebrow">学生端预览</span>
          <strong>学生看到的样子</strong>
        </div>
        <span>正在播放 · {formatPreviewTime(node.anchor.timeSeconds)}</span>
      </header>
      <div className="student-node-preview-stage">
        <span className="student-node-preview-video-label">课程视频 · 预览画面</span>
        <span className="student-node-preview-play" aria-hidden="true">▶</span>
        <article className="student-node-card">
          <span className="student-node-card-badge">{interactionLabel}</span>
          <h4>{node.title || '未命名节点'}</h4>
          <p>{previewText}</p>
          {node.interaction === 'choice' && options.length > 0 && (
            <div className="student-node-card-options">
              {options.slice(0, 3).map((option: { id: string; label: string }) => (
                <span key={option.id}>{option.label || `选项 ${option.id.toUpperCase()}`}</span>
              ))}
            </div>
          )}
          {node.interaction === 'blank' && <div className="student-node-card-input">输入你的答案</div>}
          {node.interaction === 'free_text' && <div className="student-node-card-input">写下你的想法……</div>}
        </article>
      </div>
      <div className="preview-settings">
        <div className="preview-settings-heading">
          <div>
            <span className="node-section-eyebrow">预览设置</span>
            <strong>窗口显示</strong>
          </div>
          <span>调整后确认预览</span>
        </div>
        <ChoiceGroup
          label="大小"
          value={windowSize}
          options={WINDOW_SIZE_OPTIONS}
          disabled={disabled}
          onChange={(value) => {
            setPreviewConfirmed(false);
            onChange({ windowSize: value });
          }}
        />
        <ChoiceGroup
          label="位置"
          value={windowPosition}
          options={WINDOW_POSITION_OPTIONS}
          disabled={disabled}
          onChange={(value) => {
            setPreviewConfirmed(false);
            onChange({ windowPosition: value });
          }}
        />
        <ChoiceGroup
          label="样式"
          value={windowStyle}
          options={WINDOW_STYLE_OPTIONS}
          disabled={disabled}
          onChange={(value) => {
            setPreviewConfirmed(false);
            onChange({ windowStyle: value });
          }}
        />
        <button
          className="preview-confirm-button"
          type="button"
          onClick={() => setPreviewConfirmed(true)}
          disabled={disabled}
        >
          {previewConfirmed ? '已确认预览' : '预览确认'}
        </button>
      </div>
      <footer className="student-node-preview-foot">
        <span>{windowSizeLabel(windowSize)} · {windowPositionLabel(windowPosition)} · {windowStyle === 'card' ? '卡片' : '文档'}</span>
        <span>示意预览</span>
      </footer>
    </section>
  );
};

const ChoiceGroup: React.FC<{
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, options, disabled, onChange }) => (
  <div className="preview-setting-row">
    <span>{label}</span>
    <div className="preview-choice-group" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'is-active' : ''}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

function windowSizeLabel(value: string): string {
  return WINDOW_SIZE_OPTIONS.find((option) => option.value === value)?.label ?? '中等';
}

function windowPositionLabel(value: string): string {
  return WINDOW_POSITION_OPTIONS.find((option) => option.value === value)?.label ?? '右下';
}

function formatPreviewTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

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
