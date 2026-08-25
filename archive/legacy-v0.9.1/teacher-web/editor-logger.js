(function initKnownMapEditorLogger(global, factory) {
  const api = factory();
  global.KnownMapEditorLogger = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function createLoggerModule() {
  const levels = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
  const allowedFields = new Set([
    'nodeId',
    'pluginId',
    'timeSeconds',
    'source',
    'result',
    'errorCode',
    'mode',
    'durationMs'
  ]);

  function defaultLevel(origin) {
    return /^(http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(origin || '') ? 'debug' : 'info';
  }

  function createEditorLogger({ origin, level, sink } = {}) {
    const threshold = level || defaultLevel(origin || globalThis.location?.origin);
    const write = typeof sink === 'function'
      ? sink
      : (entry) => {
          const consoleTarget = globalThis.console;
          if (!consoleTarget) return;
          const method = typeof consoleTarget[entry.level] === 'function'
            ? consoleTarget[entry.level]
            : consoleTarget.log;
          method?.call(consoleTarget, entry);
        };

    function log(entryLevel, action, fields = {}) {
      if ((levels[entryLevel] || levels.info) < (levels[threshold] || levels.info)) return;
      const entry = {
        timestamp: new Date().toISOString(),
        level: entryLevel,
        module: 'teacher-web.visual-editor',
        action,
        event: fields.result || 'success'
      };
      for (const [key, value] of Object.entries(fields)) {
        if (!allowedFields.has(key)) continue;
        if (value === undefined || value === null) continue;
        entry[key] = value;
      }
      write(entry);
    }

    return {
      level: threshold,
      debug: (action, fields) => log('debug', action, fields),
      info: (action, fields) => log('info', action, fields),
      warn: (action, fields) => log('warn', action, { ...fields, result: fields?.result || 'failure' }),
      error: (action, fields) => log('error', action, { ...fields, result: fields?.result || 'failure' })
    };
  }

  return { createEditorLogger };
});
