import React, { useEffect, useRef, useState } from 'react';
import { AssetRecord } from '@v1/web/shared';
import { sanitizeRichTextHtml } from '../../../../extension/content/richText';

interface Props {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (html: string) => void;
  placeholder?: string;
  hint?: string;
  onUploadAsset?: (file: File) => Promise<AssetRecord>;
  onImportAsset?: (url: string) => Promise<AssetRecord>;
  assetUrlForId?: (assetId: string) => string;
  onAssetCreated?: (asset: AssetRecord) => void;
}

const COLORS = ['#1d5c43', '#927008', '#a9654e', '#35516a'];

export const RichTextEditor: React.FC<Props> = ({ label, value, disabled, onChange, placeholder, hint, onUploadAsset, onImportAsset, assetUrlForId, onAssetCreated }) => {
  const [tab, setTab] = useState<'visual' | 'html'>('visual');
  const [htmlDraft, setHtmlDraft] = useState(value);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<AssetRecord['kind']>('image');
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const hydrateAssetSources = (html: string) => {
    const clean = sanitizeRichTextHtml(html);
    if (!assetUrlForId) return clean;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = clean;
    wrapper.querySelectorAll<HTMLElement>('[data-asset-id]').forEach((element) => {
      const match = (element.dataset.assetId ?? '').match(/^asset:\/\/(.+)$/);
      const assetId = match?.[1] ?? (element.dataset.assetId && /^[a-zA-Z0-9._:-]+$/.test(element.dataset.assetId) ? element.dataset.assetId : null);
      if (assetId && ['IMG', 'AUDIO', 'VIDEO'].includes(element.tagName)) {
        element.setAttribute('src', assetUrlForId(assetId));
      }
    });
    return wrapper.innerHTML;
  };

  const emit = (html: string) => {
    const clean = sanitizeRichTextHtml(html);
    onChangeRef.current(clean);
    setHtmlDraft(clean);
    return clean;
  };

  useEffect(() => {
    if (tab !== 'visual' || !hostRef.current) return;
    editorRef.current = hostRef.current.querySelector<HTMLDivElement>('[contenteditable]');
    if (editorRef.current) editorRef.current.innerHTML = hydrateAssetSources(valueRef.current);
  }, [tab]);

  useEffect(() => {
    const clean = sanitizeRichTextHtml(value);
    setHtmlDraft(clean);
    const editor = editorRef.current;
    const visual = hydrateAssetSources(clean);
    if (tab === 'visual' && editor && editor.innerHTML !== visual) editor.innerHTML = visual;
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

  const insertAsset = (asset: AssetRecord) => {
    const editor = editorRef.current;
    if (!editor) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = editor.innerHTML;
    const paragraph = document.createElement('p');
    const element = document.createElement(asset.kind === 'image' ? 'img' : asset.kind);
    element.setAttribute('data-asset-id', `asset://${asset.assetId}`);
    if (assetUrlForId) element.setAttribute('src', assetUrlForId(asset.assetId));
    if (asset.kind === 'image') element.setAttribute('alt', asset.alt ?? '');
    else element.setAttribute('controls', '');
    paragraph.append(element);
    wrapper.append(paragraph);
    const clean = emit(wrapper.innerHTML);
    editor.innerHTML = hydrateAssetSources(clean);
    onAssetCreated?.(asset);
  };

  const importAsset = async (source: Promise<AssetRecord>) => {
    setAssetBusy(true);
    setAssetError(null);
    try {
      insertAsset(await source);
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : '媒体导入失败');
    } finally {
      setAssetBusy(false);
    }
  };

  const chooseUpload = (kind: AssetRecord['kind']) => {
    setUploadKind(kind);
    window.setTimeout(() => uploadRef.current?.click(), 0);
  };

  const insertFromUrl = () => {
    const url = window.prompt('输入图片、音频或视频 URL（服务器会先导入并生成资源 ID）')?.trim();
    if (url && onImportAsset) void importAsset(onImportAsset(url));
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
          <button type="button" role="tab" aria-selected={tab === 'visual'} className={tab === 'visual' ? 'rich-text-tab is-active' : 'rich-text-tab'} disabled={disabled} onClick={showVisual}>可视化</button>
          <button type="button" role="tab" aria-selected={tab === 'html'} className={tab === 'html' ? 'rich-text-tab is-active' : 'rich-text-tab'} disabled={disabled} onClick={showHtml}>HTML</button>
        </div>
        {tab === 'visual' && (
          <div className="rich-text-toolbar" aria-label="正文格式工具栏">
            <select aria-label="段落样式" defaultValue="P" onChange={(event) => run('formatBlock', event.target.value)} disabled={disabled}>
              <option value="P">正文</option><option value="H2">标题 2</option><option value="H3">标题 3</option>
            </select>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('bold')} disabled={disabled} aria-label="加粗">B</button>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('italic')} disabled={disabled} aria-label="斜体"><em>I</em></button>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('underline')} disabled={disabled} aria-label="下划线"><u>U</u></button>
            {COLORS.map((color) => <button key={color} type="button" className="rich-text-color" style={{ background: color }} onMouseDown={(event) => event.preventDefault()} onClick={() => run('foreColor', color)} disabled={disabled} aria-label={`文字颜色 ${color}`} />)}
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertUnorderedList')} disabled={disabled} aria-label="无序列表">•</button>
            <button type="button" className="rich-text-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertOrderedList')} disabled={disabled} aria-label="有序列表">1.</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={() => run('formatBlock', 'BLOCKQUOTE')} disabled={disabled}>引用</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={insertLink} disabled={disabled}>链接</button>
            <input ref={uploadRef} type="file" hidden accept={uploadKind === 'image' ? 'image/*' : uploadKind === 'audio' ? 'audio/*' : 'video/*'} disabled={disabled || assetBusy || !onUploadAsset} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file && onUploadAsset) void importAsset(onUploadAsset(file)); }} />
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseUpload('image')} disabled={disabled || assetBusy || !onUploadAsset}>上传图片</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseUpload('audio')} disabled={disabled || assetBusy || !onUploadAsset}>上传音频</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseUpload('video')} disabled={disabled || assetBusy || !onUploadAsset}>上传视频</button>
            <button type="button" className="rich-text-tool rich-text-tool-wide" onMouseDown={(event) => event.preventDefault()} onClick={insertFromUrl} disabled={disabled || assetBusy || !onImportAsset}>媒体链接</button>
          </div>
        )}
        {tab === 'visual' ? (
          <div ref={hostRef} className="rich-text-visual"><div ref={editorRef} className="rich-text-content" contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder ?? '在这里编辑内容'} onInput={(event) => emit(event.currentTarget.innerHTML)} role="textbox" aria-label={label} aria-multiline="true" /></div>
        ) : (
          <textarea className="rich-text-html" aria-label={`${label} HTML`} value={htmlDraft} disabled={disabled} rows={10} onChange={(event) => setHtmlDraft(event.target.value)} onBlur={() => setHtmlDraft(emit(htmlDraft))} />
        )}
      </div>
      {assetBusy && <small>正在导入媒体并生成资源 ID…</small>}
      {assetError && <p className="field-error">{assetError}</p>}
      {hint && <small>{hint}</small>}
      <small>可视化与 HTML 两种编辑方式；保存前会去掉脚本、危险链接和未允许的标签。</small>
    </div>
  );
};
