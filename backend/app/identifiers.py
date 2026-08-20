from uuid import uuid4


def generate_uuid() -> str:
    """Return a canonical lowercase UUID string for persistent identities."""
    return str(uuid4())
