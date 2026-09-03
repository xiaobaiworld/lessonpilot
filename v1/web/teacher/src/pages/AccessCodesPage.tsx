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

type CourseScope = 'course' | 'lessons';

interface CourseScopeSelection {
  scope: CourseScope;
  lessonIds: string[];
}

export const STUDENT_GUIDE_URL = 'https://knownmap.com/student/guide.html';

export function buildAccessCodeShareText(
  accessCode: ManagedAccessCode,
  courseTitles: string[],
): string {
  const courseLabel = courseTitles.length > 0 ? courseTitles.join('、') : '相关课程';
  return `KnownMap 课程授权：${courseLabel}。授权码：${accessCode.access_code}。学生插件使用指南：${STUDENT_GUIDE_URL}。请先安装学生插件，再按指南中的步骤粘贴授权码领取课程。`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy copy path for browsers that reject clipboard access.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
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
  const [courseScopes, setCourseScopes] = useState<Record<string, CourseScopeSelection>>({
    [courseId]: { scope: 'course', lessonIds: [] },
  });
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [coursePickerQuery, setCoursePickerQuery] = useState('');
  const [coursePickerSelection, setCoursePickerSelection] = useState<string[]>([]);
  const [scopeCourseId, setScopeCourseId] = useState<string | null>(null);
  const [scopeCourse, setScopeCourse] = useState<CourseDetail | null>(null);
  const [scopeMode, setScopeMode] = useState<CourseScope>('course');
  const [scopeLessonIds, setScopeLessonIds] = useState<string[]>([]);
  const [scopeLessonQuery, setScopeLessonQuery] = useState('');
  const [scopeBusy, setScopeBusy] = useState(false);
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
  const [shareCode, setShareCode] = useState<ManagedAccessCode | null>(null);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
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
    setCourseScopes({ [courseId]: { scope: 'course', lessonIds: [] } });
    setScopeCourseId(null);
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

  const availableCourses = ownPublishedCourses.filter((item) => !selectedCourseIds.includes(item.id));
  const filteredAvailableCourses = availableCourses.filter((item) => {
    const normalized = coursePickerQuery.trim().toLowerCase();
    return !normalized || item.title.toLowerCase().includes(normalized);
  });

  const courseTitle = (id: string): string => {
    if (id === course?.id) return course.title;
    return courses.find((item) => item.id === id)?.title ?? '相关课程';
  };

  const shareText = shareCode
    ? buildAccessCodeShareText(
        shareCode,
        shareCode.grants.map((grant) => courseTitle(grant.course_id)),
      )
    : '';

  useEffect(() => {
    if (selectedCode) {
      setDetailRecipientLabel(selectedCode.recipient_label ?? '');
      setDetailRecipientNote(selectedCode.recipient_note ?? '');
    }
  }, [selectedCode]);

  const buildGrants = (): AccessCodeGrantInput[] => {
    return selectedCourseIds.map((id) => {
      const selection = courseScopes[id] ?? { scope: 'course', lessonIds: [] };
      return {
        course_id: id,
        scope: selection.scope,
        lesson_ids: selection.scope === 'lessons' ? selection.lessonIds : [],
        node_ids: [],
      };
    });
  };

  const generate = async () => {
    const grants = buildGrants();
    if (grants.length === 0) {
      setError('至少选择一门已发布课程');
      return;
    }
    if (grants.some((grant) => grant.scope === 'lessons' && grant.lesson_ids?.length === 0)) {
      setError('指定课节的课程至少要选择一个课节');
      return;
    }
    const redeemFromUtc = beijingLocalToUtc(redeemFrom);
    const redeemUntilUtc = beijingLocalToUtc(redeemUntil);
    if ((redeemFrom && !redeemFromUtc) || (redeemUntil && !redeemUntilUtc)) {
      setError('领取时间格式无效，请重新选择北京时间。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const options = {
        grants,
        redeem_from: redeemFromUtc,
        redeem_until: redeemUntilUtc,
        recipient_label: recipientLabel.trim() || null,
        recipient_note: recipientNote.trim() || null,
      };
      const advanced =
        selectedCourseIds.length !== 1 ||
        selectedCourseIds[0] !== courseId ||
        grants.some((grant) => grant.scope !== 'course') ||
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
      if (current.includes(id)) {
        setCourseScopes((scopes) => {
          const next = { ...scopes };
          delete next[id];
          return next;
        });
        return current.filter((item) => item !== id);
      }
      setCourseScopes((scopes) => ({
        ...scopes,
        [id]: { scope: 'course', lessonIds: [] },
      }));
      return [...current, id];
    });
  };

  const openCoursePicker = () => {
    setCoursePickerQuery('');
    setCoursePickerSelection([]);
    setCoursePickerOpen(true);
  };

  const confirmCoursePicker = () => {
    if (coursePickerSelection.length === 0) return;
    setSelectedCourseIds((current) => [...current, ...coursePickerSelection]);
    setCourseScopes((current) => {
      const next = { ...current };
      coursePickerSelection.forEach((id) => {
        next[id] = { scope: 'course', lessonIds: [] };
      });
      return next;
    });
    setCoursePickerOpen(false);
  };

  const openScopeEditor = async (id: string) => {
    const existing = courseScopes[id] ?? { scope: 'course', lessonIds: [] };
    setScopeCourseId(id);
    setScopeCourse(null);
    setScopeMode(existing.scope);
    setScopeLessonIds(existing.lessonIds);
    setScopeLessonQuery('');
    setScopeBusy(true);
    setError(null);
    try {
      setScopeCourse(id === courseId && course ? course : await api.getCourse(id));
    } catch (err) {
      setError(errorMessage(err));
      setScopeCourseId(null);
    } finally {
      setScopeBusy(false);
    }
  };

  const closeScopeEditor = () => {
    if (scopeBusy) return;
    setScopeCourseId(null);
    setScopeCourse(null);
  };

  const saveScopeEditor = () => {
    if (!scopeCourseId) return;
    if (scopeMode === 'lessons' && scopeLessonIds.length === 0) {
      setError('请选择至少一个课节');
      return;
    }
    setCourseScopes((current) => ({
      ...current,
      [scopeCourseId]: {
        scope: scopeMode,
        lessonIds: scopeMode === 'lessons' ? scopeLessonIds : [],
      },
    }));
    closeScopeEditor();
  };

  const openShare = (code: ManagedAccessCode) => {
    setShareCode(code);
    setShareCopyStatus('idle');
    void copyShareText(code);
  };

  const copyShareText = async (code: ManagedAccessCode) => {
    const copied = await copyTextToClipboard(
      buildAccessCodeShareText(
        code,
        code.grants.map((grant) => courseTitle(grant.course_id)),
      ),
    );
    setShareCopyStatus(copied ? 'copied' : 'error');
  };

  const copyAccessCode = async (code: ManagedAccessCode) => {
    const copied = await copyTextToClipboard(code.access_code);
    if (copied) {
      setCopiedCodeId(code.id);
      window.setTimeout(() => {
        setCopiedCodeId((current) => (current === code.id ? null : current));
      }, 1800);
    }
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
            <small className="muted-note">页面时间均显示为北京时间（UTC+8）</small>
          </div>
        </div>

        <section className="access-code-create-panel" aria-labelledby="access-code-create-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">新建</p>
              <h2 id="access-code-create-title">生成授权码</h2>
            </div>
            <div className="access-code-rule-notes">
              <span className="access-code-rule-note">当前规则：保证授权码唯一</span>
              <span className="access-code-rule-note is-future">后续版本：支持为一个班级的多个学生统一开通授权码</span>
            </div>
          </div>
          <div className="access-code-form-grid">
            <fieldset>
              <legend>授权范围</legend>
              <div className="access-code-scope-heading">
                <span className="muted-note">默认授权整门课程；需要精细范围时再单独指定。</span>
                <button
                  className="light-button access-code-add-course"
                  type="button"
                  disabled={busy || availableCourses.length === 0}
                  onClick={openCoursePicker}
                >
                  添加授权课程
                </button>
              </div>
              <div className="access-code-selected-courses">
                {selectedCourseIds.length === 0 && (
                  <div className="access-code-empty-selection">还没有选择课程，请先添加课程。</div>
                )}
                {selectedCourseIds.map((id) => {
                  const item = ownPublishedCourses.find((candidate) => candidate.id === id);
                  if (!item) return null;
                  const selection = courseScopes[id] ?? { scope: 'course', lessonIds: [] };
                  const version = item.version_number ?? item.metrics.release_number;
                  const scopeLabel =
                    selection.scope === 'course'
                      ? '整门课程'
                      : `指定课节 · ${selection.lessonIds.length} 个课节`;
                  return (
                    <article key={id} className="access-code-course-card">
                      <div>
                        <div className="access-code-course-title">
                          <strong>{item.title}</strong>
                          {id === courseId && <span>当前课程</span>}
                        </div>
                        <small>
                          第 {version ?? '—'} 版 · {item.metrics.lesson_count} 个课节
                        </small>
                      </div>
                      <div className="access-code-course-actions">
                        <span className="access-code-scope-badge">{scopeLabel}</span>
                        <button
                          className="text-button"
                          type="button"
                          disabled={busy}
                          onClick={() => void openScopeEditor(id)}
                        >
                          {selection.scope === 'course' ? '指定范围' : '修改范围'}
                        </button>
                        <button
                          className="text-button access-code-remove-course"
                          type="button"
                          disabled={busy || selectedCourseIds.length === 1}
                          onClick={() => toggleCourse(id)}
                        >
                          移除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="access-code-scope-note">
                页面只展示已选择的课程；点击“指定范围”后，才会打开该课程自己的课节列表。
              </p>
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
              {` · ${Object.values(courseScopes).filter((item) => item.scope === 'course').length} 整门课程`}
              {` · ${Object.values(courseScopes).reduce((total, item) => total + item.lessonIds.length, 0)} 个课节`}
              {` · ${count} 个授权码`}
            </span>
            <button className="dark-button" type="button" onClick={generate} disabled={busy}>
              {busy ? '处理中…' : count === 1 ? '生成授权码' : '批量生成授权码'}
            </button>
          </div>
          <p className="access-code-share-note">
            授权码生成成功后，可在每条记录的“操作”中复制“授权码 + 学生插件使用指南”，直接发送给学生。
          </p>
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
                      <div className="access-code-code-cell">
                        <button
                          className="access-code-detail-trigger"
                          type="button"
                          onClick={() => void openDetail(code)}
                        >
                          <code className="access-code-value">{code.access_code}</code>
                        </button>
                        <button
                          className="access-code-copy-button"
                          type="button"
                          aria-label={`复制授权码 ${code.access_code}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyAccessCode(code);
                          }}
                        >
                          {copiedCodeId === code.id ? '已复制' : '复制'}
                        </button>
                      </div>
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
                        <div className="access-code-share-action-wrap">
                          <button
                            className="access-code-copy-button access-code-share-action"
                            type="button"
                            disabled={busy}
                            aria-label={`复制 ${code.access_code} 的授权码和学生插件使用指南`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openShare(code);
                            }}
                          >
                            授权码 + 指南
                          </button>
                          <small className="access-code-share-action-note">复制课程名称、授权码和学生指南网址</small>
                        </div>
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
            <div className="access-code-detail-share">
              <button
                className="light-button"
                type="button"
                onClick={() => openShare(selectedCode)}
              >
                复制授权码 + 学生插件使用指南
              </button>
              <small>整理课程名称、完整授权码和学生指南网址，并复制到剪贴板。</small>
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

        {coursePickerOpen && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="course-picker-title">
            <div className="access-code-course-picker">
              <div className="access-code-dialog-head">
                <div>
                  <span className="eyebrow">添加到授权内容</span>
                  <h2 id="course-picker-title">选择课程</h2>
                </div>
                <button className="text-button" type="button" onClick={() => setCoursePickerOpen(false)}>
                  关闭
                </button>
              </div>
              <input
                aria-label="搜索课程"
                value={coursePickerQuery}
                placeholder="搜索课程名称"
                onChange={(event) => setCoursePickerQuery(event.target.value)}
              />
              <div className="access-code-picker-list">
                {filteredAvailableCourses.length === 0 && <p className="table-state">没有可添加的课程。</p>}
                {filteredAvailableCourses.map((item) => (
                  <label key={item.id} className="access-code-picker-option">
                    <input
                      type="checkbox"
                      checked={coursePickerSelection.includes(item.id)}
                      onChange={() =>
                        setCoursePickerSelection((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id]
                        )
                      }
                    />
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        第 {item.version_number ?? item.metrics.release_number ?? '—'} 版 ·{' '}
                        {item.metrics.lesson_count} 个课节
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="modal-actions">
                <button className="light-button" type="button" onClick={() => setCoursePickerOpen(false)}>
                  取消
                </button>
                <button
                  className="dark-button"
                  type="button"
                  disabled={coursePickerSelection.length === 0}
                  onClick={confirmCoursePicker}
                >
                  添加所选课程
                </button>
              </div>
            </div>
          </div>
        )}

        {scopeCourseId && scopeCourse && (
          <div className="modal-backdrop access-code-scope-backdrop" role="dialog" aria-modal="true" aria-labelledby="scope-editor-title">
            <aside className="access-code-scope-editor">
              <div className="access-code-dialog-head">
                <div>
                  <span className="eyebrow">授权范围</span>
                  <h2 id="scope-editor-title">{scopeCourse.title}</h2>
                  <small className="muted-note">
                    第 {scopeCourse.version_number ?? '—'} 版 · {scopeCourse.lessons.length} 个课节
                  </small>
                </div>
                <button className="text-button" type="button" disabled={scopeBusy} onClick={closeScopeEditor}>
                  关闭
                </button>
              </div>
              <div className="access-code-scope-options">
                <label className={scopeMode === 'course' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="access-code-scope"
                    value="course"
                    checked={scopeMode === 'course'}
                    onChange={() => setScopeMode('course')}
                  />
                  <span><strong>整门课程</strong><small>包含这门课程当前可交付的全部课节</small></span>
                </label>
                <label className={scopeMode === 'lessons' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="access-code-scope"
                    value="lessons"
                    checked={scopeMode === 'lessons'}
                    onChange={() => setScopeMode('lessons')}
                  />
                  <span><strong>指定课节</strong><small>只授予下方勾选的课节</small></span>
                </label>
              </div>
              {scopeMode === 'lessons' && (
                <>
                  <div className="access-code-lesson-tools">
                    <input
                      aria-label="搜索课节"
                      value={scopeLessonQuery}
                      placeholder="搜索课节"
                      onChange={(event) => setScopeLessonQuery(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setScopeLessonIds((current) => [
                          ...new Set([
                            ...current,
                            ...scopeCourse.lessons
                              .filter((lesson) =>
                                lesson.title.toLowerCase().includes(scopeLessonQuery.trim().toLowerCase()),
                              )
                              .map((lesson) => lesson.id),
                          ]),
                        ])
                      }
                    >
                      全选当前结果
                    </button>
                  </div>
                  <div className="access-code-scope-lessons">
                    {scopeCourse.lessons
                      .filter((lesson) =>
                        lesson.title.toLowerCase().includes(scopeLessonQuery.trim().toLowerCase()),
                      )
                      .map((lesson) => (
                        <label key={lesson.id} className="check-row">
                          <input
                            type="checkbox"
                            checked={scopeLessonIds.includes(lesson.id)}
                            onChange={() =>
                              setScopeLessonIds((current) =>
                                current.includes(lesson.id)
                                  ? current.filter((id) => id !== lesson.id)
                                  : [...current, lesson.id],
                              )
                            }
                          />
                          <span>{lesson.title}</span>
                          <small>第 {lesson.sort_order + 1} 节</small>
                        </label>
                      ))}
                  </div>
                </>
              )}
              <div className="access-code-scope-footer">
                <span className="muted-note">
                  {scopeMode === 'course' ? `整门课程 · ${scopeCourse.lessons.length} 个课节` : `已选 ${scopeLessonIds.length} / ${scopeCourse.lessons.length} 个课节`}
                </span>
                <div className="modal-actions">
                  <button className="light-button" type="button" disabled={scopeBusy} onClick={closeScopeEditor}>取消</button>
                  <button className="dark-button" type="button" disabled={scopeBusy} onClick={saveScopeEditor}>保存范围</button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {shareCode && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-code-title">
            <div className="access-code-share-panel">
              <div className="access-code-dialog-head">
                <div>
                  <span className="eyebrow">发送给学生</span>
                  <h2 id="share-code-title">授权码 + 学生插件使用指南</h2>
                </div>
                <button className="text-button" type="button" onClick={() => setShareCode(null)}>关闭</button>
              </div>
              <p className="access-code-share-intro">这是一段可以直接粘贴到微信、邮件或群聊里的文字，打开时会自动复制。</p>
              <textarea
                className="access-code-share-text"
                value={shareText}
                readOnly
                aria-label="可复制的学生文案"
                onFocus={(event) => event.currentTarget.select()}
              />
              <p className={`access-code-copy-status is-${shareCopyStatus}`}>
                {shareCopyStatus === 'copied' ? '已复制到剪贴板，可直接发送' : shareCopyStatus === 'error' ? '未能自动复制，请选中文案后手动复制' : '正在复制…'}
              </p>
              <p className="access-code-share-footnote">内容包括课程名称、完整授权码和学生插件使用指南网址。</p>
              <div className="modal-actions">
                <button className="light-button" type="button" onClick={() => setShareCode(null)}>关闭</button>
                <button className="dark-button" type="button" onClick={() => void copyShareText(shareCode)}>
                  重新复制
                </button>
              </div>
            </div>
          </div>
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

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

export function beijingLocalToUtc(value: string): string | null {
  if (!value) return null;
  const local = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${local}+08:00`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
