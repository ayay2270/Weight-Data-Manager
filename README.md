# Weight Data Manager — One-click Department Deployment

Weight Data Manager is a department-shared web application. One designated Windows Host PC runs the application; everyone else uses Edge or Chrome and sees the same central data.

## Release folder

After `build_release.bat`, deploy the folder `dist\Weight Data Manager`. Its outer layer is intentionally simple:

```text
Weight Data Manager.exe
First Time Setup.exe
README.md
_internal\          (required PyInstaller runtime — do not delete)
```

Do not hand-edit files inside `_internal`. Operational data is **not** stored in this folder by default.

## Normal daily use (Host PC)

1. Double-click `Weight Data Manager.exe`.
2. Keep the small status window open — closing it stops the shared server.
3. Confirm **System Running**, **Database OK**, and **Backup OK**.
4. The Dashboard opens in the default browser. Use **Open** anytime, or **Copy** to share the **Department URL** (`http://HOSTNAME:8000`).
5. If a colleague's PC cannot resolve the hostname, share the **Fallback** IP address shown on the status window.

Normal users do not run PowerShell, BAT files, Python, or manual backups. Technical paths and listen details stay under **Show Details**.

The Host PC must stay powered on, on the company network, and awake while colleagues are using the system.

## First deployment only

1. Copy the entire release folder to a stable local path on the Host PC, for example `C:\DepartmentApps\Weight Data Manager`.
2. Double-click `First Time Setup.exe` once.
3. Click **Configure Firewall** and approve the administrator prompt. The tool checks for an existing rule first and does not create duplicates. If company policy blocks the change, ask IT to allow inbound TCP 8000 for Domain and Private networks only.
4. Double-click `Weight Data Manager.exe`.
5. From one colleague's PC on the same company network, open the Department URL from the status window.

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
- Colleagues cannot connect: same company network, and the one-time firewall rule must exist.
- Hostname URL fails on another PC: use the Fallback IP and ask IT about internal hostname resolution.
- Details and log path: click **Show Details** on the status window.
- Port 8000 must be free.

## Development and rebuild (maintainers)

```text
setup_server.bat      create .venv and install requirements
run_tests.bat         pytest
build_release.bat     rebuild both EXEs via the .spec files into dist\Weight Data Manager
start_server.bat      developer server without the Tk launcher
```

Windows is required to produce the release EXEs (PyInstaller + Tk + firewall helper). On Linux CI or Cloud Agent hosts, run tests and keep scripts current; document that EXE rebuild needs a Windows maintainer machine.

Version 1 intentionally does not include login, SSO, roles, Docker, cloud deployment, Teams/email notification, PLM/BOM integration, or CAE calculations.
