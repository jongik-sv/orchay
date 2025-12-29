# orchay 코드 참조 문서

PRD에서 참조하는 구현 코드 예시 모음입니다.

## 상태 감지

### 파일 기반 상태 관리 (`utils/active_tasks.py`)

```python
"""작업 중 상태 파일 관리 모듈.

`.orchay/logs/orchay-active.json` 파일로 Worker 작업 상태를 추적합니다.
"""

from pathlib import Path
import json
from datetime import datetime

def get_active_tasks_path() -> Path:
    """상태 파일 경로 반환."""
    return Path.cwd() / ".orchay" / "logs" / "orchay-active.json"

def load_active_tasks() -> dict:
    """상태 파일 로드."""
    path = get_active_tasks_path()
    if not path.exists():
        return {"activeTasks": {}}
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def save_active_tasks(data: dict) -> None:
    """상태 파일 저장."""
    path = get_active_tasks_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def clear_active_tasks() -> None:
    """상태 파일 초기화 (스케줄러 시작 시)."""
    save_active_tasks({"activeTasks": {}})

def register_active_task(task_id: str, worker_id: int, pane_id: int, step: str = "start") -> None:
    """Task 분배 시 작업 중 상태 등록."""
    data = load_active_tasks()
    data["activeTasks"][task_id] = {
        "worker": worker_id,
        "paneId": pane_id,
        "startedAt": datetime.now().isoformat(),
        "currentStep": step,
    }
    save_active_tasks(data)

def unregister_active_task(task_id: str) -> None:
    """Task 완료(ORCHAY_DONE) 시 작업 중 상태 해제."""
    data = load_active_tasks()
    if task_id in data["activeTasks"]:
        del data["activeTasks"][task_id]
        save_active_tasks(data)

def is_pane_active(pane_id: int) -> bool:
    """해당 pane이 작업 중인지 확인."""
    data = load_active_tasks()
    return any(info["paneId"] == pane_id for info in data["activeTasks"].values())

def get_task_by_pane(pane_id: int) -> str | None:
    """pane에 할당된 Task ID 반환."""
    data = load_active_tasks()
    for task_id, info in data["activeTasks"].items():
        if info["paneId"] == pane_id:
            return task_id
    return None
```

### 상태 감지 함수 (`worker.py`)

```python
async def detect_worker_state(pane_id: int) -> tuple[WorkerState, DoneInfo | None]:
    """Worker 상태를 감지합니다.

    파일 기반 상태 관리:
    - 파일에 작업이 있으면: ORCHAY_DONE 체크 후 busy 또는 done
    - 파일에 없으면: pane 출력으로 idle/paused/error/blocked/busy 판단
    """
    # 0. pane 존재 확인
    if not await pane_exists(pane_id):
        return "dead", None

    output = await wezterm_get_text(pane_id, lines=50)

    if not output.strip():
        return "busy", None

    # 1. 파일 기반 상태 확인 (작업 중인 pane인지)
    if is_pane_active(pane_id):
        done_info = parse_done_signal(output)
        if done_info:
            # 완료 신호 감지 → 파일에서 제거
            task_id = get_task_by_pane(pane_id)
            if task_id:
                unregister_active_task(task_id)
            return "done", done_info
        # 완료 신호 없으면 계속 busy
        return "busy", None

    # 2. 파일에 없으면: pane 출력 기반 판단
    # ... (프롬프트, pause, error, blocked 패턴 체크)
    return "busy", None
```

## 상태 감지 패턴

### PAUSE_PATTERNS

```python
PAUSE_PATTERNS = [
    re.compile(r"rate.*limit", re.IGNORECASE),
    re.compile(r"please.*wait", re.IGNORECASE),
    re.compile(r"try.*again", re.IGNORECASE),
    re.compile(r"weekly.*limit", re.IGNORECASE),
    re.compile(r"resets.*at", re.IGNORECASE),
    re.compile(r"context.*limit", re.IGNORECASE),
    re.compile(r"conversation.*too.*long", re.IGNORECASE),
    re.compile(r"overloaded", re.IGNORECASE),
    re.compile(r"capacity", re.IGNORECASE),
]
```

