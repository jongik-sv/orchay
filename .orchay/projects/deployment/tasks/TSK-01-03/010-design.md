# TSK-01-03 - __main__.py 수정 설계 문서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-03 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-30 |
| 상태 | 작성중 |
| 카테고리 | development |

---

## 1. 개요

### 1.1 배경 및 문제 정의

**현재 상황:**
- `orchay/src/orchay/__main__.py`가 `cli.cli_main()`을 호출함
- `python -m orchay` 실행 시 CLI 모드로 진입 (스케줄러 직접 실행)
- 사용자가 WezTerm 레이아웃을 수동으로 구성해야 함

**해결하려는 문제:**
- 단일 실행 파일(PyInstaller) 배포를 위해 엔트리포인트 통일 필요
- `python -m orchay` 실행 시 `launcher.main()`을 통해 WezTerm 레이아웃 자동 생성 필요

### 1.2 목적 및 기대 효과

**목적:**
- `__main__.py`에서 `launcher.main()` 호출로 변경
- 모든 실행 경로(`orchay` 명령, `python -m orchay`)에서 동일한 동작 보장

**기대 효과:**
- 사용자가 어떤 방식으로 실행하든 WezTerm 레이아웃 자동 생성
- PyInstaller 빌드 시 일관된 동작 보장

### 1.3 범위

**포함:**
- `__main__.py` 파일 수정 (import 변경)

**제외:**
- `launcher.py` 수정 (TSK-01-01에서 처리)
- `pyproject.toml` 수정 (TSK-01-02에서 처리)

### 1.4 참조 문서

| 문서 | 경로 | 관련 섹션 |
|------|------|----------|
| PRD | `.orchay/projects/deployment/prd.md` | 9.4 __main__.py 변경 |

---

## 2. 유즈케이스

### 2.1 UC-01: 모듈 실행

| 항목 | 내용 |
|------|------|
| 액터 | 사용자 |
| 목적 | `python -m orchay`로 orchay 실행 |
| 사전 조건 | orchay 패키지 설치됨, WezTerm 설치됨 |
| 사후 조건 | WezTerm 레이아웃 생성 및 스케줄러 시작 |
| 트리거 | `python -m orchay` 명령 실행 |

**기본 흐름:**
1. 사용자가 `python -m orchay` 명령을 실행한다
2. Python이 `__main__.py`를 로드한다
3. `launcher.main()` 함수가 호출된다
4. WezTerm 레이아웃이 생성된다
5. 스케줄러가 시작된다

---

## 3. 구현 상세

### 3.1 현재 코드

```python
# orchay/src/orchay/__main__.py
"""orchay 패키지 진입점."""

from orchay.cli import cli_main

if __name__ == "__main__":
    cli_main()
```

### 3.2 변경 후 코드

```python
# orchay/src/orchay/__main__.py
"""orchay 패키지 진입점."""

from orchay.launcher import main

if __name__ == "__main__":
    main()
```

### 3.3 변경 사항

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| import | `from orchay.cli import cli_main` | `from orchay.launcher import main` |
| 호출 함수 | `cli_main()` | `main()` |

---

## 4. 의존성

### 4.1 선행 Task

| Task ID | 제목 | 상태 | 이유 |
|---------|------|------|------|
| TSK-01-01 | launcher.py 패키지 이동 | [dd] | `orchay.launcher` 모듈이 존재해야 import 가능 |

### 4.2 후행 Task

없음 - 이 Task 완료 후 WP-02 진행 가능

---

## 5. 테스트 시나리오

### 5.1 정상 동작 테스트

| 테스트 | 명령어 | 예상 결과 |
|--------|--------|----------|
| 모듈 실행 | `python -m orchay --help` | launcher help 출력 |
| 실제 실행 | `python -m orchay` | WezTerm 레이아웃 생성 |

### 5.2 에러 케이스

| 상황 | 원인 | 예상 동작 |
|------|------|----------|
| launcher 모듈 없음 | TSK-01-01 미완료 | `ModuleNotFoundError` |
| main 함수 없음 | launcher.py 수정 오류 | `AttributeError` |

---

## 6. 수용 기준 (Acceptance Criteria)

- [ ] `python -m orchay` 실행 시 WezTerm 레이아웃 생성
- [ ] 기존 기능 정상 동작
- [ ] `ModuleNotFoundError` 없음
- [ ] Pyright strict 모드 통과

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-30 | Claude | 최초 작성 |
