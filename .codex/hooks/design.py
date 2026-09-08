"""Format and verify the design reference at turn completion."""

import json
from pathlib import Path
import shutil
import subprocess


def main():
    root = Path(__file__).resolve().parents[2]
    mise = shutil.which("mise") or str(Path.home() / ".local/bin/mise")
    try:
        for command in (["deno", "fmt"], ["deno", "task", "check"], ["deno", "task", "build"]):
            result = subprocess.run(
                [mise, "exec", "--", *command],
                cwd=root / "design",
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=50,
            )
            if result.returncode:
                raise RuntimeError(result.stdout[-12000:])
        print("{}")
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
        print(json.dumps({
            "decision": "block",
            "reason": "Design verification failed. Fix the errors; the Stop hook will retry automatically.\n" + str(error),
        }))


if __name__ == "__main__":
    main()