### ERROR_PATTERNS

```python
ERROR_PATTERNS = [
    re.compile(r"Error:", re.IGNORECASE),
    re.compile(r"Failed:", re.IGNORECASE),
    re.compile(r"Exception:", re.IGNORECASE),
    re.compile(r"❌"),
    re.compile(r"fatal:", re.IGNORECASE),
]
```

### PROMPT_PATTERNS

```python
PROMPT_PATTERNS = [
    re.compile(r"^>\s", re.MULTILINE),  # ">" 뒤에 공백 (텍스트 있어도 됨)
    re.compile(r"^>\s*$", re.MULTILINE),  # ">" 만 있는 경우
    re.compile(r"╭─"),
    re.compile(r"❯"),
]
```

### BLOCKED_PATTERNS

```python
BLOCKED_PATTERNS = [
    re.compile(r"\?\s*$"),
    re.compile(r"\(y/n\)", re.IGNORECASE),
    re.compile(r"선택", re.IGNORECASE),
    re.compile(r"Press.*to continue", re.IGNORECASE),
]
```

## 완료 신호 (ORCHAY_DONE)

### 패턴

```python
DONE_PATTERN = re.compile(r"ORCHAY_DONE:([^:]+):(\w+):(success|error)(?::(.+))?")
```

### 형식

```
ORCHAY_DONE:{task-id}:{action}:{status}[:{message}]
```

예시:
```
ORCHAY_DONE:TSK-01-01-01:start:success
ORCHAY_DONE:TSK-01-01-01:build:error:TDD 5회 초과
```

## 작업 분배 (`scheduler.py`)

```python
async def dispatch_task(worker: Worker, task: Task, mode: ExecutionMode) -> None:
    """Worker에 Task를 분배합니다."""
    # Worker 상태 업데이트
    worker.state = WorkerState.BUSY
    worker.current_task = task.id
    worker.dispatch_time = datetime.now()

    # 워크플로우 첫 단계 설정
    steps = get_workflow_steps(task, mode)
    first_step = steps[0] if steps else "start"
    worker.current_step = first_step

    # Task의 is_running 플래그 설정
    task.is_running = True

    # 파일 기반 상태 관리: 작업 등록
    register_active_task(
        task_id=task.id,
        worker_id=worker.id,
        pane_id=worker.pane_id,
        step=first_step,
    )
```

## 상태 파일 구조

### `.orchay/logs/orchay-active.json`

```json
{
  "activeTasks": {
    "TSK-01-01": {
      "worker": 1,
      "paneId": 2,
      "startedAt": "2025-12-28T10:00:00",
      "currentStep": "start"
    },
    "TSK-01-02": {
      "worker": 2,
      "paneId": 3,
      "startedAt": "2025-12-28T10:05:00",
      "currentStep": "build"
    }
  }
}
```

### 생명주기

| 단계 | 함수 | 설명 |
|------|------|------|
| 초기화 | `clear_active_tasks()` | 스케줄러 시작 시 파일 비움 |
| 등록 | `register_active_task()` | Task 분배 시 작업 정보 추가 |
| 갱신 | `update_active_task_step()` | /wf 명령어 단계 변경 시 |
| 해제 | `unregister_active_task()` | ORCHAY_DONE 감지 시 제거 |

## 스케줄러 이벤트 루프

### 메인 루프 (pseudo code)

