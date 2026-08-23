import React, { useEffect, useState } from 'react';
import { LoadingSpinner, ErrorBanner, SuccessToast } from '@v1/web/shared';
import { useTeacherStore } from '../store';
import { TeacherPublishAPI } from '../api-publish';

interface PublishWorkflowProps {
  api: TeacherPublishAPI;
  courseId: string;
  onClose: () => void;
}

interface WorkflowStep {
  step: 'preview' | 'publishing' | 'success' | 'accesscode' | 'done';
}

export const PublishWorkflow: React.FC<PublishWorkflowProps> = ({
  api,
  courseId,
  onClose,
}) => {
  const { session, courses } = useTeacherStore();
  const [state, setState] = useState<WorkflowStep>({ step: 'preview' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [releaseNumber, setReleaseNumber] = useState<number | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const course = courses.find((c) => c.id === courseId);

  if (!session || !course) {
    return <div>数据错误</div>;
  }

  const handlePublish = async () => {
    setState({ step: 'publishing' });
    setLoading(true);
    setError(null);

    try {
      const response = await api.publishCourse(session.token, courseId);
      setReleaseNumber(response.release_number);
      setState({ step: 'success' });
      setSuccess(true);

      // 成功后自动转到授权码生成
      setTimeout(() => {
        setState({ step: 'accesscode' });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('发布失败'));
      setState({ step: 'preview' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccessCode = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.createAccessCode(session.token, courseId, {
        scope: 'course',
      });
      setAccessCode(response.code);
      setState({ step: 'done' });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('生成授权码失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (accessCode) {
      navigator.clipboard.writeText(accessCode);
      setSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
        {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

        {state.step === 'preview' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">发布课程</h2>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">
                <strong>课程:</strong> {course.title}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>课节数:</strong> {course.lessons.length}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                本次发布将创建原子快照，所有课节和节点一起发布。
              </p>
            </div>
            <button
              onClick={handlePublish}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? <LoadingSpinner size="sm" /> : '确认发布'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        )}

        {state.step === 'publishing' && (
          <div className="text-center space-y-4">
            <LoadingSpinner message="正在发布..." />
          </div>
        )}

        {state.step === 'success' && (
          <div className="text-center space-y-4">
            <p className="text-2xl">✓</p>
            <p className="font-bold">发布成功</p>
            <p className="text-sm text-gray-600">
              版本号: {releaseNumber}
            </p>
            {success && <SuccessToast message="发布成功！" onClose={() => {}} />}
          </div>
        )}

        {state.step === 'accesscode' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">生成授权码</h2>
            <p className="text-sm text-gray-600">
              学生需要授权码才能下载这个课程版本
            </p>

            {!accessCode && (
              <button
                onClick={handleCreateAccessCode}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? <LoadingSpinner size="sm" /> : '生成授权码'}
              </button>
            )}

            {accessCode && (
              <div className="bg-gray-50 p-4 rounded space-y-2">
                <p className="text-xs text-gray-600">授权码（一次性，关闭后清空）</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={accessCode}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded bg-white font-mono text-sm"
                  />
                  <button
                    onClick={handleCopyCode}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    复制
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
