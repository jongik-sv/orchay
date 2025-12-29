"""Task 모델 정의."""

from enum import Enum

from pydantic import BaseModel, Field


class TaskCategory(str, Enum):
    """Task 카테고리."""

    DEVELOPMENT = "development"
    DEFECT = "defect"
    INFRASTRUCTURE = "infrastructure"
    SIMPLE_DEV = "simple-dev"


class TaskStatus(str, Enum):
    """Task 상태."""

    TODO = "[ ]"
    BASIC_DESIGN = "[bd]"
    DETAIL_DESIGN = "[dd]"
    ANALYSIS = "[an]"
    DESIGN = "[ds]"
    APPROVED = "[ap]"
    IMPLEMENT = "[im]"
    FIX = "[fx]"
    VERIFY = "[vf]"
    DONE = "[xx]"


class TaskPriority(str, Enum):
    """Task 우선순위."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Task(BaseModel):
    """WBS Task 모델."""

    id: str = Field(description="Task ID (예: TSK-01-01)")
    title: str = Field(description="Task 제목")
    category: TaskCategory = Field(description="Task 카테고리")
    domain: str = Field(default="", description="기술 도메인 (backend, frontend 등)")
    status: TaskStatus = Field(default=TaskStatus.TODO, description="현재 상태")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="우선순위")
    assignee: str = Field(default="-", description="담당자")
    schedule: str = Field(default="", description="일정")
    tags: list[str] = Field(default_factory=list, description="태그 목록")
    depends: list[str] = Field(default_factory=list, description="의존 Task ID 목록")
    blocked_by: str | None = Field(default=None, description="블로킹 사유")
    assigned_worker: int | None = Field(default=None, description="할당된 Worker ID")
    workflow: str = Field(default="design", description="실행할 workflow 명령어 (design, build 등)")
    # TSK-06-02: 요구사항/기술 스펙 필드
    prd_ref: str = Field(default="", description="PRD 참조 섹션")
    requirements: list[str] = Field(default_factory=list, description="요구사항 목록")
    acceptance: list[str] = Field(default_factory=list, description="인수 조건 목록")
    tech_spec: list[str] = Field(default_factory=list, description="기술 스펙 목록")
    api_spec: list[str] = Field(default_factory=list, description="API 스펙 목록")
    ui_spec: list[str] = Field(default_factory=list, description="UI 스펙 목록")

    def is_executable(self) -> bool:
        """실행 가능 여부 확인."""
        return (
            self.status != TaskStatus.DONE
            and self.blocked_by is None
            and self.assigned_worker is None
        )