```python
while running:
    # 1. wbs.md 변경 체크
    if wbs_file_changed():
        tasks = parse_wbs()
        queue = filter_executable_tasks(tasks)
        queue = sort_by_priority(queue)

    # 2. 각 Worker pane 상태 체크
    for worker in workers:
        output = wezterm_get_text(worker.pane_id)

        if matches_prompt_pattern(output):
            worker.state = "idle"
        elif matches_error_pattern(output):
            worker.state = "error"
        else:
            worker.state = "busy"

    # 3. 대기 중 Worker 처리
    for worker in workers:
        if worker.state == "idle" and queue:
            # 이전 Task 완료 확인
            if worker.current_task:
                verify_task_completion(worker.current_task)

            # 다음 Task 분배
            task = queue.pop(0)
            command = f"/wf:{task.workflow} {project}/{task.id}"
            wezterm_send_text(worker.pane_id, command)
            wezterm_send_text(worker.pane_id, "\r")  # Enter 전송
            worker.current_task = task
            worker.state = "busy"

    # 4. 에러 Worker 처리
    for worker in workers:
        if worker.state == "error":
            log_error(worker)
            mark_task_blocked(worker.current_task)
            notify_user(worker)  # 선택

    # 5. paused 상태 처리
    for worker in workers:
        if worker.state == "paused":
            handle_paused_worker(worker)

    # 6. 대기
    sleep(interval)
```

## 필터링 로직

### filter_executable_tasks

```python
def filter_executable_tasks(tasks: list, mode: str) -> list:
    """실행 가능한 Task 필터링

    → workflows.json executionModes.dependencyCheck 참조:
      - ignore: 의존성 무시
      - check-implemented: 선행 Task [im] 이상 확인
    """
    executable = []

    for task in tasks:
        # 공통 필터: 완료, blocked, 실행 중 제외
        if task.status == "[xx]":
            continue
        if task.blocked_by:
            continue
        if task.is_running:
            continue

        if mode == "design":
            # 설계 모드: 설계 미완료만
            if task.status == "[ ]":
                executable.append(task)

        elif mode in ["quick", "develop"]:
            # quick/develop: 설계는 무시, 구현은 의존성 확인
            if task.status == "[ ]":
                # 설계 단계: 의존성 무시
                executable.append(task)
            elif task.status in ["[dd]", "[ap]", "[im]"]:
                # 구현 단계: 선행 Task가 [im] 이상이어야 진행
                if check_dependencies_implemented(task):
                    executable.append(task)

        elif mode == "force":
            # 강제 모드: 모든 미완료 Task (의존성 무시)
            executable.append(task)

    return executable
```

## Task 실행 로직

### execute_task

```python
def execute_task(worker, task, mode: str):
    """Task의 전체 workflow를 순차 실행"""

    # 1. 컨텍스트 초기화
    wezterm_send_text(worker.pane_id, "/clear")
    wezterm_send_text(worker.pane_id, "\r")
    log(f"🧹 Worker {worker.id}: /clear 전송")
    sleep(2)

    # 2. 모드별 workflow 단계 결정
    workflow_steps = get_workflow_steps(task, mode)
    # design: ["start"]
    # quick/force: ["start", "approve", "build", "done"]
    # develop: ["start", "review", "apply", "approve", "build", "audit", "patch", "test", "done"]

    # 3. 상태 업데이트
    worker.current_task = task
    worker.state = "busy"
    worker.dispatch_time = time.time()

    # 4. workflow 순차 실행
    for step in workflow_steps:
        command = f"/wf:{step} {project}/{task.id}"
        wezterm_send_text(worker.pane_id, command)
        wezterm_send_text(worker.pane_id, "\r")
        log(f"📤 Worker {worker.id}: {command}")

        # 단계 완료 대기
        wait_for_step_completion(worker)

        # 에러 발생 시 중단
        if worker.state == "error":
            log(f"❌ Worker {worker.id}: {task.id} 에러 발생, 중단")
            return "error"

        # paused 상태 처리 (rate limit 등)
        if worker.state == "paused":
            handle_paused_worker(worker)

    log(f"✅ Worker {worker.id}: {task.id} 완료")
    return "completed"
```

### get_workflow_steps

