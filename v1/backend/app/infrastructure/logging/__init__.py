"""Structured logging - shared infrastructure

Handles:
- Event schema validation
- PII scrubbing (no passwords, tokens, raw authorization codes)
- Request correlation IDs
- Audit trail formatting
- Log output routing

All logs must pass design 08 (security & operations) scrubbing rules.
"""
