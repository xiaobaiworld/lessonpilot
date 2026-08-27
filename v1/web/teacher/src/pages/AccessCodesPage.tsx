import React, { useCallback, useEffect, useState } from 'react';
import { Topbar, errorMessage } from '@v1/web/shared';
import {
  CourseDetail,
  ManagedAccessCode,
  Teacher,
  TeacherAPI,
} from '../api';

interface Props {
  api: TeacherAPI;
  teacher: Teacher;
  courseId: string;
  onBack: () => void;
  onSignedOut: () => void;
}

export const AccessCodesPage: React.FC<Props> = ({
  api,
  teacher,
  courseId,
  onBack,
  onSignedOut,
}) => {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [codes, setCodes] = useState<ManagedAccessCode[] | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextCourse, nextCodes] = await Promise.all([
        api.getCourse(courseId),
        api.listAccessCodes(courseId),
      ]);
      setCourse(nextCourse);
      setCodes(nextCodes);
    } catch (err) {
      setError(errorMessage(err));
      setCodes([]);
    }
  }, [api, courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createAccessCodeBatch(courseId, count);
      setCodes((current) => [...created, ...(current ?? [])]);
      setCount(1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const terminate = async (code: ManagedAccessCode) => {
    if (!window.confirm('确定终止这条授权码吗？')) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.terminateAccessCode(code.id);
      setCodes((current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)) ?? []
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={teacher.login_name}
        onLogout={onSignedOut}
      />

      <main className="view workspace-home access-code-page">
        <button className="text-button back-link" type="button" onClick={onBack}>
          ← 返回课程总览
        </button>

        <div className="access-code-page-head">
          <div>
            <p className="eyebrow">课程交付</p>
            <h1>授权码管理</h1>
            <p>
              {course?.title ?? '正在读取课程…'}
              {course?.version_number ? ` · 第 ${course.version_number} 版` : ''}
            </p>
          </div>
          <div className="access-code-create">
            <label htmlFor="access-code-count">生成数量</label>
            <input
              id="access-code-count"
              name="count"
              type="number"
              min="1"
              max="100"
              value={count}
              disabled={busy}
              onChange={(event) => {
                const value = Number(event.target.value);
                setCount(Number.isFinite(value) ? Math.min(100, Math.max(1, value)) : 1);
              }}
            />
            <button className="dark-button" type="button" onClick={generate} disabled={busy}>
              {busy ? '处理中…' : count === 1 ? '生成授权码' : '批量生成'}
            </button>
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}
        {codes === null && !error && <p className="table-state">正在读取授权码…</p>}

        {codes && codes.length === 0 && (
          <div className="access-code-empty">
            <strong>还没有授权码</strong>
            <p>生成后可在这里查看完整授权码和领取使用情况。</p>
          </div>
        )}

        {codes && codes.length > 0 && (
          <div className="access-code-table-wrap">
            <table className="access-code-table">
              <thead>
                <tr>
                  <th>完整授权码</th>
                  <th>状态</th>
                  <th>领取情况</th>
                  <th>首次领取</th>
                  <th>最近领取</th>
                  <th><span className="visually-hidden">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id}>
                    <td data-label="完整授权码">
                      <code className="access-code-value">{code.access_code}</code>
                    </td>
                    <td data-label="状态">
                      <span className={`access-code-status is-${code.status}`}>
                        {formatStatus(code.status)}
                      </span>
                    </td>
                    <td data-label="领取情况">已领取 {code.redemption_count} 台设备</td>
                    <td data-label="首次领取">{formatDateTime(code.first_redeemed_at)}</td>
                    <td data-label="最近领取">{formatDateTime(code.last_redeemed_at)}</td>
                    <td data-label="操作">
                      {code.status !== 'terminated' && (
                        <button
                          className="text-button access-code-terminate"
                          type="button"
                          disabled={busy}
                          onClick={() => void terminate(code)}
                        >
                          终止授权
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

function formatStatus(status: string): string {
  if (status === 'active') return '有效';
  if (status === 'terminated') return '已终止';
  return status;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
