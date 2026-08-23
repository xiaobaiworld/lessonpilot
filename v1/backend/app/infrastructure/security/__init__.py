"""Security primitives - shared infrastructure

Handles:
- Argon2 password hashing
- HMAC session token digests
- Extension local proof storage format
- Cryptographic key initialization
- Environment secret loading and validation

No business logic; only cryptographic safeguards.
"""
