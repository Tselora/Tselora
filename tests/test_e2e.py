from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def test_simple_agent_end_to_end(tmp_path: Path) -> None:
    port = _free_port()
    url = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env["TSELOA_DATA_DIR"] = str(tmp_path)
    env["TSELOA_COLLECTOR_URL"] = url
    env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1])

    server = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "server.collector.app:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=str(Path(__file__).resolve().parents[1]),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                if httpx.get(f"{url}/health", timeout=0.5).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.05)
        else:
            err = server.stderr.read().decode() if server.stderr else ""
            pytest.fail(f"collector did not start: {err}")

        example = Path(__file__).resolve().parents[1] / "examples" / "simple_agent.py"
        completed = subprocess.run(
            [sys.executable, str(example)],
            cwd=str(Path(__file__).resolve().parents[1]),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        assert completed.returncode == 0, completed.stdout + completed.stderr
        assert "run_id=" in completed.stdout
        run_id = completed.stdout.split("run_id=", 1)[1].splitlines()[0].strip()

        log = tmp_path / "runs" / run_id / "events.jsonl"
        assert log.is_file()
        events = [json.loads(line) for line in log.read_text().splitlines() if line]
        types = [e["type"] for e in events]
        assert types == [
            "run.started",
            "tool.started",
            "tool.completed",
            "run.completed",
        ]
        assert {e["run_id"] for e in events} == {run_id}
        seqs = [e["sequence"] for e in events]
        assert seqs == sorted(seqs)
        assert seqs == list(range(1, 5))
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
