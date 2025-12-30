# 기술 설계: TSK-01-02 pyproject.toml 엔트리포인트 변경

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-02 |
| 카테고리 | infrastructure |
| 상태 | 상세설계 [dd] |
| 작성일 | 2025-12-30 |
| PRD 참조 | PRD 9.2 pyproject.toml 변경 |

---

## 1. 목적

pyproject.toml의 `[project.scripts]` 섹션을 수정하여 orchay 명령어가 launcher.main()을 호출하도록 변경합니다.

---

## 2. 현재 상태

### 2.1 현재 엔트리포인트 설정

```toml
# orchay/pyproject.toml (현재)
[project.scripts]
orchay = "orchay.cli:cli_main"
```

### 2.2 현재 동작 흐름

```
orchay 명령 → orchay.cli:cli_main() → 스케줄러 CLI 직접 실행
```

### 2.3 문제점

- launcher.py의 WezTerm 레이아웃 생성 로직이 호출되지 않음
- 사용자가 별도로 launcher.py를 실행해야 함
- PyInstaller 빌드 시 엔트리포인트 불일치

---

## 3. 목표 상태

### 3.1 변경될 엔트리포인트 설정

```toml
# orchay/pyproject.toml (변경 후)
[project.scripts]
orchay = "orchay.launcher:main"
```

### 3.2 목표 동작 흐름

```
orchay 명령 → orchay.launcher:main() → WezTerm 레이아웃 생성 → 스케줄러 실행
```

---

## 4. 구현 계획

### 4.1 변경 사항

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

### 4.3 의존성

- TSK-01-01 완료 필수: launcher.py가 `orchay/src/orchay/`로 이동되어야 함
- launcher.py에 `main()` 함수가 정의되어 있어야 함

---

## 5. 수용 기준

| 번호 | 기준 | 검증 방법 |
|------|------|----------|
| AC-1 | `uv pip install -e .` 성공 | 명령어 실행 후 오류 없음 |
| AC-2 | `orchay` 명령 실행 시 launcher.main() 호출 | WezTerm 레이아웃 생성 확인 |
| AC-3 | `python -m orchay` 동일하게 동작 | 동일 결과 확인 |

---

## 6. 테스트 계획

### 6.1 설치 테스트

```bash
cd orchay
uv pip install -e .
```

### 6.2 실행 테스트

```bash
# 엔트리포인트 실행
orchay --help

# 모듈 직접 실행
python -m orchay --help
```

### 6.3 동작 검증

```bash
# WezTerm 레이아웃 생성 확인
orchay -w 3 --dry-run
```

---

## 7. 롤백 계획

문제 발생 시 원래 설정으로 복원:

```toml
[project.scripts]
orchay = "orchay.cli:cli_main"
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 설계 문서 작성 |
