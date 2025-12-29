"""히스토리 관리 유틸리티."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

# 타입 별칭
HistoryDict = dict[str, Any]


@dataclass
class HistoryEntry:
    """히스토리 항목."""

    task_id: str
    command: str
    result: str  # "success" | "error"
    worker_id: int
    timestamp: str
    output: str  # 캡처된 pane 출력


class HistoryManager:
    """히스토리 관리자.

    JSON Lines 형식으로 히스토리를 저장하고 조회합니다.
    """

    def __init__(self, storage_path: str, max_entries: int = 1000) -> None:
        """HistoryManager 초기화.

        Args:
            storage_path: 히스토리 파일 경로
            max_entries: 최대 저장 항목 수
        """
        self.storage_path = Path(storage_path)
        self.max_entries = max_entries

    def save(self, entry: HistoryEntry) -> None:
        """히스토리 항목을 저장한다.

        Args:
            entry: 저장할 히스토리 항목
        """
        # 디렉토리 생성
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        # 기존 항목 읽기
        entries = self._read_all()
        entries.append(asdict(entry))

        # 최대 항목 수 초과 시 오래된 것 삭제
        if len(entries) > self.max_entries:
            entries = entries[-self.max_entries :]

        # JSON Lines 형식으로 저장
        with open(self.storage_path, "w", encoding="utf-8") as f:
            for e in entries:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")

    def list(self, limit: int = 10) -> list[HistoryDict]:
        """최근 히스토리 목록을 반환한다.

        Args:
            limit: 반환할 최대 항목 수

        Returns:
            히스토리 항목 리스트 (최신순)
        """
        entries = self._read_all()
        # 최신순으로 정렬하여 반환
        return entries[-limit:][::-1]

    def get(self, task_id: str) -> HistoryDict | None:
        """특정 Task의 가장 최근 히스토리를 반환한다.

        Args:
            task_id: 조회할 Task ID

        Returns:
            히스토리 항목 또는 None
        """
        entries = self._read_all()
        for entry in reversed(entries):
            if entry["task_id"] == task_id:
                return entry
        return None

    def clear(self) -> None:
        """히스토리를 삭제한다."""
        if self.storage_path.exists():
            self.storage_path.unlink()

    def _read_all(self) -> list[HistoryDict]:
        """모든 히스토리 항목을 읽는다.

        Returns:
            히스토리 항목 리스트
        """
        if not self.storage_path.exists():
            return []

        entries: list[HistoryDict] = []
        with open(self.storage_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        # 손상된 라인은 무시
                        continue
        return entries
