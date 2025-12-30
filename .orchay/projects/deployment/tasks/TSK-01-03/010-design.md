# TSK-01-03: __main__.py 수정 - 통합설계

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-03 |
| 문서 유형 | 통합설계 (Basic + Detail) |
| 작성일 | 2025-12-30 |
| 상태 | Draft |
| PRD 참조 | PRD 9.4 __main__.py 변경 |

---

## 1. 개요

### 1.1 목적

orchay 패키지의 `__main__.py` 모듈을 수정하여 기존 CLI 엔트리포인트(`cli.cli_main()`)를 새로운 launcher 엔트리포인트(`launcher.main()`)로 변경한다.

### 1.2 배경

- TSK-01-01에서 `launcher.py`가 `orchay/src/orchay/`로 이동됨
- TSK-01-02에서 `pyproject.toml`의 엔트리포인트가 `orchay.launcher:main`으로 변경됨
- `python -m orchay` 실행 시에도 동일하게 launcher를 호출하도록 `__main__.py` 수정 필요

### 1.3 범위

| 구분 | 포함 | 제외 |
|------|------|------|
| 대상 파일 | `orchay/src/orchay/__main__.py` | 다른 모듈 |
| 변경 내용 | import 문 및 함수 호출 변경 | 새로운 기능 추가 |

---

## 2. 현재 상태 분석

### 2.1 현재 코드

```python
"""orchay 패키지 진입점."""

from orchay.cli import cli_main

if __name__ == "__main__":
    cli_main()
```

### 2.2 문제점

| 문제 | 설명 |
|------|------|
| 엔트리포인트 불일치 | `pyproject.toml`은 `launcher.main`을 가리키나 `__main__.py`는 `cli_main` 호출 |
| 실행 방식 차이 | `orchay` 명령과 `python -m orchay` 동작이 다름 |

---

## 3. 목표 상태

### 3.1 변경 후 코드

```python
"""orchay 패키지 진입점."""

from orchay.launcher import main

if __name__ == "__main__":
    main()
```

### 3.2 실행 흐름 통일

```
orchay (CLI 명령)
       │
       ▼
pyproject.toml: orchay.launcher:main
       │
       ▼
launcher.main() ◄─── python -m orchay (__main__.py)
       │
       ▼
WezTerm 레이아웃 생성 + 스케줄러 실행
```

---

## 4. 상세 설계

### 4.1 변경 사항

| 항목 | Before | After |
|------|--------|-------|
| Import | `from orchay.cli import cli_main` | `from orchay.launcher import main` |
| 함수 호출 | `cli_main()` | `main()` |
| Docstring | 유지 | 유지 |

### 4.2 코드 변경

**파일**: `orchay/src/orchay/__main__.py`

```python
"""orchay 패키지 진입점."""

from orchay.launcher import main

if __name__ == "__main__":
    main()
```

### 4.3 의존성 확인

- `orchay.launcher` 모듈이 존재해야 함 (TSK-01-01에서 이동 완료)
- `main()` 함수가 export 되어야 함

---

## 5. 수용 기준

| ID | 기준 | 검증 방법 |
|----|------|----------|
| AC-01 | `python -m orchay` 실행 시 WezTerm 레이아웃 생성 | 수동 테스트 |
| AC-02 | 기존 기능 정상 동작 | 스케줄러 UI 표시 확인 |
| AC-03 | import 오류 없음 | `python -c "from orchay.launcher import main"` |

---

## 6. 테스트 계획

### 6.1 단위 테스트

```bash
# import 테스트
python -c "from orchay.launcher import main; print('OK')"
```

### 6.2 통합 테스트

```bash
# python -m orchay 실행 테스트
cd /home/jji/project/orchay/orchay
python -m orchay --help
```

### 6.3 기능 테스트

| 테스트 | 예상 결과 |
|--------|----------|
| `python -m orchay` | WezTerm 새 창에서 레이아웃 생성 |
| `python -m orchay --help` | launcher의 help 메시지 출력 |

---

## 7. 리스크 및 대응

| 리스크 | 영향도 | 대응 |
|--------|--------|------|
| launcher 모듈 미존재 | 높음 | TSK-01-01 완료 확인 필수 |
| 순환 import | 중간 | launcher가 cli를 import하지 않도록 확인 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 통합설계 작성 |
