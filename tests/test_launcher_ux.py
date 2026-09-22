"""Tests for daily launcher backup rules and launcher URL helpers."""
from __future__ import annotations

import sqlite3

from app.launch_backup import backup_if_due, prune_backups
from desktop_launcher import fallback_url, primary_url
from first_time_setup import RULE, add_rule_command


def test_primary_and_fallback_urls():
    assert primary_url("HOST-PC", 8000) == "http://HOST-PC:8000"
    assert fallback_url("10.1.2.3", 8000) == "http://10.1.2.3:8000"
    assert fallback_url("", 8000) == "Network IP unavailable"


def test_firewall_add_command_is_domain_private_only():
    command = add_rule_command()
    assert RULE in command
    assert "localport=8000" in command
    assert "profile=domain,private" in command
    profile_part = command.lower().split("profile=")[-1]
    assert "public" not in profile_part


def test_daily_backup_same_day_no_duplicate_and_prune(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    backup_dir = tmp_path / "backups"
    data_dir.mkdir()
    backup_dir.mkdir()
    db_path = data_dir / "weight_manager.db"
    with sqlite3.connect(db_path) as db:
        db.execute("CREATE TABLE t(id INTEGER PRIMARY KEY)")
        db.execute("INSERT INTO t(id) VALUES (1)")
        db.commit()

    import app.config as config
    import app.launch_backup as launch_backup

    monkeypatch.setattr(config, "BACKUP_DIR", backup_dir)
    monkeypatch.setattr(config, "DATA_DIR", data_dir)
    monkeypatch.setattr(
        config.settings,
        "database_url",
        f"sqlite:///{db_path.as_posix()}",
    )
    monkeypatch.setattr(launch_backup, "BACKUP_DIR", backup_dir)
    monkeypatch.setattr(launch_backup, "settings", config.settings)

    first = backup_if_due(keep=30)
    assert first is not None and first.exists()
    with sqlite3.connect(first) as check:
        assert check.execute("PRAGMA integrity_check").fetchone()[0] == "ok"

    second = backup_if_due(keep=30)
    assert second is None
    assert len(list(backup_dir.glob("weight_manager_*.db"))) == 1

    for index in range(5):
        extra = backup_dir / f"weight_manager_2099-01-0{index + 1}_000000.db"
        extra.write_bytes(first.read_bytes())
    prune_backups(keep=2)
    assert len(list(backup_dir.glob("weight_manager_*.db"))) == 2


def test_migrate_portable_data_copies_once(tmp_path, monkeypatch):
    from desktop_launcher import migrate_portable_data_if_needed

    portable = tmp_path / "release"
    home = tmp_path / "appdata"
    (portable / "data").mkdir(parents=True)
    source = portable / "data" / "weight_manager.db"
    source.write_bytes(b"sqlite-demo")
    (portable / "backups").mkdir()
    old_backup = portable / "backups" / "weight_manager_2026-01-01_120000.db"
    old_backup.write_bytes(b"backup-demo")

    migrate_portable_data_if_needed(portable, home)
    destination = home / "data" / "weight_manager.db"
    assert destination.read_bytes() == b"sqlite-demo"
    assert (home / "backups" / old_backup.name).read_bytes() == b"backup-demo"

    # Second run must not overwrite an existing AppData DB
    source.write_bytes(b"changed")
    migrate_portable_data_if_needed(portable, home)
    assert destination.read_bytes() == b"sqlite-demo"
