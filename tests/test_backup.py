import sqlite3
from app.backup import main
from app.config import BASE_DIR

def test_consistent_sqlite_backup(client):
    before=set((BASE_DIR/"backups").glob("weight_manager_*.db")); main()
    created=set((BASE_DIR/"backups").glob("weight_manager_*.db"))-before
    assert len(created)==1
    with sqlite3.connect(created.pop()) as db: assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
