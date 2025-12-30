# 기술 설계: TSK-01-02 pyproject.toml 엔트리포인트 변경

## 1. 개요

### 1.1 목적

`pyproject.toml`의 `[project.scripts]` 섹션을 수정하여 orchay 명령어가 기존 `orchay.cli:cli_main` 대신 `orchay.launcher:main`을 호출하도록 변경합니다.

### 1.2 배경

현재 orchay는 CLI 모듈을 직접 호출하지만, 배포 시스템 구축을 위해 launcher.py를 기본 엔트리포인트로 사용해야 합니다. launcher는 WezTerm 레이아웃 생성, 의존성 체크 등의 초기화 로직을 포함합니다.

### 1.3 PRD 참조

- **섹션**: PRD 9.2 pyproject.toml 변경
- **의존 Task**: TSK-01-01 (launcher.py 패키지 이동)

---

## 2. 현재 상태

### 2.1 현재 pyproject.toml 설정

```toml
[project.scripts]
orchay = "orchay.cli:cli_main"
```

### 2.2 현재 실행 흐름

```
orchay 명령 → orchay.cli:cli_main() → argparse → 스케줄러 실행
```

### 2.3 문제점

- launcher의 초기화 로직(WezTerm 실행, 레이아웃 생성)이 우회됨
- PyInstaller 빌드 시 엔트리포인트 불일치 발생 가능

---

## 3. 목표 상태

### 3.1 변경될 pyproject.toml 설정

```toml
[project.scripts]
orchay = "orchay.launcher:main"
```

### 3.2 목표 실행 흐름

```
orchay 명령 → orchay.launcher:main() → WezTerm 레이아웃 생성 → 스케줄러 실행
```

---

## 4. 구현 계획

### 4.1 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `orchay/pyproject.toml` | `[project.scripts]` 섹션 수정 |

### 4.2 변경 상세

**Before:**
```toml
[project.scripts]
orchay = "orchay.cli:cli_main"
```

**After:**
```toml
[project.scripts]
orchay = "orchay.launcher:main"
```

### 4.3 전제 조건

- TSK-01-01 완료 필수 (launcher.py가 `src/orchay/`에 위치)
- `orchay.launcher` 모듈에 `main()` 함수 존재

---

## 5. 검증 계획

### 5.1 설치 검증

```bash
cd orchay
uv pip install -e .
```

**예상 결과**: 성공, 오류 없음

### 5.2 명령어 검증

```bash
orchay --help
```

**예상 결과**: launcher.main() 호출, 도움말 출력

### 5.3 모듈 실행 검증

```bash
python -m orchay --help
```

**예상 결과**: 동일한 동작

---

## 6. 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| `uv pip install -e .` 성공 | 설치 명령 실행 |
| `orchay` 명령 시 launcher.main() 호출 | 명령 실행 및 동작 확인 |
| `python -m orchay` 동일하게 동작 | 모듈 실행 테스트 |

---

## 7. 위험 요소

### 7.1 의존성 위험

- **위험**: TSK-01-01 미완료 시 import 오류 발생
- **대응**: TSK-01-01 완료 후 진행

### 7.2 호환성 위험

- **위험**: 기존 cli_main() 호출 스크립트 영향
- **대응**: 내부 사용만 해당, 외부 호환성 문제 없음

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-30 | 초기 기술 설계 작성 |
