"""Database initialization and migrations - stage 0 (0E)

Responsibility:
- Clean database schema for v1 (no legacy data import)
- Alembic migration head
- Initialization checks to reject old schema

Migration strategy:
1. Alembic head bumped to 0012_v1_schema_bootstrap
2. All legacy table references frozen
3. Old data (if present) isolated in read-only views
4. v1 tables built in fresh schema
"""
