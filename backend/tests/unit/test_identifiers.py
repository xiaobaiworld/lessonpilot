from uuid import UUID

from app.identifiers import generate_uuid


def test_generate_uuid_returns_unique_canonical_uuid_strings() -> None:
    first = generate_uuid()
    second = generate_uuid()

    assert first != second
    assert str(UUID(first)) == first
    assert str(UUID(second)) == second
