import React, { useCallback, useEffect, useState } from 'react';
import { Topbar, SectionHead, APIError, errorMessage } from '@v1/web/shared';
import { TeacherAPI, Teacher, ScriptNode, NodeKind } from '../api';
import { NODE_KINDS, metaOf, createNode, formatTime, parseTime } from '../nodes';
import { NodeForm } from '../components/NodeForm';

interface Props {
  api: TeacherAPI;
  teacher: Teacher;
  lessonId: string;
  lessonTitle: string;
  onBack: () => void;
  onSignedOut: () => void;
}

export const LessonPage: React.FC<Props> = ({
  api,
  teacher,
  lessonId,
  lessonTitle,
  onBack,
  onSignedOut,
}) => {
  const [nodes, setNodes] = useState<ScriptNode[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const draft = await api.getDraft(lessonId);
      setNodes(draft.config.nodes);
      setDirty(false);
    } catch (err) {
      // 还没存过草稿是正常起点，不是错误
      if (err instanceof APIError && err.code === 'DRAFT_NOT_FOUND') {
        setNodes([]);
        setDirty(false);
        return;
      }
      setError(errorMessage(err));
      setNodes([]);
    }
  }, [api, lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  // 有未保存改动时离开页面先提醒
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (next: ScriptNode[]) => {
    setNodes(next);
    setDirty(true);
    setNotice(null);
  };

  const add = (kind: NodeKind) => {
    if (!nodes) return;
    // 新节点排在最后一个之后 30 秒，避免和已有节点同一时刻
    const last = nodes.reduce((max, n) => Math.max(max, n.trigger.timeSeconds), 0);
    update([...nodes, createNode(kind, nodes.length === 0 ? 30 : last + 30)]);
  };

  const save = async () => {
    if (!nodes) return;
    setBusy(true);
    setError(null);
    try {
      // 按时间排序后保存，学生端按顺序触发
      const sorted = [...nodes].sort(
        (a, b) => a.trigger.timeSeconds - b.trigger.timeSeconds
      );
      const draft = await api.saveDraft(lessonId, sorted);
      setNodes(draft.config.nodes);
      setDirty(false);
      setNotice(`已保存 ${draft.node_count} 个节点`);
    } catch (err) {
      // 后端整份校验，失败时本地内容保留，不清空用户的输入
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sorted = nodes
    ? [...nodes].sort((a, b) => a.trigger.timeSeconds - b.trigger.timeSeconds)
    : [];

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={teacher.display_name}
        onLogout={onSignedOut}
      />

      <main className="view workspace-home">
        <button className="text-button back-link" type="button" onClick={onBack}>
          ← 返回课程
        </button>

        {error && <p className="field-error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}

        <SectionHead
          title={lessonTitle}
          count={
            nodes === null
              ? undefined
              : `${nodes.length} 个互动节点${dirty ? '（有未保存改动）' : ''}`
          }
        >
          <button
            className="dark-button"
            type="button"
            onClick={save}
            disabled={busy || !dirty}
          >
            {busy ? '保存中…' : '保存草稿'}
          </button>
        </SectionHead>

        {nodes === null && <p className="table-state">正在读取草稿…</p>}

        {nodes && (
          <>
            <div className="node-add-row">
              <span>添加节点：</span>
              {NODE_KINDS.map((m) => (
                <button
                  key={m.kind}
                  className="light-button"
                  type="button"
                  onClick={() => add(m.kind)}
                  disabled={busy}
                  title={m.hint}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {nodes.length === 0 ? (
              <p className="table-state">
                还没有互动节点。课程必须至少有一个节点才能发布。
              </p>
            ) : (
              <div className="node-list">
                {sorted.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    disabled={busy}
                    onChange={(next) =>
                      update(nodes.map((n) => (n.id === node.id ? next : n)))
                    }
                    onRemove={() => update(nodes.filter((n) => n.id !== node.id))}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const NodeCard: React.FC<{
  node: ScriptNode;
  disabled: boolean;
  onChange: (node: ScriptNode) => void;
  onRemove: () => void;
}> = ({ node, disabled, onChange, onRemove }) => {
  const meta = metaOf(node.interaction);
  const [timeText, setTimeText] = useState(formatTime(node.trigger.timeSeconds));
  const [timeError, setTimeError] = useState(false);

  const commitTime = () => {
    const seconds = parseTime(timeText);
    if (seconds === null) {
      setTimeError(true);
      return;
    }
    setTimeError(false);
    onChange({ ...node, trigger: { ...node.trigger, timeSeconds: seconds } });
  };

  return (
    <section className="node-card">
      <header className="node-card-head">
        <span className={`node-tag node-tag-${node.interaction}`}>{meta.label}</span>
        <label className="node-time">
          <span>触发时刻</span>
          <input
            type="text"
            value={timeText}
            onChange={(e) => setTimeText(e.target.value)}
            onBlur={commitTime}
            disabled={disabled}
            aria-invalid={timeError}
          />
        </label>
        {timeError && <span className="node-time-error">格式应为 mm:ss</span>}
        <button
          className="text-button"
          type="button"
          onClick={onRemove}
          disabled={disabled}
        >
          删除
        </button>
      </header>

      <NodeForm node={node} disabled={disabled} onChange={onChange} />
    </section>
  );
};
