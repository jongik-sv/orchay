"""Launcher 공통 헬퍼 함수.

Windows/Linux launcher 간 공유되는 유틸리티 함수들을 제공합니다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from orchay.models.config import LauncherConfig, WorkerCommandConfig


@dataclass
class LaunchResult:
    """WezTerm 실행 결과."""

    success: bool
    pid: int | None = None
    error_message: str | None = None


@dataclass
class PaneCreationResult:
    """Pane 생성 결과."""

    pane_id: int | None
    success: bool
    error_message: str | None = None


@dataclass
class LayoutResult:
    """레이아웃 생성 결과."""

    column_panes: list[list[int]] = field(default_factory=list)
    success: bool = True
    errors: list[str] = field(default_factory=list)

    @property
    def all_pane_ids(self) -> list[int]:
        """모든 pane ID를 플랫하게 반환."""
        return [pane_id for col in self.column_panes for pane_id in col]


def calculate_scheduler_ratio(scheduler_cols: int, worker_cols: int) -> float:
    """스케줄러 pane 비율 계산.

    Args:
        scheduler_cols: 스케줄러 pane 너비 (columns)
        worker_cols: Worker pane 너비 (columns)

    Returns:
        스케줄러 pane이 차지하는 비율 (0.0 ~ 1.0)
    """
    total = scheduler_cols + worker_cols
    if total == 0:
        return 0.45  # 기본값
    return round(scheduler_cols / total, 2)


def create_startup_config_dict(
    cwd: str,
    workers: int,
    scheduler_cmd: str,
    launcher_config: LauncherConfig,
    worker_command_config: WorkerCommandConfig,
) -> dict[str, Any]:
    """WezTerm startup config 딕셔너리 생성.

    Windows에서 gui-startup 이벤트에 전달할 JSON 설정을 생성합니다.

    Args:
        cwd: 현재 작업 디렉토리
        workers: Worker pane 수
        scheduler_cmd: 스케줄러 실행 명령
        launcher_config: Launcher 설정
        worker_command_config: Worker 명령어 설정

    Returns:
        JSON으로 직렬화할 설정 딕셔너리
    """
    # pane_startup의 키를 문자열로 변환 (JSON 호환)
    pane_startup_json: dict[str, str] = {
        str(k): v for k, v in worker_command_config.pane_startup.items()
    }

    return {
        "cwd": cwd,
        "workers": workers,
        "scheduler_cmd": scheduler_cmd,
        "width": launcher_config.width,
        "height": launcher_config.height,
        "max_rows": launcher_config.max_rows,
        "scheduler_ratio": calculate_scheduler_ratio(
            launcher_config.scheduler_cols, launcher_config.worker_cols
        ),
        "font_size": launcher_config.font_size,
        "worker_startup_cmd": worker_command_config.startup,
        "pane_startup": pane_startup_json,
    }


def track_new_pid(pids_before: set[int], pids_after: set[int]) -> int | None:
    """새로 생긴 wezterm-gui PID 찾기.

    Args:
        pids_before: 실행 전 PID 집합
        pids_after: 실행 후 PID 집합

    Returns:
        새로 생긴 PID (가장 큰 값) 또는 None
    """
    new_pids = pids_after - pids_before
    if new_pids:
        return max(new_pids)  # 가장 큰 것 = 가장 최근
    return None


def log_launch_start(logger: logging.Logger, workers: int, width: int, height: int) -> None:
    """실행 시작 로그 출력.

    Args:
        logger: 로거 인스턴스
        workers: Worker 수
        width: 창 너비
        height: 창 높이
    """
    logger.info("Starting WezTerm...")
    logger.info(f"  Workers: {workers}")
    logger.info(f"  Window: {width}x{height}")


def log_launch_completion(
    logger: logging.Logger,
    success: bool,
    method: str,
) -> None:
    """실행 완료 로그 출력.

    Args:
        logger: 로거 인스턴스
        success: 성공 여부
        method: 실행 방법 설명
    """
    logger.info("=" * 60)
    if success:
        logger.info(f"Launcher completed - {method}")
    else:
        logger.error(f"Launcher failed - {method}")
    logger.info("=" * 60)


def create_layout_config(workers: int, max_rows: int = 3) -> list[int]:
    """Worker 수에 따른 레이아웃 구성 반환.

    Args:
        workers: Worker pane 개수
        max_rows: 열당 최대 Worker 수

    Returns:
        각 열의 Worker 수 리스트 (예: [3, 2] = 1열 3개, 2열 2개)

    Examples:
        >>> create_layout_config(3, max_rows=3)
        [3]
        >>> create_layout_config(5, max_rows=3)
        [3, 2]
        >>> create_layout_config(6, max_rows=3)
        [3, 3]
    """
    if workers <= 0:
        return []

    # 최대 6개 worker만 지원
    workers = min(workers, 6)

    # 균형 분배 계산
    columns = (workers + max_rows - 1) // max_rows  # ceil(workers / max_rows)
    base_per_col = workers // columns
    extra = workers % columns

    layout = []
    for col in range(columns):
        if col < extra:
            layout.append(base_per_col + 1)
        else:
            layout.append(base_per_col)

    return layout
