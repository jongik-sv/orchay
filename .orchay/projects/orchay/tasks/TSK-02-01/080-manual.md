# 자동 재개 메커니즘 - 사용자 매뉴얼

## 0. 문서 메타데이터

* **문서명**: `080-manual.md`
* **Task ID**: TSK-02-01
* **Task 명**: 자동 재개 메커니즘
* **작성일**: 2025-12-28
* **대상 사용자**: orchay 운영자, 개발자

---

## 1. 개요

### 1.1 기능 소개
자동 재개 메커니즘은 Claude Code Worker가 일시 중단(paused) 상태일 때 자동으로 재개하는 기능입니다. 이를 통해 무인 운영 환경에서 작업 연속성을 확보합니다.

### 1.2 대상 사용자
- orchay를 사용하여 작업을 자동 분배하는 **운영자**
- 자동 재개 로직을 확장하려는 **개발자**

### 1.3 지원하는 중단 유형

| 유형 | 원인 | 기본 대기 시간 |
|------|------|---------------|
| Weekly Limit | 주간 사용량 초과 | reset 시간까지 대기 |
| Rate Limit | 요청 빈도 초과 | 60초 |
| Context Limit | 대화 길이 초과 | 5초 |

---

## 2. 시작하기

### 2.1 사전 요구사항
- Python >= 3.10
- orchay 패키지 설치 완료
- WezTerm CLI 사용 가능 (`wezterm cli` 명령어)

### 2.2 설정

`orchay.json`에서 재개 설정을 구성합니다:

```json
{
  "recovery": {
    "resume_text": "계속",
    "default_wait_time": 60,
    "context_limit_wait": 5,
    "weekly_limit_default": 3600,
    "max_retries": 3
  }
}
```

| 설정 | 설명 | 기본값 |
|------|------|--------|
| `resume_text` | 재개 시 전송할 텍스트 | "계속" |
| `default_wait_time` | Rate limit 대기 시간 (초) | 60 |
| `context_limit_wait` | Context limit 대기 시간 (초) | 5 |
| `weekly_limit_default` | Weekly limit 파싱 실패 시 대기 시간 (초) | 3600 |
| `max_retries` | 최대 재시도 횟수 | 3 |

---

## 3. 사용 방법

### 3.1 기본 동작

자동 재개는 스케줄러 메인 루프에서 자동으로 작동합니다:

1. Worker가 `paused` 상태로 감지됨
2. 중단 유형 자동 판별 (weekly/rate/context)
3. 유형에 맞는 대기 시간 계산
4. 대기 후 "계속" 텍스트 전송
5. Worker 상태 확인 → busy 전환 시 성공

### 3.2 Weekly Limit 처리

Claude Code가 표시하는 reset 시간을 자동으로 파싱합니다:

**지원 형식:**
```
Weekly limit reached · resets Oct 9 at 10:30am
Weekly limit reached · resets Oct 6, 1pm
reset at Dec 15, 9:45am
```

### 3.3 재시도 횟수 관리

- 재개 실패 시 `retry_count` 증가
- 최대 재시도(`max_retries`) 초과 시 → `error` 상태로 전환
- 재개 성공 시 `retry_count` 초기화

---

## 4. FAQ

### Q1. Weekly limit reset 시간이 파싱되지 않으면?
**A**: `weekly_limit_default` 시간(기본 1시간) 대기 후 재개를 시도합니다.

### Q2. 재개 실패 시 어떻게 되나요?
**A**: 최대 3회까지 자동 재시도합니다. 초과 시 Worker가 `error` 상태로 전환되며, 수동 개입이 필요합니다.

### Q3. 재개 텍스트를 변경할 수 있나요?
**A**: 네, `orchay.json`의 `recovery.resume_text`를 수정하세요. 예: `"계속해"`

### Q4. Context limit은 왜 대기 시간이 짧은가요?
**A**: Context limit은 `/clear` 후 이어서 작업해야 하는 상황으로, 짧은 대기 후 재개를 시도합니다.

---

## 5. 문제 해결

### 5.1 Worker가 계속 paused 상태인 경우

**증상**: 재개 시도 후에도 Worker가 paused 상태 유지

**해결 방법**:
1. Worker pane에서 실제 출력 확인
2. 패턴 매칭 실패인 경우 `recovery.py`의 패턴 추가 검토
3. 수동으로 "계속" 입력하여 재개

### 5.2 Error 상태 전환 후 복구

**증상**: 최대 재시도 초과로 error 상태

**해결 방법**:
1. 스케줄러에서 Worker 상태 수동 리셋
2. 원인 분석 (실제 Claude Code 상태 확인)
3. 필요 시 `orchay restart` 명령 사용

### 5.3 Reset 시간 파싱 오류

**증상**: Weekly limit인데 기본 대기 시간 적용

**해결 방법**:
1. Worker pane 출력에서 reset 메시지 형식 확인
2. 새로운 형식이면 `RESET_PATTERNS`에 패턴 추가

---

## 6. 참고 자료

### 6.1 관련 파일

| 파일 | 설명 |
|------|------|
| `orchay/src/orchay/recovery.py` | 자동 재개 핵심 로직 |
| `orchay/src/orchay/models/config.py` | RecoveryConfig 설정 모델 |
| `orchay/tests/test_recovery.py` | 단위 테스트 (28개) |

### 6.2 API 참조

```python
from orchay.recovery import (
    extract_reset_time,      # reset 시간 파싱
    detect_paused_type,      # 중단 유형 판별
    handle_paused_worker,    # 자동 재개 실행
)
```

### 6.3 설계 문서

- `010-design.md` - 통합설계서
- `025-traceability-matrix.md` - 추적성 매트릭스
- `026-test-specification.md` - 테스트 명세서
- `030-implementation.md` - 구현 보고서

---

<!--
TSK-02-01 Manual
Version: 1.0.0
-->
