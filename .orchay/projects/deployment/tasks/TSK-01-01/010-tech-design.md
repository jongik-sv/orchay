# 010 기술 설계: TSK-01-01 launcher.py 패키지 이동

> **Task ID**: TSK-01-01
> **Category**: infrastructure
> **Status**: 상세설계 [dd]
> **PRD Ref**: PRD 3.1 엔트리포인트 변경
> **작성일**: 2025-12-29

---

## 1. 목적

launcher.py를 패키지 외부 독립 스크립트에서 `orchay/src/orchay/` 내부로 이동하여:
- PyInstaller 단일 실행 파일 빌드 지원
- `python -m orchay` 실행 시 launcher 기능 통합
- 패키지 설치 후 `orchay` 명령 직접 실행 가능

---

## 2. 현재 상태

### 2.1 파일 위치

```
orchay/
├── launcher.py              ← 패키지 외부 (독립 스크립트)
├── pyproject.toml           ← entry point: orchay.cli:cli_main
└── src/orchay/
    ├── cli.py               ← 현재 엔트리포인트
    └── __main__.py          ← cli.cli_main() 호출
```

### 2.2 현재 실행 방식

```bash
# launcher.py 직접 실행 (패키지 외부)
python launcher.py

# 또는 CLI 통해 스케줄러만 실행
uv run --project orchay python -m orchay
```

### 2.3 현재 launcher.py 주요 기능

| 함수 | 기능 |
|------|------|
| `check_dependencies()` | wezterm, claude, uv 설치 확인 |
| `kill_mux_server()` | 기존 WezTerm mux-server 종료 |
| `get_orchay_cmd()` | orchay 스케줄러 실행 명령 생성 |
| `main()` | WezTerm 레이아웃 생성 + 스케줄러 시작 |

---

## 3. 목표 상태

### 3.1 파일 구조

```
orchay/
├── pyproject.toml           ← entry point: orchay.launcher:main
└── src/orchay/
    ├── launcher.py          ← 새 위치 (이동됨)
    ├── cli.py               ← 스케줄러 CLI (내부 호출)
    └── __main__.py          ← launcher.main() 호출
```

### 3.2 목표 실행 방식

```bash
# 모든 방식이 동일하게 launcher.main() 호출
orchay                    # entry point 통해
python -m orchay          # __main__.py 통해
./dist/orchay             # PyInstaller 빌드 실행 파일
```

---

## 4. 구현 계획

### 4.1 파일 이동

**작업**: `orchay/launcher.py` → `orchay/src/orchay/launcher.py`

```bash
mv orchay/launcher.py orchay/src/orchay/launcher.py
```

### 4.2 경로 로직 수정

**파일**: `orchay/src/orchay/launcher.py`

**변경 대상 함수**: `get_orchay_cmd()`

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| PROJECT_ROOT | `Path(__file__).parent` (orchay/) | `Path(__file__).parent.parent.parent` (orchay/) |
| 상대 경로 | `orchay/src/orchay` | 패키지 내부에서 자체 참조 |

**변경 코드**:

```python
def get_orchay_cmd() -> list[str]:
    """orchay 스케줄러 실행 명령 반환."""
    # PyInstaller frozen 환경 감지
    if getattr(sys, 'frozen', False):
        # 빌드된 실행 파일: 자기 자신 + run 서브커맨드
        return [sys.executable, "run"]

    # 개발 환경: uv run 사용
    project_root = Path(__file__).parent.parent.parent  # orchay/
    return ["uv", "run", "--project", str(project_root), "python", "-m", "orchay", "run"]
```

### 4.3 Import 경로 조정

**파일**: `orchay/src/orchay/launcher.py`

기존 상대 import 확인 필요:
- 현재 독립 스크립트로 외부 import 없음
- 이동 후에도 표준 라이브러리만 사용하므로 변경 불필요

### 4.4 Type Annotation 확인

Pyright strict 모드 통과를 위해 다음 확인:
- 모든 함수 반환 타입 명시
- `subprocess.run` 호출 시 타입 힌트 확인

---

## 5. 범위 검증

### 5.1 범위 내 (이 Task에서 수행)

- [x] launcher.py 파일 이동
- [x] get_orchay_cmd() 경로 로직 수정
- [x] Pyright strict 모드 통과 확인

### 5.2 범위 외 (다른 Task에서 수행)

- pyproject.toml 엔트리포인트 변경 → TSK-01-02
- __main__.py 수정 → TSK-01-03

---

## 6. 수용 기준

| # | 기준 | 검증 방법 |
|---|------|----------|
| 1 | launcher.py가 src/orchay/ 내에 위치 | 파일 존재 확인 |
| 2 | import 오류 없이 모듈 로드 가능 | `python -c "from orchay.launcher import main"` |
| 3 | Pyright strict 모드 통과 | `pyright src/orchay/launcher.py` |

---

## 7. 위험 요소

| 위험 | 영향 | 완화 방안 |
|------|------|----------|
| 기존 launcher.py 직접 실행 스크립트 호환성 | 낮음 | 문서에 새로운 실행 방법 안내 |
| 경로 계산 오류 | 중간 | 단위 테스트로 경로 검증 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-29 | 초기 기술 설계 작성 |
