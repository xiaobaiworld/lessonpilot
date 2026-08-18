(function initKnownMapApi(global, factory) {
  const api = factory();
  global.KnownMapApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function createKnownMapApi() {
  const localHost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'localhost'
    : '127.0.0.1';
  const baseUrl = `http://${localHost}:8000/api/v1`;

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error?.message || `请求失败（HTTP ${response.status}）`);
      error.code = data?.error?.code || 'HTTP_ERROR';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  const json = (method, body) => ({ method, body: JSON.stringify(body) });

  return {
    baseUrl,
    health: () => request('/health'),
    login: (loginName, password) => request('/auth/login', json('POST', {
      login_name: loginName,
      password
    })),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    listCourses: () => request('/teacher/courses'),
    createCourse: (payload) => request('/teacher/courses', json('POST', payload)),
    getCourse: (courseId) => request(`/teacher/courses/${courseId}`),
    createLesson: (courseId, payload) => request(
      `/teacher/courses/${courseId}/lessons`,
      json('POST', payload)
    ),
    getDraft: (lessonId) => request(`/teacher/lessons/${lessonId}/draft`),
    saveDraft: (lessonId, payload) => request(
      `/teacher/lessons/${lessonId}/draft`,
      json('PUT', payload)
    ),
    publishCourse: (courseId) => request(
      `/teacher/courses/${courseId}/publish`,
      { method: 'POST' }
    ),
    createAccessCode: (courseId) => request(
      `/teacher/courses/${courseId}/access-codes`,
      { method: 'POST' }
    )
  };
});
