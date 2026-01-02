# Launcher 실행 흐름 분석

## 개요

`python launcher.py notion-like` 명령 실행 시 내부 동작을 설명합니다.

---

## 1. 전체 실행 흐름 (High-Level)

```mermaid
flowchart TB
    subgraph User["사용자"]
        CMD["python launcher.py notion-like"]
    end

    subgraph Python["Python Process"]
        MAIN["main()"]
        PARSE["parse_args()"]
        CONFIG["설정 로드<br/>.orchay/settings/orchay.yaml"]
        KILL["kill_orchay_wezterm()"]
        LAUNCH["launch_wezterm_windows()"]
    end

    subgraph Files["파일 시스템"]
        JSON["~/.config/wezterm/<br/>orchay-startup.json"]
        LUA["wezterm-orchay.lua"]
    end

    subgraph WezTerm["WezTerm Process"]
        STARTUP["gui-startup 이벤트"]
        LAYOUT["레이아웃 생성"]
        WORKERS["Worker Panes"]
        SCHEDULER["Scheduler Pane"]
    end

    CMD --> MAIN
    MAIN --> PARSE
    PARSE --> CONFIG
    CONFIG --> KILL
    KILL --> LAUNCH
    LAUNCH -->|JSON 설정 생성| JSON
    LAUNCH -->|"wezterm --config-file"| LUA
    LUA --> STARTUP
    JSON -->|설정 읽기| STARTUP
    STARTUP --> LAYOUT
    LAYOUT --> WORKERS
    LAYOUT --> SCHEDULER
    WORKERS -->|"claude --model haiku..."| W1["Worker 1"]
    WORKERS --> W2["Worker 2"]
    WORKERS --> W3["..."]
    SCHEDULER -->|"orchay run notion-like"| S1["스케줄러 실행"]
```

---

## 2. 함수 호출 순서 (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    participant User as 사용자
    participant Main as main()
    participant Parse as parse_args()
    participant YAML as orchay.yaml
    participant Kill as kill_orchay_wezterm()
    participant Launch as launch_wezterm_windows()
    participant Config as load_config()
    participant JSON as orchay-startup.json
    participant WezTerm as WezTerm
    participant Lua as wezterm-orchay.lua

    User->>Main: python launcher.py notion-like
    Main->>Main: 서브커맨드 체크 (run/exec/history?)
    Note over Main: notion-like는 서브커맨드 아님 → 계속 진행

    Main->>Main: check_all_dependencies()
    Main->>Parse: 인자 분리
    Parse-->>Main: launcher_args, orchay_args=["notion-like"]

    Main->>YAML: 설정 파일 로드
    YAML-->>Main: workers=6, launcher 설정

    Main->>Main: full_orchay_cmd = ["uv", "run", ..., "run", "notion-like"]

    Main->>Kill: 기존 WezTerm 종료
    Kill->>Kill: load_wezterm_pid() → PID 파일 읽기
    Kill->>Kill: _kill_process_sync(pid)

    Main->>Main: platform.system() == "Windows"
    Main->>Launch: launch_wezterm_windows(cwd, workers, cmd, args)

    Launch->>Config: load_config()
    Config-->>Launch: Config 객체 (worker_command.startup 포함)

    Launch->>JSON: JSON 설정 파일 생성
    Note over JSON: cwd, workers, scheduler_cmd,<br/>worker_startup_cmd 저장

    Launch->>WezTerm: subprocess.Popen(["wezterm", "--config-file", lua_path, "start"])

    WezTerm->>Lua: gui-startup 이벤트 발생
    Lua->>JSON: 설정 파일 읽기
    JSON-->>Lua: 설정 데이터
    Lua->>Lua: JSON 파싱 (workers, cwd, worker_startup_cmd...)
    Lua->>JSON: os.remove() - 설정 파일 삭제 (일회용)

    Lua->>Lua: mux.spawn_window() - 메인 창 생성
    Lua->>Lua: scheduler_pane:split() - Worker 영역 분할

    loop 각 Worker Pane
        Lua->>Lua: pane:split() - Worker pane 생성
    end

    Lua->>Lua: wezterm.time.call_after(1.5s)

    Note over Lua: 1.5초 후 명령 전송

    loop 각 Worker Pane
        Lua->>WezTerm: pane:send_text(worker_startup_cmd)
        Note over WezTerm: "claude --model haiku --dangerously-skip-permissions"
    end

    Lua->>WezTerm: scheduler_pane:send_text(scheduler_cmd)
    Note over WezTerm: "uv run --project orchay python -m orchay run notion-like"
