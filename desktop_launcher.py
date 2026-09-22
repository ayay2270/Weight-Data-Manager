"""One-click Windows launcher for the shared Weight Data Manager server."""
from __future__ import annotations

import ctypes
import json
import os
import shutil
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from first_time_setup import (
    IT_ASSISTANCE_MESSAGE,
    request_firewall_rule,
    rule_exists,
    verify_rule_present,
)

APP_NAME = "Weight Data Manager"
PORT = int(os.getenv("WDM_PORT", "8000"))
APPDATA_FOLDER = "Weight Data Manager"
SETUP_MARKER = "network_setup.done"


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


def best_department_url(hostname: str | None = None, ip: str | None = None, port: int = PORT) -> str:
    """Prefer hostname URL; fall back to LAN IP when hostname is unavailable."""
    host = (hostname if hostname is not None else socket.gethostname()).strip()
    if host:
        return primary_url(host, port)
    return fallback_url(ip, port)


def setup_marker_path(home: Path) -> Path:
    return home / SETUP_MARKER


def mark_setup_handled(home: Path) -> None:
    setup_marker_path(home).write_text("done\n", encoding="utf-8")


def setup_already_handled(home: Path) -> bool:
    return setup_marker_path(home).exists()


def needs_first_time_network_setup(home: Path) -> bool:
    """Show the one-shot setup panel only when the firewall rule is missing and never handled."""
    if sys.platform != "win32":
        return False
    try:
        if rule_exists():
            mark_setup_handled(home)
            return False
    except OSError:
        pass
    return not setup_already_handled(home)


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
        self.server_started = False
        self.database_detail = "Database: checking…"
        self.backup_detail = "Backup: checking…"
        self.firewall_detail = "Firewall: checking…"
        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("560x320")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.stop)
        self.system_status = tk.StringVar(value="Starting…")
        self.message = tk.StringVar(value="")
        self.hostname_url = primary_url()
        self.ip_url = fallback_url()
        self.department_url = best_department_url()
        self.local_url = f"http://127.0.0.1:{PORT}"
        self.outer = tk.Frame(self.root, padx=28, pady=22)
        self.outer.pack(fill="both", expand=True)
        self.main_frame = None
        self.setup_frame = None
        self.details_frame = None
        self.details_label = None
        self.details_button = None
        self.buttons_frame = None
        if needs_first_time_network_setup(self.home):
            self._build_setup_window()
        else:
            self._build_main_window()
            self._begin_server()

    def _clear_outer(self):
        for child in self.outer.winfo_children():
            child.destroy()
        self.main_frame = None
        self.setup_frame = None
        self.details_frame = None
        self.details_label = None
        self.details_button = None
        self.buttons_frame = None
        self.details_visible = False

    def _build_setup_window(self):
        import tkinter as tk

        self._clear_outer()
        self.root.geometry("560x280")
        self.setup_frame = tk.Frame(self.outer)
        self.setup_frame.pack(fill="both", expand=True)
        tk.Label(self.setup_frame, text=APP_NAME, font=("Segoe UI", 20, "bold")).pack(anchor="w")
        tk.Label(
            self.setup_frame,
            text="First-time network setup is required.",
            font=("Segoe UI", 12, "bold"),
            fg="#1f5f93",
        ).pack(anchor="w", pady=(16, 8))
        tk.Label(
            self.setup_frame,
            text=(
                "Colleagues need an inbound firewall allow rule for TCP port 8000 "
                "on Domain and Private networks only. Windows may ask for administrator approval."
            ),
            wraplength=500,
            justify="left",
            fg="#526173",
        ).pack(anchor="w", pady=(0, 18))
        buttons = tk.Frame(self.setup_frame)
        buttons.pack(anchor="e", fill="x")
        tk.Button(buttons, text="Start Setup", command=self._start_network_setup, padx=14).pack(side="right")

    def _start_network_setup(self):
        from tkinter import messagebox

        outcome = request_firewall_rule()
        if outcome == "already_configured":
            mark_setup_handled(self.home)
            self.firewall_detail = "Firewall: rule already present"
            self._finish_setup_and_launch()
            return
        if outcome in {"elevation_denied", "unsupported"}:
            mark_setup_handled(self.home)
            self.firewall_detail = "Firewall: IT assistance required"
            messagebox.showwarning(APP_NAME, IT_ASSISTANCE_MESSAGE)
            self._finish_setup_and_launch()
            return
        # pending_verify — UAC accepted; wait briefly then re-check
        self.root.after(1500, self._verify_network_setup)

    def _verify_network_setup(self):
        from tkinter import messagebox

        if verify_rule_present():
            mark_setup_handled(self.home)
            self.firewall_detail = "Firewall: rule configured"
            self._finish_setup_and_launch()
            return
        mark_setup_handled(self.home)
        self.firewall_detail = "Firewall: IT assistance required"
        messagebox.showwarning(APP_NAME, IT_ASSISTANCE_MESSAGE)
        self._finish_setup_and_launch()

    def _finish_setup_and_launch(self):
        self._build_main_window()
        self._begin_server()

    def _build_main_window(self):
        import tkinter as tk

        self._clear_outer()
        self.root.geometry("560x320")
        self.main_frame = tk.Frame(self.outer)
        self.main_frame.pack(fill="both", expand=True)

        tk.Label(self.main_frame, text=APP_NAME, font=("Segoe UI", 20, "bold")).pack(anchor="w")
        tk.Label(
            self.main_frame,
            textvariable=self.system_status,
            fg="#1f5f93",
            font=("Segoe UI", 13, "bold"),
        ).pack(anchor="w", pady=(14, 12))

        actions = tk.Frame(self.main_frame)
        actions.pack(anchor="w", pady=(0, 14))
        tk.Button(actions, text="Open", command=self.open_app, width=10, padx=8).pack(side="left", padx=(0, 8))
        tk.Button(actions, text="Copy Link", command=self.copy_link, width=12, padx=8).pack(side="left")

        tk.Label(
            self.main_frame,
            text="Keep this window open while colleagues are using the system.\nClosing it stops the shared server.",
            justify="left",
            fg="#334155",
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(0, 10))

        tk.Label(self.main_frame, textvariable=self.message, fg="#1f5f93", font=("Segoe UI", 9)).pack(anchor="w")

        self.details_frame = tk.Frame(self.main_frame)
        self.details_label = tk.Label(
            self.details_frame,
            text=self._details_text(),
            justify="left",
            wraplength=500,
            fg="#526173",
            font=("Segoe UI", 9),
        )
        self.details_label.pack(anchor="w")

        self.buttons_frame = tk.Frame(self.main_frame)
        self.buttons_frame.pack(anchor="e", fill="x", pady=(16, 0))
        self.details_button = tk.Button(
            self.buttons_frame, text="Show Details", command=self.toggle_details, padx=10
        )
        self.details_button.pack(side="left")
        tk.Button(self.buttons_frame, text="Stop", command=self.stop, padx=12).pack(side="right")

    def _details_text(self) -> str:
        return (
            f"Status: {self.system_status.get()}\n"
            f"{self.database_detail}\n"
            f"{self.backup_detail}\n"
            f"{self.firewall_detail}\n"
            f"Department URL: {self.department_url}\n"
            f"Hostname URL: {self.hostname_url}\n"
            f"Fallback IP: {self.ip_url}\n"
            f"Port: {PORT}\n"
            f"Local URL: {self.local_url}\n"
            f"Data folder: {self.data_dir}\n"
            f"Backup folder: {self.backup_dir}\n"
            f"Log file: {self.log_dir / 'server.log'}\n"
            f"Listen: 0.0.0.0:{PORT} (uvicorn / FastAPI)\n"
            f"Database engine: SQLite"
        )

    def _refresh_details(self):
        if self.details_label is not None:
            self.details_label.configure(text=self._details_text())

    def toggle_details(self):
        if self.details_frame is None or self.buttons_frame is None or self.details_button is None:
            return
        if self.details_visible:
            self.details_frame.pack_forget()
            self.details_button.configure(text="Show Details")
            self.details_visible = False
            self.root.geometry("560x320")
        else:
            self._refresh_details()
            self.details_frame.pack(fill="x", pady=(8, 0), before=self.buttons_frame)
            self.details_button.configure(text="Hide Details")
            self.details_visible = True
            self.root.geometry("560x520")

    def copy_link(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.department_url)
        self.message.set("Link copied. Share it with department colleagues.")

    def open_app(self):
        webbrowser.open(self.department_url)

    def _begin_server(self):
        if self.server_started:
            return
        self.server_started = True
        self.system_status.set("Starting…")
        try:
            if sys.platform == "win32" and rule_exists():
                self.firewall_detail = "Firewall: rule present"
            elif sys.platform == "win32":
                self.firewall_detail = "Firewall: rule not detected"
            else:
                self.firewall_detail = "Firewall: not applicable"
        except OSError:
            self.firewall_detail = "Firewall: status unknown"
        self.server_thread = threading.Thread(target=self.serve, daemon=True)
        self.server_thread.start()
        threading.Thread(target=self.ready, daemon=True).start()

    def ready(self):
        for _ in range(50):
            try:
                with urllib.request.urlopen(f"{self.local_url}/health", timeout=1) as response:
                    if response.status == 200:
                        payload = json.loads(response.read().decode("utf-8"))
                        database_ok = payload.get("database") == "ok"
                        from app.launch_backup import backup_if_due

                        try:
                            backup = backup_if_due(keep=30)
                            if backup:
                                self.backup_detail = "Backup OK — daily backup completed and verified."
                            else:
                                self.backup_detail = "Backup OK — already completed today."
                        except Exception as exc:  # noqa: BLE001
                            self.backup_detail = "Backup issue — see log under Show Details."
                            print(f"Backup failed: {exc}")

                        self.database_detail = "Database OK" if database_ok else "Database issue"
                        self.system_status.set("● Running")
                        self.message.set("Dashboard opened in your browser.")
                        self._refresh_details()
                        webbrowser.open(self.department_url)
                        return
            except Exception:
                time.sleep(0.2)
        self.system_status.set("Could not start")
        self.database_detail = "Database: unavailable"
        self.backup_detail = "Backup: not run"
        self.message.set("See Show Details for the log location.")
        self._refresh_details()
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
        webbrowser.open(best_department_url())
        sys.exit(0)
    Launcher().run()
