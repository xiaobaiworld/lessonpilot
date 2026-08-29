import React, { useState } from 'react';
import {
  AssetRecord,
  InlineContent,
  PresentationHints,
  RichPageBlock,
  RichPageDocument,
  WindowStyle,
  richDocumentFromHtml,
  richDocumentToHtml,
  resolvePresentationHints,
} from '@v1/web/shared';
import { ScriptNode } from '../api';
import { nodeFormCopy, type NodeFormCopy } from '../nodeFormCopy';
import { RichTextEditor } from './RichTextEditor';
import { PresentationPreview } from './PresentationPreview';

interface Props {
  node: ScriptNode;
  disabled: boolean;
  onChange: (node: ScriptNode) => void;
  onUploadAsset?: (file: File) => Promise<AssetRecord>;
  onImportAsset?: (url: string) => Promise<AssetRecord>;
  assetUrlForId?: (assetId: string) => string;
  onAssetCreated?: (asset: AssetRecord) => void;
}

const WINDOW_STYLE_OPTIONS = [
  { value: 'card' as WindowStyle, label: '卡片' },
  { value: 'document' as WindowStyle, label: '文档' },
] as const;

/** 各字段名由后端校验固定，见 v1/backend/app/modules/authoring_release/application_service.py */
export const NodeForm: React.FC<Props> = ({ node, disabled, onChange, onUploadAsset, onImportAsset, assetUrlForId, onAssetCreated }) => {
  const copy = nodeFormCopy(node.interaction);

  const setHints = (patch: Partial<PresentationHints>) => {
    const resolved = resolvePresentationHints(node.presentationHints ?? {});
    onChange({
      ...node,
      presentationHints: {
        windowSize: patch.windowSize ?? resolved.size,
        windowPosition: patch.windowPosition ?? resolved.position,
        windowStyle: patch.windowStyle ?? resolved.style,
      },
    });
  };

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
              <h3>{copy.contentHeading}</h3>
            </div>
            <span>{copy.contentAside}</span>
          </div>
          <Field
            label={copy.titleLabel}
            value={node.title}
            onChange={(title) => onChange({ ...node, title })}
            disabled={disabled}
            hint={copy.titleHint}
            placeholder={copy.titlePlaceholder}
          />
          <RichTextEditor
            label={copy.contentLabel}
            value={richDocumentToHtml(node.content)}
            disabled={disabled}
            onChange={setPageHtml}
            placeholder={copy.contentPlaceholder}
            hint={copy.contentHint}
            onUploadAsset={onUploadAsset}
            onImportAsset={onImportAsset}
            assetUrlForId={assetUrlForId}
            onAssetCreated={onAssetCreated}
          />
        </section>

        {node.interaction !== 'notice' && <div className="node-detail-fields">
          {node.interaction === 'choice' && (
            <DetailSection copy={copy}>
              <ChoiceFields
                copy={copy}
                options={data.options ?? []}
                answer={data.answer ?? ''}
                explanation={data.explanation ?? ''}
                disabled={disabled}
                onOptions={(options) => setInteractionData({ options })}
                onAnswer={(answer) => setInteractionData({ answer })}
                onInteractionData={(patch) => setInteractionData(patch)}
                onExplanation={(explanation) => setInteractionData({ explanation })}
              />
            </DetailSection>
          )}

          {node.interaction === 'blank' && (
            <DetailSection copy={copy}>
              <Field
                label={copy.answerLabel}
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
                hint={copy.answerHint}
                placeholder={copy.answerPlaceholder}
              />
              <Area
                label={copy.feedbackLabel}
                value={data.explanation ?? ''}
                onChange={(v) => setInteractionData({ explanation: v })}
                disabled={disabled}
                hint={copy.feedbackHint}
                placeholder={copy.feedbackPlaceholder}
              />
            </DetailSection>
          )}

          {node.interaction === 'free_text' && (
            <DetailSection copy={copy}>
              <Area
                label={copy.feedbackLabel}
                value={data.referenceFeedback ?? ''}
                onChange={(v) => setInteractionData({ referenceFeedback: v })}
                disabled={disabled}
                hint={copy.feedbackHint}
                placeholder={copy.feedbackPlaceholder}
              />
            </DetailSection>
          )}
        </div>}
      </div>

      <StudentNodePreview node={node} disabled={disabled} onChange={setHints} assetUrlForId={assetUrlForId} />
    </div>
  );
};