```

---

## 3. 함수별 상세 설명

### 3.1 `main()` (launcher.py:650)

```mermaid
flowchart TD
    A["main() 시작"] --> B{"서브커맨드 체크<br/>run/exec/history?"}
    B -->|Yes| C["cli_main()으로 위임"]
    B -->|No| D["check_all_dependencies()"]
    D --> E{"의존성 OK?"}
    E -->|No| F["print_install_guide() → exit(1)"]
    E -->|Yes| G["parse_args()"]
    G --> H["설정 파일 로드<br/>.orchay/settings/orchay.yaml"]
    H --> I["workers 수 결정<br/>파일 설정 → CLI override"]
    I --> J["full_orchay_cmd 구성"]
    J --> K["kill_orchay_wezterm(cwd)"]
    K --> L{"platform.system()"}
    L -->|Windows| M["launch_wezterm_windows()"]
    L -->|Linux/macOS| N["launch_wezterm_linux()"]
```

### 3.2 `launch_wezterm_windows()` (launcher.py:308)

```mermaid
flowchart TD
    A["launch_wezterm_windows() 시작"] --> B["설정 디렉토리 생성<br/>~/.config/wezterm/"]
    B --> C["load_config()"]
    C --> D["startup_config 딕셔너리 생성"]
    D --> E["JSON 파일 저장<br/>orchay-startup.json"]
    E --> F["_get_bundled_file()<br/>wezterm-orchay.lua 경로"]
    F --> G["get_wezterm_gui_pids()<br/>기존 PID 기록"]
    G --> H["subprocess.Popen()<br/>wezterm --config-file lua start"]
    H --> I["1.5초 대기"]
    I --> J["새 WezTerm PID 감지"]
    J --> K["save_wezterm_pid()"]
    K --> L["return 0"]
```

### 3.3 `wezterm-orchay.lua` gui-startup 이벤트

```mermaid
flowchart TD
    A["gui-startup 이벤트"] --> B["설정 파일 경로 결정"]
    B --> C{"orchay-startup.json<br/>존재?"}
    C -->|No| D["일반 시작 (레이아웃 없음)"]
    C -->|Yes| E["JSON 파일 읽기"]
    E --> F["패턴 매칭으로 파싱<br/>cwd, workers, worker_startup_cmd..."]
    F --> G{"설정 유효?"}
    G -->|No| D
    G -->|Yes| H["os.remove() - JSON 삭제"]
    H --> I["mux.spawn_window()<br/>메인 창 + scheduler_pane"]
    I --> J["set_inner_size()<br/>창 크기 설정"]
    J --> K["Worker 분배 계산<br/>columns, workers_per_column"]
    K --> L["scheduler_pane:split()<br/>Worker 영역 생성"]
    L --> M["열/행 분할<br/>worker_panes 배열 생성"]
    M --> N["scheduler_pane:activate()"]
    N --> O["call_after(1.5초)"]
    O --> P["Worker panes에<br/>worker_startup_cmd 전송"]
    P --> Q["Scheduler pane에<br/>scheduler_cmd 전송"]
```

---

## 4. 데이터 흐름

### 4.1 설정 데이터 흐름

```mermaid
flowchart LR
    subgraph Sources["설정 소스"]
        YAML[".orchay/settings/<br/>orchay.yaml"]
        CLI["CLI 인자<br/>notion-like"]
        DEFAULT["기본값"]
    end

    subgraph Python["Python 처리"]
        MERGE["설정 병합"]
        CONFIG["Config 객체"]
    end

    subgraph Transfer["전달"]
        JSON["orchay-startup.json"]
    end

    subgraph Lua["Lua 처리"]
        PARSE["JSON 파싱"]
        EXEC["명령 실행"]
    end

    YAML --> MERGE
    CLI --> MERGE
    DEFAULT --> MERGE
    MERGE --> CONFIG
    CONFIG --> JSON
    JSON --> PARSE
    PARSE --> EXEC
