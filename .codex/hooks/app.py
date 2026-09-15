"""Format, type-check and build production Fathom at turn completion."""

from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess


def main():
    root = Path(__file__).resolve().parents[2]
    app = root / "app"
    if not (app / "main.ts").exists():
        print("{}")
        return
    evidence = root / ".codex" / "verification" / "app.json"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    checks = []

    def record(status, error=None):
        temporary = evidence.with_suffix(".tmp")
        temporary.write_text(json.dumps({
            "status": status,
            "finishedAt": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
            "error": error,
        }, indent=2) + "\n")
        temporary.replace(evidence)

    record("running")
    mise = shutil.which("mise") or str(Path.home() / ".local/bin/mise")
    try:
        for command in (["deno", "fmt", "sdk", "kernel", "plugins", "server", "ui", "scripts", "examples", "main.ts", "vite.config.ts", "deno.json"], ["deno", "task", "check"], ["deno", "task", "build"]):
            result = subprocess.run(
                [mise, "exec", "--", *command], cwd=app,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, timeout=100,
            )
            checks.append({"command": command, "exitCode": result.returncode})
            if result.returncode:
                raise RuntimeError(result.stdout[-18000:])
        record("passed")
        print("{}")
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
        record("failed", str(error))
        print(json.dumps({"decision": "block", "reason": "Fathom completion check failed. Fix the errors; the lifecycle hook retries automatically.\n" + str(error)}))


if __name__ == "__main__":
    main()
