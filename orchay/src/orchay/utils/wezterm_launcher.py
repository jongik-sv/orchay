"""WezTerm Launcher 추상화.

플랫폼별 WezTerm 실행 로직을 Template Method 패턴으로 통합합니다.
"""

from __future__ import annotations

import json
import logging
import os
import shlex
import shutil
import subprocess
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from orchay.utils.launcher_helpers import (
    calculate_scheduler_ratio,
    create_startup_config_dict,
    log_launch_completion,
    log_launch_start,
    track_new_pid,
)
from orchay.utils.pane_layout import PaneLayoutManager

if TYPE_CHECKING:
    from orchay.models.config import Config


@dataclass
class LaunchContext:
    """WezTerm 실행 컨텍스트."""

    cwd: str
    workers: int
    orchay_cmd_list: list[str]
    config: Config
    logger: logging.Logger


class WeztermLauncher(ABC):
    """WezTerm launcher 추상 베이스 클래스.

    Template Method 패턴을 사용하여 공통 로직을 정의하고,
    플랫폼별 차이점을 추상 메서드로 위임합니다.
    """

    def __init__(self, context: LaunchContext):
        """WeztermLauncher 초기화.

        Args:
            context: 실행 컨텍스트
        """
        self.ctx = context
        self.log = context.logger
        self.launcher_config = context.config.launcher
        self.wezterm_cmd = "wezterm"

    def launch(self) -> int:
        """WezTerm 실행 (Template Method).

        Returns:
            종료 코드 (0: 성공)
        """
        # 1. 시작 로그
        log_launch_start(
            self.log,
            self.ctx.workers,
            self.launcher_config.width,
            self.launcher_config.height,
        )

        # 2. 시작 전 PID 기록
        pids_before = self._get_wezterm_pids()
        self.log.debug(f"WezTerm PIDs before launch: {pids_before}")

        # 3. 환경 설정
        env = self._prepare_environment()

        # 4. 플랫폼별 사전 작업
        self._pre_launch_setup()

        # 5. WezTerm 실행
        self._start_wezterm(env)

        # 6. 시작 대기
        self._wait_for_startup()

        # 7. 새 PID 추적 및 저장
        pids_after = self._get_wezterm_pids()
        self.log.debug(f"WezTerm PIDs after launch: {pids_after}")

        new_pid = track_new_pid(pids_before, pids_after)
        if new_pid:
            self._save_wezterm_pid(new_pid)
            self.log.info(f"WezTerm GUI started with PID: {new_pid}")
        else:
            self.log.warning("Could not detect new WezTerm GUI PID")

        # 8. 플랫폼별 후처리 (레이아웃 생성 등)
        result = self._post_launch_setup()

        # 9. 완료 로그
        log_launch_completion(self.log, result == 0, self._get_method_name())

        return result

    def _prepare_environment(self) -> dict[str, str]:
        """공통 환경 변수 설정."""
        env = os.environ.copy()
        env["WEZTERM_LOG"] = "warn"
        return env

    def _get_wezterm_pids(self) -> set[int]:
        """wezterm-gui PID 목록 조회."""
        # 순환 import 방지를 위해 지연 import
        from orchay.utils.process import _list_processes_sync

        processes = _list_processes_sync("wezterm-gui")
        return {p.pid for p in processes}

    def _save_wezterm_pid(self, pid: int) -> None:
        """WezTerm PID를 파일에 저장."""
        pid_file = Path(self.ctx.cwd) / ".orchay" / "logs" / "wezterm.pid"
        pid_file.parent.mkdir(parents=True, exist_ok=True)
        pid_file.write_text(str(pid))
        self.log.debug(f"Saved WezTerm PID {pid} to {pid_file}")

    def _get_bundled_file(self, filename: str) -> Path:
        """번들된 파일 경로 반환."""
        # orchay 패키지 루트 경로 (pyproject.toml 위치)
        # utils/wezterm_launcher.py → utils/ → orchay/ → src/ → orchay/ (패키지 루트)
        package_dir = Path(__file__).resolve().parent.parent.parent.parent
        return package_dir / filename

    @abstractmethod
    def _pre_launch_setup(self) -> None:
        """플랫폼별 사전 설정 (startup config 생성 등)."""
        pass

    @abstractmethod
    def _start_wezterm(self, env: dict[str, str]) -> None:
        """WezTerm 프로세스 시작."""
        pass

    @abstractmethod
    def _wait_for_startup(self) -> None:
        """시작 완료 대기."""
        pass

    @abstractmethod
    def _post_launch_setup(self) -> int:
        """플랫폼별 후처리 (레이아웃 생성, 명령 전송 등)."""
        pass

    @abstractmethod
    def _get_method_name(self) -> str:
        """로그용 메서드 이름."""
        pass


