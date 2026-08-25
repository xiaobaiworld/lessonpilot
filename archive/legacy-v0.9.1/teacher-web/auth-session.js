(function initKnownMapSession(global, factory) {
  const session = factory(global.KnownMapApi);
  global.KnownMapSession = session;
  if (typeof module !== 'undefined' && module.exports) module.exports = session;
})(typeof window !== 'undefined' ? window : globalThis, function createKnownMapSession(api) {
  let teacher = null;
  const storageKey = 'knownmap_teacher_session';

  return {
    shouldRestore() {
      return globalThis.sessionStorage?.getItem(storageKey) === '1';
    },
    async restore() {
      const response = await api.me();
      teacher = response.teacher || response;
      return teacher;
    },
    async login(loginName, password) {
      const response = await api.login(loginName, password);
      teacher = response.teacher || response;
      globalThis.sessionStorage?.setItem(storageKey, '1');
      return teacher;
    },
    async logout() {
      await api.logout();
      teacher = null;
      globalThis.sessionStorage?.removeItem(storageKey);
    },
    current() {
      return teacher;
    }
  };
});
