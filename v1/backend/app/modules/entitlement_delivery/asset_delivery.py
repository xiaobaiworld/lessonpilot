from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time


class AssetDeliveryError(Exception):
    def __init__(self, code: str):
        self.code = code


def _encode(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode(value: str) -> object:
    padding = "=" * (-len(value) % 4)
    return json.loads(base64.urlsafe_b64decode(f"{value}{padding}"))


def issue_asset_token(
    secret: str,
    course_id: str,
    release_id: str,
    assets: dict[str, str],
    ttl_seconds: int = 300,
    now: int | None = None,
) -> tuple[str, int]:
    expires_at = (now if now is not None else int(time.time())) + ttl_seconds
    payload = {
        "courseId": course_id,
        "releaseId": release_id,
        "assets": assets,
        "expiresAt": expires_at,
    }
    encoded = _encode(payload)
    signature = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}", expires_at


def verify_asset_token(
    secret: str,
    token: str,
    asset_id: str,
    now: int | None = None,
) -> str:
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise AssetDeliveryError("ASSET_ACCESS_INVALID")
        payload = _decode(encoded)
    except (
        ValueError,
        TypeError,
        binascii.Error,
        json.JSONDecodeError,
        UnicodeDecodeError,
    ):
        raise AssetDeliveryError("ASSET_ACCESS_INVALID") from None

    if not isinstance(payload, dict):
        raise AssetDeliveryError("ASSET_ACCESS_INVALID")
    expires_at = payload.get("expiresAt")
    assets = payload.get("assets")
    if (
        not isinstance(payload.get("courseId"), str)
        or not isinstance(payload.get("releaseId"), str)
        or not isinstance(expires_at, int)
        or expires_at <= (now if now is not None else int(time.time()))
        or not isinstance(assets, dict)
        or asset_id not in assets
        or not isinstance(assets[asset_id], str)
    ):
        raise AssetDeliveryError("ASSET_ACCESS_INVALID")
    return assets[asset_id]
