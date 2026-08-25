"""v1 Security Primitives Module - Stage 1A

Extracted from v0.9.1 but cleaned up for reuse:
- Password hashing (Argon2)
- Session token digests (HMAC)
- Time utilities
- Random generators
- Environment secret loading

This module is cross-module shared; identity and admin modules both use it.
"""

import os
import secrets
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone

try:
    import argon2

    HAS_ARGON2 = True
except ImportError:
    HAS_ARGON2 = False


class SecurityError(Exception):
    """Base security primitive error."""

    pass


class PasswordManager:
    """Argon2 password hashing with fixed parameters."""

    def __init__(self):
        if not HAS_ARGON2:
            raise SecurityError("argon2-cffi is required for password hashing")
        self.ph = argon2.PasswordHasher()

    def hash_password(self, password: str) -> str:
        """Hash a plaintext password. Raises if password is empty."""
        if not password or not isinstance(password, str):
            raise SecurityError("Invalid password")
        return self.ph.hash(password)

    def verify_password(self, password: str, hash_digest: str) -> bool:
        """Verify plaintext against stored hash. Returns False if mismatch."""
        try:
            self.ph.verify(hash_digest, password)
            return True
        except Exception:
            # Catches both InvalidHash and VerifyMismatchError from argon2
            return False


class TokenDigester:
    """HMAC-based token digest for session storage.

    Stores only the digest in the database; never stores plaintext tokens.
    """

    def __init__(self, secret: bytes | None = None):
        """Initialize with a stable secret (from environment or provided)."""
        if secret is None:
            secret_str = os.getenv("V1_SESSION_SECRET")
            if not secret_str:
                raise SecurityError("V1_SESSION_SECRET not set")
            secret = secret_str.encode("utf-8")
        elif not isinstance(secret, bytes):
            raise SecurityError("Secret must be bytes or None (loads from env)")

        if len(secret) < 32:
            raise SecurityError("Secret must be at least 32 bytes")

        self.secret = secret

    def generate_token(self, length: int = 32) -> str:
        """Generate a random token and return both token and digest.

        Returns tuple (token_hex, digest_hex) for storage.
        """
        token_bytes = secrets.token_bytes(length)
        digest = hmac.new(self.secret, token_bytes, hashlib.sha256).digest()
        return token_bytes.hex(), digest.hex()

    def verify_token(self, token_hex: str, stored_digest_hex: str) -> bool:
        """Verify a token against its stored digest."""
        try:
            token_bytes = bytes.fromhex(token_hex)
            computed_digest = hmac.new(self.secret, token_bytes, hashlib.sha256).digest()
            stored_digest = bytes.fromhex(stored_digest_hex)
            return hmac.compare_digest(computed_digest, stored_digest)
        except (ValueError, TypeError):
            return False

    def digest_only(self, token_hex: str) -> str:
        """Compute digest from a token hex string."""
        try:
            token_bytes = bytes.fromhex(token_hex)
            digest = hmac.new(self.secret, token_bytes, hashlib.sha256).digest()
            return digest.hex()
        except ValueError:
            raise SecurityError("Invalid token format")


class TimeManager:
    """UTC-based time utilities."""

    @staticmethod
    def utc_now() -> datetime:
        """Return current UTC time as timezone-aware datetime."""
        return datetime.now(timezone.utc)

    @staticmethod
    def utc_timestamp() -> float:
        """Return current UTC timestamp (seconds since epoch)."""
        return time.time()

    @staticmethod
    def future(hours: int = 24, minutes: int = 0) -> datetime:
        """Return a future UTC time."""
        return TimeManager.utc_now() + timedelta(hours=hours, minutes=minutes)

    @staticmethod
    def is_expired(expiry_time: datetime) -> bool:
        """Check if a datetime has passed."""
        if expiry_time.tzinfo is None:
            expiry_time = expiry_time.replace(tzinfo=timezone.utc)
        return TimeManager.utc_now() > expiry_time


class RandomGenerator:
    """Cryptographically secure random data."""

    @staticmethod
    def hex_string(length: int = 32) -> str:
        """Generate a hex string of the given byte length."""
        return secrets.token_hex(length)

    @staticmethod
    def bytes_data(length: int = 32) -> bytes:
        """Generate random bytes."""
        return secrets.token_bytes(length)


# Module exports for cross-module use
__all__ = [
    "PasswordManager",
    "TokenDigester",
    "TimeManager",
    "RandomGenerator",
    "SecurityError",
]
