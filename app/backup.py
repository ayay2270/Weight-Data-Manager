import sqlite3
from datetime import datetime
from pathlib import Path
from .config import BASE_DIR, settings


def main():
    if not settings.database_url.startswith("sqlite:///"):
        raise SystemExit("This backup command is for SQLite only. Use your PostgreSQL backup procedure after migration.")
    source = Path(settings.database_url.removeprefix("sqlite:///"))
    if not source.exists():
        raise SystemExit(f"Database not found: {source}")
    out = BASE_DIR / "backups" / f"weight_manager_{datetime.now():%Y-%m-%d_%H%M%S}.db"
    out.parent.mkdir(exist_ok=True)
    source_db = sqlite3.connect(source)
    destination_db = sqlite3.connect(out)
    try:
        source_db.backup(destination_db)
    finally:
        destination_db.close()
        source_db.close()
    check_db = sqlite3.connect(out)
    try:
        result = check_db.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        check_db.close()
    if result != "ok":
        out.unlink(missing_ok=True)
        raise SystemExit(f"Backup integrity check failed: {result}")
    print(f"Backup completed and verified:\n{out}")


if __name__ == "__main__":
    main()
