import React, { useState } from 'react';
import { LoadingSpinner, ErrorHandler } from '@v1/web/shared';
import { useTeacherStore } from '../store';
import { TeacherPublishAPI } from '../api-publish';

interface PublishWorkflowProps {
  api: TeacherPublishAPI;
  courseId: string;
  onClose: () => void;
}

type Step = 'confirm' | 'publishing' | 'published' | 'code';

export const PublishWorkflow: React.FC<PublishWorkflowProps> = ({
  api,
  courseId,
  onClose,
}) => {
  const { session, courses } = useTeacherStore();
  const [step, setStep] = useState<Step>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [releaseNumber, setReleaseNumber] = useState<number | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const course = courses.find((c) => c.id === courseId);
  if (!session || !course) return null;

  const handlePublish = async () => {
    setStep('publishing');
    setError(null);
    try {
      const res = await api.publishCourse(session.token, courseId);
      setReleaseNumber(res.release_number);
      setStep('published');
    } catch (err) {
      setError(ErrorHandler.getDisplayMessage(err));
      setStep('confirm');
    }
  };

  const handleCreateCode = async () => {
    setError(null);
    try {
      const res = await api.createAccessCode(session.token, courseId, {
        scope: 'course',
      });
      setAccessCode(res.code);
      setStep('code');
    } catch (err) {
      setError(ErrorHandler.getDisplayMessage(err));
    }
  };

  const handleCopy = async () => {
    if (!accessCode) return;
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopied(true);
    } catch {
      setError('浏览器拒绝了剪贴板访问，请手动选中复制');
    }
  };

  /** 关闭时清空授权码：它不可再次获取 */
  const handleClose = () => {
    setAccessCode(null);
    setCopied(false);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-title"
    >
      <div className="modal-panel">
        {step === 'confirm' && (
          <>
            <p className="eyebrow">发布课程</p>
            <h2 id="publish-title">{course.title}</h2>
            <p className="modal-note">
              发布会把当前 {course.lessons.length} 个课节和全部互动节点一起
              保存为一个不可修改的版本。学生领取授权码后下载的就是这个版本，
              之后继续编辑不影响已发布内容。
            </p>
            {error && <p className="field-error">{error}</p>}
            <div className="modal-actions">
              <button className="light-button" type="button" onClick={handleClose}>
                取消
              </button>
              <button className="dark-button" type="button" onClick={handlePublish}>
                确认发布
              </button>
            </div>
          </>
        )}

        {step === 'publishing' && <LoadingSpinner message="正在发布课程" />}

        {step === 'published' && (
          <>
            <p className="eyebrow">发布成功</p>
            <h2 id="publish-title">版本 {releaseNumber}</h2>
            <p className="modal-note">
              课程已发布。接下来创建授权码，学生用它在插件里下载这门课程。
            </p>
            {error && <p className="field-error">{error}</p>}
            <div className="modal-actions">
              <button className="light-button" type="button" onClick={handleClose}>
                稍后再说
              </button>
              <button className="dark-button" type="button" onClick={handleCreateCode}>
                创建授权码
              </button>
            </div>
          </>
        )}

        {step === 'code' && accessCode && (
          <>
            <p className="eyebrow">授权码已创建</p>
            <h2 id="publish-title">发给学生的授权码</h2>
            <p className="credential-warning">
              这个授权码只显示这一次，关闭后无法再次查看。请先复制并交给学生。
            </p>
            <div className="credential-row">
              <input
                type="text"
                value={accessCode}
                readOnly
                aria-label="授权码"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button className="dark-button" type="button" onClick={handleCopy}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            {error && <p className="field-error">{error}</p>}
            <div className="modal-actions">
              <button className="light-button" type="button" onClick={handleClose}>
                我已保存，关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
