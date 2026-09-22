"""Daily, verified SQLite backups for the desktop launcher."""
import sqlite3
from datetime import datetime
from pathlib import Path
from .config import BACKUP_DIR, settings


def _database_path() -> Path:
    if not settings.database_url.startswith("sqlite:///"):
        raise RuntimeError("Daily launcher backups support SQLite only.")
    return Path(settings.database_url.removeprefix("sqlite:///"))


def _backup_name() -> Path:
    return BACKUP_DIR / f"weight_manager_{datetime.now():%Y-%m-%d_%H%M%S}.db"


def backup_if_due(keep=30):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    existing_today = list(BACKUP_DIR.glob(f"weight_manager_{today}_*.db"))
    if existing_today:
        prune_backups(keep)
        return None
    source = _database_path()
    if not source.exists():
        return None
    output = _backup_name()
    source_db = sqlite3.connect(source)
    destination_db = sqlite3.connect(output)
    try:
        source_db.backup(destination_db)
    finally:
        destination_db.close()
        source_db.close()
    check_db = sqlite3.connect(output)
    try:
        integrity = check_db.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        check_db.close()
    if integrity != "ok":
        output.unlink(missing_ok=True)
        raise RuntimeError("Backup integrity check failed")
    prune_backups(keep)
    return output


def prune_backups(keep=30):
    import time

    backups = sorted(BACKUP_DIR.glob("weight_manager_*.db"), key=lambda path: path.stat().st_mtime, reverse=True)
    for stale in backups[keep:]:
        last_error = None
        for attempt in range(5):
            try:
                stale.unlink()
                last_error = None
                break
            except PermissionError as exc:  # WinError 32: file still briefly locked
                last_error = exc
                time.sleep(0.05 * (attempt + 1))
        if last_error is not None:
            raise last_error
