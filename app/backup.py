import sqlite3
from datetime import datetime
from pathlib import Path
from .config import BASE_DIR, settings


def main():
    if not settings.database_url.startswith("sqlite:///"):
        raise SystemExit("This backup command is for SQLite only. Use your PostgreSQL backup procedure after migration.")
    source=Path(settings.database_url.removeprefix("sqlite:///"))
    if not source.exists(): raise SystemExit(f"Database not found: {source}")
    out=BASE_DIR/"backups"/f"weight_manager_{datetime.now():%Y-%m-%d_%H%M%S}.db"; out.parent.mkdir(exist_ok=True)
    with sqlite3.connect(source) as src, sqlite3.connect(out) as dst: src.backup(dst)
    with sqlite3.connect(out) as check:
        result=check.execute("PRAGMA integrity_check").fetchone()[0]
    if result!="ok": out.unlink(missing_ok=True); raise SystemExit(f"Backup integrity check failed: {result}")
    print(f"Backup completed and verified:\n{out}")


if __name__=="__main__": main()

