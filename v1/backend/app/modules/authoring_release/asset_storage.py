from __future__ import annotations

import hashlib
import ipaddress
import json
import mimetypes
import os
import socket
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID, uuid4


class AssetStorageError(Exception):
    def __init__(self, code: str):
        self.code = code


ALLOWED_MIME_TYPES = {
    "image/png": "image",
    "image/jpeg": "image",
    "image/gif": "image",
    "image/webp": "image",
    "audio/mpeg": "audio",
    "audio/wav": "audio",
    "audio/ogg": "audio",
    "audio/webm": "audio",
    "video/mp4": "video",
    "video/webm": "video",
    "video/ogg": "video",
}


class _SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_source_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _validate_source_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
        raise AssetStorageError("ASSET_SOURCE_INVALID")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except (OSError, ValueError):
        raise AssetStorageError("ASSET_SOURCE_UNAVAILABLE") from None
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise AssetStorageError("ASSET_SOURCE_INVALID")
    return value


def _kind_for_mime(mime_type: str | None, filename: str | None = None) -> tuple[str, str]:
    normalized = (mime_type or "").split(";", 1)[0].strip().lower()
    if normalized not in ALLOWED_MIME_TYPES and filename:
        guessed = mimetypes.guess_type(filename)[0]
        normalized = guessed or normalized
    kind = ALLOWED_MIME_TYPES.get(normalized)
    if not kind:
        raise AssetStorageError("ASSET_FILE_TYPE_INVALID")
    return kind, normalized


class AssetStorage:
    """服务器媒体文件存储；SQLite 只保存返回的资源清单和节点引用。"""

    def __init__(self, root: Path, max_bytes: int = 50 * 1024 * 1024, timeout_seconds: int = 10):
        self.root = root
        self.max_bytes = max_bytes
        self.timeout_seconds = timeout_seconds
        self.root.mkdir(parents=True, exist_ok=True)

    def _paths(self, asset_id: str) -> tuple[Path, Path]:
        try:
            UUID(asset_id)
        except ValueError:
            raise AssetStorageError("ASSET_NOT_FOUND") from None
        return self.root / f"{asset_id}.bin", self.root / f"{asset_id}.json"

    def _write(self, teacher_id: str, data: bytes, mime_type: str, source_type: str) -> dict:
        if len(data) > self.max_bytes:
            raise AssetStorageError("ASSET_TOO_LARGE")
        kind, normalized_mime = _kind_for_mime(mime_type)
        asset_id = str(uuid4())
        file_path, metadata_path = self._paths(asset_id)
        record = {
            "assetId": asset_id,
            "kind": kind,
            "mimeType": normalized_mime,
            "byteSize": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "sourceType": source_type,
        }
        temp_file = None
        temp_metadata = None
        try:
            with tempfile.NamedTemporaryFile(dir=self.root, delete=False) as handle:
                temp_file = Path(handle.name)
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            with tempfile.NamedTemporaryFile(
                dir=self.root, mode="w", encoding="utf-8", delete=False
            ) as handle:
                temp_metadata = Path(handle.name)
                json.dump({"teacherId": teacher_id, "record": record}, handle, ensure_ascii=False)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_file, file_path)
            os.replace(temp_metadata, metadata_path)
        except OSError:
            raise AssetStorageError("ASSET_STORAGE_FAILED") from None
        finally:
            for path in (temp_file, temp_metadata):
                if path and path.exists():
                    path.unlink(missing_ok=True)
        return record

    def save_upload(
        self, teacher_id: str, data: bytes, mime_type: str | None, filename: str | None
    ) -> dict:
        kind, normalized = _kind_for_mime(mime_type, filename)
        del kind
        return self._write(teacher_id, data, normalized, "uploaded")

    def import_url(self, teacher_id: str, url: str) -> dict:
        _validate_source_url(url)
        opener = build_opener(_SafeRedirectHandler())
        try:
            with opener.open(
                Request(url, headers={"User-Agent": "KnownMap/1.0"}), timeout=self.timeout_seconds
            ) as response:
                mime_type = response.headers.get_content_type()
                filename = urlparse(response.geturl()).path.rsplit("/", 1)[-1]
                if mime_type == "application/octet-stream":
                    mime_type = None
                _, normalized_mime = _kind_for_mime(mime_type, filename)
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > self.max_bytes:
                    raise AssetStorageError("ASSET_TOO_LARGE")
                data = response.read(self.max_bytes + 1)
        except AssetStorageError:
            raise
        except (OSError, ValueError):
            raise AssetStorageError("ASSET_SOURCE_UNAVAILABLE") from None
        return self._write(teacher_id, data, normalized_mime, "licensed")

    def get(self, teacher_id: str, asset_id: str) -> tuple[dict, Path]:
        file_path, metadata_path = self._paths(asset_id)
        if not file_path.is_file() or not metadata_path.is_file():
            raise AssetStorageError("ASSET_NOT_FOUND")
        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise AssetStorageError("ASSET_NOT_FOUND") from None
        if payload.get("teacherId") != teacher_id:
            raise AssetStorageError("ASSET_NOT_FOUND")
        return payload["record"], file_path