const DetailSection: React.FC<{
  copy: NodeFormCopy;
  children: React.ReactNode;
}> = ({ copy, children }) => (
  <section className="node-section node-detail-section">
    <div className="node-section-heading">
      <div>
        <span className="node-section-eyebrow">填写路径</span>
        <h3>{copy.detailHeading}</h3>
      </div>
      <span>{copy.detailAside}</span>
    </div>
    {children}
  </section>
);

const StudentNodePreview: React.FC<{
  node: ScriptNode;
  disabled: boolean;
  onChange: (patch: Partial<PresentationHints>) => void;
  assetUrlForId?: (assetId: string) => string;
}> = ({ node, disabled, onChange, assetUrlForId }) => {
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const presentation = resolvePresentationHints(node.presentationHints ?? {});
  const previewHints: PresentationHints = {
    windowSize: presentation.size,
    windowPosition: presentation.position,
    windowStyle: presentation.style,
  };
  const data = (node.interactionData ?? {}) as Record<string, any>;
  const options = Array.isArray(data.options) ? data.options : [];
  const copy = nodeFormCopy(node.interaction);

  return (
    <section
      className={`student-node-preview student-node-preview-${node.interaction} student-node-preview-${presentation.style}${previewConfirmed ? ' is-confirmed' : ''}`}
      aria-label="学生端预览"
    >
      <header className="student-node-preview-head">
        <div>
          <span className="node-section-eyebrow">学生端预览</span>
          <strong>学生看到的样子</strong>
        </div>
        <span>正在播放 · {formatPreviewTime(node.anchor.timeSeconds)}</span>
      </header>
      <PresentationPreview
        hints={previewHints}
        disabled={disabled}
        onChange={(patch) => {
          setPreviewConfirmed(false);
          onChange(patch);
        }}
      >
          <span className="student-node-card-badge">{copy.previewBadge}</span>
          <h4>{node.title || '未命名节点'}</h4>
          <PreviewRichContent document={node.content} emptyText={copy.previewEmptyText} assetUrlForId={assetUrlForId} />
          {node.interaction === 'choice' && options.length > 0 && (
            <div className="student-node-card-options">
              {options.map((option: { id: string; label: string }) => (
                <span key={option.id}>{option.label || `选项 ${option.id.toUpperCase()}`}</span>
              ))}
            </div>
          )}
          {node.interaction === 'blank' && <div className="student-node-card-input">{copy.previewInputPlaceholder}</div>}
          {node.interaction === 'free_text' && <div className="student-node-card-input">{copy.previewInputPlaceholder}</div>}
      </PresentationPreview>
      <div className="preview-settings">
        <div className="preview-settings-heading">
          <div>
            <span className="node-section-eyebrow">预览设置</span>
            <strong>窗口显示</strong>
          </div>
          <span>调整后确认预览</span>
        </div>
        <RangeField
          label={`宽度 ${presentation.size.widthPercent.toFixed(1)}%`}
          value={presentation.size.widthPercent}
          disabled={disabled}
          onChange={(value) => {
            setPreviewConfirmed(false);
            onChange({ windowSize: { ...presentation.size, widthPercent: value } });
          }}
        />
        <RangeField
          label={`高度 ${presentation.size.heightPercent.toFixed(1)}%`}
          value={presentation.size.heightPercent}
          disabled={disabled}
          onChange={(value) => {
            setPreviewConfirmed(false);
            onChange({ windowSize: { ...presentation.size, heightPercent: value } });
          }}
        />
        <ChoiceGroup
          label="样式"
          value={presentation.style}
          options={WINDOW_STYLE_OPTIONS}
          disabled={disabled}
          onChange={(value) => {
            setPreviewConfirmed(false);
            onChange({ windowStyle: value });
          }}
        />
        <div className="preview-position-summary">
          位置 X {presentation.position.xPercent.toFixed(1)}% · Y {presentation.position.yPercent.toFixed(1)}%
          <button
            className="preview-reset-button"
            type="button"
            onClick={() => {
              setPreviewConfirmed(false);
              onChange({
                windowSize: { widthPercent: 40, heightPercent: 30 },
                windowPosition: { xPercent: 50, yPercent: 50 },
              });
            }}
            disabled={disabled}
          >
            重置位置和大小
          </button>
        </div>
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
        <span>{presentation.size.widthPercent.toFixed(1)}% × {presentation.size.heightPercent.toFixed(1)}% · X {presentation.position.xPercent.toFixed(1)}% · Y {presentation.position.yPercent.toFixed(1)}% · {presentation.style === 'card' ? '卡片' : '文档'}</span>
        <span>示意预览</span>
      </footer>
    </section>
  );
};

