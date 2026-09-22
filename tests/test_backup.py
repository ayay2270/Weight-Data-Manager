import sqlite3
from app.backup import main
from app.config import BASE_DIR

def test_consistent_sqlite_backup(client):
    before=set((BASE_DIR/"backups").glob("weight_manager_*.db")); main()
    created=set((BASE_DIR/"backups").glob("weight_manager_*.db"))-before
    assert len(created)==1
    path=created.pop()
    # Explicit close so Windows does not keep the backup file locked after the test.
    db=sqlite3.connect(path)
    try:
        assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
    finally:
        db.close()
