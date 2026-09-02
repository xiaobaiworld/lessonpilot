import React, { useEffect, useRef, useState } from 'react';
import {
  Caption,
  parseSubtitle,
  SubtitleDocument,
  SUBTITLE_MAX_BYTES,
  errorMessage,
} from '@v1/web/shared';
import { NODE_KINDS } from '../nodes';
import { NodeKind, SubtitleRepairResult } from '../api';

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
  onSubtitle: (subtitle: SubtitleDocument | null) => void;
  initialSubtitle: SubtitleDocument | null;
  onFilename?: (filename: string) => void;
  repairSubtitle: (file: File) => Promise<SubtitleRepairResult>;
  disabled: boolean;
}

/**
 * 字幕取景器。
 *
 * 字幕文件自带精确时间戳，是节点定位的真源——播放器只是用来确认内容的。
 * 老师从字幕里挑一句，节点就落在那句话的起点，不用手填 mm:ss。
 * 文件先交给服务端临时检查/修复，再在浏览器内解析；只有保存草稿时才进入服务端草稿。
 */
export const SubtitlePicker: React.FC<Props> = ({
  usedSeconds,
  onPick,
  onDuration,
  onCaptions,
  onSubtitle,
  initialSubtitle,
  onFilename,
  repairSubtitle,
  disabled,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [picking, setPicking] = useState<Caption | null>(null);
  const [repairNotice, setRepairNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialSubtitle) {
      setCaptions(null);
      setFilename('');
      setPicking(null);
      setRepairNotice(null);
      return;
    }
    const result = parseSubtitle(initialSubtitle.content, initialSubtitle.filename);
    if (result.ok) {
      setCaptions(result.captions);
      setFilename(initialSubtitle.filename);
      onCaptions(result.captions);
    }
  }, [initialSubtitle?.content, initialSubtitle?.filename]);

  const load = async (file: File) => {
    setError(null);
    setRepairNotice(null);
    if (file.size > SUBTITLE_MAX_BYTES) {
      setError('字幕文件不能超过 5 MB。');
      return;
    }
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      setError('请选择 .srt 或 .vtt 字幕文件。');
      return;
    }
    setLoading(true);
    try {
      const repaired = await repairSubtitle(file);
      const result = parseSubtitle(repaired.subtitle.content, repaired.subtitle.filename);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCaptions(result.captions);
      onCaptions(result.captions);
      onSubtitle(repaired.subtitle);
      setFilename(repaired.subtitle.filename);
      onFilename?.(repaired.subtitle.filename);
      if (repaired.repaired) {
        setRepairNotice(`已自动修复 ${repaired.changes.length} 处字幕时间问题。`);
      }
      const last = result.captions[result.captions.length - 1];
      if (last) onDuration(Math.ceil(last.endSeconds));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const chooseFile = () => fileInput.current?.click();

  const fileInputElement = (
    <input
      ref={fileInput}
      type="file"
      accept=".srt,.vtt"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void load(f);
        e.target.value = '';
      }}
    />
  );

  if (!captions) {
    return (
      <div className="subtitle-import">
        <div>
          <strong>导入字幕定位节点</strong>
          <p>
            字幕自带精确时间戳，导入后从某句话直接插入节点，不必手填时刻。
            导入结果会在点击“保存草稿”时随课节草稿保存。
          </p>
        </div>
        {fileInputElement}
        <button
          className="light-button"
          type="button"
          onClick={chooseFile}
          disabled={disabled || loading}
        >
          {loading ? '检查字幕中…' : '选择 SRT / VTT 文件'}
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
          onClick={chooseFile}
          disabled={disabled || loading}
        >
          重新导入
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setCaptions(null);
            onCaptions(null);
            onSubtitle(null);
            onFilename?.('');
            setPicking(null);
            setRepairNotice(null);
          }}
          disabled={disabled || loading}
        >
          移除字幕
        </button>
      </div>
      {fileInputElement}
      {repairNotice && <p className="subtitle-repair-notice">{repairNotice}</p>}
      {error && <p className="field-error">{error}</p>}

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
