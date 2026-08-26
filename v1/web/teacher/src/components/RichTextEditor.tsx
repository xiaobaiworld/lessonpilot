import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import {
  isSafeRichTextImageSrc,
  sanitizeRichTextHtml,
} from '../../../../extension/content/richText';

interface Props {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (html: string) => void;
}

const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ color: ['#1d5c43', '#927008', '#a9654e', '#35516a'] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'link', 'image'],
];

export const RichTextEditor: React.FC<Props> = ({ label, value, disabled, onChange }) => {
  const [tab, setTab] = useState<'visual' | 'html'>('visual');
  const [htmlDraft, setHtmlDraft] = useState(value);
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const emit = (html: string) => {
    const clean = sanitizeRichTextHtml(html);
    onChangeRef.current(clean);
    return clean;
  };

  useEffect(() => {
    if (tab !== 'visual' || !hostRef.current) return;

    const quill = new Quill(hostRef.current, {
      theme: 'snow',
      readOnly: disabled,
      modules: {
        toolbar: {
          container: TOOLBAR,
          handlers: {
            image() {
              const url = window.prompt('输入图片地址（http 或 https）');
              if (!url || !isSafeRichTextImageSrc(url.trim())) return;
              const range = quill.getSelection(true) ?? { index: quill.getLength(), length: 0 };
              quill.insertEmbed(range.index, 'image', url.trim(), 'user');
            },
          },
        },
      },
    });
    quill.root.innerHTML = sanitizeRichTextHtml(valueRef.current);
    quill.on('text-change', () => {
      emit(quill.root.innerHTML);
    });
    quillRef.current = quill;

    return () => {
      quill.off('text-change');
      quillRef.current = null;
    };
  }, [tab, disabled]);

  useEffect(() => {
    const clean = sanitizeRichTextHtml(value);
    setHtmlDraft(clean);
    const quill = quillRef.current;
    if (tab === 'visual' && quill && quill.root.innerHTML !== clean) {
      quill.root.innerHTML = clean;
    }
  }, [value, tab]);

  const showVisual = () => {
    const clean = emit(htmlDraft);
    setHtmlDraft(clean);
    setTab('visual');
  };

  const showHtml = () => {
    const current = quillRef.current ? quillRef.current.root.innerHTML : htmlDraft;
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
        {tab === 'visual' ? (
          <div className="rich-text-quill">
            <div ref={hostRef} />
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