```python
def get_workflow_steps(task, mode: str) -> list:
    """모드와 Task 상태에 따른 workflow 단계 반환

    → workflows.json의 executionModes 및 workflows 참조
    """

    if mode == "design":
        # 설계 모드: start만
        if task.status == "[ ]":
            return ["start"]
        return []  # 이미 설계 완료

    # 모드별 워크플로우 정의
    # quick/force: transitions만 (actions 생략)
    # develop: full (transitions + actions)

    if mode in ["quick", "force"]:
        # transitions만 실행
        all_steps = {
            "development": ["start", "approve", "build", "done"],
            "defect": ["start", "fix", "verify", "done"],
            "infrastructure": ["start", "build", "done"]
        }
    else:  # develop
        # full workflow (transitions + actions)
        all_steps = {
            "development": ["start", "review", "apply", "approve", "build", "audit", "patch", "test", "done"],
            "defect": ["start", "fix", "audit", "patch", "test", "verify", "done"],
            "infrastructure": ["start", "build", "audit", "patch", "done"]
        }

    steps = all_steps.get(task.category, all_steps["development"])

    # 현재 상태에 따라 남은 단계만 반환
    status_to_step = {
        "[ ]": 0,   # start부터
        "[dd]": 1,  # approve/review부터
        "[ap]": 2,  # build부터
        "[im]": 3   # done/verify부터
    }

    start_index = status_to_step.get(task.status, 0)
    return steps[start_index:]
```

## 히스토리 관리

### save_task_history

```python
def save_task_history(worker, task, status: str):
    """완료된 작업을 히스토리에 저장"""

    if not settings.get("history", {}).get("enabled", True):
        return

    # pane 출력 캡처
    capture_lines = settings["history"].get("captureLines", 500)
    output = wezterm_get_text(worker.pane_id, last_lines=capture_lines)

    # 히스토리 레코드 생성
    record = {
        "task_id": task.id,
        "worker_id": worker.id,
        "started_at": worker.dispatch_time.isoformat(),
        "completed_at": datetime.now().isoformat(),
        "status": status,
        "output": output,
        "duration_seconds": int(time.time() - worker.dispatch_time.timestamp())
    }

    if status == "error":
        record["error_message"] = extract_error_message(output)

    # 파일에 추가
    history_path = settings["history"].get("storagePath")
    with open(history_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    # 최대 항목 수 관리
    manage_history_size(history_path)
```

### 히스토리 조회

```python
def list_history(limit: int = 20) -> list:
    """최근 히스토리 목록 조회"""
    history_path = settings["history"].get("storagePath")
    records = []

    with open(history_path, "r", encoding="utf-8") as f:
        for line in f:
            records.append(json.loads(line))

    # 최신순 정렬 후 limit 적용
    records.sort(key=lambda x: x["completed_at"], reverse=True)
    return records[:limit]


def get_history_detail(task_id: str) -> dict | None:
    """특정 Task의 히스토리 상세 조회"""
    history_path = settings["history"].get("storagePath")

    with open(history_path, "r", encoding="utf-8") as f:
        for line in f:
            record = json.loads(line)
            if record["task_id"] == task_id:
                return record

    return None
```

## 인터랙티브 명령어

### CommandHandler

```python
import sys
import select
import tty
import termios

class CommandHandler:
    """인터랙티브 명령어 처리기"""

    FUNCTION_KEYS = {
        '\x1bOP': 'help',      # F1
        '\x1bOQ': 'status',    # F2
        '\x1bOR': 'queue',     # F3
        '\x1bOS': 'workers',   # F4
        '\x1b[15~': 'reload',  # F5
        '\x1b[17~': 'history', # F6
        '\x1b[18~': 'mode',    # F7
        '\x1b[20~': 'pause',   # F9
        '\x1b[21~': 'stop',    # F10
        '\x1b[1;2P': 'worker 1',  # Shift+F1
        '\x1b[1;2Q': 'worker 2',  # Shift+F2
        '\x1b[1;2R': 'worker 3',  # Shift+F3
    }

    def check_input(self) -> str | None:
        """비동기로 키 입력 확인"""
        if select.select([sys.stdin], [], [], 0)[0]:
            key = sys.stdin.read(1)

            # ESC 시퀀스 (Function Key) 처리
            if key == '\x1b':
                key += sys.stdin.read(2)
                if key in self.FUNCTION_KEYS:
                    return self.FUNCTION_KEYS[key]

            # 일반 문자 입력 (명령어 모드)
            elif key == ':':
                return self.read_command_line()

        return None

    def process_command(self, cmd: str):
        """명령어 실행"""
        parts = cmd.strip().split()
        if not parts:
            return

        action = parts[0].lower()
        args = parts[1:] if len(parts) > 1 else []

        if action == 'help':
            self.show_help()
        elif action == 'status':
            self.show_status()
        elif action == 'queue':
            self.interactive_queue()
        elif action == 'stop':
            self.stop_scheduler()
        # ... 기타 명령어
```

