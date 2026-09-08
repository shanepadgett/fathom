"""Apply Markdown fixes at Stop; continue the agent only on remaining failures."""

import json
from pathlib import Path
import shutil
import subprocess


def main():
    root = Path(__file__).resolve().parents[2]
    mise = shutil.which("mise")
    if not mise:
        local_mise = Path.home() / ".local/bin/mise"
        mise = str(local_mise) if local_mise.is_file() else "mise"
    try:
        result = subprocess.run(
            [mise, "run", "lint:markdown"],
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=50,
        )
        if result.returncode == 0:
            print("{}")
            return
        failure = result.stdout[-12000:]
    except (OSError, subprocess.TimeoutExpired) as error:
        failure = str(error)
    print(json.dumps({
        "decision": "block",
        "reason": (
            "The repository Markdown hook failed after attempting automatic fixes. "
            "Resolve the remaining errors below. The Stop hook will retry automatically; "
            "do not run it manually. If blocked by missing tools or an external issue, "
            "report the blocker and request user help.\n\n" + failure
        ),
    }))


if __name__ == "__main__":
    main()
