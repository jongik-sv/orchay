"""WezTerm Pane 레이아웃 관리.

복잡한 pane 분할 로직을 캡슐화하여 테스트 가능하고 재사용 가능한 인터페이스를 제공합니다.
"""

from __future__ import annotations

import logging
import shlex
import subprocess
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from orchay.models.config import WorkerCommandConfig


class SubprocessRunner(Protocol):
    """subprocess 실행 프로토콜 (테스트용 추상화)."""

    def run(self, cmd: list[str]) -> tuple[int, str, str]:
        """명령 실행 후 (returncode, stdout, stderr) 반환."""
        ...


class RealSubprocessRunner:
    """실제 subprocess 실행 구현."""

    def run(self, cmd: list[str]) -> tuple[int, str, str]:
        """subprocess.run으로 명령 실행."""
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode, result.stdout, result.stderr


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

    @property
    def total_workers(self) -> int:
        """총 Worker 수 반환."""
        return len(self.all_pane_ids)


class PaneLayoutManager:
    """WezTerm pane 레이아웃 생성 관리자.

    복잡한 중첩 로직을 간결한 인터페이스로 추상화합니다.
    """

    def __init__(
        self,
        cwd: str,
        worker_command_config: WorkerCommandConfig,
        runner: SubprocessRunner | None = None,
        wezterm_cmd: str = "wezterm",
        logger: logging.Logger | None = None,
    ):
        """PaneLayoutManager 초기화.

        Args:
            cwd: 작업 디렉토리
            worker_command_config: Worker 명령어 설정
            runner: subprocess 실행기 (테스트용, 기본값: RealSubprocessRunner)
            wezterm_cmd: wezterm 실행 파일 경로
            logger: 로거 인스턴스
        """
        self.cwd = cwd
        self.worker_command = worker_command_config
        self.runner = runner or RealSubprocessRunner()
        self.wezterm_cmd = wezterm_cmd
        self.log = logger or logging.getLogger(__name__)
        self._worker_num = 1

    def create_layout(self, layout: list[int]) -> LayoutResult:
        """레이아웃에 따라 pane 생성.

        Args:
            layout: 각 열의 Worker 수 (예: [3, 2] = 1열 3개, 2열 2개)

        Returns:
            LayoutResult with column information
        """
        result = LayoutResult()

        if not layout:
            result.success = False
            result.errors.append("Empty layout configuration")
            return result

        # Phase 1: 각 열의 첫 번째 pane 생성 (수평 분할)
        column_first_panes: list[int] = []

        for col_idx in range(len(layout)):
            pane_result = self._create_column_first_pane(col_idx, column_first_panes)

            if not pane_result.success or pane_result.pane_id is None:
                result.success = False
                result.errors.append(
                    pane_result.error_message or f"Column {col_idx} creation failed"
                )
                return result

            column_first_panes.append(pane_result.pane_id)
            result.column_panes.append([pane_result.pane_id])

        # Phase 2: 각 열 내에서 수직 분할
        for col_idx, workers_in_col in enumerate(layout):
            if col_idx >= len(result.column_panes):
                break

            current_pane_id = column_first_panes[col_idx]

            for row in range(1, workers_in_col):
                remaining = workers_in_col - row
                pane_result = self._create_vertical_pane(current_pane_id, remaining)

                if pane_result.success and pane_result.pane_id is not None:
                    result.column_panes[col_idx].append(pane_result.pane_id)
                    current_pane_id = pane_result.pane_id
                else:
                    result.errors.append(
                        pane_result.error_message
                        or f"Vertical pane creation failed at col {col_idx}, row {row}"
                    )
                    # 에러가 발생해도 계속 진행 (부분 레이아웃 허용)

        return result

    def _get_startup_cmd_parts(self) -> list[str]:
        """현재 Worker의 startup 명령어 파츠 반환."""
        startup_cmd = self.worker_command.get_startup_for_worker(self._worker_num)
        self.log.info(f"Worker {self._worker_num}: startup={startup_cmd}")
        self._worker_num += 1
        return shlex.split(startup_cmd)

    def _create_column_first_pane(
        self,
        col_idx: int,
        existing_first_panes: list[int],
    ) -> PaneCreationResult:
        """열의 첫 번째 pane 생성 (수평 분할).

        Args:
            col_idx: 열 인덱스
            existing_first_panes: 이전 열들의 첫 번째 pane ID 목록

        Returns:
            PaneCreationResult
        """
        startup_parts = self._get_startup_cmd_parts()

        if col_idx == 0:
            target_pane = "0"
        else:
            target_pane = str(existing_first_panes[col_idx - 1])

        cmd = [
            self.wezterm_cmd,
            "cli",
            "split-pane",
            "--right",
            "--pane-id",
            target_pane,
            "--cwd",
            self.cwd,
            "--",
            *startup_parts,
        ]

        return self._run_split_command(cmd, f"column {col_idx}")

    def _create_vertical_pane(
        self,
        target_pane_id: int,
        remaining: int,
    ) -> PaneCreationResult:
        """열 내에서 수직 분할.

        Args:
            target_pane_id: 분할할 pane ID
            remaining: 남은 행 수 (비율 계산용)

        Returns:
            PaneCreationResult
        """
        startup_parts = self._get_startup_cmd_parts()
        percent = int(remaining / (remaining + 1) * 100)

        cmd = [
            self.wezterm_cmd,
            "cli",
            "split-pane",
            "--bottom",
            "--percent",
            str(percent),
            "--pane-id",
            str(target_pane_id),
            "--cwd",
            self.cwd,
            "--",
            *startup_parts,
        ]

        return self._run_split_command(cmd, f"vertical at pane {target_pane_id}")

    def _run_split_command(self, cmd: list[str], context: str) -> PaneCreationResult:
        """split-pane 명령 실행.

        Args:
            cmd: 실행할 명령 리스트
            context: 로그용 컨텍스트 설명

        Returns:
            PaneCreationResult
        """
        self.log.debug(f"Split command ({context}): {cmd}")
        returncode, stdout, stderr = self.runner.run(cmd)

        if returncode != 0:
            error_msg = f"Pane creation failed ({context}): {stderr}"
            self.log.error(error_msg)
            self.log.error(f"  Command: {' '.join(cmd)}")
            self.log.error(f"  Return code: {returncode}")
            return PaneCreationResult(pane_id=None, success=False, error_message=error_msg)

        try:
            pane_id = int(stdout.strip())
            self.log.debug(f"Created pane {pane_id} ({context})")
            return PaneCreationResult(pane_id=pane_id, success=True)
        except ValueError:
            error_msg = f"pane ID 파싱 실패 ({context}): {stdout}"
            self.log.error(error_msg)
            return PaneCreationResult(pane_id=None, success=False, error_message=error_msg)

    def log_worker_panes(self, result: LayoutResult) -> None:
        """Worker pane 정보 로그 출력.

        Args:
            result: 레이아웃 생성 결과
        """
        worker_num = 1
        for col_panes in result.column_panes:
            for pane_id in col_panes:
                self.log.info(f"Worker {worker_num}: pane {pane_id}")
                worker_num += 1
