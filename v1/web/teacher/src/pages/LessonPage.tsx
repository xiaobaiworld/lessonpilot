import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { APIError, parseSubtitle, SubtitleDocument, Topbar, errorMessage } from '@v1/web/shared';
import { richDocumentFromText } from '@v1/web/shared';
import { Caption, NODE_ICON_IDS, NodeIcon } from '@v1/web/shared/editor';
import { TeacherAPI, Teacher, ScriptNode, NodeKind, CourseDetail } from '../api';
import { AssetRecord } from '@v1/web/shared';
import {
  NODE_KINDS,
  metaOf,
  createNode,
  formatTime,
  parseTime,
  findEmptyField,
} from '../nodes';
import { NodeForm } from '../components/NodeForm';
import { NodeKindSelect } from '../components/NodeKindSelect';
import { SubtitlePicker } from '../components/SubtitlePicker';
import { Timeline } from '../components/Timeline';
import {
  buildSegments,
  captionsAround,
  SEGMENT_LENGTH_OPTIONS,
} from '../editorModel';

interface Props {
  api: TeacherAPI;
  teacher: Teacher;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  onBack: () => void;
  onSelectLesson: (lessonId: string, lessonTitle: string) => void;
  onSignedOut: () => void;
}

const LESSON_ORDINALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function lessonOptionLabel(sortOrder: number, title: string): string {
  const ordinal = LESSON_ORDINALS[sortOrder] ?? String(sortOrder);
  return `第${ordinal}节：${title}`;
}

