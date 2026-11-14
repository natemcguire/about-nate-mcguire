"""Upload site/ to Cloudflare Pages. Run on the Mac mini. Never prints credentials.

    python3 deploy.py                      # production (natemcguire.com)
    python3 deploy.py --preview            # a preview URL, production untouched
"""
from pathlib import Path
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
KEYS = Path.home() / ".local/bin/keys"  # reads the macOS Keychain; no plaintext file

preview = "--preview" in sys.argv[1:]
env = os.environ.copy()
for name in ("CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL"):
    env.pop(name, None)
for line in subprocess.run([KEYS, "dotenv"], capture_output=True, text=True).stdout.splitlines():
    found = re.match(r"^(?:export\s+)?(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)\s*=\s*(.*)$", line)
    if found:
        env[found[1]] = found[2].strip().strip("\"'")
if not (env.get("CLOUDFLARE_API_TOKEN") and env.get("CLOUDFLARE_ACCOUNT_ID")):
    raise SystemExit("Cloudflare credentials not found in the Keychain (keys dotenv).")

commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
command = [
    "/opt/homebrew/bin/node", "/opt/homebrew/bin/wrangler", "pages", "deploy", "site",
    "--project-name", "natemcguire-v2",
    "--branch", "preview" if preview else "main",
    "--commit-dirty=true",
]
if commit:
    command += ["--commit-hash", commit]
raise SystemExit(subprocess.run(command, cwd=ROOT, env=env).returncode)
