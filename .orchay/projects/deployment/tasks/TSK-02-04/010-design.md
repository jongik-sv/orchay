# TSK-02-04: 로컬 빌드 테스트 (Linux)

> **category**: development
> **domain**: qa
> **prd-ref**: PRD 4.1 로컬 빌드, PRD 4.10 로컬 빌드 테스트
> **created**: 2025-12-30

---

## 1. 개요

### 1.1 목적

Linux 환경에서 PyInstaller로 빌드된 orchay 바이너리의 정상 동작을 검증한다. 이는 GitHub Actions CI/CD 파이프라인 구축 전 로컬 환경에서 빌드 가능 여부와 실행 파일의 안정성을 사전 검증하기 위함이다.

### 1.2 범위

| 범위 | 포함 여부 |
|------|----------|
| Linux PyInstaller 빌드 실행 | ✅ |
| dist/orchay 바이너리 생성 확인 | ✅ |
| WezTerm 레이아웃 생성 테스트 | ✅ |
| 스케줄러 정상 동작 확인 | ✅ |
| Windows/macOS 테스트 | ❌ (별도 Task) |
| GitHub Actions 설정 | ❌ (TSK-03-01) |

### 1.3 선행 조건

| 의존 Task | 상태 | 필요 산출물 |
|-----------|------|-------------|
| TSK-02-01 | [dd] | orchay.spec 파일 |
| TSK-02-02 | [dd] | Hidden imports 설정 완료 |
| TSK-02-03 | [ ] | 데이터 파일 번들링 설정 |

---

## 2. 테스트 시나리오

### 2.1 빌드 검증

**TC-01: PyInstaller 빌드 성공**

```bash
# 사전 조건
cd orchay
pip install -e .
pip install pyinstaller

# 실행
pyinstaller orchay.spec

# 예상 결과
# - dist/orchay 파일 생성
# - 빌드 오류 없음
# - 파일 크기: 20-30MB (예상)
```

**검증 항목:**
- [ ] 빌드 프로세스 성공 (exit code 0)
- [ ] dist/orchay 파일 존재
- [ ] 실행 권한 자동 부여 (ELF 바이너리)

### 2.2 실행 검증

**TC-02: 기본 실행 테스트**

```bash
# 실행
./dist/orchay --help

# 예상 결과
# - 도움말 출력
# - ModuleNotFoundError 없음
# - import 오류 없음
```

**TC-03: WezTerm 레이아웃 생성**

```bash
# 사전 조건: WezTerm 미실행 상태

# 실행
./dist/orchay

# 예상 결과
# - WezTerm 창 생성
# - 스케줄러 + Worker pane 레이아웃 구성
# - 스케줄러 프로세스 시작
```

**TC-04: 스케줄러 동작 테스트**

```bash
# 실행 (dry-run 모드)
./dist/orchay -w 3 --dry-run

# 예상 결과
# - 3개 Worker pane 생성
# - Task 분배 없음 (dry-run)
# - 상태 모니터링 정상
```

---

## 3. 기술 설계

### 3.1 테스트 환경

| 항목 | 값 |
|------|-----|
| OS | Ubuntu 22.04 / Linux 6.8.0-90-generic |
| Python | 3.12+ |
| PyInstaller | 6.x |
| WezTerm | PATH 등록 필수 |
| Claude Code | PATH 등록 필수 |

### 3.2 빌드 절차

```bash
# 1. 의존성 설치
cd orchay
pip install -e .
pip install pyinstaller

# 2. spec 파일 기반 빌드
pyinstaller orchay.spec

# 3. 빌드 결과 확인
ls -lh dist/orchay
file dist/orchay
```

### 3.3 검증 스크립트

```bash
#!/bin/bash
# test-local-build.sh

set -e

echo "=== PyInstaller 로컬 빌드 테스트 ==="

# 1. 빌드 결과 확인
if [ ! -f "dist/orchay" ]; then
    echo "[FAIL] dist/orchay 파일 없음"
    exit 1
fi
echo "[PASS] dist/orchay 파일 존재"

# 2. 파일 타입 확인
FILE_TYPE=$(file dist/orchay)
if [[ ! "$FILE_TYPE" == *"ELF"* ]]; then
    echo "[FAIL] ELF 바이너리가 아님: $FILE_TYPE"
    exit 1
fi
echo "[PASS] ELF 바이너리 확인"

# 3. 실행 권한 확인
if [ ! -x "dist/orchay" ]; then
    echo "[WARN] 실행 권한 없음, 추가"
    chmod +x dist/orchay
fi
echo "[PASS] 실행 권한 확인"

# 4. --help 테스트
if ./dist/orchay --help > /dev/null 2>&1; then
    echo "[PASS] --help 실행 성공"
else
    echo "[FAIL] --help 실행 실패"
    exit 1
fi

# 5. import 오류 확인 (ModuleNotFoundError)
OUTPUT=$(./dist/orchay --help 2>&1)
if [[ "$OUTPUT" == *"ModuleNotFoundError"* ]]; then
    echo "[FAIL] ModuleNotFoundError 발생"
    echo "$OUTPUT"
    exit 1
fi
echo "[PASS] import 오류 없음"

echo ""
echo "=== 모든 테스트 통과 ==="
```

---

## 4. 예상 오류 및 대응

### 4.1 ModuleNotFoundError

**원인:** Hidden imports 누락

**대응:**
1. 오류 메시지에서 누락된 모듈 확인
2. orchay.spec의 hiddenimports에 추가
3. 재빌드 후 테스트

```python
# orchay.spec
hiddenimports += ['누락된_모듈명']
```

### 4.2 FileNotFoundError (workflows.json)

**원인:** 데이터 파일 번들링 누락

**대응:**
1. spec 파일의 datas 설정 확인
2. TSK-02-03 완료 후 재테스트

### 4.3 glibc 버전 오류

**원인:** 빌드 환경과 실행 환경의 glibc 버전 불일치

**대응:**
- 빌드는 낮은 버전의 Linux에서 수행 (예: Ubuntu 20.04)
- 또는 Docker manylinux 이미지 사용

---

## 5. 수용 기준

| 번호 | 기준 | 검증 방법 |
|------|------|----------|
| AC-01 | ./dist/orchay 실행 성공 | `./dist/orchay --help` 정상 출력 |
| AC-02 | 스케줄러 정상 동작 | WezTerm 레이아웃 생성, Worker pane 구성 |
| AC-03 | import 오류 없음 | ModuleNotFoundError 미발생 |
| AC-04 | 데이터 파일 로드 성공 | workflows.json 정상 로드 |

---

## 6. 산출물

| 산출물 | 위치 | 설명 |
|--------|------|------|
| dist/orchay | orchay/dist/orchay | Linux x64 바이너리 |
| 테스트 로그 | - | 빌드 및 실행 결과 |

---

## 7. 참고 자료

- PRD 4.1 도구 선택
- PRD 4.10 로컬 빌드 테스트
- TRD 3.1 Linux 빌드
- TSK-02-01 orchay.spec 설계

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 통합설계 초안 작성 |
