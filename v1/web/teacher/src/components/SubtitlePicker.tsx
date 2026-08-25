import React, { useRef, useState } from 'react';
import { Caption, parseSubtitle } from '@v1/web/shared';
import { NODE_KINDS } from '../nodes';
import { NodeKind } from '../api';

interface Props {
  /** 已有节点的时刻，用来标出哪句已经放过节点 */
  usedSeconds: number[];
  onPick: (kind: NodeKind, seconds: number, captionText: string) => void;
  /**
   * 上报课程时长。取最后一句字幕的结束时刻——这是本机唯一可靠的时长真源，
   * 时间轴据此渲染。没有字幕时不上报，时间轴就不显示，而不是猜一个数字。
   */
  onDuration: (seconds: number) => void;
  onCaptions: (captions: Caption[] | null) => void;
  onFilename?: (filename: string) => void;
  disabled: boolean;
}

/**
 * 字幕取景器。
 *
 * 字幕文件自带精确时间戳，是节点定位的真源——播放器只是用来确认内容的。
 * 老师从字幕里挑一句，节点就落在那句话的起点，不用手填 mm:ss。
 * 文件只在浏览器内解析，不上传。
 */
export const SubtitlePicker: React.FC<Props> = ({
  usedSeconds,
  onPick,
  onDuration,
  onCaptions,
  onFilename,
  disabled,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [picking, setPicking] = useState<Caption | null>(null);

  const load = async (file: File) => {
    setError(null);
    const result = parseSubtitle(await file.text(), file.name);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCaptions(result.captions);
    onCaptions(result.captions);
    setFilename(file.name);
    onFilename?.(file.name);
    const last = result.captions[result.captions.length - 1];
    if (last) onDuration(Math.ceil(last.endSeconds));
  };

  if (!captions) {
    return (
      <div className="subtitle-import">
        <div>
          <strong>导入字幕定位节点</strong>
          <p>
            字幕自带精确时间戳，导入后从某句话直接插入节点，不必手填时刻。
            文件只在本机解析，不会上传。
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".srt,.vtt"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) load(f);
            e.target.value = '';
          }}
        />
        <button
          className="light-button"
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
        >
          选择 SRT / VTT 文件
        </button>
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="subtitle-panel">
      <div className="subtitle-panel-head">
        <strong>{filename}</strong>
        <span>{captions.length} 句</span>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setCaptions(null);
            onCaptions(null);
            onFilename?.('');
            setPicking(null);
          }}
        >
          换一份
        </button>
      </div>

      <ul className="caption-list">
        {captions.map((c) => {
          const used = usedSeconds.some((s) => Math.abs(s - c.startSeconds) < 0.5);
          const active = picking?.id === c.id;
          return (
            <li key={c.id} className={`caption-item${used ? ' is-used' : ''}`}>
              <button
                type="button"
                className="caption-line"
                onClick={() => setPicking(active ? null : c)}
                disabled={disabled}
              >
                <span className="caption-time">{c.time}</span>
                <span className="caption-text">{c.text}</span>
                {used && <span className="caption-used">已有节点</span>}
              </button>

              {active && (
                <div className="caption-actions">
                  {NODE_KINDS.map((m) => (
                    <button
                      key={m.kind}
                      className="light-button"
                      type="button"
                      onClick={() => {
                        onPick(m.kind, c.startSeconds, c.text);
                        setPicking(null);
                      }}
                      disabled={disabled}
                      title={m.hint}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
