"""One-click Windows launcher for the shared Weight Data Manager server."""
from __future__ import annotations

import ctypes
import os
import shutil
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

APP_NAME = "Weight Data Manager"
PORT = int(os.getenv("WDM_PORT", "8000"))
APPDATA_FOLDER = "Weight Data Manager"


def resource_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def portable_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def appdata_home() -> Path:
    return Path(os.getenv("LOCALAPPDATA", Path.home())) / APPDATA_FOLDER


def migrate_portable_data_if_needed(portable: Path, home: Path) -> None:
    """Copy an older beside-EXE database into AppData once, without overwriting."""
    source_db = portable / "data" / "weight_manager.db"
    destination_db = home / "data" / "weight_manager.db"
    if not source_db.exists() or destination_db.exists():
        return
    destination_db.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_db, destination_db)
    for suffix in ("-wal", "-shm"):
        side = Path(str(source_db) + suffix)
        if side.exists():
            shutil.copy2(side, Path(str(destination_db) + suffix))
    source_backups = portable / "backups"
    destination_backups = home / "backups"
    if source_backups.is_dir():
        destination_backups.mkdir(parents=True, exist_ok=True)
        for item in source_backups.glob("weight_manager_*.db"):
            target = destination_backups / item.name
            if not target.exists():
                shutil.copy2(item, target)


def app_home() -> Path:
    """Prefer LocalAppData for frozen installs so replacing the release folder keeps the DB."""
    if getattr(sys, "frozen", False):
        home = appdata_home()
        home.mkdir(parents=True, exist_ok=True)
        migrate_portable_data_if_needed(portable_dir(), home)
        return home
    return Path(__file__).resolve().parent


def copy_initial_workbook(data_dir: Path) -> None:
    destination = data_dir / "Weight Measurement Record_X01.xlsx"
    source = resource_dir() / "data" / "Weight Measurement Record_X01.xlsx"
    if not destination.exists() and source.exists():
        destination.write_bytes(source.read_bytes())


def lan_ip() -> str:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return probe.getsockname()[0]
    except OSError:
        return ""
    finally:
        probe.close()


def primary_url(hostname: str | None = None, port: int = PORT) -> str:
    return f"http://{hostname or socket.gethostname()}:{port}"


def fallback_url(ip: str | None = None, port: int = PORT) -> str:
    address = ip if ip is not None else lan_ip()
    return f"http://{address}:{port}" if address else "Network IP unavailable"


def acquire_single_instance() -> bool:
    if sys.platform != "win32":
        return True
    handle = ctypes.windll.kernel32.CreateMutexW(None, False, "Global\\WeightDataManagerLauncher")
    return not handle or ctypes.windll.kernel32.GetLastError() != 183


