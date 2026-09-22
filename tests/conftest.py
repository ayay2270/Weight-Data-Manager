import os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TEST_DB=ROOT/"data"/"test_weight_manager.db"
for suffix in ["","-wal","-shm"]:
    Path(str(TEST_DB)+suffix).unlink(missing_ok=True)
os.environ["DATABASE_URL"]=f"sqlite:///{TEST_DB.as_posix()}"
os.environ["POLL_SECONDS"]="1"

import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c: yield c

@pytest.fixture(scope="session")
def client_b():
    with TestClient(app) as c: yield c

def pytest_sessionfinish(session, exitstatus):
    from app.database import engine
    engine.dispose()
