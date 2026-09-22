# Weight Data Manager — One-click Department Deployment

Weight Data Manager is a department-shared web application. One designated Windows Host PC runs the application; everyone else uses Edge or Chrome and sees the same central data.

## Release folder

After `build_release.bat`, deploy the folder `dist\Weight Data Manager`. Outer layer:

```text
Weight Data Manager.exe
README.md
_internal\          (required PyInstaller onedir runtime — do not delete)
```

There is no separate First Time Setup executable. Network setup runs inside `Weight Data Manager.exe` on first launch only when needed. Operational data is **not** stored in this folder by default.

One-file packaging was evaluated and not used: onedir starts more reliably with templates/static assets and is easier for antivirus and upgrades.

## Normal daily use (Host PC)

1. Double-click `Weight Data Manager.exe`.
2. Keep the small status window open — closing it stops the shared server.
3. Confirm **● Running**.
4. Use **Open** or **Copy Link** for the Department URL (`http://HOSTNAME:8000`, with IP as fallback when needed).
5. Database, backup, firewall, paths, port, and server details stay under **Show Details**.

Normal users do not run PowerShell, BAT files, Python, or manual backups.

The Host PC must stay powered on, on the company network, and awake while colleagues are using the system.

## First launch (Host PC only)

1. Copy the entire release folder to a stable local path, for example `C:\DepartmentApps\Weight Data Manager`.
2. Double-click `Weight Data Manager.exe`.
3. If the firewall rule is already present, the app starts normally with no setup UI.
4. If the rule is missing, the window shows **First-time network setup is required.** Click **Start Setup** and approve the Windows administrator prompt. The app creates an inbound allow rule for TCP 8000 on Domain and Private networks only, then continues launching.
5. If company policy blocks the change, the app shows **Network setup requires IT assistance.** with the inbound TCP 8000 / Domain / Private requirement. Daily local use still continues; colleagues need IT to finish the rule.
6. Later launches never show the setup panel again.

Equivalent IT rule (optional central deployment):

```powershell
New-NetFirewallRule -DisplayName "Weight Data Manager TCP 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Domain,Private
```

Do not enable the Public profile unless company IT explicitly approves it. This product never disables Windows Firewall.

## Data and automatic backup

Frozen builds store operational files under:

```text
%LOCALAPPDATA%\Weight Data Manager\data\weight_manager.db
%LOCALAPPDATA%\Weight Data Manager\backups\weight_manager_YYYY-MM-DD_HHMMSS.db
%LOCALAPPDATA%\Weight Data Manager\logs\server.log
```

That keeps the department database safe when someone replaces the release folder during an upgrade. If an older install still has `data\weight_manager.db` beside the EXE and AppData does not yet have a database, the launcher copies it into AppData once on first start.

On the first successful start of each day, the launcher uses SQLite's online backup API, verifies the backup with `PRAGMA integrity_check`, and keeps the newest 30 backups. Same-day restarts do not create another backup.

For Host PC disk-failure protection, IT may copy the `backups` folder to an approved protected location. Do not put the live SQLite database on a shared network folder.

## Restore a backup

1. Close the Weight Data Manager status window and confirm the application has stopped.
2. Preserve the current `weight_manager.db` under another filename.
3. Copy the selected verified backup into `data\weight_manager.db` (under the AppData path above, unless you are on a developer checkout).
4. Start `Weight Data Manager.exe` and check the Dashboard and several records.

If `weight_manager.db-wal` or `weight_manager.db-shm` remains after shutdown, ask support to confirm no server process is running before restoring.

## Shared-operation behavior

- The Host listens on all interfaces, port 8000; browsers use one central SQLite database.
- List pages poll for updates approximately every seven seconds.
- Optimistic locking prevents silent overwrites.
- SQLite uses WAL mode, a busy timeout, and short transactions.
- Browser Local Storage remembers user names for audit fields (identification, not authentication).
- `/health` reports application and database status.

## Troubleshooting

- Local browser will not open: close all Weight Data Manager windows and start once more.
- Colleagues cannot connect: same company network, and the inbound TCP 8000 Domain/Private rule must exist (Ask IT if first-launch setup was blocked).
- Hostname URL fails on another PC: use the Fallback IP under **Show Details** and ask IT about internal hostname resolution.
- Details and log path: click **Show Details**.
- Port 8000 must be free.

## Official Windows build (maintainers)

Normal department use does **not** need local Python. The official Windows EXE is produced by GitHub Actions.

1. Push to `main`, or open **Actions** → **Build Windows** → **Run workflow**.
2. Wait for the latest successful run.
3. Open the run → **Artifacts** → download **Weight-Data-Manager-Windows**.
4. Unpack `Weight-Data-Manager-Windows.zip` and deploy the `Weight Data Manager` folder to the Host PC.

Department users only double-click `Weight Data Manager.exe`. First-launch firewall setup (if needed) runs inside that EXE via UAC — there is no separate setup EXE and no Python/BAT/PowerShell/CMD for daily use.

## Local rebuild (optional maintainers only)

Department Host PC users never use these steps.

**Sole local Windows build entry** (build machine with Python 3.11+ on PATH):

```text
build_release.bat
```

That script checks for Python, creates `.venv`, installs requirements + PyInstaller, and builds `dist\Weight Data Manager\`. If Python is missing it prints **BUILD FAILED**, exits non-zero, and does not claim success. It runs non-interactively (suitable for CI).

Optional maintainer checks after a successful local build (requires the `.venv` from `build_release.bat`):

```text
run_tests.bat
```

Developer server without the Tk launcher (maintainer Python checkout only):

```text
.venv\Scripts\python.exe start_server.py
```

Prefer the GitHub Actions artifact for department deployment. Local `build_release.bat` is for maintainers who need an offline rebuild.

Version 1 intentionally does not include login, SSO, roles, Docker, cloud deployment, Teams/email notification, PLM/BOM integration, or CAE calculations.
