import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("WDM_DATA_DIR", str(BASE_DIR / "data"))).resolve()
BACKUP_DIR = Path(os.getenv("WDM_BACKUP_DIR", str(DATA_DIR.parent / "backups"))).resolve()


class Settings(BaseSettings):
    app_name: str = "Weight Data Manager"
    app_version: str = "1.0.0"
    database_url: str = f"sqlite:///{(DATA_DIR / 'weight_manager.db').as_posix()}"
    poll_seconds: int = 7
    page_size: int = 25
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")


settings = Settings()

