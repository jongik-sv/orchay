"""WezTerm CLI 어댑터.

Protocol 기반으로 테스트 시 Mock 가능하게 설계됩니다.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Protocol


class WezTermNotFoundError(Exception):
    """WezTerm CLI를 찾을 수 없을 때 발생하는 예외."""

    pass


@dataclass
class PaneInfo:
    """WezTerm pane 정보."""

    pane_id: int
    workspace: str
    cwd: str
    title: str


class ITerminalAdapter(Protocol):
    """터미널 어댑터 인터페이스.

    테스트 시 Mock 어댑터로 교체할 수 있습니다.
    """

    async def list_panes(self) -> list[PaneInfo]:
        """pane 목록을 조회합니다."""
        ...

    async def get_text(self, pane_id: int, lines: int = 50) -> str:
        """특정 pane의 출력 텍스트를 조회합니다."""
        ...

    async def send_text(self, pane_id: int, text: str) -> None:
        """특정 pane에 텍스트를 전송합니다."""
        ...

    async def pane_exists(self, pane_id: int) -> bool:
        """pane이 존재하는지 확인합니다."""
        ...

    async def get_active_pane_id(self) -> int | None:
        """현재 활성화된 pane ID를 반환합니다."""
        ...


class WezTermAdapter:
    """WezTerm CLI 어댑터 구현.

    WezTerm CLI를 사용하여 터미널 pane을 관리합니다.

    Example:
        ```python
        adapter = WezTermAdapter()

        # pane 목록 조회
        panes = await adapter.list_panes()

        # 텍스트 조회
        text = await adapter.get_text(pane_id=1, lines=50)

        # 텍스트 전송
        await adapter.send_text(pane_id=1, text="/wf:start TSK-01-01")
        ```
    """

    async def list_panes(self) -> list[PaneInfo]:
        """WezTerm pane 목록을 조회합니다.

        Returns:
            PaneInfo 리스트

        Raises:
            WezTermNotFoundError: WezTerm CLI를 찾을 수 없을 때
        """
        try:
            process = await asyncio.create_subprocess_exec(
                "wezterm",
                "cli",
                "list",
                "--format",
                "json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await process.communicate()
        except FileNotFoundError as e:
            raise WezTermNotFoundError(
                "WezTerm CLI를 찾을 수 없습니다. "
                "WezTerm이 설치되어 있고 PATH에 등록되어 있는지 확인하세요."
            ) from e

        if process.returncode != 0:
            return []

        try:
            data = json.loads(stdout.decode())
        except json.JSONDecodeError:
            return []

        result: list[PaneInfo] = []
        for item in data:
            result.append(
                PaneInfo(
                    pane_id=item.get("pane_id", 0),
                    workspace=item.get("workspace", ""),
                    cwd=item.get("cwd", ""),
                    title=item.get("title", ""),
                )
            )
        return result

    async def get_text(self, pane_id: int, lines: int = 50) -> str:
        """특정 pane의 출력 텍스트를 조회합니다.

        Args:
            pane_id: WezTerm pane ID
            lines: 읽을 줄 수 (기본값: 50)

        Returns:
            pane 출력 텍스트. pane이 없으면 빈 문자열.
        """
        try:
            process = await asyncio.create_subprocess_exec(
                "wezterm",
                "cli",
                "get-text",
                "--pane-id",
                str(pane_id),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await process.communicate()
        except FileNotFoundError:
            return ""

        if process.returncode != 0:
            return ""

        text = stdout.decode(errors="replace")

        # 마지막 N줄만 반환
        all_lines = text.split("\n")
        if len(all_lines) > lines:
            all_lines = all_lines[-lines:]

        return "\n".join(all_lines)

    async def send_text(self, pane_id: int, text: str) -> None:
        """특정 pane에 텍스트를 전송합니다.

        Args:
            pane_id: WezTerm pane ID
            text: 전송할 텍스트

        Raises:
            RuntimeError: 전송 실패 시
            WezTermNotFoundError: WezTerm CLI를 찾을 수 없을 때
        """
        try:
            process = await asyncio.create_subprocess_exec(
                "wezterm",
                "cli",
                "send-text",
                "--pane-id",
                str(pane_id),
                "--no-paste",
                "--",
                text,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await process.communicate()
        except FileNotFoundError as e:
            raise WezTermNotFoundError("WezTerm CLI를 찾을 수 없습니다.") from e

        if process.returncode != 0:
            error_msg = stderr.decode(errors="replace") if stderr else "Unknown error"
            raise RuntimeError(f"WezTerm send-text 실패: {error_msg}")

    async def pane_exists(self, pane_id: int) -> bool:
        """pane이 존재하는지 확인합니다.

        Args:
            pane_id: 확인할 pane ID

        Returns:
            pane 존재 여부
        """
        panes = await self.list_panes()
        return any(p.pane_id == pane_id for p in panes)

    async def get_active_pane_id(self) -> int | None:
        """현재 활성화된 pane ID를 반환합니다.

        WezTerm CLI의 list 명령에서 is_active=true인 pane을 찾습니다.

        Returns:
            활성 pane ID 또는 None (찾을 수 없는 경우)
        """
        try:
            process = await asyncio.create_subprocess_exec(
                "wezterm",
                "cli",
                "list",
                "--format",
                "json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await process.communicate()
        except FileNotFoundError:
            return None

        if process.returncode != 0:
            return None

        try:
            data = json.loads(stdout.decode())
        except json.JSONDecodeError:
            return None

        # is_active=true인 pane 찾기
        for item in data:
            if item.get("is_active", False):
                return item.get("pane_id")

        return None
