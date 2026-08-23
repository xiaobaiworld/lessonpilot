"""Tests for v1 security primitives."""

import pytest
import os
from datetime import datetime, timedelta, timezone
from .primitives import (
    PasswordManager,
    TokenDigester,
    TimeManager,
    RandomGenerator,
    SecurityError,
)


@pytest.fixture
def password_manager():
    return PasswordManager()


@pytest.fixture
def token_digester():
    return TokenDigester(b'a' * 32)  # Use a fixed key for testing


def test_password_hashing(password_manager):
    """Hash and verify a password."""
    password = 'secure_password_123'
    hash_digest = password_manager.hash_password(password)

    assert password_manager.verify_password(password, hash_digest)
    assert not password_manager.verify_password('wrong_password', hash_digest)


def test_password_rejects_empty(password_manager):
    """Empty password raises SecurityError."""
    with pytest.raises(SecurityError):
        password_manager.hash_password('')


def test_token_digest_roundtrip(token_digester):
    """Generate token and verify against digest."""
    token_hex, digest_hex = token_digester.generate_token()

    # Token should verify against its own digest
    assert token_digester.verify_token(token_hex, digest_hex)

    # Wrong token should not verify
    wrong_token_hex, _ = token_digester.generate_token()
    assert not token_digester.verify_token(wrong_token_hex, digest_hex)


def test_token_digest_from_hex(token_digester):
    """Compute digest from token hex."""
    token_hex, expected_digest = token_digester.generate_token()
    computed_digest = token_digester.digest_only(token_hex)

    assert computed_digest == expected_digest


def test_time_manager():
    """UTC time utilities."""
    now = TimeManager.utc_now()
    assert now.tzinfo is not None

    future_time = TimeManager.future(hours=1)
    assert future_time > now
    assert not TimeManager.is_expired(future_time)

    past_time = TimeManager.future(hours=-1)
    assert TimeManager.is_expired(past_time)


def test_random_generator():
    """Random data generation."""
    hex_str = RandomGenerator.hex_string(16)
    assert len(hex_str) == 32  # 16 bytes = 32 hex chars
    assert all(c in '0123456789abcdef' for c in hex_str)

    bytes_data = RandomGenerator.bytes_data(16)
    assert len(bytes_data) == 16
    assert isinstance(bytes_data, bytes)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
