# TSK-01-03: __main__.py 수정 - 구현 보고서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-03 |
| 문서 유형 | 구현 보고서 |
| 작성일 | 2025-12-30 |
| 상태 | Completed |
| PRD 참조 | PRD 9.4 __main__.py 변경 |

---

## 1. 구현 개요

### 1.1 목적

`python -m orchay` 실행 시 기존 CLI 엔트리포인트(`cli_main`)가 아닌 새로운 launcher 엔트리포인트(`launcher.main`)를 호출하도록 `__main__.py`를 수정했습니다.

### 1.2 변경 범위

| 파일 | 변경 내용 |
|------|----------|
| `orchay/src/orchay/__main__.py` | import 및 함수 호출 변경 |

---

## 2. 코드 변경

### 2.1 Before

```python
"""orchay 패키지 진입점."""

import sys

from orchay.cli import cli_main

if __name__ == "__main__":
    sys.exit(cli_main())
```

### 2.2 After

```python
"""orchay 패키지 진입점."""

import sys

from orchay.launcher import main

if __name__ == "__main__":
    sys.exit(main())
```

### 2.3 변경 사항

| 항목 | Before | After |
|------|--------|-------|
| Import | `from orchay.cli import cli_main` | `from orchay.launcher import main` |
| 함수 호출 | `cli_main()` | `main()` |

---

## 3. 테스트 결과

### 3.1 Import 테스트

```bash
$ python -c "from orchay.launcher import main; print('OK')"
OK: import 성공
```

### 3.2 python -m orchay --help 테스트

```bash
$ uv run python -m orchay --help
Launcher 전용 옵션 (WezTerm 레이아웃):
  --width N             창 너비 픽셀 (기본: 1920)
  --height N            창 높이 픽셀 (기본: 1080)
  --max-rows N          열당 최대 worker 수 (기본: 3)
  --scheduler-cols N    스케줄러 너비 columns (기본: 100)
  --worker-cols N       Worker 너비 columns (기본: 120)
  --font-size F         폰트 크기 (기본: 11.0)

나머지 옵션은 orchay에 그대로 전달됩니다:
...
```

### 3.3 python -m orchay run --help 테스트

```bash
$ uv run python -m orchay run --help
positional arguments:
  wbs                   WBS 파일 경로 (기본: .orchay/projects/orchay/wbs.md)

options:
  -h, --help            show this help message and exit
  -w WORKERS, --workers WORKERS
                        Worker 수 (기본: 3)
  ...
```

### 3.4 Pyright 타입 검사

```bash
$ pyright src/orchay/__main__.py
0 errors, 0 warnings, 0 informations
```

---

## 4. 검증 결과

| AC ID | 기준 | 결과 |
|-------|------|------|
| AC-01 | `python -m orchay` 실행 시 launcher 호출 | ✅ 통과 |
| AC-02 | `python -m orchay run` 서브커맨드 정상 동작 | ✅ 통과 |
| AC-03 | Import 오류 없음 | ✅ 통과 |
| AC-04 | Pyright strict 모드 통과 | ✅ 통과 |

---

## 5. 실행 흐름 확인

```
python -m orchay
       │
       ▼
__main__.py: from orchay.launcher import main
       │
       ▼
launcher.main() 호출
       │
       ├── 서브커맨드 없음: WezTerm 레이아웃 생성
       └── run/exec 서브커맨드: cli.py로 위임
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 구현 완료 |
