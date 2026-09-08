import os
import subprocess

env = dict(os.environ, MISE_NODE_VERSION="24.12.0")

def browser(*args, source=None):
    result = subprocess.run(["agent-browser", *args], input=source, text=True,
                            capture_output=True, env=env)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout

