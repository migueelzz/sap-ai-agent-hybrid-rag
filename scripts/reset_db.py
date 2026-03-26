"""
Reset the database: drop all tables and reapply schema.sql.

Usage:
    pdm run python scripts/reset_db.py
"""
import asyncio
import os
import pathlib

import asyncpg
from dotenv import load_dotenv

load_dotenv()

SCHEMA = pathlib.Path(__file__).parent / "schema.sql"


async def reset() -> None:
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    try:
        print("Dropping schema...")
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        print("Applying schema.sql...")
        await conn.execute(SCHEMA.read_text(encoding="utf-8"))
        print("✓ Database reset complete")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(reset())