const RangeField: React.FC<{
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, disabled, onChange }) => (
  <label className="preview-range-row">
    <span>{label}</span>
    <input
      type="range"
      min="10"
      max="66"
      step="0.1"
      value={value}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      disabled={disabled}
      aria-label={label}
    />
  </label>
);

const ChoiceGroup: React.FC<{
  label: string;
  value: WindowStyle;
  options: readonly { value: WindowStyle; label: string }[];
  disabled: boolean;
  onChange: (value: WindowStyle) => void;
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

const PreviewRichContent: React.FC<{
  document: RichPageDocument;
  emptyText: string;
  assetUrlForId?: (assetId: string) => string;
}> = ({ document, emptyText, assetUrlForId }) => {
  if (document.schemaVersion !== 1 || document.blocks.length === 0) {
    return <p className="student-node-card-placeholder">{emptyText}</p>;
  }

  return (
    <div className="student-node-card-content">
      {document.blocks.map((block, index) => renderPreviewBlock(block, index, assetUrlForId))}
    </div>
  );
};

function renderPreviewBlock(
  block: RichPageBlock,
  index: number,
  assetUrlForId?: (assetId: string) => string
): React.ReactNode {
  switch (block.type) {
    case 'paragraph':
      return <p key={index}>{renderInlineContent(block.children, `paragraph-${index}`)}</p>;
    case 'heading': {
      const Heading = block.level === 2 ? 'h2' : 'h3';
      return <Heading key={index}>{renderInlineContent(block.children, `heading-${index}`)}</Heading>;
    }
    case 'quote':
      return <blockquote key={index}>{renderInlineContent(block.children, `quote-${index}`)}</blockquote>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineContent(item.children, `list-${index}-${itemIndex}`)}</li>
          ))}
        </List>
      );
    }
    case 'image': {
      const src = assetUrlForId?.(block.assetId);
      return src ? (
        <img key={index} src={src} alt={block.alt} />
      ) : (
        <MediaPlaceholder key={index} label="图片资源未加载" />
      );
    }
    case 'audio': {
      const src = assetUrlForId?.(block.assetId);
      return src ? (
        <audio key={index} controls src={src} aria-label={block.title || '音频'} />
      ) : (
        <MediaPlaceholder key={index} label={block.title || '音频资源未加载'} />
      );
    }
    case 'video': {
      const src = assetUrlForId?.(block.assetId);
      const poster = block.posterAssetId ? assetUrlForId?.(block.posterAssetId) : undefined;
      return src ? (
        <video key={index} controls src={src} poster={poster} aria-label={block.title || '视频'} />
      ) : (
        <MediaPlaceholder key={index} label={block.title || '视频资源未加载'} />
      );
    }
  }
}

