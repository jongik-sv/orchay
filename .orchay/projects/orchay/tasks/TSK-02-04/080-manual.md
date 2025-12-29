# orchay CLI 및 설정 관리 매뉴얼

## 1. 개요

orchay는 WezTerm 기반 Task 스케줄러로, CLI 옵션과 설정 파일을 통해 유연하게 동작을 제어할 수 있습니다.

### 1.1 대상 사용자

- CLI 도구에 익숙한 개발자
- WezTerm 환경에서 병렬 작업 분배를 원하는 프로젝트 관리자

### 1.2 주요 기능

- **설정 파일**: `.orchay/settings/orchay.json`을 통한 설정 관리
- **CLI 옵션**: 런타임에 설정값 오버라이드
- **히스토리**: 완료된 작업 기록 저장 및 조회
- **Dry-run**: 실제 분배 없이 스케줄 큐 미리보기

---

## 2. 시작하기

### 2.1 사전 요구사항

- Python >= 3.10
- WezTerm 설치 및 PATH 등록
- uv 패키지 관리자

### 2.2 설치

```bash
cd orchay
uv pip install -e .
```

### 2.3 기본 실행

```bash
# 프로젝트 루트에서 실행
uv run --project orchay python -m orchay [PROJECT]
```

---

## 3. 사용 방법

### 3.1 CLI 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `PROJECT` | 프로젝트명 | orchay |
| `-w, --workers N` | Worker 수 (1-10) | 3 |
| `-i, --interval N` | 모니터링 간격 (1-60초) | 5 |
| `-m, --mode MODE` | 실행 모드 | quick |
| `--dry-run` | 미리보기 (분배 안 함) | - |
| `-v, --verbose` | 상세 로그 출력 | - |

#### 실행 모드

| 모드 | 워크플로우 단계 | 의존성 검사 |
|------|----------------|------------|
| `design` | start만 | 없음 |
| `quick` | start → approve → build → done | [dd]+ only |
| `develop` | start → review → apply → approve → build → audit → patch → test → done | [dd]+ only |
| `force` | start → approve → build → done | 무시 |

#### 예시

```bash
# Worker 2개, develop 모드로 실행
orchay -w 2 -m develop

# 미리보기 모드
orchay --dry-run

# 상세 로그 출력
orchay -v
```

### 3.2 History 서브커맨드

작업 히스토리를 조회하거나 관리합니다.

```bash
# 최근 히스토리 목록 (기본 10개)
orchay history

# 표시 항목 수 지정
orchay history --limit 20

# 특정 Task 상세 조회
orchay history TSK-01-01

# 히스토리 삭제
orchay history --clear
```

### 3.3 Exec 서브커맨드

워크플로우 훅에서 사용하는 Task 실행 상태 관리입니다.

```bash
# Task 실행 시작 등록
orchay exec start TSK-01-01 build

# Task 실행 종료
orchay exec stop TSK-01-01

# 실행 중인 Task 목록
orchay exec list

# Task 단계 갱신
orchay exec update TSK-01-01 done

# 모든 실행 상태 초기화
orchay exec clear
```

---

## 4. 설정 파일

### 4.1 위치

`.orchay/settings/orchay.json`

### 4.2 구조

```json
{
  "workers": 3,
  "interval": 5,
  "category": null,
  "project": null,
  "detection": {
    "donePattern": "ORCHAY_DONE:([^:]+):(\\w+):(success|error)(?::(.+))?",
    "promptPatterns": ["^>\\s*$", "╭─", "❯"],
    "pausePatterns": ["rate.*limit", "weekly.*limit.*reached"],
    "errorPatterns": ["Error:", "Failed:", "❌"],
    "questionPatterns": ["\\?\\s*$", "\\(y/n\\)"],
    "readLines": 50
  },
  "recovery": {
    "resumeText": "계속",
    "defaultWaitTime": 60,
    "contextLimitWait": 5,
    "maxRetries": 3
  },
  "dispatch": {
    "clearBeforeDispatch": true,
    "clearWaitTime": 2
  },
  "history": {
    "enabled": true,
    "storagePath": ".orchay/logs/orchay-history.jsonl",
    "maxEntries": 1000,
    "captureLines": 500
  },
  "execution": {
    "mode": "quick",
    "allowModeSwitch": true
  }
}
```

### 4.3 설정 우선순위

```
CLI 옵션 > 설정 파일 > 기본값
```

---

## 5. FAQ

### Q1: 설정 파일이 없으면 어떻게 되나요?

기본값으로 동작합니다. 경고 메시지가 표시될 수 있습니다.

### Q2: CLI 옵션과 설정 파일 값이 다르면?

CLI 옵션이 우선됩니다. 예: 설정 파일에 `workers: 3`이고 `-w 2`를 전달하면 Worker 2개로 실행됩니다.

### Q3: 히스토리 파일이 너무 커지면?

`maxEntries` 설정(기본 1000)을 초과하면 오래된 항목이 자동 삭제됩니다.

---

## 6. 문제 해결

### 설정 파일 오류

**증상**: "설정 로드 실패" 에러

**해결**:
1. JSON 문법 확인 (온라인 JSON 검증기 사용)
2. 필드값 범위 확인 (workers: 1-10, interval: 1-60)

### WezTerm CLI 오류

**증상**: "WezTerm CLI를 찾을 수 없습니다"

**해결**:
1. WezTerm 설치 확인
2. PATH에 WezTerm 등록 확인
3. `wezterm --version` 명령 테스트

### 히스토리 파일 손상

**증상**: "히스토리 파일 읽기 실패"

**해결**:
```bash
orchay history --clear
```

---

## 7. 참고 자료

- [orchay README](../../../../orchay/README.md)
- [PRD 설정 섹션](./../prd.md#5-설정)
- [PRD CLI 섹션](./../prd.md#6-cli)

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
