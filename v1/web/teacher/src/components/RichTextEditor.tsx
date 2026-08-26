import React, { useEffect, useRef, useState } from 'react';
import { sanitizeRichTextHtml } from '../../../../extension/content/richText';

interface Props {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (html: string) => void;
}

const COLORS = ['#1d5c43', '#927008', '#a9654e', '#35516a'];

export const RichTextEditor: React.FC<Props> = ({ label, value, disabled, onChange }) => {
  const [tab, setTab] = useState<'visual' | 'html'>('visual');
  const [htmlDraft, setHtmlDraft] = useState(value);
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const emit = (html: string) => {
    const clean = sanitizeRichTextHtml(html);
    onChangeRef.current(clean);
    setHtmlDraft(clean);
    return clean;
  };

  useEffect(() => {
    if (tab !== 'visual' || !hostRef.current) return;
    editorRef.current = hostRef.current.querySelector<HTMLDivElement>('[contenteditable]');
    if (editorRef.current) editorRef.current.innerHTML = sanitizeRichTextHtml(valueRef.current);
  }, [tab]);

  useEffect(() => {
    const clean = sanitizeRichTextHtml(value);
    setHtmlDraft(clean);
    const editor = editorRef.current;
    if (tab === 'visual' && editor && editor.innerHTML !== clean) {
      editor.innerHTML = clean;
    }
  }, [value, tab]);

  const run = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    emit(editor.innerHTML);
  };

  const insertLink = () => {
    const href = window.prompt('输入链接地址（支持 http、https、mailto）');
    if (href) run('createLink', href.trim());
  };

  const insertImage = () => {
    const assetId = window.prompt('输入已存在的图片资源 ID（assetId）');
    if (!assetId || !/^[a-zA-Z0-9._:-]+$/.test(assetId.trim())) return;
    run('insertImage', `asset://${assetId.trim()}`);
  };

  const showVisual = () => {
    const clean = emit(htmlDraft);
    setHtmlDraft(clean);
    setTab('visual');
  };

  const showHtml = () => {
    const current = editorRef.current ? editorRef.current.innerHTML : htmlDraft;
    const clean = emit(current);
    setHtmlDraft(clean);
    setTab('html');
  };

  return (
    <div className="rich-text-field">
      <span className="field-label">{label}</span>
      <div className="rich-text-editor" aria-disabled={disabled}>
        <div className="rich-text-tabs" role="tablist" aria-label="正文编辑方式">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'visual'}
            className={tab === 'visual' ? 'rich-text-tab is-active' : 'rich-text-tab'}
            disabled={disabled}
            onClick={showVisual}
          >
            可视化
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'html'}
            className={tab === 'html' ? 'rich-text-tab is-active' : 'rich-text-tab'}
            disabled={disabled}
            onClick={showHtml}
          >
            HTML
          </button>
        </div>
        {tab === 'visual' && (
          <div className="rich-text-toolbar" aria-label="正文格式工具栏">
            <select aria-label="段落样式" defaultValue="P" onChange={(event) => run('formatBlock', event.target.value)} disabled={disabled}>
              <option value="P">正文</option>
              <option value="H2">标题 2</option>
              <option value="H3">标题 3</option>
            </select>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('bold')} disabled={disabled} aria-label="加粗">B</button>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('italic')} disabled={disabled} aria-label="斜体"><em>I</em></button>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('underline')} disabled={disabled} aria-label="下划线"><u>U</u></button>
            {COLORS.map((color) => (
              <button key={color} type="button" className="rich-text-color" style={{ background: color }} onMouseDown={(event) => event.preventDefault()} onClick={() => run('foreColor', color)} disabled={disabled} aria-label={`文字颜色 ${color}`} />
            ))}
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertUnorderedList')} disabled={disabled} aria-label="无序列表">•</button>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertOrderedList')} disabled={disabled} aria-label="有序列表">1.</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={() => run('formatBlock', 'BLOCKQUOTE')} disabled={disabled}>引用</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={insertLink} disabled={disabled}>链接</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={insertImage} disabled={disabled}>图片资源</button>
          </div>
        )}
        {tab === 'visual' ? (
          <div ref={hostRef} className="rich-text-visual">
            <div
              ref={editorRef}
              className="rich-text-content"
              contentEditable={!disabled}
              suppressContentEditableWarning
              data-placeholder="在这里编辑重点内容"
              onInput={(event) => emit(event.currentTarget.innerHTML)}
              role="textbox"
              aria-multiline="true"
            />
          </div>
        ) : (
          <textarea
            className="rich-text-html"
            aria-label={`${label} HTML`}
            value={htmlDraft}
            disabled={disabled}
            rows={10}
            onChange={(event) => setHtmlDraft(event.target.value)}
            onBlur={() => {
              const clean = emit(htmlDraft);
              setHtmlDraft(clean);
            }}
          />
        )}
      </div>
      <small>可视化与 HTML 两种编辑方式；保存前会去掉脚本、危险链接和未允许的标签。</small>
    </div>
  );
};
