"""Firewall helpers shared by the Weight Data Manager launcher.

The separate First Time Setup.exe was removed from the release; these helpers
run from the main EXE on first launch when needed.
"""
from __future__ import annotations

import ctypes
import subprocess
import sys

RULE = "Weight Data Manager TCP 8000"
PORT = "8000"
IT_ASSISTANCE_MESSAGE = (
    "Network setup requires IT assistance.\n\n"
    "Ask IT to allow inbound TCP port 8000 for Domain and Private networks only "
    "on this Host PC. Weight Data Manager never disables Windows Firewall."
)


def rule_exists(rule_name: str = RULE) -> bool:
    """Return True when an inbound rule with this display name already exists."""
    if sys.platform != "win32":
        return False
    completed = subprocess.run(
        ["netsh", "advfirewall", "firewall", "show", "rule", f"name={rule_name}"],
        capture_output=True,
        text=True,
        check=False,
    )
    output = (completed.stdout or "") + (completed.stderr or "")
    if completed.returncode != 0:
        return False
    if "No rules match" in output:
        return False
    return rule_name.lower() in output.lower()


def add_rule_command(rule_name: str = RULE, port: str = PORT) -> str:
    return (
        f'netsh advfirewall firewall add rule name="{rule_name}" '
        f"dir=in action=allow protocol=TCP localport={port} profile=domain,private"
    )


def request_firewall_rule() -> str:
    """
    Attempt to ensure the inbound rule exists.

    Returns one of: already_configured, elevation_denied, pending_verify, unsupported.
    """
    if sys.platform != "win32":
        return "unsupported"
    try:
        if rule_exists():
            return "already_configured"
    except OSError:
        pass
    command = add_rule_command()
    result = ctypes.windll.shell32.ShellExecuteW(None, "runas", "cmd.exe", f"/c {command}", None, 1)
    if result <= 32:
        return "elevation_denied"
    return "pending_verify"


def verify_rule_present(timeout_seconds: float = 0) -> bool:
    """Re-check the firewall rule. Optional short wait is handled by the caller."""
    try:
        return rule_exists()
    except OSError:
        return False