const MediaPlaceholder: React.FC<{ label: string }> = ({ label }) => (
  <div className="student-node-card-media-placeholder" role="img" aria-label={label}>
    {label}
  </div>
);

function renderInlineContent(children: InlineContent[], keyPrefix: string): React.ReactNode[] {
  return children.map((inline, index) => {
    let content: React.ReactNode = inline.text.split('\n').map((line, lineIndex, lines) => (
      <React.Fragment key={`${keyPrefix}-${index}-${lineIndex}`}>
        {line}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    ));

    if (inline.link && isSafePreviewHref(inline.link.href)) {
      content = <a href={inline.link.href} target="_blank" rel="noreferrer noopener">{content}</a>;
    }
    for (const mark of [...(inline.marks ?? [])].reverse()) {
      if (mark === 'strong') content = <strong>{content}</strong>;
      if (mark === 'em') content = <em>{content}</em>;
      if (mark === 'underline') content = <u>{content}</u>;
    }

    const color = inline.color && /^#[0-9a-f]{3,8}$/i.test(inline.color) ? inline.color : undefined;
    return <span key={`${keyPrefix}-${index}`} style={color ? { color } : undefined}>{content}</span>;
  });
}

function isSafePreviewHref(value: string): boolean {
  try {
    const url = new URL(value, 'https://knownmap.invalid/');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function formatPreviewTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

const ChoiceFields: React.FC<{
  copy: NodeFormCopy;
  options: { id: string; label: string }[];
  answer: string;
  explanation: string;
  disabled: boolean;
  onOptions: (o: { id: string; label: string }[]) => void;
  onAnswer: (a: string) => void;
  onInteractionData: (patch: Record<string, unknown>) => void;
  onExplanation: (s: string) => void;
}> = ({
  copy,
  options,
  answer,
  explanation,
  disabled,
  onOptions,
  onAnswer,
  onInteractionData,
  onExplanation,
}) => {
  const optionIds = ['a', 'b', 'c', 'd', 'e', 'f'];
  const nextId = () =>
    optionIds.find((id) => !options.some((option) => option.id === id)) ?? '';

  return (
    <>
      <div className="choice-options">
        <span className="node-field-label">{copy.optionHint}</span>
        {options.map((opt, i) => {
          const optionLabel = `选项 ${i + 1}`;
          return (
            <label key={opt.id} className="choice-row">
              <span className="choice-row-number">{optionLabel}</span>
              <input
                type="radio"
                name={`answer-${opt.id}-${i}`}
                checked={answer === opt.id}
                onChange={() => onAnswer(opt.id)}
                disabled={disabled}
                aria-label={`${copy.optionHint}：${optionLabel}`}
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
                placeholder={optionLabel}
                aria-label={optionLabel}
                disabled={disabled}
              />
              {answer === opt.id && (
                <span className="choice-row-correct">✓ {copy.optionHint}</span>
              )}
              {options.length > 2 && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    const kept = options.filter((_, j) => j !== i);
                    if (answer === opt.id) {
                      onInteractionData({ options: kept, answer: kept[0]?.id ?? '' });
                    } else {
                      onOptions(kept);
                    }
                  }}
                  disabled={disabled}
                >
                  移除
                </button>
              )}
            </label>
          );
        })}
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
        label={copy.feedbackLabel}
        value={explanation}
        onChange={onExplanation}
        disabled={disabled}
        hint={copy.feedbackHint}
        placeholder={copy.feedbackPlaceholder}
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
  placeholder?: string;
}> = ({ label, value, onChange, disabled, hint, placeholder }) => (
  <label className="field-group">
    <span>{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
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
  placeholder?: string;
}> = ({ label, value, onChange, disabled, hint, placeholder }) => (
  <label className="field-group">
    <span>{label}</span>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={3}
      placeholder={placeholder}
    />
    {hint && <small>{hint}</small>}
  </label>
);
