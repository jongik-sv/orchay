"""프로세스 관리 유틸리티 (Phase 4.2).

Windows, Linux, macOS에서 동일하게 동작하는 프로세스 관리 기능을 제공합니다.
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
from dataclasses import dataclass

from orchay.utils.platform import is_windows

logger = logging.getLogger(__name__)


@dataclass
class ProcessInfo:
    """프로세스 정보."""

    pid: int
    name: str


async def list_processes(name: str) -> list[ProcessInfo]:
    """이름으로 프로세스 목록을 조회합니다.

    플랫폼별 구현:
    - Windows: tasklist /FI "IMAGENAME eq {name}" /FO CSV /NH
    - Linux/macOS: pgrep -f {name}

    Args:
        name: 검색할 프로세스 이름 (예: "wezterm-gui")

    Returns:
        ProcessInfo 목록
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _list_processes_sync, name)


def _list_processes_sync(name: str) -> list[ProcessInfo]:
    """프로세스 목록 조회 (동기 버전)."""
    processes: list[ProcessInfo] = []

    try:
        if is_windows():
            processes = _list_processes_windows(name)
        else:
            processes = _list_processes_unix(name)
    except Exception as e:
        logger.warning(f"프로세스 목록 조회 실패: {e}")

    return processes


def _list_processes_windows(name: str) -> list[ProcessInfo]:
    """Windows에서 프로세스 목록 조회."""
    processes: list[ProcessInfo] = []

    # .exe 확장자 추가 (없는 경우)
    search_name = name if name.endswith(".exe") else f"{name}.exe"

    result = subprocess.run(
        ["tasklist", "/FI", f"IMAGENAME eq {search_name}", "/FO", "CSV", "/NH"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=subprocess.CREATE_NO_WINDOW,  # type: ignore[attr-defined]
    )

    if result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if line and "," in line:
                parts = line.split(",")
                if len(parts) >= 2:
                    try:
                        proc_name = parts[0].strip('"')
                        pid = int(parts[1].strip('"'))
                        processes.append(ProcessInfo(pid=pid, name=proc_name))
                    except (ValueError, IndexError):
                        continue

    return processes


def _list_processes_unix(name: str) -> list[ProcessInfo]:
    """Linux/macOS에서 프로세스 목록 조회."""
    processes: list[ProcessInfo] = []

    result = subprocess.run(
        ["pgrep", "-f", name],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if line:
                try:
                    pid = int(line.strip())
                    processes.append(ProcessInfo(pid=pid, name=name))
                except ValueError:
                    continue

    return processes


async def kill_process(pid: int) -> bool:
    """프로세스를 종료합니다.

    플랫폼별 구현:
    - Windows: taskkill /F /PID {pid}
    - Linux/macOS: kill -9 {pid}

    Args:
        pid: 종료할 프로세스 ID

    Returns:
        True: 성공, False: 실패
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _kill_process_sync, pid)


def _kill_process_sync(pid: int) -> bool:
    """프로세스 종료 (동기 버전)."""
    try:
        if is_windows():
            result = subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW,  # type: ignore[attr-defined]
            )
        else:
            result = subprocess.run(
                ["kill", "-9", str(pid)],
                capture_output=True,
            )

        success = result.returncode == 0
        if success:
            logger.debug(f"프로세스 종료 성공: PID={pid}")
        else:
            logger.warning(f"프로세스 종료 실패: PID={pid}")

        return success

    except Exception as e:
        logger.error(f"프로세스 종료 중 오류: PID={pid}, {e}")
        return False


async def kill_processes_by_name(name: str) -> int:
    """이름으로 프로세스를 찾아 모두 종료합니다.

    Args:
        name: 종료할 프로세스 이름

    Returns:
        종료된 프로세스 수
    """
    processes = await list_processes(name)
    killed = 0

    for proc in processes:
        if await kill_process(proc.pid):
            killed += 1

    return killed


def kill_process_nowait(pid: int) -> None:
    """프로세스를 비동기적으로 종료합니다 (결과 대기 안 함).

    UI 종료 시처럼 즉시 반환이 필요한 경우에 사용합니다.

    Args:
        pid: 종료할 프로세스 ID
    """
    try:
        if is_windows():
            subprocess.Popen(
                ["taskkill", "/F", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,  # type: ignore[attr-defined]
            )
        else:
            subprocess.Popen(
                ["kill", "-9", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    except Exception as e:
        logger.warning(f"프로세스 종료 요청 실패: PID={pid}, {e}")


async def is_process_running(pid: int) -> bool:
    """프로세스가 실행 중인지 확인합니다.

    Args:
        pid: 확인할 프로세스 ID

    Returns:
        True: 실행 중, False: 종료됨
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _is_process_running_sync, pid)


def _is_process_running_sync(pid: int) -> bool:
    """프로세스 실행 확인 (동기 버전)."""
    try:
        if is_windows():
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW,  # type: ignore[attr-defined]
            )
            # tasklist는 프로세스가 없으면 "정보: ..." 메시지를 출력
            return result.returncode == 0 and str(pid) in result.stdout
        else:
            result = subprocess.run(
                ["kill", "-0", str(pid)],
                capture_output=True,
            )
            return result.returncode == 0

    except Exception:
        return False