## Rate Limit 처리

### extract_reset_time

```python
from datetime import datetime
import re

def extract_reset_time(output: str) -> datetime | None:
    """Claude Code 출력에서 reset 시간 추출

    지원 형식:
    - "Weekly limit reached · resets Oct 9 at 10:30am"
    - "resets Oct 6, 1pm"
    - "reset at Oct 6, 1pm"
    """
    patterns = [
        # "resets Oct 9 at 10:30am" 형식
        r"resets\s+(\w+)\s+(\d+)\s+at\s+(\d+):?(\d*)\s*(am|pm)?",
        # "reset at Oct 6, 1pm" 형식
        r"reset\s+at\s+(\w+)\s+(\d+),?\s*(\d+):?(\d*)\s*(am|pm)?"
    ]

    for pattern in patterns:
        match = re.search(pattern, output, re.I)
        if match:
            groups = match.groups()
            month_str, day = groups[0], int(groups[1])
            hour = int(groups[2])
            minute = int(groups[3]) if groups[3] else 0
            ampm = groups[4].lower() if groups[4] else None

            # AM/PM 변환
            if ampm == "pm" and hour < 12:
                hour += 12
            elif ampm == "am" and hour == 12:
                hour = 0

            # 월 파싱
            months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                      "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
            month = months.get(month_str.lower()[:3], 1)

            # 연도 추정 (현재 연도, 과거면 다음 연도)
            now = datetime.now()
            year = now.year
            reset_time = datetime(year, month, day, hour, minute)

            if reset_time < now:
                reset_time = datetime(year + 1, month, day, hour, minute)

            return reset_time

    return None


def calculate_wait_seconds(reset_time: datetime) -> int:
    """reset 시간까지 대기할 초 계산"""
    now = datetime.now()
    delta = reset_time - now
    return max(0, int(delta.total_seconds()))
```

### handle_paused_worker

```python
def handle_paused_worker(worker):
    """일시 중단된 Worker 자동 재개"""

    output = get_pane_output(worker.pane_id)

    # 1. 중단 유형별 대기 시간 결정
    if is_weekly_limit(output):
        # Weekly limit: reset 시간 파싱하여 정확한 대기 시간 계산
        reset_time = extract_reset_time(output)
        if reset_time:
            wait_time = calculate_wait_seconds(reset_time)
            reset_str = reset_time.strftime("%m/%d %H:%M")
            log(f"⏳ Worker {worker.id}: Weekly limit, {reset_str}까지 대기 ({wait_time}초)")
        else:
            wait_time = settings["recovery"]["retryInterval"]
            log(f"⏳ Worker {worker.id}: Weekly limit (시간 파싱 실패), {wait_time}초 대기")

    elif is_rate_limit(output):
        wait_time = settings["recovery"]["retryInterval"]
        log(f"⏳ Worker {worker.id}: Rate limit, {wait_time}초 대기")

    elif is_context_limit(output):
        # context limit: /clear 후 재시작
        log(f"⏳ Worker {worker.id}: Context limit, /clear 후 재시작")
        wezterm_send_text(worker.pane_id, "/clear")
        wezterm_send_text(worker.pane_id, "\r")
        sleep(2)
        worker.state = "idle"
        return

    # 2. 대기 후 재시도
    sleep(wait_time)

    # 3. "계속" 전송
    wezterm_send_text(worker.pane_id, "계속")
    wezterm_send_text(worker.pane_id, "\r")
    log(f"▶️ Worker {worker.id}: '계속' 전송")

    # 4. 상태 확인
    sleep(5)
    new_state = detect_worker_state(worker.pane_id)
    worker.state = new_state
```