export const LessonPage: React.FC<Props> = ({
  api,
  teacher,
  courseId,
  lessonId,
  lessonTitle,
  onBack,
  onSelectLesson,
  onSignedOut,
}) => {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [nodes, setNodes] = useState<ScriptNode[] | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [revision, setRevision] = useState<number | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [filename, setFilename] = useState('');
  const [subtitle, setSubtitle] = useState<SubtitleDocument | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armedKind, setArmedKind] = useState<NodeKind | null>(null);
  const [dialogNode, setDialogNode] = useState<ScriptNode | null>(null);
  const [dialogIsNew, setDialogIsNew] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState('segment-1');
  const [segmentSeconds, setSegmentSeconds] = useState<number>(SEGMENT_LENGTH_OPTIONS[0].seconds);

  const currentLesson = course?.lessons.find((lesson) => lesson.id === lessonId);
  const durationSeconds = captions.length
    ? Math.ceil(captions[captions.length - 1].endSeconds)
    : 0;
  const segments = useMemo(
    () => buildSegments(durationSeconds, segmentSeconds),
    [durationSeconds, segmentSeconds]
  );
  const selectedSegment =
    segments.find((segment) => segment.id === selectedSegmentId) ?? segments[0];
  const selectedNode = nodes?.find((node) => node.id === selectedId);
  const contextCaptions = selectedNode
    ? captionsAround(captions, selectedNode.anchor.timeSeconds, selectedNode.anchor.captionId)
    : [];

  const load = useCallback(async () => {
    setError(null);
    try {
      const courseDetail = await api.getCourse(courseId);
      setCourse(courseDetail);
    } catch (err) {
      setError(errorMessage(err));
      setCourse(null);
    }

    try {
      const draft = await api.getDraft(lessonId);
      setNodes(draft.config.nodes);
      setAssets(draft.config.assets ?? []);
      setSubtitle(draft.config.subtitle ?? null);
      if (draft.config.subtitle) {
        const parsed = parseSubtitle(draft.config.subtitle.content, draft.config.subtitle.filename);
        setCaptions(parsed.ok ? parsed.captions : []);
        setFilename(draft.config.subtitle.filename);
      } else {
        setCaptions([]);
        setFilename('');
      }
      setRevision(draft.revision);
      setDirty(false);
      setSelectedId(null);
    } catch (err) {
      if (err instanceof APIError && err.code === 'DRAFT_NOT_FOUND') {
        setNodes([]);
        setAssets([]);
        setSubtitle(null);
        setCaptions([]);
        setFilename('');
        setRevision(null);
        return;
      }
      setError(errorMessage(err));
      setNodes([]);
      setAssets([]);
      setSubtitle(null);
      setCaptions([]);
      setFilename('');
      setRevision(null);
    }
  }, [api, courseId, lessonId]);

  useEffect(() => {
    setCaptions([]);
    setFilename('');
    setSubtitle(null);
    setSelectedSegmentId('segment-1');
    setSegmentSeconds(SEGMENT_LENGTH_OPTIONS[0].seconds);
    setDialogNode(null);
    setArmedKind(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (next: ScriptNode[]) => {
    setNodes(next);
    setDirty(true);
    setNotice(null);
  };

  const openNewNode = (kind: NodeKind, seconds: number, captionText = '') => {
    if (!nodes) return;
    const node = createNode(kind, seconds);
    const nearest = captions.reduce<Caption | null>((best, item) => {
      if (!best || Math.abs(item.startSeconds - seconds) < Math.abs(best.startSeconds - seconds)) {
        return item;
      }
      return best;
    }, null);
    const caption = captionText || nearest?.text || '';
    const prepared: ScriptNode = {
      ...node,
      content: richDocumentFromText(caption),
      anchor: { ...node.anchor, captionId: nearest?.id ?? null },
    };
    setSelectedId(prepared.id);
    setDialogNode(prepared);
    setDialogIsNew(true);
  };

  const saveDialog = (next: ScriptNode) => {
    if (!nodes) return;
    const missing = findEmptyField(next);
    if (missing) {
      setError(`请先填写「${missing}」。`);
      return;
    }
    if (dialogIsNew) update([...nodes, next]);
    else update(nodes.map((node) => (node.id === next.id ? next : node)));
    setSelectedId(next.id);
    setDialogNode(null);
    setError(null);
  };

  const deleteDialogNode = () => {
    if (!dialogNode || !nodes || !window.confirm('确定删除这个节点吗？')) return;
    update(nodes.filter((node) => node.id !== dialogNode.id));
    setSelectedId(null);
    setDialogNode(null);
  };

  const moveNode = (nodeId: string, seconds: number) => {
    if (!nodes) return;
    const nearest = captions.reduce<Caption | null>((best, item) => {
      if (!best || Math.abs(item.startSeconds - seconds) < Math.abs(best.startSeconds - seconds)) {
        return item;
      }
      return best;
    }, null);
    update(
      nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              anchor: {
                ...node.anchor,
                timeSeconds: Math.max(0, Math.round(seconds * 10) / 10),
                captionId: nearest?.id ?? null,
              },
            }
          : node
      )
    );
    setSelectedId(nodeId);
  };

  const save = async () => {
    if (!nodes) return;
    const sorted = [...nodes].sort(
      (a, b) => a.anchor.timeSeconds - b.anchor.timeSeconds || a.id.localeCompare(b.id)
    );
    for (let i = 0; i < sorted.length; i++) {
      const missing = findEmptyField(sorted[i]);
      if (missing) {
        setError(`第 ${i + 1} 个节点（${metaOf(sorted[i].interaction).label}）还缺「${missing}」`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const draft = await api.saveDraft(lessonId, sorted, revision, assets, subtitle);
      setNodes(draft.config.nodes);
      setAssets(draft.config.assets ?? []);
      setSubtitle(draft.config.subtitle ?? null);
      setRevision(draft.revision);
      setDirty(false);
      setNotice(`已保存 ${draft.node_count} 个节点`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const testPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.testPreview(lessonId);
      setNotice('当前草稿的测试预览已通过');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const selectLesson = (nextLessonId: string) => {
    if (nextLessonId === lessonId) return;
    if (dirty && !window.confirm('当前课节有未保存修改，确定切换吗？')) return;
    const target = course?.lessons.find((lesson) => lesson.id === nextLessonId);
    if (target) onSelectLesson(target.id, target.title);
  };

  const backToCourse = () => {
    if (dirty && !window.confirm('当前课节有未保存修改，确定返回课程吗？')) return;
    onBack();
  };

  return (
    <div className="app-shell">
      <Topbar subtitle="互动课程工具" account={teacher.display_name} onLogout={onSignedOut} />
      <main className="view workspace-home teacher-editor-page">
        <button className="text-button back-link" type="button" onClick={backToCourse}>
          ← 返回课程
        </button>
        {error && <p className="field-error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}

        <header className="teacher-editor-head">
          <div>
            <p className="eyebrow">课程设计</p>
            <h1>{course?.title ?? '正在读取课程…'}</h1>
            <p className="teacher-editor-subtitle">
              {currentLesson?.title ?? lessonTitle} · {nodes?.length ?? 0} 个互动节点
              {dirty ? ' · 有未保存修改' : ''}
            </p>
          </div>
          <div className="teacher-editor-actions">
            <button
              className="light-button"
              type="button"
              onClick={testPreview}
              disabled={busy || dirty || revision === null}
            >
              测试预览
            </button>
            <button className="dark-button" type="button" onClick={save} disabled={busy || !dirty}>
              {busy ? '保存中…' : '保存草稿'}
            </button>
          </div>
        </header>

        <section className="node-plugin-bar" aria-label="添加交互节点">
          <span className="node-plugin-title">交互节点</span>
          {NODE_KINDS.map((meta) => {
            const iconId = NODE_ICON_IDS[meta.kind];
            return (
              <button
                key={meta.kind}
                type="button"
                draggable
                className={`node-plugin node-plugin-${meta.kind}${armedKind === meta.kind ? ' is-active' : ''}`}
                aria-pressed={armedKind === meta.kind}
                onClick={() => setArmedKind(armedKind === meta.kind ? null : meta.kind)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/node-kind', meta.kind);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                title={meta.hint}
              >
                <NodeIcon iconId={iconId as 'attention' | 'choice' | 'blank' | 'qa'} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </section>

        <div className="teacher-editor-context-row">
          <strong className="course-context-title">{course?.title ?? '正在读取课程…'}</strong>
          <select
            id="lesson-switcher-select"
            className="lesson-context-select"
            value={lessonId}
            onChange={(event) => selectLesson(event.target.value)}
            disabled={!course || busy}
            aria-label="选择课节"
          >
            {course?.lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lessonOptionLabel(lesson.sort_order, lesson.title)}
              </option>
            ))}
          </select>
          <div className="segment-pager" aria-label="时间段切换">
            <button
              type="button"
              className="segment-arrow segment-arrow-prev"
              disabled={!selectedSegment || selectedSegment.index === 1}
              onClick={() => setSelectedSegmentId(`segment-${selectedSegment.index - 1}`)}
              aria-label="上一时间段"
            >
              ‹
            </button>
            <strong>
              时间段 {selectedSegment?.index ?? 1} / {selectedSegment?.total ?? 1}
            </strong>
            <button
              type="button"
              className="segment-arrow segment-arrow-next"
              disabled={!selectedSegment || selectedSegment.index === selectedSegment.total}
              onClick={() => setSelectedSegmentId(`segment-${selectedSegment.index + 1}`)}
              aria-label="下一时间段"
            >
              ›
            </button>
          </div>
          <label className="segment-length-control">
            <span>分段长度</span>
            <select
              aria-label="时间段长度"
              value={segmentSeconds}
              onChange={(event) => {
                setSegmentSeconds(Number(event.target.value));
                setSelectedSegmentId('segment-1');
              }}
              disabled={busy}
            >
              {SEGMENT_LENGTH_OPTIONS.map((option) => (
                <option key={option.seconds} value={option.seconds}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {durationSeconds > 0 && selectedSegment ? (
          <>
            <Timeline
              nodes={nodes ?? []}
              durationSeconds={durationSeconds}
              segment={selectedSegment}
              armedKind={armedKind}
              selectedId={selectedId}
              onArm={setArmedKind}
              onPlaceAt={(seconds, kind) => openNewNode(kind ?? armedKind ?? 'notice', seconds)}
              onSelect={setSelectedId}
              onOpen={(id) => {
                const node = nodes?.find((item) => item.id === id);
                if (node) {
                  setSelectedId(id);
                  setDialogNode({ ...node });
                  setDialogIsNew(false);
                }
              }}
              onMove={moveNode}
            />
          </>
        ) : (
          <div className="timeline-empty-state">请先导入字幕，时间轴会根据字幕的真实时长生成。</div>
        )}

        <div className="editor-lower-grid">
          <aside className="subtitle-rail" aria-label="节点处字幕">
            <div className="subtitle-rail-head">
              <strong>节点处字幕</strong>
              <span>{selectedNode ? formatTime(selectedNode.anchor.timeSeconds) : '未选择节点'}</span>
            </div>
            {selectedNode && contextCaptions.length > 0 ? (
              <ol className="subtitle-context-list">
                {contextCaptions.map((caption) => (
                  <li
                    key={caption.id}
                    className={caption.id === selectedNode.anchor.captionId ? 'is-center' : ''}
                  >
                    <time>{caption.time}</time>
                    <span>{caption.text}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="subtitle-empty">选择时间轴上的节点查看附近字幕。</p>
            )}
          </aside>
          <div>
            <SubtitlePicker
              usedSeconds={(nodes ?? []).map((node) => node.anchor.timeSeconds)}
              onPick={(kind, seconds, text) => openNewNode(kind, seconds, text)}
              onDuration={() => undefined}
              onCaptions={(next) => {
                setCaptions(next ?? []);
              }}
              initialSubtitle={subtitle}
              onSubtitle={(next) => {
                setSubtitle(next);
                setFilename(next?.filename ?? '');
                const parsed = next ? parseSubtitle(next.content, next.filename) : null;
                const nextCaptions = parsed?.ok ? parsed.captions : [];
                setNodes((current) =>
                  current
                    ? current.map((node) => {
                        const captionId = node.anchor.captionId;
                        if (!captionId) return node;
                        const previous = captions.find((caption) => caption.id === captionId);
                        const replacement = nextCaptions.find((caption) => caption.id === captionId);
                        const sameTime =
                          previous && replacement && previous.startSeconds === replacement.startSeconds;
                        return sameTime
                          ? node
                          : { ...node, anchor: { ...node.anchor, captionId: null } };
                      })
                    : current
                );
                setDirty(true);
                setNotice(null);
              }}
              onFilename={setFilename}
              repairSubtitle={(file) => api.repairSubtitle(file)}
              disabled={busy}
            />
            {filename && <p className="subtitle-source-note">当前字幕来源：{filename}</p>}
          </div>
        </div>
      </main>

      {dialogNode && (
        <NodeDialog
          node={dialogNode}
          isNew={dialogIsNew}
          disabled={busy}
          onChange={setDialogNode}
          onSave={saveDialog}
          onDelete={deleteDialogNode}
          onCancel={() => setDialogNode(null)}
          onUploadAsset={api.uploadAsset.bind(api)}
          onImportAsset={api.importAssetUrl.bind(api)}
          assetUrlForId={api.assetUrl.bind(api)}
          onAssetCreated={(asset) => setAssets((current) => current.some((item) => item.assetId === asset.assetId) ? current : [...current, asset])}
        />
      )}
    </div>
  );
};

const NodeDialog: React.FC<{
  node: ScriptNode;
  isNew: boolean;
  disabled: boolean;
  onChange: (node: ScriptNode) => void;
  onSave: (node: ScriptNode) => void;
  onDelete: () => void;
  onCancel: () => void;
  onUploadAsset: (file: File) => Promise<AssetRecord>;
  onImportAsset: (url: string) => Promise<AssetRecord>;
  assetUrlForId: (assetId: string) => string;
  onAssetCreated: (asset: AssetRecord) => void;
}> = ({ node, isNew, disabled, onChange, onSave, onDelete, onCancel, onUploadAsset, onImportAsset, assetUrlForId, onAssetCreated }) => {
  const [timeText, setTimeText] = useState(formatTime(node.anchor.timeSeconds));
  const [timeError, setTimeError] = useState(false);
  const iconId = NODE_ICON_IDS[node.interaction];
  const meta = metaOf(node.interaction);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="node-dialog" role="dialog" aria-modal="true" aria-labelledby="node-dialog-title">
        <header className="node-dialog-head">
          <div className="node-dialog-title">
            <span className={`node-dialog-icon node-dialog-${node.interaction}`}>
              <NodeIcon iconId={iconId as 'attention' | 'choice' | 'blank' | 'qa'} />
            </span>
            <div>
              <p className="eyebrow">节点属性</p>
              <h2 id="node-dialog-title">{isNew ? '添加交互节点' : '编辑交互节点'}</h2>
            </div>
          </div>
          <span className={`node-dialog-kind node-dialog-kind-${node.interaction}`}>{meta.label}</span>
        </header>
        <div className="node-dialog-context">
          <label className="dialog-field">
            <span>节点类型</span>
            <NodeKindSelect node={node} disabled={disabled} onChange={onChange} />
          </label>
          <label className="dialog-field dialog-field-time">
            <span>触发时间</span>
            <input
              value={timeText}
              disabled={disabled}
              aria-invalid={timeError}
              onChange={(event) => setTimeText(event.target.value)}
              onBlur={() => {
                const seconds = parseTime(timeText);
                if (seconds === null) setTimeError(true);
                else {
                  setTimeError(false);
                  onChange({ ...node, anchor: { ...node.anchor, timeSeconds: seconds } });
                }
              }}
            />
          </label>
        </div>
        <NodeForm node={node} disabled={disabled} onChange={onChange} onUploadAsset={onUploadAsset} onImportAsset={onImportAsset} assetUrlForId={assetUrlForId} onAssetCreated={onAssetCreated} />
        {timeError && <p className="field-error">时间格式应为 mm:ss。</p>}
        <footer className="node-dialog-actions">
          <button className="text-button" type="button" onClick={onCancel} disabled={disabled}>
            取消
          </button>
          {!isNew && (
            <button className="text-button danger-button" type="button" onClick={onDelete} disabled={disabled}>
              删除节点
            </button>
          )}
          <button className="dark-button" type="button" onClick={() => onSave(node)} disabled={disabled || timeError}>
            保存节点
          </button>
        </footer>
      </section>
    </div>
  );
};
