(function initKnownMapAdmin(global, factory) {
  const admin = factory(global);
  global.KnownMapAdmin = admin;
  if (typeof module !== 'undefined' && module.exports) module.exports = admin;
})(typeof window !== 'undefined' ? window : globalThis, function createKnownMapAdmin(global) {
  const location = global.location || { hostname: '127.0.0.1', origin: '' };
  const isLocalDevelopment =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const baseUrl = isLocalDevelopment
    ? `http://${location.hostname}:8000/api/v1`
    : `${location.origin}/api/v1`;

  async function request(path, options = {}) {
    const response = await global.fetch(`${baseUrl}${path}`, {
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

  function createInteractionCoordinator() {
    let sessionGeneration = 0;
    let teacherRequestGeneration = 0;
    let sensitiveOperationInFlight = false;
    let temporaryPasswordPresent = false;

    return {
      currentSessionGeneration: () => sessionGeneration,
      advanceSession: () => {
        sessionGeneration += 1;
        teacherRequestGeneration += 1;
        return sessionGeneration;
      },
      isSessionCurrent: (generation) => generation === sessionGeneration,
      beginTeacherRequest: () => {
        teacherRequestGeneration += 1;
        return {
          sessionGeneration,
          teacherRequestGeneration
        };
      },
      invalidateTeacherRequests: () => {
        teacherRequestGeneration += 1;
      },
      isTeacherRequestCurrent: (requestGeneration) => (
        requestGeneration.sessionGeneration === sessionGeneration &&
        requestGeneration.teacherRequestGeneration === teacherRequestGeneration
      ),
      beginSensitiveOperation: () => {
        if (sensitiveOperationInFlight || temporaryPasswordPresent) return false;
        sensitiveOperationInFlight = true;
        teacherRequestGeneration += 1;
        return true;
      },
      finishSensitiveOperation: () => {
        sensitiveOperationInFlight = false;
      },
      setTemporaryPasswordPresent: (present) => {
        temporaryPasswordPresent = Boolean(present);
      },
      isSensitiveOperationBlocked: () => (
        sensitiveOperationInFlight || temporaryPasswordPresent
      ),
      isSensitiveOperationInFlight: () => sensitiveOperationInFlight
    };
  }

  const json = (method, body) => ({ method, body: JSON.stringify(body) });
  const api = {
    baseUrl,
    login: (loginName, password) => request('/admin/auth/login', json('POST', {
      login_name: loginName,
      password
    })),
    logout: () => request('/admin/auth/logout', { method: 'POST' }),
    me: () => request('/admin/auth/me'),
    listTeachers: () => request('/admin/teachers'),
    createTeacher: (loginName, displayName) => request('/admin/teachers', json('POST', {
      login_name: loginName,
      display_name: displayName
    })),
    resetTeacherPassword: (teacherId) => request(
      `/admin/teachers/${encodeURIComponent(teacherId)}/reset-password`,
      { method: 'POST' }
    ),
    createInteractionCoordinator
  };

  if (!global.document) return api;

  const document = global.document;
  const entryView = document.getElementById('entry-view');
  const adminWorkspace = document.getElementById('admin-workspace');
  const openAdminLogin = document.getElementById('open-admin-login');
  const adminLoginPanel = document.getElementById('admin-login-panel');
  const closeAdminLogin = document.getElementById('close-admin-login');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminLoginName = document.getElementById('admin-login-name');
  const adminPassword = document.getElementById('admin-password');
  const adminLoginButton = document.getElementById('admin-login-button');
  const adminLoginMessage = document.getElementById('admin-login-message');
  const adminIdentity = document.getElementById('admin-identity');
  const adminDisplayName = document.getElementById('admin-display-name');
  const logoutButton = document.getElementById('admin-logout');
  const workspaceMessage = document.getElementById('workspace-message');
  const teacherTableBody = document.getElementById('teacher-table-body');
  const teacherTable = document.getElementById('teacher-table');
  const teacherEmpty = document.getElementById('teacher-empty');
  const teacherLoading = document.getElementById('teacher-loading');
  const refreshTeachers = document.getElementById('refresh-teachers');
  const createTeacherForm = document.getElementById('create-teacher-form');
  const createLoginName = document.getElementById('create-login-name');
  const createDisplayName = document.getElementById('create-display-name');
  const createTeacherButton = document.getElementById('create-teacher-button');
  const temporaryPasswordResult = document.getElementById('temporary-password-result');
  const temporaryPasswordTitle = document.getElementById('temporary-password-title');
  const temporaryPasswordLogin = document.getElementById('temporary-password-login');
  const temporaryPasswordValue = document.getElementById('temporary-password-value');
  const copyTemporaryPassword = document.getElementById('copy-temporary-password');
  const dismissTemporaryPassword = document.getElementById('dismiss-temporary-password');
  const copyStatus = document.getElementById('copy-status');
  const coordinator = createInteractionCoordinator();

  const state = {
    admin: null,
    teachers: [],
    temporaryPassword: null,
    temporaryLoginName: null,
    loadingTeachers: false
  };

  function isUnauthorized(error) {
    return error.status === 401;
  }

  function setMessage(element, message = '', tone = '') {
    element.textContent = message;
    element.dataset.tone = tone;
    element.hidden = !message;
  }

  function syncOperationControls() {
    const sensitiveOperationBlocked = coordinator.isSensitiveOperationBlocked();
    const sensitiveOperationInFlight = coordinator.isSensitiveOperationInFlight();
    createTeacherButton.disabled = sensitiveOperationBlocked || state.loadingTeachers;
    refreshTeachers.disabled = sensitiveOperationInFlight || state.loadingTeachers;
    logoutButton.disabled = sensitiveOperationInFlight;
    for (const button of teacherTableBody.querySelectorAll('.table-action')) {
      button.disabled = sensitiveOperationBlocked;
    }
  }

  function advanceSession() {
    const generation = coordinator.advanceSession();
    state.loadingTeachers = false;
    teacherLoading.hidden = true;
    syncOperationControls();
    return generation;
  }

  function clearTemporaryPassword() {
    state.temporaryPassword = null;
    state.temporaryLoginName = null;
    coordinator.setTemporaryPasswordPresent(false);
    temporaryPasswordValue.textContent = '';
    temporaryPasswordLogin.textContent = '';
    copyStatus.textContent = '';
    temporaryPasswordResult.hidden = true;
    syncOperationControls();
  }

  function clearWorkspaceState() {
    coordinator.invalidateTeacherRequests();
    coordinator.finishSensitiveOperation();
    state.admin = null;
    state.teachers = [];
    state.loadingTeachers = false;
    teacherTableBody.replaceChildren();
    teacherTable.hidden = true;
    teacherEmpty.hidden = true;
    teacherLoading.hidden = true;
    adminIdentity.hidden = true;
    adminDisplayName.textContent = '';
    createLoginName.value = '';
    createDisplayName.value = '';
    setMessage(workspaceMessage);
    clearTemporaryPassword();
  }

  function showEntryView({ openLogin = false, message = '' } = {}) {
    advanceSession();
    clearWorkspaceState();
    adminPassword.value = '';
    adminWorkspace.hidden = true;
    entryView.hidden = false;
    adminLoginPanel.hidden = !openLogin;
    setMessage(adminLoginMessage, message, message ? 'error' : '');
    if (openLogin) adminLoginName.focus();
  }

  function showWorkspace(admin) {
    state.admin = admin;
    entryView.hidden = true;
    adminLoginPanel.hidden = true;
    adminWorkspace.hidden = false;
    adminIdentity.hidden = false;
    adminDisplayName.textContent = admin.display_name;
    setMessage(adminLoginMessage);
    syncOperationControls();
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function appendCell(row, value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
    return cell;
  }

  function createResetButton(teacher) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-action';
    button.textContent = '↻ 重置密码';
    button.title = `重置 ${teacher.display_name} 的密码`;
    button.addEventListener('click', async () => {
      const confirmed = global.confirm(
        `确认重置“${teacher.display_name}”的密码？旧密码会立即失效。`
      );
      if (!confirmed) return;
      if (!beginSensitiveOperation()) return;

      button.textContent = '重置中…';
      setMessage(workspaceMessage);
      const operationGeneration = coordinator.currentSessionGeneration();
      try {
        const result = await api.resetTeacherPassword(teacher.id);
        if (!coordinator.isSessionCurrent(operationGeneration)) return;
        showTemporaryPassword('密码已重置', result.teacher, result.temporary_password);
        upsertTeacher(result.teacher);
      } catch (error) {
        if (!coordinator.isSessionCurrent(operationGeneration)) return;
        if (isUnauthorized(error)) {
          showEntryView({ openLogin: true, message: '管理员登录已失效，请重新登录。' });
          return;
        }
        setMessage(workspaceMessage, error.message, 'error');
      } finally {
        coordinator.finishSensitiveOperation();
        button.textContent = '↻ 重置密码';
        syncOperationControls();
      }
    });
    return button;
  }

  function renderTeachers() {
    teacherTableBody.replaceChildren();
    for (const teacher of state.teachers) {
      const row = document.createElement('tr');
      appendCell(row, teacher.login_name, 'mono');
      appendCell(row, teacher.display_name);

      const statusCell = document.createElement('td');
      const status = document.createElement('span');
      status.className = `status-label status-${teacher.status}`;
      status.textContent = teacher.status === 'active' ? '可用' : '停用';
      statusCell.append(status);
      row.append(statusCell);

      appendCell(row, String(teacher.published_course_count), 'number-cell');
      appendCell(row, formatDate(teacher.updated_at), 'date-cell');

      const actionCell = document.createElement('td');
      actionCell.className = 'action-cell';
      actionCell.append(createResetButton(teacher));
      row.append(actionCell);
      teacherTableBody.append(row);
    }

    teacherLoading.hidden = true;
    teacherTable.hidden = state.teachers.length === 0;
    teacherEmpty.hidden = state.teachers.length !== 0;
    syncOperationControls();
  }

  function upsertTeacher(teacher) {
    const existingIndex = state.teachers.findIndex((item) => item.id === teacher.id);
    if (existingIndex === -1) {
      state.teachers = [...state.teachers, teacher];
    } else {
      state.teachers = state.teachers.map((item) => (
        item.id === teacher.id ? teacher : item
      ));
    }
    state.teachers.sort((left, right) => left.login_name.localeCompare(right.login_name));
    renderTeachers();
  }

  async function loadTeachers() {
    if (state.loadingTeachers) return;
    const requestGeneration = coordinator.beginTeacherRequest();
    state.loadingTeachers = true;
    teacherLoading.hidden = false;
    teacherEmpty.hidden = true;
    teacherTable.hidden = true;
    syncOperationControls();
    setMessage(workspaceMessage);
    try {
      const teachers = await api.listTeachers();
      if (!coordinator.isTeacherRequestCurrent(requestGeneration) || !state.admin) return;
      state.teachers = teachers;
      renderTeachers();
    } catch (error) {
      if (!coordinator.isTeacherRequestCurrent(requestGeneration)) return;
      teacherLoading.hidden = true;
      if (isUnauthorized(error)) {
        showEntryView({ openLogin: true, message: '管理员登录已失效，请重新登录。' });
        return;
      }
      setMessage(workspaceMessage, error.message, 'error');
    } finally {
      if (coordinator.isTeacherRequestCurrent(requestGeneration)) {
        state.loadingTeachers = false;
        syncOperationControls();
      }
    }
  }

  function beginSensitiveOperation() {
    if (state.loadingTeachers || !coordinator.beginSensitiveOperation()) return false;
    state.loadingTeachers = false;
    teacherLoading.hidden = true;
    syncOperationControls();
    return true;
  }

  function showTemporaryPassword(title, teacher, password) {
    state.temporaryPassword = password;
    state.temporaryLoginName = teacher.login_name;
    coordinator.setTemporaryPasswordPresent(true);
    temporaryPasswordTitle.textContent = title;
    temporaryPasswordLogin.textContent = teacher.login_name;
    temporaryPasswordValue.textContent = password;
    copyStatus.textContent = '';
    temporaryPasswordResult.hidden = false;
    temporaryPasswordResult.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    syncOperationControls();
  }

  openAdminLogin.addEventListener('click', () => {
    adminLoginPanel.hidden = false;
    setMessage(adminLoginMessage);
    adminLoginName.focus();
  });

  closeAdminLogin.addEventListener('click', () => {
    adminPassword.value = '';
    adminLoginPanel.hidden = true;
    setMessage(adminLoginMessage);
  });

  adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const loginGeneration = advanceSession();
    adminLoginButton.disabled = true;
    adminLoginButton.textContent = '登录中…';
    setMessage(adminLoginMessage);
    try {
      const result = await api.login(adminLoginName.value, adminPassword.value);
      if (!coordinator.isSessionCurrent(loginGeneration)) return;
      adminPassword.value = '';
      showWorkspace(result.admin);
      await loadTeachers();
    } catch (error) {
      if (!coordinator.isSessionCurrent(loginGeneration)) return;
      adminPassword.value = '';
      setMessage(adminLoginMessage, error.message, 'error');
    } finally {
      if (coordinator.isSessionCurrent(loginGeneration)) {
        adminLoginButton.disabled = false;
        adminLoginButton.textContent = '登录';
      }
    }
  });

  logoutButton.addEventListener('click', async () => {
    const logoutGeneration = advanceSession();
    logoutButton.disabled = true;
    try {
      await api.logout();
      if (!coordinator.isSessionCurrent(logoutGeneration)) return;
      showEntryView();
    } catch (error) {
      if (!coordinator.isSessionCurrent(logoutGeneration)) return;
      if (isUnauthorized(error)) {
        showEntryView({ openLogin: true, message: '管理员登录已失效，请重新登录。' });
        return;
      }
      setMessage(workspaceMessage, `退出失败：${error.message}`, 'error');
    } finally {
      if (coordinator.isSessionCurrent(logoutGeneration)) {
        logoutButton.disabled = false;
        syncOperationControls();
      }
    }
  });

  refreshTeachers.addEventListener('click', loadTeachers);

  createTeacherForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!beginSensitiveOperation()) return;
    createTeacherButton.textContent = '创建中…';
    setMessage(workspaceMessage);
    const operationGeneration = coordinator.currentSessionGeneration();
    try {
      const result = await api.createTeacher(
        createLoginName.value,
        createDisplayName.value
      );
      if (!coordinator.isSessionCurrent(operationGeneration)) return;
      createLoginName.value = '';
      createDisplayName.value = '';
      showTemporaryPassword('教师账号已创建', result.teacher, result.temporary_password);
      upsertTeacher(result.teacher);
    } catch (error) {
      if (!coordinator.isSessionCurrent(operationGeneration)) return;
      if (isUnauthorized(error)) {
        showEntryView({ openLogin: true, message: '管理员登录已失效，请重新登录。' });
        return;
      }
      setMessage(workspaceMessage, error.message, 'error');
    } finally {
      coordinator.finishSensitiveOperation();
      createTeacherButton.textContent = '＋ 创建教师';
      syncOperationControls();
    }
  });

  copyTemporaryPassword.addEventListener('click', async () => {
    if (!state.temporaryPassword) return;
    copyTemporaryPassword.disabled = true;
    try {
      await global.navigator.clipboard.writeText(state.temporaryPassword);
      copyStatus.textContent = '已复制';
    } catch {
      copyStatus.textContent = '复制失败，请手动选择';
    } finally {
      copyTemporaryPassword.disabled = false;
    }
  });

  dismissTemporaryPassword.addEventListener('click', clearTemporaryPassword);

  async function restoreSession() {
    const restoreGeneration = coordinator.currentSessionGeneration();
    try {
      const result = await api.me();
      if (!coordinator.isSessionCurrent(restoreGeneration)) return;
      showWorkspace(result.admin);
      await loadTeachers();
    } catch (error) {
      if (!coordinator.isSessionCurrent(restoreGeneration)) return;
      if (isUnauthorized(error)) {
        showEntryView();
        return;
      }
      showEntryView({ openLogin: true, message: '暂时无法连接管理员服务。' });
    }
  }

  restoreSession();
  return api;
});