class WindowsLauncher(WeztermLauncher):
    """Windows 전용 WezTerm launcher.

    gui-startup 이벤트 방식을 사용합니다.
    Windows에서 CLI 소켓 연결 문제를 회피하기 위해 JSON 설정 파일로 레이아웃 정보를 전달합니다.

    참고: https://github.com/wezterm/wezterm/issues/4456
    """

    def _pre_launch_setup(self) -> None:
        """startup config 파일 생성."""
        config_dir = Path.home() / ".config" / "wezterm"
        config_dir.mkdir(parents=True, exist_ok=True)

        startup_file = config_dir / self.launcher_config.config_filename
        startup_dict = create_startup_config_dict(
            cwd=self.ctx.cwd,
            workers=self.ctx.workers,
            scheduler_cmd=" ".join(self.ctx.orchay_cmd_list),
            launcher_config=self.launcher_config,
            worker_command_config=self.ctx.config.worker_command,
        )

        with open(startup_file, "w", encoding="utf-8") as f:
            json.dump(startup_dict, f, ensure_ascii=False)

        self.log.info(f"Created startup config: {startup_file}")
        self.log.debug(f"  Config: {startup_dict}")

    def _start_wezterm(self, env: dict[str, str]) -> None:
        """gui-startup 이벤트 방식으로 WezTerm 시작."""
        config_file = self._get_bundled_file(self.launcher_config.lua_config_file)

        args = [
            self.wezterm_cmd,
            "--config-file",
            str(config_file),
            "start",
            "--cwd",
            self.ctx.cwd,
        ]

        self.log.debug(f"Popen: {args}")
        subprocess.Popen(
            args,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            env=env,
        )

    def _wait_for_startup(self) -> None:
        """Windows 시작 대기."""
        delay = self.launcher_config.startup_delay_windows
        self.log.debug(f"Waiting {delay}s for WezTerm startup...")
        time.sleep(delay)

    def _post_launch_setup(self) -> int:
        """Windows는 gui-startup 이벤트가 레이아웃 생성."""
        # Lua 스크립트가 레이아웃과 명령 전송을 처리함
        return 0

    def _get_method_name(self) -> str:
        return "WezTerm gui-startup will create layout"


class LinuxLauncher(WeztermLauncher):
    """Linux/macOS 전용 WezTerm launcher.

    CLI 방식을 사용하여 직접 pane을 생성합니다.
    """

    def _pre_launch_setup(self) -> None:
        """Linux는 사전 설정 불필요."""
        pass

    def _start_wezterm(self, env: dict[str, str]) -> None:
        """CLI 방식으로 WezTerm 시작."""
        subprocess.Popen(
            [self.wezterm_cmd],
            start_new_session=True,
            env=env,
        )

    def _wait_for_startup(self) -> None:
        """Linux 시작 대기."""
        delay = self.launcher_config.startup_delay_linux
        self.log.info(f"Waiting for WezTerm to start ({delay}s)...")
        time.sleep(delay)

    def _post_launch_setup(self) -> int:
        """CLI로 레이아웃 생성 및 스케줄러 명령 전송."""
        # 1. 창 크기 조절
        self._resize_window()

        # 2. 레이아웃 생성
        from orchay.utils.launcher_helpers import create_layout_config

        layout = create_layout_config(self.ctx.workers, self.launcher_config.max_rows)

        manager = PaneLayoutManager(
            cwd=self.ctx.cwd,
            worker_command_config=self.ctx.config.worker_command,
            wezterm_cmd=self.wezterm_cmd,
            logger=self.log,
        )

        result = manager.create_layout(layout)

        if not result.success:
            for err in result.errors:
                self.log.error(err)
            return 1

        # 3. Worker pane 로그
        manager.log_worker_panes(result)

        # 4. 스케줄러 명령 전송
        return self._send_scheduler_command()

    def _resize_window(self) -> None:
        """wmctrl로 창 크기 조절 (Linux 전용)."""
        if not shutil.which("wmctrl"):
            self.log.debug("wmctrl not found, skipping window resize")
            return

        cmd = [
            "wmctrl",
            "-r",
            ":ACTIVE:",
            "-e",
            f"0,0,0,{self.launcher_config.width},{self.launcher_config.height}",
        ]
        self.log.debug(f"Resize command: {cmd}")
        subprocess.run(cmd, capture_output=True, text=True)

    def _send_scheduler_command(self) -> int:
        """pane 0에 스케줄러 명령 전송."""
        time.sleep(1)  # 셸 초기화 대기

        orchay_cmd_str = " ".join(self.ctx.orchay_cmd_list)
        full_cmd = f"cd {shlex.quote(self.ctx.cwd)} && {orchay_cmd_str}\n"

        cmd = [
            self.wezterm_cmd,
            "cli",
            "send-text",
            "--pane-id",
            "0",
            "--no-paste",
            full_cmd,
        ]

        self.log.debug(f"Send text command: {cmd}")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            self.log.error(f"Error sending scheduler command: {result.stderr}")
            return 1

        self.log.info("Scheduler started successfully")
        return 0

    def _get_method_name(self) -> str:
        return "CLI layout creation completed"


def create_launcher(context: LaunchContext) -> WeztermLauncher:
    """플랫폼에 맞는 Launcher 인스턴스 생성.

    Args:
        context: 실행 컨텍스트

    Returns:
        플랫폼별 WeztermLauncher 인스턴스
    """
    import platform

    if platform.system() == "Windows":
        return WindowsLauncher(context)
    else:
        return LinuxLauncher(context)
