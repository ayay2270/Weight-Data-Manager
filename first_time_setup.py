"""One-time optional Windows Firewall setup for the department host PC."""
from __future__ import annotations

import ctypes
import subprocess
import sys

RULE = "Weight Data Manager TCP 8000"
PORT = "8000"


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


def run_gui() -> None:
    import tkinter as tk
    from tkinter import messagebox

    root = tk.Tk()
    root.title("Weight Data Manager — First Time Setup")
    root.geometry("580x300")
    root.resizable(False, False)

    def verify_after_add() -> None:
        try:
            ok = rule_exists()
        except OSError:
            ok = False
        if ok:
            messagebox.showinfo(
                "First Time Setup",
                "Success: inbound TCP 8000 is allowed for Domain and Private networks.\n\n"
                "Start Weight Data Manager and test the Department URL from one colleague's browser.",
            )
        else:
            messagebox.showwarning(
                "First Time Setup",
                "The administrator prompt finished, but the firewall rule was not found.\n\n"
                "Ask IT for assistance. They can add an inbound allow rule for TCP 8000 "
                "on Domain and Private profiles only. This tool never disables Windows Firewall.",
            )

    def configure_firewall() -> None:
        outcome = request_firewall_rule()
        if outcome == "unsupported":
            messagebox.showwarning(
                "First Time Setup",
                "Firewall setup is only available on Windows. Ask IT to allow inbound TCP 8000 "
                "for Domain and Private networks.",
            )
            return
        if outcome == "already_configured":
            messagebox.showinfo(
                "First Time Setup",
                "Success: the firewall rule is already configured.\n\n"
                "No change was made. You can start Weight Data Manager and test from a colleague's browser.",
            )
            return
        if outcome == "elevation_denied":
            messagebox.showwarning(
                "First Time Setup",
                "Windows did not approve the firewall change.\n\n"
                "Ask IT to allow inbound TCP port 8000 for Domain and Private networks on this Host PC.\n"
                "Weight Data Manager does not disable Windows Firewall.",
            )
            return
        root.after(1500, verify_after_add)

    frame = tk.Frame(root, padx=28, pady=24)
    frame.pack(fill="both", expand=True)
    tk.Label(frame, text="First Time Setup", font=("Segoe UI", 18, "bold")).pack(anchor="w")
    tk.Label(
        frame,
        text="Run this only once on the Host PC if colleagues need to open the shared department URL.",
        wraplength=520,
        justify="left",
    ).pack(anchor="w", pady=(10, 12))
    tk.Label(
        frame,
        text=(
            "This checks for an existing rule, then asks Windows for administrator permission "
            "to allow inbound TCP port 8000 on Domain and Private networks only. "
            "It does not create duplicate rules and does not disable Windows Firewall."
        ),
        wraplength=520,
        justify="left",
        fg="#526173",
    ).pack(anchor="w", pady=(0, 18))
    buttons = tk.Frame(frame)
    buttons.pack(anchor="e")
    tk.Button(buttons, text="Close", command=root.destroy, padx=16).pack(side="left", padx=6)
    tk.Button(buttons, text="Configure Firewall", command=configure_firewall, padx=16).pack(side="right")
    root.mainloop()


if __name__ == "__main__":
    run_gui()
