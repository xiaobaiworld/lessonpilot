from time import perf_counter
from uuid import uuid4

import structlog
from starlette.middleware.base import BaseHTTPMiddleware


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = request.headers.get("X-Request-Id") or str(uuid4())
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        logger = structlog.get_logger("http")
        started_at = perf_counter()
        logger.info(
            "http.request.start",
            method=request.method,
            path=request.url.path,
        )
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "http.request.failure",
                method=request.method,
                path=request.url.path,
                duration_ms=round((perf_counter() - started_at) * 1000),
            )
            raise

        duration_ms = round((perf_counter() - started_at) * 1000)
        response.headers["X-Request-Id"] = request_id
        logger.info(
            "http.request.success",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        structlog.contextvars.clear_contextvars()
        return response
