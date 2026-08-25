import logging
import sys

import structlog

from app.config import Settings


REDACTED_SUBSTRINGS = (
    "password",
    "secret",
    "token",
    "cookie",
    "access_code",
    "authorization",
    "credential",
    "proof",
)
REDACTED = "[已脱敏]"


def _redact(value: object, depth: int = 0) -> object:
    if depth > 4:
        return value
    if isinstance(value, dict):
        return {
            key: (
                REDACTED
                if isinstance(key, str)
                and any(marker in key.lower() for marker in REDACTED_SUBSTRINGS)
                else _redact(item, depth + 1)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return type(value)(_redact(item, depth + 1) for item in value)
    return value


def redact_sensitive(_logger: object, _name: str, event_dict: dict) -> dict:
    return _redact(event_dict)  # type: ignore[return-value]


def configure_logging(settings: Settings) -> None:
    level = getattr(logging, settings.effective_log_level, logging.INFO)
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        redact_sensitive,
    ]
    renderer = (
        structlog.dev.ConsoleRenderer()
        if settings.app_env in {"development", "test"}
        else structlog.processors.JSONRenderer()
    )
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level)
    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=False,
    )
