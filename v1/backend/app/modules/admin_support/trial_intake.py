from threading import Lock
from time import monotonic


class TrialSubmissionRateLimiter:
    """单进程轻量限流，适配当前 SQLite 单节点开发/小规模部署。"""

    def __init__(self, max_attempts: int = 3, window_seconds: int = 60):
        if max_attempts < 1 or window_seconds < 1:
            raise ValueError("TRIAL_RATE_LIMIT_CONFIGURATION_INVALID")
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            recent = [attempt for attempt in self._attempts.get(key, []) if attempt > cutoff]
            allowed = len(recent) < self.max_attempts
            recent.append(now)
            self._attempts[key] = recent
            return allowed
