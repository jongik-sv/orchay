# 기술 설계서 - TSK-02-05: UPX 압축 설정

**Task ID**: TSK-02-05
**Category**: infrastructure
**작성일**: 2025-12-30

---

## 1. 목적

PyInstaller 빌드 결과물에 UPX 압축을 적용하여 실행 파일 크기를 20-40% 감소시킨다.

## 2. 요구사항 (PRD 4.9)

| ID | 요구사항 | 수용 기준 |
|----|----------|----------|
| REQ-01 | UPX 설치 및 경로 설정 | 플랫폼별 UPX 자동 설치 |
| REQ-02 | --upx-dir 옵션 적용 | spec 파일에 UPX 경로 설정 |
| REQ-03 | 압축 제외 파일 설정 | 손상 위험 바이너리 제외 |
| REQ-04 | 크기 감소 20-40% | 빌드 전후 크기 비교 |
| REQ-05 | 실행 시간 영향 최소화 | 시작 시간 +10% 이내 |

## 3. 기술 설계

### 3.1 UPX 압축 제외 대상

아래 파일들은 UPX 압축 시 손상될 수 있어 제외:

```python
upx_exclude = [
    # Python 바이트코드/동적 라이브러리
    'python*.dll',
    'python*.so*',
    '_ssl*.so*',
    '_ssl*.pyd',

    # Pydantic Core (Rust 컴파일)
    'pydantic_core*.so*',
    'pydantic_core*.pyd',

    # 암호화 관련
    'libcrypto*.so*',
    'libssl*.so*',
    'libffi*.so*',

    # Windows CRT
    'vcruntime*.dll',
    'api-ms-*.dll',
    'ucrtbase.dll',
]
```

### 3.2 GitHub Actions UPX 설치

| OS | 설치 방법 |
|----|----------|
| Ubuntu | `sudo apt-get install upx` |
| Windows | `choco install upx` |
| macOS | `brew install upx` |

### 3.3 spec 파일 수정 포인트

```python
# EXE 설정
exe = EXE(
    ...
    upx=True,
    upx_exclude=[...],  # 제외 파일 목록
)

# COLLECT 설정
coll = COLLECT(
    ...
    upx=True,
    upx_exclude=[...],  # 동일 제외 목록
)
```

## 4. 구현 대상

| 파일 | 변경 내용 |
|------|----------|
| `orchay/orchay.spec` | UPX 제외 목록 추가 |
| `.github/workflows/release.yml` | UPX 설치 step 추가 |

## 5. 테스트 계획

1. 로컬 빌드 후 크기 비교
2. GitHub Actions 빌드 성공 확인
3. 실행 파일 정상 동작 확인

---

<!--
010-tech-design.md for TSK-02-05
-->
