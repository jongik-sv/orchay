"""작업 중 상태 파일 관리 모듈.

`.orchay/logs/orchay-active.json` 파일로 Worker 일시정지 및 스케줄러 상태를 관리합니다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict


class ActiveTasksData(TypedDict):
    """orchay-active.json 파일 구조."""

    pausedWorkers: list[int]  # 수동 일시정지된 Worker ID 목록
    schedulerState: str  # running, paused, stopped


def get_active_tasks_path() -> Path:
    """상태 파일 경로 반환."""
    return Path.cwd() / ".orchay" / "logs" / "orchay-active.json"


def _get_default_data() -> ActiveTasksData:
    """기본 데이터 반환."""
    return {
        "pausedWorkers": [],
        "schedulerState": "running",
    }


def load_active_tasks() -> ActiveTasksData:
    """상태 파일 로드."""
    path = get_active_tasks_path()
    if not path.exists():
        return _get_default_data()

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            # 기본값 보장
            if "pausedWorkers" not in data:
                data["pausedWorkers"] = []
            if "schedulerState" not in data:
                data["schedulerState"] = "running"
            return data
    except (json.JSONDecodeError, OSError):
        return _get_default_data()


def save_active_tasks(data: ActiveTasksData) -> None:
    """상태 파일 저장."""
    path = get_active_tasks_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# === Worker Pause/Resume 관리 ===


def pause_worker(worker_id: int) -> None:
    """Worker 수동 일시정지.

    Args:
        worker_id: Worker ID (1, 2, 3...)
    """
    data = load_active_tasks()
    paused = data.get("pausedWorkers", [])
    if worker_id not in paused:
        paused.append(worker_id)
        data["pausedWorkers"] = paused
        save_active_tasks(data)


def resume_worker(worker_id: int) -> None:
    """Worker 수동 일시정지 해제.

    Args:
        worker_id: Worker ID (1, 2, 3...)
    """
    data = load_active_tasks()
    paused = data.get("pausedWorkers", [])
    if worker_id in paused:
        paused.remove(worker_id)
        data["pausedWorkers"] = paused
        save_active_tasks(data)


def is_worker_paused(worker_id: int) -> bool:
    """Worker가 수동 일시정지 상태인지 확인.

    Args:
        worker_id: Worker ID

    Returns:
        일시정지 상태 여부
    """
    data = load_active_tasks()
    return worker_id in data.get("pausedWorkers", [])


def get_paused_workers() -> list[int]:
    """수동 일시정지된 Worker ID 목록 반환."""
    data = load_active_tasks()
    return data.get("pausedWorkers", [])


# === Scheduler State 관리 ===


def set_scheduler_state(state: str) -> None:
    """스케줄러 상태 설정.

    Args:
        state: running, paused, stopped 중 하나
    """
    data = load_active_tasks()
    data["schedulerState"] = state
    save_active_tasks(data)


def get_scheduler_state() -> str:
    """스케줄러 상태 반환.

    Returns:
        running, paused, stopped 중 하나
    """
    data = load_active_tasks()
    return data.get("schedulerState", "running")
