# 구현 보고서: TSK-01-01 launcher.py 패키지 이동

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-01 |
| Task명 | launcher.py 패키지 이동 |
| Category | infrastructure |
| 상태 | 구현 [im] |
| 작성일 | 2025-12-30 |

---

## 1. 구현 요약

### 1.1 변경 사항

| 항목 | 이전 | 이후 |
|------|------|------|
| 파일 위치 | `orchay/launcher.py` | `orchay/src/orchay/launcher.py` |
| 프로젝트 경로 계산 | `.parent` (1단계) | `.parent.parent.parent` (3단계) |
| PyInstaller 호환 | 미지원 | `sys.frozen` 분기 지원 |

### 1.2 주요 변경 함수

#### `_get_project_dir() -> Path`

```python
def _get_project_dir() -> Path:
    """pyproject.toml이 위치한 프로젝트 디렉토리 반환."""
    if getattr(sys, "frozen", False):
        # PyInstaller frozen 환경: 실행 파일 위치
        return Path(sys.executable).parent
    else:
        # 일반 실행: src/orchay/launcher.py → orchay/
        # __file__: orchay/src/orchay/launcher.py
        # parent[0]: orchay/src/orchay/
        # parent[1]: orchay/src/
        # parent[2]: orchay/ (프로젝트 루트)
        return Path(__file__).resolve().parent.parent.parent
```

#### `get_orchay_cmd() -> str`

```python
def get_orchay_cmd() -> str:
    """orchay 실행 명령 반환."""
    if getattr(sys, "frozen", False):
        # PyInstaller frozen 환경: 직접 실행
        return str(Path(sys.executable))
    else:
        project_dir = _get_project_dir()
        return f"uv run --project {project_dir} python -m orchay"
```

---

## 2. 검증 결과

### 2.1 Pyright Strict 모드

```
0 errors, 0 warnings, 0 informations
```

### 2.2 Import 테스트

```python
>>> from orchay.launcher import main
Import 성공: <function main at 0x7427cf4b0360>
```

### 2.3 파일 구조 확인

```
orchay/
├── pyproject.toml
└── src/orchay/
    ├── launcher.py      ← 신규 위치
    ├── cli.py
    ├── main.py
    └── __main__.py
```

---

## 3. 수용 기준 충족 여부

| 기준 | 상태 | 비고 |
|------|------|------|
| launcher.py가 src/orchay/ 내에 위치 | ✅ | `orchay/src/orchay/launcher.py` |
| import 오류 없이 모듈 로드 가능 | ✅ | `from orchay.launcher import main` 성공 |
| Pyright strict 모드 통과 | ✅ | 0 errors |
| 기존 launcher.py 삭제 | ✅ | `orchay/launcher.py` 삭제됨 |

---

## 4. 추가 구현 사항

### 4.1 타입 힌트 강화

- `INSTALL_GUIDE`: `dict[str, dict[str, str]]` 타입 명시
- `file_config`: `dict[str, Any]` 타입 명시
- `launcher_config`: `cast()` 사용으로 타입 안정성 확보

### 4.2 PyInstaller 호환성

`sys.frozen` 플래그 확인으로 빌드 환경 분기:
- 일반 실행: `uv run --project {project_dir} python -m orchay`
- Frozen 환경: 실행 파일 직접 호출

---

## 5. 후속 작업

| Task ID | 제목 | 상태 |
|---------|------|------|
| TSK-01-02 | pyproject.toml 엔트리포인트 변경 | [ap] 대기 |
| TSK-01-03 | __main__.py 수정 | [ap] 대기 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 구현 완료 |
