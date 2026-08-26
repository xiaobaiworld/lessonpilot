import React, { useEffect, useRef } from 'react';

const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'EM',
  'FONT',
  'H3',
  'I',
  'LI',
  'OL',
  'P',
  'SPAN',
  'STRONG',
  'U',
  'UL',
]);

export function isSafeRichTextHref(value: string, base = 'https://knownmap.invalid/'): boolean {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeRichTextColor(value: string): boolean {
  const color = value.trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) || /^rgb(a)?\([\d\s.,%]+\)$/i.test(color);
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
  if (!(node instanceof HTMLElement) || !ALLOWED_TAGS.has(node.tagName)) return null;

  const clean = document.createElement(node.tagName === 'FONT' ? 'span' : node.tagName.toLowerCase());
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? '';
    if (!isSafeRichTextHref(href, window.location.origin)) {
      return document.createTextNode(node.textContent ?? '');
    }
    clean.setAttribute('href', href);
    clean.setAttribute('target', '_blank');
    clean.setAttribute('rel', 'noreferrer noopener');
  }
  if (node.tagName === 'SPAN' || node.tagName === 'FONT') {
    const color = node.tagName === 'FONT' ? node.getAttribute('color') ?? '' : node.style.color;
    if (isSafeRichTextColor(color)) clean.setAttribute('style', `color: ${color.trim()}`);
  }
  node.childNodes.forEach((child) => {
    const safeChild = sanitizeNode(child);
    if (safeChild) clean.append(safeChild);
  });
  return clean;
}

/** 只保留编辑器提供的文本排版和安全链接，避免把 HTML 当作课程代码执行。 */
export function sanitizeRichTextHtml(html: string): string {
  const source = document.createElement('template');
  source.innerHTML = html;
  const clean = document.createElement('div');
  source.content.childNodes.forEach((node) => {
    const safeNode = sanitizeNode(node);
    if (safeNode) clean.append(safeNode);
  });
  return clean.innerHTML;
}

export function plainTextFromRichText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = sanitizeRichTextHtml(html);
  return (container.innerText || container.textContent || '').trim();
}

export function plainTextToRichTextHtml(text: string): string {
  const container = document.createElement('div');
  container.textContent = text;
  return container.innerHTML.replace(/\r?\n/g, '<br>');
}

interface Props {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (html: string, plainText: string) => void;
}

interface ToolbarButton {
  label: string;
  command: string;
  value?: string;
}

const TEXT_BUTTONS: ToolbarButton[] = [
  { label: '粗体', command: 'bold' },
  { label: '斜体', command: 'italic' },
  { label: '下划线', command: 'underline' },
  { label: '清除格式', command: 'removeFormat' },
];

const BLOCK_BUTTONS: ToolbarButton[] = [
  { label: '分组标题', command: 'formatBlock', value: 'h3' },
  { label: '引用分组', command: 'formatBlock', value: 'blockquote' },
  { label: '项目分组', command: 'insertUnorderedList' },
  { label: '编号分组', command: 'insertOrderedList' },
];

const COLORS = [
  { label: '墨绿色', value: '#1d5c43' },
  { label: '重点金色', value: '#927008' },
  { label: '砖红色', value: '#a9654e' },
  { label: '蓝灰色', value: '#35516a' },
];

export const RichTextEditor: React.FC<Props> = ({ label, value, disabled, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const cleanValue = sanitizeRichTextHtml(value);
    if (editor.innerHTML !== cleanValue) editor.innerHTML = cleanValue;
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeRichTextHtml(editor.innerHTML);
    if (editor.innerHTML !== html) editor.innerHTML = html;
    onChange(html, plainTextFromRichText(html));
  };

  const applyCommand = (command: string, commandValue?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const addLink = () => {
    if (disabled) return;
    const href = window.prompt('输入链接地址（支持 http、https 或 mailto）');
    if (!href || !isSafeRichTextHref(href.trim(), window.location.origin)) return;
    editorRef.current?.focus();
    document.execCommand('createLink', false, href.trim());
    emitChange();
  };

  return (
    <div className="rich-text-field">
      <span className="field-label">{label}</span>
      <div className="rich-text-editor" aria-disabled={disabled}>
        <div className="rich-text-toolbar" role="toolbar" aria-label="正文格式工具">
          {TEXT_BUTTONS.map((button) => (
            <button
              key={button.label}
              type="button"
              className="rich-text-tool"
              title={button.label}
              aria-label={button.label}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand(button.command, button.value)}
            >
              {button.label === '粗体' ? 'B' : button.label === '斜体' ? 'I' : button.label === '下划线' ? 'U' : '清'}
            </button>
          ))}
          <span className="rich-text-tool-separator" aria-hidden="true" />
          {COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className="rich-text-color"
              style={{ backgroundColor: color.value }}
              title={`文字颜色：${color.label}`}
              aria-label={`文字颜色：${color.label}`}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand('foreColor', color.value)}
            />
          ))}
          <span className="rich-text-tool-separator" aria-hidden="true" />
          {BLOCK_BUTTONS.map((button) => (
            <button
              key={button.label}
              type="button"
              className="rich-text-tool rich-text-tool-wide"
              title={button.label}
              aria-label={button.label}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand(button.command, button.value)}
            >
              {button.label}
            </button>
          ))}
          <button
            type="button"
            className="rich-text-tool rich-text-tool-wide"
            title="添加链接"
            aria-label="添加链接"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={addLink}
          >
            链接
          </button>
        </div>
        <div
          ref={editorRef}
          className="rich-text-content"
          contentEditable={!disabled}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          data-placeholder="输入重点内容，可使用颜色、链接和分组"
          suppressContentEditableWarning
          onInput={emitChange}
        />
      </div>
      <small>支持重点、链接和分组排版；旧版插件会使用同一内容的纯文本回退。</small>
    </div>
  );
};