```

### 4.2 orchay-startup.json 구조

```json
{
  "cwd": "C:\\project\\orchay",
  "workers": 6,
  "scheduler_cmd": "uv run --project orchay python -m orchay run notion-like",
  "width": 1920,
  "height": 1080,
  "max_rows": 3,
  "scheduler_ratio": 0.45,
  "font_size": 9,
  "worker_startup_cmd": "claude --model haiku --dangerously-skip-permissions"
}
```

---

## 5. 주요 함수 참조

| 함수 | 파일:라인 | 역할 |
|------|-----------|------|
| `main()` | launcher.py:650 | 진입점, 전체 흐름 제어 |
| `parse_args()` | launcher.py:598 | launcher/orchay 인자 분리 |
| `check_all_dependencies()` | launcher.py:100+ | wezterm 등 의존성 체크 |
| `kill_orchay_wezterm()` | launcher.py:268 | 기존 WezTerm 종료 |
| `launch_wezterm_windows()` | launcher.py:308 | Windows 레이아웃 생성 |
| `launch_wezterm_linux()` | launcher.py:418 | Linux/macOS 레이아웃 생성 |
| `load_config()` | utils/config.py:34 | orchay.yaml 로드 |
| `_create_layout_config()` | launcher.py:218 | Worker 수 → 열/행 배치 |

---

## 6. 플랫폼별 차이

```mermaid
flowchart TB
    subgraph Windows["Windows"]
        W1["gui-startup 이벤트 방식"]
        W2["JSON 설정 파일로 전달"]
        W3["Lua에서 레이아웃 생성"]
        W4["CLI 소켓 연결 문제 회피"]
        W1 --> W2 --> W3 --> W4
    end

    subgraph Linux["Linux/macOS"]
        L1["CLI 방식"]
        L2["wezterm cli split-pane 직접 호출"]
        L3["Python에서 레이아웃 생성"]
        L4["안정적인 CLI 소켓 연결"]
        L1 --> L2 --> L3 --> L4
    end
```

**Windows에서 gui-startup 방식을 사용하는 이유:**
- WezTerm CLI 소켓 연결 문제 ([GitHub Issue #4456](https://github.com/wezterm/wezterm/issues/4456))
- Windows에서 `wezterm cli send-text` 등이 불안정

---

## 7. 실행 타임라인

```mermaid
gantt
    title Launcher 실행 타임라인
    dateFormat X
    axisFormat %Ls

    section Python
    main() 시작           :a1, 0, 50ms
    설정 로드             :a2, after a1, 100ms
    kill_orchay_wezterm() :a3, after a2, 500ms
    JSON 생성             :a4, after a3, 50ms
    WezTerm 시작          :a5, after a4, 100ms

    section WezTerm
    프로세스 초기화       :b1, after a5, 500ms
    gui-startup 이벤트    :b2, after b1, 100ms
    레이아웃 생성         :b3, after b2, 300ms
    1.5초 대기            :b4, after b3, 1500ms
    명령 전송             :b5, after b4, 200ms

    section Workers
    Claude 시작           :c1, after b5, 2000ms
    프롬프트 대기         :c2, after c1, 500ms
```

---

## 8. 디버깅 팁

### 로그 파일 위치
```
.orchay/logs/launcher.log
```

### 설정 파일 확인 (Windows)
```powershell
# JSON 설정 파일 (생성 직후 삭제됨)
cat ~/.config/wezterm/orchay-startup.json

# Lua 설정 파일
cat (python -c "from orchay.launcher import _get_bundled_file; print(_get_bundled_file('wezterm-orchay.lua'))")
```

### 환경변수로 상세 로그
```powershell
$env:WEZTERM_LOG='debug'
python launcher.py notion-like
```
