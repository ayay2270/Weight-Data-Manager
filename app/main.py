import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from . import __version__
from .config import BACKUP_DIR, BASE_DIR, DATA_DIR, settings
from .database import SessionLocal, init_db
from .routes import api, web
from .services.importer import import_excel


LOG_DIR = DATA_DIR.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "server.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)
app = FastAPI(title=settings.app_name, version=__version__)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "app" / "static")), name="static")
app.include_router(api.router)
app.include_router(web.router)


@app.on_event("startup")
def startup():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    sample = DATA_DIR / "Weight Measurement Record_X01.xlsx"
    if sample.exists():
        with SessionLocal() as db:
            try:
                result = import_excel(db, sample, "Initial Excel Import")
                logger.info("Initial sample import: %s", result)
            except Exception:
                logger.exception("Initial sample import failed")


@app.get("/health")
def health():
    try:
        from sqlalchemy import text
        with SessionLocal() as db: db.execute(text("SELECT 1"))
        database="ok"
    except Exception: database="error"
    return {"status":"ok" if database=="ok" else "degraded","database":database,"version":__version__}


@app.exception_handler(404)
async def not_found(request:Request,exc):
    return web.templates.TemplateResponse(request,"error.html",web.ctx(request,title="Not found",message="The requested page or record does not exist.",back_url="/"),status_code=404)


@app.exception_handler(Exception)
async def unexpected(request:Request,exc):
    logger.exception("Unhandled request error")
    return web.templates.TemplateResponse(request,"error.html",web.ctx(request,title="Something went wrong",message="The server could not complete this request. Details were written to server.log.",back_url="/"),status_code=500)

