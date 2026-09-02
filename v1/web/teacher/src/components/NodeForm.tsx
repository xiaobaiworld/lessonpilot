import React, { useEffect, useState } from 'react';
import {
  AssetRecord,
  InlineContent,
  PRESENTATION_LIMITS,
  PresentationHints,
  RichPageBlock,
  RichPageDocument,
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

function clampPositionPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(
    Math.min(
      Math.max(value, PRESENTATION_LIMITS.positionMinPercent),
      PRESENTATION_LIMITS.positionMaxPercent,
    ) * 10,
  ) / 10;
}

/** 各字段名由后端校验固定，见 v1/backend/app/modules/authoring_release/application_service.py */
export const NodeForm: React.FC<Props> = ({ node, disabled, onChange, onUploadAsset, onImportAsset, assetUrlForId, onAssetCreated }) => {
  const copy = nodeFormCopy(node.interaction);
  const [acceptedAnswersDraft, setAcceptedAnswersDraft] = useState(
    () => (node.interactionData as Record<string, any> | null)?.acceptedAnswers?.join(' | ') ?? ''
  );

  useEffect(() => {
    setAcceptedAnswersDraft(
      (node.interactionData as Record<string, any> | null)?.acceptedAnswers?.join(' | ') ?? ''
    );
  }, [node.id]);

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
            required
            onChange={(title) => onChange({ ...node, title })}
            disabled={disabled}
            hint={copy.titleHint}
            placeholder={copy.titlePlaceholder}
          />
          <RichTextEditor
            label={copy.contentLabel}
            value={richDocumentToHtml(node.content)}
            disabled={disabled}
            required
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
                value={acceptedAnswersDraft}
                required
                onChange={(value) => {
                  setAcceptedAnswersDraft(value);
                  setInteractionData({ acceptedAnswers: parseAcceptedAnswers(value) });
                }}
                disabled={disabled}
                hint={copy.answerHint}
                placeholder={copy.answerPlaceholder}
              />
              <Area
                label={copy.feedbackLabel}
                value={data.explanation ?? ''}
                required
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
                required
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
            <strong>窗口设置</strong>
          </div>
        </div>
        <div className="preview-settings-group">
          <div className="preview-settings-group-heading">
            <strong>窗口大小</strong>
            <span>拖动滑块调整</span>
          </div>
          <RangeField
            label="宽度"
            value={presentation.size.widthPercent}
            disabled={disabled}
            onChange={(value) => {
              setPreviewConfirmed(false);
              onChange({ windowSize: { ...presentation.size, widthPercent: value } });
            }}
          />
          <RangeField
            label="高度"
            value={presentation.size.heightPercent}
            disabled={disabled}
            onChange={(value) => {
              setPreviewConfirmed(false);
              onChange({ windowSize: { ...presentation.size, heightPercent: value } });
            }}
          />
        </div>
        <div className="preview-settings-group">
          <div className="preview-settings-group-heading">
            <strong>窗口位置</strong>
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
              恢复默认
            </button>
          </div>
          <p className="preview-position-hint">
            拖动上方窗口，或直接输入中心点坐标。范围 0%–100%。
          </p>
          <div className="preview-position-inputs">
            <PositionInput
              axis="X"
              value={presentation.position.xPercent}
              disabled={disabled}
              onChange={(value) => {
                setPreviewConfirmed(false);
                onChange({
                  windowPosition: {
                    ...presentation.position,
                    xPercent: clampPositionPercent(value, presentation.position.xPercent),
                  },
                });
              }}
            />
            <PositionInput
              axis="Y"
              value={presentation.position.yPercent}
              disabled={disabled}
              onChange={(value) => {
                setPreviewConfirmed(false);
                onChange({
                  windowPosition: {
                    ...presentation.position,
                    yPercent: clampPositionPercent(value, presentation.position.yPercent),
                  },
                });
              }}
            />
          </div>
        </div>
        <button
          className="preview-confirm-button"
          type="button"
          onClick={() => setPreviewConfirmed(true)}
          disabled={disabled}
        >
          {previewConfirmed ? '已确认预览' : '确认预览'}
        </button>
      </div>
    </section>
  );
};

const PositionInput: React.FC<{
  axis: 'X' | 'Y';
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}> = ({ axis, value, disabled, onChange }) => (
  <label className="preview-position-input">
    <span>{axis} 坐标</span>
    <input
      name={`position-${axis.toLowerCase()}`}
      type="number"
      min="0"
      max="100"
      step="0.1"
      value={value}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      disabled={disabled}
      aria-label={`窗口中心 ${axis} 坐标`}
    />
    <span>%</span>
  </label>
);

const RangeField: React.FC<{
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, disabled, onChange }) => (
  <label className="preview-range-row">
    <span className="preview-range-label">
      <span>{label}</span>
      <strong>{value.toFixed(1)}%</strong>
    </span>
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
        <span className="node-field-label">{copy.optionHint}<RequiredMark /></span>
        {options.map((opt, i) => {
          const optionLabel = `选项 ${i + 1}`;
          return (
            <label key={opt.id} className="choice-row">
              <span className="choice-row-number">{optionLabel}<RequiredMark /></span>
              <input
                type="radio"
                name={`answer-${opt.id}-${i}`}
                checked={answer === opt.id}
                required={i === 0}
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
                required
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
        required
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
  required?: boolean;
  hint?: string;
  placeholder?: string;
}> = ({ label, value, onChange, disabled, required = false, hint, placeholder }) => (
  <label className="field-group">
    <span>{label}{required && <RequiredMark />}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      aria-required={required}
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
  required?: boolean;
  hint?: string;
  placeholder?: string;
}> = ({ label, value, onChange, disabled, required = false, hint, placeholder }) => (
  <label className="field-group">
    <span>{label}{required && <RequiredMark />}</span>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      aria-required={required}
      rows={3}
      placeholder={placeholder}
    />
    {hint && <small>{hint}</small>}
  </label>
);

function parseAcceptedAnswers(value: string): string[] {
  return value.split('|').map((item) => item.trim()).filter(Boolean);
}

const RequiredMark: React.FC = () => <span className="required-mark" aria-hidden="true">*</span>;
