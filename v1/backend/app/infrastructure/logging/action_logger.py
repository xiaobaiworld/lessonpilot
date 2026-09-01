from __future__ import annotations

from typing import Any

import structlog

from .config import redact_log_fields, sanitize_error_message


class ActionLogger:
    """Emit the project's canonical start/success/failure/retry action records."""

    def __init__(self, module: str, logger: Any | None = None) -> None:
        self.module = module
        self.logger = logger or structlog.get_logger(f"action.{module}")

    def _emit(
        self,
        action: str,
        event: str,
        request_id: str | None,
        **fields: object,
    ) -> None:
        payload = redact_log_fields(
            {
                "module": self.module,
                "action": action,
                "event": event,
                "request_id": request_id,
                **fields,
            }
        )
        self.logger.info(f"{self.module}.{action}", **payload)

    def start(self, action: str, request_id: str | None = None, **fields: object) -> None:
        self._emit(action, "start", request_id, **fields)

    def success(
        self,
        action: str,
        duration_ms: int,
        request_id: str | None = None,
        **fields: object,
    ) -> None:
        self._emit(action, "success", request_id, duration_ms=duration_ms, **fields)

    def failure(
        self,
        action: str,
        error: BaseException,
        duration_ms: int,
        request_id: str | None = None,
        **fields: object,
    ) -> None:
        self._emit(
            action,
            "failure",
            request_id,
            duration_ms=duration_ms,
            error_type=type(error).__name__,
            error_message=sanitize_error_message(str(error)),
            **fields,
        )

    def retry(
        self,
        action: str,
        retry_count: int,
        request_id: str | None = None,
        **fields: object,
    ) -> None:
        self._emit(action, "retry", request_id, retry_count=retry_count, **fields)
