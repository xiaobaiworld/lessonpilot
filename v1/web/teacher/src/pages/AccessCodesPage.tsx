import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Topbar, errorMessage } from '@v1/web/shared';
import {
  AccessCodeBatchAction,
  AccessCodeGrantInput,
  CourseDetail,
  CourseListItem,
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
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [codes, setCodes] = useState<ManagedAccessCode[] | null>(null);
  const [count, setCount] = useState(1);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([courseId]);
  const [scopeMode, setScopeMode] = useState<'course' | 'lessons'>('course');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [recipientLabel, setRecipientLabel] = useState('');
  const [recipientNote, setRecipientNote] = useState('');
  const [redeemFrom, setRedeemFrom] = useState('');
  const [redeemUntil, setRedeemUntil] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [redemptionFilter, setRedemptionFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ManagedAccessCode | null>(null);
  const [detailRecipientLabel, setDetailRecipientLabel] = useState('');
  const [detailRecipientNote, setDetailRecipientNote] = useState('');
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
      if (api.listCourses) {
        setCourses(await api.listCourses());
      }
    } catch (err) {
      setError(errorMessage(err));
      setCodes([]);
    }
  }, [api, courseId]);

  useEffect(() => {
    setSelectedCourseIds([courseId]);
    setSelectedLessonIds([]);
    void load();
  }, [load]);

  const ownPublishedCourses = useMemo(() => {
    const available = courses.filter(
      (item) => item.status !== 'archived' && item.metrics.release_number !== null
    );
    if (available.some((item) => item.id === courseId)) return available;
    if (course) {
      return [
        {
          ...course,
          metrics: {
            lesson_count: course.lessons.length,
            draft_lesson_count: 0,
            draft_node_count: 0,
            published_node_count: 0,
            access_code_count: 0,
            redeemed_count: 0,
            student_submission_count: null,
            release_number: course.version_number,
            published_at: null,
          },
        },
      ];
    }
    return available;
  }, [course, courseId, courses]);

  const filteredCodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (codes ?? []).filter((code) => {
      const matchesQuery =
        !normalized ||
        code.access_code.toLowerCase().includes(normalized) ||
        code.recipient_label?.toLowerCase().includes(normalized) ||
        code.recipient_note?.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === 'all' || code.status === statusFilter;
      const matchesRedemption =
        redemptionFilter === 'all' ||
        (redemptionFilter === 'redeemed' && code.redemption_count > 0) ||
        (redemptionFilter === 'unused' && code.redemption_count === 0);
      return matchesQuery && matchesStatus && matchesRedemption;
    });
  }, [codes, query, redemptionFilter, statusFilter]);

  const selectedCode = detail ?? codes?.find((item) => item.id === detailId) ?? null;
  const allVisibleSelected =
    filteredCodes.length > 0 && filteredCodes.every((code) => selectedIds.includes(code.id));
  const canUseLessonScope =
    selectedCourseIds.length === 1 && selectedCourseIds[0] === courseId;

  useEffect(() => {
    if (selectedCode) {
      setDetailRecipientLabel(selectedCode.recipient_label ?? '');
      setDetailRecipientNote(selectedCode.recipient_note ?? '');
    }
  }, [selectedCode]);

  const buildGrants = (): AccessCodeGrantInput[] => {
    return selectedCourseIds.map((id) => ({
      course_id: id,
      scope: scopeMode === 'lessons' && id === courseId ? 'lessons' : 'course',
      lesson_ids: scopeMode === 'lessons' && id === courseId ? selectedLessonIds : [],
      node_ids: [],
    }));
  };

  const generate = async () => {
    const grants = buildGrants();
    if (grants.length === 0) {
      setError('至少选择一门已发布课程');
      return;
    }
    if (scopeMode === 'lessons' && selectedLessonIds.length === 0) {
      setError('请选择至少一个课节');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const options = {
        grants,
        redeem_from: redeemFrom || null,
        redeem_until: redeemUntil || null,
        recipient_label: recipientLabel.trim() || null,
        recipient_note: recipientNote.trim() || null,
      };
      const advanced =
        selectedCourseIds.length !== 1 ||
        selectedCourseIds[0] !== courseId ||
        scopeMode !== 'course' ||
        Boolean(redeemFrom || redeemUntil || recipientLabel.trim() || recipientNote.trim());
      const created = advanced
        ? await api.createAccessCodeBatch(courseId, count, options)
        : await api.createAccessCodeBatch(courseId, count);
      setCodes((current) => [...created, ...(current ?? [])]);
      setCount(1);
      setSelectedIds([]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const replaceCode = (updated: ManagedAccessCode) => {
    setCodes((current) =>
      current?.map((item) => (item.id === updated.id ? updated : item)) ?? []
    );
    setDetail((current) => (current?.id === updated.id ? updated : current));
  };

  const openDetail = async (code: ManagedAccessCode) => {
    setDetailId(code.id);
    setDetail(code);
    if (!api.getAccessCode) return;
    try {
      setDetail(await api.getAccessCode(code.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const updateRecipient = async () => {
    if (!selectedCode || !api.updateAccessCodeRecipient) return;
    setBusy(true);
    setError(null);
    try {
      replaceCode(
        await api.updateAccessCodeRecipient(
          selectedCode.id,
          detailRecipientLabel.trim() || null,
          detailRecipientNote.trim() || null
        )
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const singleAction = async (code: ManagedAccessCode, action: AccessCodeBatchAction) => {
    if (
      action === 'terminate' &&
      !window.confirm('作废后将不能恢复，但历史记录会保留。继续吗？')
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated =
        action === 'terminate'
          ? await api.terminateAccessCode(code.id)
          : action === 'freeze'
            ? await api.freezeAccessCode(code.id)
            : await api.restoreAccessCode(code.id);
      replaceCode(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const batchAction = async (action: AccessCodeBatchAction) => {
    if (selectedIds.length === 0) return;
    if (
      action === 'terminate' &&
      !window.confirm(`确定作废选中的 ${selectedIds.length} 条授权码吗？`)
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.batchAccessCodeAction(selectedIds, action);
      updated.forEach(replaceCode);
      setSelectedIds([]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      if (next.length !== 1 || next[0] !== courseId) {
        setScopeMode('course');
        setSelectedLessonIds([]);
      }
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !filteredCodes.some((code) => code.id === id))
        : [...new Set([...current, ...filteredCodes.map((code) => code.id)])]
    );
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
        </div>

        <section className="access-code-create-panel" aria-labelledby="access-code-create-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">新建</p>
              <h2 id="access-code-create-title">生成授权码</h2>
            </div>
            <span className="muted-note">当前规则：保证授权码唯一</span>
          </div>
          <div className="access-code-form-grid">
            <fieldset>
              <legend>授权范围</legend>
              <div className="access-code-course-list">
                {ownPublishedCourses.map((item) => (
                  <label key={item.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedCourseIds.includes(item.id)}
                      disabled={busy}
                      onChange={() => toggleCourse(item.id)}
                    />
                    <span>{item.title}</span>
                    {item.id === courseId && <small>当前课程</small>}
                  </label>
                ))}
              </div>
              <select
                aria-label="课节范围"
                value={scopeMode}
                disabled={busy || !canUseLessonScope}
                onChange={(event) => {
                  const next = event.target.value as 'course' | 'lessons';
                  setScopeMode(next);
                  if (next === 'course') setSelectedLessonIds([]);
                }}
              >
                <option value="course">整门课程</option>
                <option value="lessons">指定课节</option>
              </select>
              {scopeMode === 'lessons' && canUseLessonScope && (
                <div className="access-code-lesson-list">
                  {course?.lessons.map((lesson) => (
                    <label key={lesson.id} className="check-row">
                      <input
                        type="checkbox"
                        checked={selectedLessonIds.includes(lesson.id)}
                        disabled={busy}
                        onChange={() =>
                          setSelectedLessonIds((current) =>
                            current.includes(lesson.id)
                              ? current.filter((id) => id !== lesson.id)
                              : [...current, lesson.id]
                          )
                        }
                      />
                      <span>{lesson.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="access-code-form-fields">
              <label>
                <span>新建数量</span>
                <input
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
              </label>
              <label>
                <span>领取开始</span>
                <input
                  type="datetime-local"
                  value={redeemFrom}
                  disabled={busy}
                  onChange={(event) => setRedeemFrom(event.target.value)}
                />
              </label>
              <label>
                <span>领取截止</span>
                <input
                  type="datetime-local"
                  value={redeemUntil}
                  disabled={busy}
                  onChange={(event) => setRedeemUntil(event.target.value)}
                />
              </label>
              <label>
                <span>接收人记录</span>
                <input
                  value={recipientLabel}
                  maxLength={200}
                  placeholder="可留空"
                  disabled={busy}
                  onChange={(event) => setRecipientLabel(event.target.value)}
                />
              </label>
              <label>
                <span>教师备注</span>
                <textarea
                  value={recipientNote}
                  maxLength={1000}
                  rows={2}
                  placeholder="可留空"
                  disabled={busy}
                  onChange={(event) => setRecipientNote(event.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="access-code-create-footer">
            <span className="muted-note">
              {selectedCourseIds.length} 门课程
              {scopeMode === 'lessons'
                ? ` · ${selectedLessonIds.length} 个课节`
                : ' · 全部课节'}
              {` · ${count} 个授权码`}
            </span>
            <button className="dark-button" type="button" onClick={generate} disabled={busy}>
              {busy ? '处理中…' : count === 1 ? '生成授权码' : '批量生成授权码'}
            </button>
          </div>
        </section>

        {error && <p className="field-error">{error}</p>}
        {codes === null && !error && <p className="table-state">正在读取授权码…</p>}
        {codes && codes.length === 0 && (
          <div className="access-code-empty">
            <strong>还没有授权码</strong>
            <p>生成后可在这里查看完整授权码和领取使用情况。</p>
          </div>
        )}

        <div className="access-code-toolbar">
          <div className="access-code-filters">
            <input
              aria-label="搜索授权码"
              value={query}
              placeholder="搜索授权码、接收人或备注"
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="状态筛选"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="active">有效</option>
              <option value="frozen">冻结</option>
              <option value="terminated">作废</option>
            </select>
            <select
              aria-label="领取筛选"
              value={redemptionFilter}
              onChange={(event) => setRedemptionFilter(event.target.value)}
            >
              <option value="all">全部领取情况</option>
              <option value="unused">未领取</option>
              <option value="redeemed">已领取</option>
            </select>
          </div>
          {selectedIds.length > 0 && (
            <div className="access-code-bulk-actions">
              <strong>已选 {selectedIds.length} 条</strong>
              <button type="button" disabled={busy} onClick={() => void batchAction('freeze')}>
                冻结
              </button>
              <button type="button" disabled={busy} onClick={() => void batchAction('restore')}>
                恢复
              </button>
              <button type="button" disabled={busy} onClick={() => void batchAction('terminate')}>
                作废
              </button>
              <button type="button" disabled={busy} onClick={() => setSelectedIds([])}>
                清除选择
              </button>
            </div>
          )}
        </div>

        {codes && codes.length > 0 && filteredCodes.length === 0 && (
          <p className="table-state">没有符合筛选条件的授权码。</p>
        )}

        {filteredCodes.length > 0 && (
          <div className="access-code-table-wrap">
            <table className="access-code-table">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="选择当前列表"
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                    />
                  </th>
                  <th>完整授权码</th>
                  <th>接收人记录</th>
                  <th>范围</th>
                  <th>状态</th>
                  <th>领取情况</th>
                  <th>最近领取</th>
                  <th>
                    <span className="visually-hidden">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map((code) => (
                  <tr key={code.id} onClick={() => void openDetail(code)}>
                    <td data-label="选择">
                      <input
                        aria-label={`选择 ${code.access_code}`}
                        type="checkbox"
                        checked={selectedIds.includes(code.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelected(code.id)}
                      />
                    </td>
                    <td data-label="完整授权码">
                      <button
                        className="access-code-detail-trigger"
                        type="button"
                        onClick={() => void openDetail(code)}
                      >
                        <code className="access-code-value">{code.access_code}</code>
                      </button>
                    </td>
                    <td data-label="接收人记录">
                      <strong>{code.recipient_label || '未记录'}</strong>
                      {code.recipient_note && <small>{code.recipient_note}</small>}
                    </td>
                    <td data-label="范围">{formatGrantSummary(code)}</td>
                    <td data-label="状态">
                      <span className={`access-code-status is-${code.status}`}>
                        {formatStatus(code.status)}
                      </span>
                    </td>
                    <td data-label="领取情况">已领取 {code.redemption_count} 台设备</td>
                    <td data-label="最近领取">{formatDateTime(code.last_redeemed_at)}</td>
                    <td data-label="操作">
                      <div className="access-code-row-actions">
                        {code.status === 'active' && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                void singleAction(code, 'terminate');
                              }}
                            >
                              作废
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                void singleAction(code, 'freeze');
                              }}
                            >
                              冻结
                            </button>
                          </>
                        )}
                        {code.status === 'frozen' && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                void singleAction(code, 'restore');
                              }}
                            >
                              恢复
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                void singleAction(code, 'terminate');
                              }}
                            >
                              作废
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedCode && (
          <aside className="access-code-detail-panel" aria-label="授权码详情">
            <div className="section-heading">
              <div>
                <p className="eyebrow">记录详情</p>
                <h2>{selectedCode.access_code}</h2>
              </div>
              <button className="text-button" type="button" onClick={() => setDetailId(null)}>
                关闭
              </button>
            </div>
            <div className="access-code-detail-grid">
              <div>
                <span>状态</span>
                <strong className={`access-code-status is-${selectedCode.status}`}>
                  {formatStatus(selectedCode.status)}
                </strong>
              </div>
              <div>
                <span>领取情况</span>
                <strong>{selectedCode.redemption_count} 台设备</strong>
              </div>
              <div>
                <span>范围</span>
                <strong>{formatGrantSummary(selectedCode)}</strong>
              </div>
              <div>
                <span>创建时间</span>
                <strong>{formatDateTime(selectedCode.created_at)}</strong>
              </div>
            </div>
            <div className="access-code-recipient-editor">
              <label>
                <span>接收人记录</span>
                <input
                  value={detailRecipientLabel}
                  maxLength={200}
                  onChange={(event) => setDetailRecipientLabel(event.target.value)}
                />
              </label>
              <label>
                <span>教师备注</span>
                <textarea
                  value={detailRecipientNote}
                  maxLength={1000}
                  rows={3}
                  onChange={(event) => setDetailRecipientNote(event.target.value)}
                />
              </label>
              <button
                className="dark-button"
                type="button"
                disabled={busy}
                onClick={() => void updateRecipient()}
              >
                保存记录
              </button>
            </div>
            {selectedCode.status_events && selectedCode.status_events.length > 0 && (
              <div className="access-code-events">
                <h3>状态记录</h3>
                {selectedCode.status_events.map((event, index) => (
                  <div key={`${event.action}-${index}`}>
                    <span>{formatEvent(event.action)}</span>
                    <time>{formatDateTime(event.occurred_at)}</time>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </main>
    </div>
  );
};

function formatStatus(status: string): string {
  if (status === 'active') return '有效';
  if (status === 'frozen') return '冻结';
  if (status === 'terminated') return '作废';
  return status;
}

function formatEvent(action: string): string {
  const labels: Record<string, string> = {
    access_code_created: '创建授权码',
    access_code_recipient_updated: '更新接收人记录',
    access_code_frozen: '冻结授权码',
    access_code_restored: '恢复授权码',
    access_code_terminated: '作废授权码',
  };
  return labels[action] ?? action;
}

function formatGrantSummary(code: ManagedAccessCode): string {
  if (code.grants.length === 0) return '—';
  const lessonCount = code.grants.reduce(
    (total, grant) => total + grant.lesson_ids.length,
    0
  );
  if (code.grants.some((grant) => grant.scope === 'course')) {
    return code.grants.length > 1 ? `${code.grants.length} 门课程` : '整门课程';
  }
  return `${code.grants.length} 门课程 · ${lessonCount} 个课节`;
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