class Launcher:
    def __init__(self):
        import tkinter as tk

        os.chdir(resource_dir())
        self.home = app_home()
        self.log_dir = self.home / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_stream = None
        if getattr(sys, "frozen", False) or sys.stdout is None or sys.stderr is None:
            self.log_stream = (self.log_dir / "server.log").open("a", encoding="utf-8", buffering=1)
            sys.stdout = self.log_stream
            sys.stderr = self.log_stream
        self.data_dir = self.home / "data"
        self.backup_dir = self.home / "backups"
        self.data_dir.mkdir(exist_ok=True)
        self.backup_dir.mkdir(exist_ok=True)
        copy_initial_workbook(self.data_dir)
        os.environ["WDM_DATA_DIR"] = str(self.data_dir)
        os.environ["WDM_BACKUP_DIR"] = str(self.backup_dir)
        self.server = None
        self.server_thread = None
        self.details_visible = False
        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("620x430")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.stop)
        self.system_status = tk.StringVar(value="Starting…")
        self.database_status = tk.StringVar(value="Database: checking…")
        self.backup_status = tk.StringVar(value="Backup: checking…")
        self.message = tk.StringVar(value="")
        self.hostname_url = primary_url()
        self.ip_url = fallback_url()
        self.local_url = f"http://127.0.0.1:{PORT}"
        self._build_window()

    def _build_window(self):
        import tkinter as tk

        outer = tk.Frame(self.root, padx=28, pady=22)
        outer.pack(fill="both", expand=True)

        tk.Label(outer, text=APP_NAME, font=("Segoe UI", 20, "bold")).pack(anchor="w")
        tk.Label(
            outer,
            text="Department shared weight database",
            fg="#526173",
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(0, 14))

        tk.Label(
            outer,
            textvariable=self.system_status,
            fg="#1f5f93",
            font=("Segoe UI", 12, "bold"),
        ).pack(anchor="w")
        tk.Label(outer, textvariable=self.database_status, fg="#1f3d2f", font=("Segoe UI", 10)).pack(
            anchor="w", pady=(6, 0)
        )
        tk.Label(outer, textvariable=self.backup_status, fg="#1f3d2f", font=("Segoe UI", 10)).pack(
            anchor="w", pady=(2, 12)
        )

        url_block = tk.Frame(outer)
        url_block.pack(fill="x", pady=(0, 8))
        tk.Label(url_block, text="Department URL", font=("Segoe UI", 10, "bold")).pack(anchor="w")
        url_row = tk.Frame(url_block)
        url_row.pack(fill="x", pady=(4, 0))
        url_entry = tk.Entry(url_row, width=42, font=("Segoe UI", 10))
        url_entry.insert(0, self.hostname_url)
        url_entry.configure(state="readonly")
        url_entry.pack(side="left", padx=(0, 8))
        tk.Button(url_row, text="Open", command=self.open_app, width=8).pack(side="left", padx=(0, 6))
        tk.Button(url_row, text="Copy", command=self.copy_primary, width=8).pack(side="left")

        tk.Label(
            outer,
            text=f"Fallback: {self.ip_url}",
            fg="#526173",
            font=("Segoe UI", 9),
        ).pack(anchor="w", pady=(4, 10))

        tk.Label(
            outer,
            text="Keep this window open while colleagues are using the system.\nClosing it stops the shared server.",
            justify="left",
            fg="#334155",
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(0, 10))

        tk.Label(outer, textvariable=self.message, fg="#1f5f93", font=("Segoe UI", 9)).pack(anchor="w")

        self.details_frame = tk.Frame(outer)
        details_body = (
            f"Data folder: {self.data_dir}\n"
            f"Backup folder: {self.backup_dir}\n"
            f"Log file: {self.log_dir / 'server.log'}\n"
            f"Listen address: 0.0.0.0:{PORT} (uvicorn)\n"
            f"Database engine: SQLite\n"
            f"Local URL: {self.local_url}"
        )
        tk.Label(
            self.details_frame,
            text=details_body,
            justify="left",
            wraplength=560,
            fg="#526173",
            font=("Segoe UI", 9),
        ).pack(anchor="w")

        buttons = tk.Frame(outer)
        buttons.pack(anchor="e", fill="x", pady=(14, 0))
        self.buttons_frame = buttons
        self.details_button = tk.Button(buttons, text="Show Details", command=self.toggle_details, padx=10)
        self.details_button.pack(side="left")
        tk.Button(buttons, text="Stop Server", command=self.stop, padx=12).pack(side="right")

    def toggle_details(self):
        if self.details_visible:
            self.details_frame.pack_forget()
            self.details_button.configure(text="Show Details")
            self.details_visible = False
            self.root.geometry("620x430")
        else:
            self.details_frame.pack(fill="x", pady=(8, 0), before=self.buttons_frame)
            self.details_button.configure(text="Hide Details")
            self.details_visible = True
            self.root.geometry("620x560")

    def copy_primary(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.hostname_url)
        self.message.set("Department URL copied. Share it with department colleagues.")

    def open_app(self):
        webbrowser.open(self.local_url)

    def ready(self):
        for _ in range(50):
            try:
                with urllib.request.urlopen(f"{self.local_url}/health", timeout=1) as response:
                    if response.status == 200:
                        import json

                        payload = json.loads(response.read().decode("utf-8"))
                        database_ok = payload.get("database") == "ok"
                        from app.launch_backup import backup_if_due

                        try:
                            backup = backup_if_due(keep=30)
                            if backup:
                                backup_text = "Backup OK — daily backup completed and verified."
                            else:
                                backup_text = "Backup OK — already completed today."
                        except Exception as exc:  # noqa: BLE001 — surface friendly status only
                            backup_text = "Backup issue — see Show Details / log."
                            print(f"Backup failed: {exc}")

                        self.system_status.set("System Running")
                        self.database_status.set(
                            "Database OK" if database_ok else "Database issue"
                        )
                        self.backup_status.set(backup_text)
                        self.message.set("Dashboard opened in your browser.")
                        webbrowser.open(self.local_url)
                        return
            except Exception:
                time.sleep(0.2)
        self.system_status.set("Could not start")
        self.database_status.set("Database: unavailable")
        self.backup_status.set("Backup: not run")
        self.message.set("See Show Details for the log location, then contact support.")
        from tkinter import messagebox

        messagebox.showerror(
            APP_NAME,
            "The system did not start. Open Show Details for the log location, and share that log with support.",
        )

    def serve(self):
        import uvicorn
        from app.main import app

        config = uvicorn.Config(app, host="0.0.0.0", port=PORT, log_level="warning", reload=False)
        self.server = uvicorn.Server(config)
        self.server.run()

    def run(self):
        self.server_thread = threading.Thread(target=self.serve, daemon=True)
        self.server_thread.start()
        threading.Thread(target=self.ready, daemon=True).start()
        self.root.mainloop()

    def stop(self):
        import tkinter as tk

        if self.server:
            self.server.should_exit = True
        if self.server_thread and self.server_thread.is_alive():
            self.server_thread.join(timeout=5)
        try:
            self.root.destroy()
        except tk.TclError:
            pass


if __name__ == "__main__":
    if not acquire_single_instance():
        webbrowser.open(f"http://127.0.0.1:{PORT}")
        sys.exit(0)
    Launcher().run()
