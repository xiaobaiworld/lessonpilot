import logging
import sys

import structlog

from app.config import Settings


#: 绝不写进日志的字段名。匹配按小写子串，覆盖 password、password_hash、
#: raw_token、access_code、temporary_password 这类命名变体。
#:
#: 现有代码本来就不记这些，但那依赖每一处日志调用都写对；只要有人加一行
#: `logger.info("x", **payload)` 就会漏出去。这里做兜底，让"不记密钥"从
#: 约定变成机制（doc/data/quality.md 的禁入规则）。
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
    """递归脱敏。depth 有上限，避免自引用结构把处理器卡死。"""
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
    """structlog 处理器：按字段名脱敏，不看值。

    按名字而非按值匹配，因为值无法可靠识别——一个 32 位十六进制串既可能是
    请求 ID 也可能是 token。字段名是调用方自己写的，可控。
    """
    return _redact(event_dict)  # type: ignore[return-value]


def configure_logging(settings: Settings) -> int:
    level = getattr(logging, settings.effective_log_level, logging.INFO)
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        # 排在渲染之前，所以两种渲染器都受它保护
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
    return level
