# TSK-02-05: UPX 압축 설정

> category: infrastructure
> domain: devops
> created: 2025-12-30
> prd-ref: PRD 4.9 UPX 압축

---

## 1. 목적

PyInstaller로 생성된 orchay 실행 파일의 크기를 UPX(Ultimate Packer for eXecutables)를 통해 최적화하여 배포 효율성을 향상시킨다.

### 1.1 기대 효과

| 항목 | 목표 |
|------|------|
| 파일 크기 감소 | 20-40% |
| 실행 시간 영향 | 최소화 (< 1초 추가) |
| 다운로드 속도 | 개선 |

---

## 2. 현재 상태

### 2.1 PyInstaller 빌드 현황

- TSK-02-04에서 로컬 빌드 테스트 완료
- 현재 spec 파일: `orchay/orchay.spec`
- UPX 옵션: `upx=True` (설정됨, 실제 UPX 미설치 시 무시됨)

### 2.2 예상 파일 크기

| OS | 압축 전 (예상) | 압축 후 (예상) |
|----|---------------|---------------|
| Windows | ~20MB | ~12-14MB |
| Linux | ~25MB | ~15-18MB |
| macOS | ~25MB | ~15-18MB |

---

## 3. 목표 상태

### 3.1 UPX 통합 구성

```
orchay/
├── orchay.spec          # UPX 옵션 활성화
└── .github/workflows/
    └── release.yml      # UPX 설치 단계 포함
```

### 3.2 플랫폼별 UPX 설정

| OS | UPX 설치 방법 | 설정 |
|----|--------------|------|
| Windows | `choco install upx` | `upx=True` |
| Linux | `apt install upx-ucl` | `upx=True`, `strip=True` |
| macOS | `brew install upx` | `upx=False` (호환성 이슈) |

> **주의**: macOS에서 UPX 압축 시 Gatekeeper 문제 및 일부 바이너리 손상 가능. 안정성 우선으로 비활성화 권장.

---

## 4. 구현 계획

### 4.1 orchay.spec 수정

```python
exe = EXE(
    ...
    strip=True,           # Linux/macOS: 심볼 제거
    upx=True,             # UPX 압축 활성화
    upx_exclude=[         # 압축 제외 파일
        'python*.dll',    # Python DLL (Windows)
        'vcruntime*.dll', # VC++ 런타임
        'libpython*',     # Python 라이브러리 (Linux)
    ],
    ...
)
```

### 4.2 GitHub Actions 워크플로우 수정

`.github/workflows/release.yml`에 UPX 설치 단계 추가:

```yaml
- name: Install UPX (Windows)
  if: runner.os == 'Windows'
  run: choco install upx -y

- name: Install UPX (Linux)
  if: runner.os == 'Linux'
  run: sudo apt-get install -y upx-ucl

- name: Install UPX (macOS)
  if: runner.os == 'macOS'
  run: echo "UPX disabled for macOS due to compatibility issues"
```

### 4.3 macOS 예외 처리

macOS에서는 UPX 비활성화를 위한 조건부 빌드:

```yaml
- name: Build with PyInstaller
  run: |
    cd orchay
    if [ "$RUNNER_OS" == "macOS" ]; then
      pyinstaller --onefile --name orchay \
        --strip src/orchay/__main__.py
    else
      pyinstaller orchay.spec
    fi
```

---

## 5. 검증 계획

### 5.1 파일 크기 검증

```bash
# 빌드 후 파일 크기 확인
ls -lh dist/orchay*

# 목표: 20-40% 감소
```

### 5.2 기능 검증

```bash
# 실행 테스트
./dist/orchay --help
./dist/orchay --dry-run

# 레이아웃 생성 테스트
./dist/orchay -w 3
```

### 5.3 실행 시간 측정

```bash
# 시작 시간 측정 (압축 전/후 비교)
time ./dist/orchay --help
```

---

## 6. 수용 기준

| 기준 | 조건 | 검증 방법 |
|------|------|----------|
| 파일 크기 | 20-40% 감소 | `ls -lh` 비교 |
| 실행 가능 | 모든 플랫폼에서 정상 실행 | `--help` 실행 |
| 실행 시간 | 추가 지연 < 1초 | `time` 명령 |
| 기능 정상 | WezTerm 레이아웃 생성 | 수동 테스트 |

---

## 7. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| macOS UPX 호환성 문제 | 실행 파일 손상 | macOS는 UPX 비활성화 |
| 일부 DLL 압축 오류 | 런타임 오류 | `upx_exclude` 설정 |
| 압축 해제 시간 증가 | 시작 지연 | 수용 가능 범위 내 허용 |

---

## 8. 참고 자료

- [UPX 공식 사이트](https://upx.github.io/)
- [PyInstaller UPX 문서](https://pyinstaller.org/en/stable/usage.html#using-upx)
- PRD 4.8 UPX 압축 섹션

---

<!--
TSK-02-05: 010-tech-design.md
Version: 1.0
-->
