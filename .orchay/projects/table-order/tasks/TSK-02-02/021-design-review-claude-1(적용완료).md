# TSK-02-02 설계 리뷰 보고서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-02 |
| 리뷰 대상 | 010-design.md |
| 리뷰어 | claude-1 |
| 리뷰 일자 | 2026-01-02 |

---

## 1. 리뷰 요약

### 1.1 검증 대상 문서

| 문서 | 상태 | 비고 |
|------|------|------|
| 010-design.md | O | 통합 설계 문서 존재 |
| 025-traceability-matrix.md | X | **미작성** |
| 026-test-specification.md | X | **미작성** |

### 1.2 검증 결과 요약

| 검증 영역 | 평가 | 비고 |
|----------|------|------|
| 문서 완전성 | **FAIL** | 추적성 매트릭스, 테스트 명세 미작성 |
| 요구사항 추적성 | WARN | PRD 매핑 필요, 별도 문서 필요 |
| 아키텍처 | PASS | 설계 구조 적절 |
| 보안 | WARN | 1건 개선 권장 |
| 성능 | PASS | 재연결 전략 적절 |
| 테스트 가능성 | WARN | 테스트 시나리오 정의 필요 |

### 1.3 이슈 분포

| 심각도 | 건수 |
|--------|------|
| Critical | 1 |
| High | 1 |
| Medium | 2 |
| Low | 1 |
| Info | 1 |
| **총계** | **6건** |

---

## 2. 상세 리뷰 결과

### 2.1 [Critical] P1 - 추적성 매트릭스 미작성

**위치**: Task 폴더

**현재 상태**:
- `025-traceability-matrix.md` 파일이 존재하지 않음
- 설계 문서 체크리스트에서도 미완료(`[ ]`)로 표시됨

**영향**:
- PRD 요구사항(K-001, K-002, C-030, C-031)과 설계 간 추적 불가
- 요구사항 누락 여부 검증 불가능
- 구현 후 검증 기준 모호

**권장 조치**:
```
1. 025-traceability-matrix.md 작성
2. PRD 요구사항 ID (K-001, C-030 등) → 설계 섹션 매핑
3. 설계 → 테스트 케이스 매핑 추가
```

**참조**: PRD 섹션 3.1 (고객 화면), 3.2 (주방 화면), 섹션 5 (WebSocket 이벤트)

---

### 2.2 [High] P1 - 테스트 명세서 미작성

**위치**: Task 폴더

**현재 상태**:
- `026-test-specification.md` 파일이 존재하지 않음
- 설계 문서 체크리스트에서도 미완료(`[ ]`)로 표시됨

**영향**:
- 단위 테스트 케이스 정의 없음
- E2E 테스트 시나리오 부재
- 구현 품질 검증 기준 불명확

**권장 조치**:
```
1. 026-test-specification.md 작성
2. Socket.io 이벤트 발송 단위 테스트 정의
3. 클라이언트 훅 테스트 케이스 정의
4. E2E: 주문 생성 → 주방 수신 시나리오
5. E2E: 상태 변경 → 고객 수신 시나리오
```

---

### 2.3 [Medium] P2 - 이벤트 입력 검증 부재

**위치**: 010-design.md 섹션 12.2 (서버 이벤트 발송)

**현재 상태**:
```typescript
// 섹션 12.2 코드에서
io.to('kitchen').emit('order:new', {
  orderId: result.lastInsertRowid,
  tableNumber,
  items,
  createdAt: new Date().toISOString(),
});
```

**문제점**:
- `items` 배열의 유효성 검증 없음
- 빈 배열, 잘못된 형식의 아이템 전송 가능
- 주방에서 비정상 데이터 수신 시 UI 오류 가능

**권장 조치**:
```typescript
// 이벤트 발송 전 페이로드 검증
function validateOrderNewPayload(payload: OrderNewEvent): boolean {
  return (
    typeof payload.orderId === 'number' &&
    typeof payload.tableNumber === 'number' &&
    Array.isArray(payload.items) &&
    payload.items.length > 0 &&
    payload.items.every(item =>
      typeof item.menuId === 'number' &&
      typeof item.menuName === 'string' &&
      typeof item.quantity === 'number' && item.quantity > 0
    )
  );
}
```

---

### 2.4 [Medium] P2 - 재연결 시 데이터 동기화 순서 미명시

**위치**: 010-design.md 섹션 6.3 (재연결 처리)

**현재 상태**:
```
| 상태 | 처리 | API 호출 |
|------|------|----------|
| 주방 재연결 | kitchen 룸 재조인 | GET /api/kitchen/orders |
| 고객 재연결 | table:{id} 룸 재조인 | GET /api/orders?table={id} |
```

**문제점**:
- 룸 재조인과 API 호출의 순서 미명시
- 조인 완료 전 API 호출 시 이벤트 누락 가능성
- 경쟁 조건(race condition) 발생 가능

**권장 조치**:
```markdown
재연결 순서:
1. 연결 복원 감지 (connect 이벤트)
2. 룸 재조인 완료 대기
3. API 호출하여 최신 데이터 조회
4. UI 상태 업데이트
```

---

### 2.5 [Low] P3 - 타입 export 누락

**위치**: 010-design.md 섹션 6.2 (이벤트 페이로드)

**현재 상태**:
- `OrderNewEvent`, `OrderStatusEvent` 인터페이스가 설계 문서에만 정의됨
- `types/index.ts`에 추가 명시 없음

**권장 조치**:
```typescript
// types/index.ts에 추가
export interface OrderNewEvent {
  orderId: number;
  tableNumber: number;
  items: {
    menuId: number;
    menuName: string;
    quantity: number;
  }[];
  createdAt: string;
}

export interface OrderStatusEvent {
  orderId: number;
  status: 'pending' | 'cooking' | 'completed';
  updatedAt: string;
}
```

---

### 2.6 [Info] P5 - 연결 상태 인디케이터 구현 범위 명확화

**위치**: 010-design.md 섹션 5.1 (클라이언트 연결 상태 표시)

**현재 상태**:
- "연결 상태 표시는 선택 사항"으로 기재
- UI 구현 Task에서 추가 가능

**제안**:
- 명시적으로 TSK-03-03 또는 TSK-04-01에서 구현하도록 의존성 표기
- 또는 이 Task에서 `useSocket` 훅에 `isConnected` 상태 반환으로 제한

---

## 3. 검증 영역별 상세

### 3.1 문서 완전성

| 항목 | 상태 | 설명 |
|------|------|------|
| 필수 섹션 존재 | PASS | 모든 섹션 작성됨 |
| 문서간 참조 일관성 | PASS | PRD, TRD, TSK-02-01 참조 적절 |
| 추적성 매트릭스 | **FAIL** | 미작성 |
| 테스트 명세서 | **FAIL** | 미작성 |

### 3.2 요구사항 추적성

| PRD 요구사항 | 설계 섹션 | 추적 상태 |
|-------------|----------|----------|
| K-001 (실시간 주문 표시) | UC-01, 시나리오 1 | O |
| K-002 (알림음) | UC-01 사후조건 | O |
| C-030 (주문 내역) | - | 별도 Task |
| C-031 (실시간 상태) | UC-02, 시나리오 2 | O |
| WebSocket 이벤트 | 섹션 6 | O |

### 3.3 아키텍처

| 항목 | 평가 | 비고 |
|------|------|------|
| 컴포넌트 분리 | PASS | lib/socket.ts, hooks/useSocket.ts 분리 |
| 확장성 | PASS | 이벤트 핸들러 추가 용이 |
| 의존성 관리 | PASS | TSK-02-01 의존성 명시 |
| 싱글톤 패턴 | PASS | getSocket() 싱글톤 적절 |

### 3.4 보안

| 항목 | 평가 | 비고 |
|------|------|------|
| 입력 검증 | **WARN** | 이벤트 페이로드 검증 필요 |
| 인증/인가 | N/A | MVP 범위 외 |
| 데이터 노출 | PASS | 민감 정보 없음 |

### 3.5 성능

| 항목 | 평가 | 비고 |
|------|------|------|
| 재연결 전략 | PASS | exponential backoff 적용 |
| 이벤트 빈도 | PASS | 주문 생성/상태 변경 시에만 발송 |
| 메모리 관리 | PASS | 언마운트 시 cleanup 함수 호출 |

### 3.6 테스트 가능성

| 항목 | 평가 | 비고 |
|------|------|------|
| 단위 테스트 정의 | **WARN** | 테스트 명세 미작성 |
| E2E 시나리오 | PASS | 유즈케이스에서 흐름 정의됨 |
| 모킹 가능성 | PASS | Socket.io 모킹 가능 |

---

## 4. 리뷰 결론

### 4.1 필수 수정 사항 (구현 전)

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 추적성 매트릭스 작성 (025-traceability-matrix.md) | 필수 |
| P1 | 테스트 명세서 작성 (026-test-specification.md) | 필수 |

### 4.2 권장 수정 사항

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P2 | 이벤트 페이로드 검증 로직 추가 | 권장 |
| P2 | 재연결 시 순서 명시 | 권장 |
| P3 | types/index.ts에 이벤트 타입 export | 권장 |

### 4.3 다음 단계

**추적성 매트릭스와 테스트 명세서 작성 후**:
- `/wf:apply` - 리뷰 내용 반영
- `/wf:build` - 구현 시작

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | claude-1 | 최초 작성 |

---

## 5. 리뷰 적용 결과

**적용일**: 2026-01-02

### 5.1 적용 판단 요약

| 이슈 ID | 우선순위 | 판단 | 적용 내용 |
|---------|---------|------|----------|
| 2.1 | 🔴 P1 Critical | ✅ 적용 | `025-traceability-matrix.md` 작성 완료 |
| 2.2 | 🔴 P1 High | ✅ 적용 | `026-test-specification.md` 작성 완료 |
| 2.3 | 🟠 P2 Medium | ✅ 적용 | `lib/validators.ts` 검증 함수 설계에 추가 |
| 2.4 | 🟠 P2 Medium | ✅ 적용 | 섹션 6.3에 재연결 순서 명시 |
| 2.5 | 🟡 P3 Low | ✅ 적용 | 섹션 11.1에 types/index.ts 추가 |
| 2.6 | ⚪ P5 Info | ✅ 적용 | 섹션 5에 연결 상태 범위 명확화 |

### 5.2 수정된 문서

| 문서 | 변경 사항 |
|------|----------|
| `010-design.md` | 페이로드 검증 함수 추가, 재연결 순서 명시, 영향 영역 갱신, 체크리스트 갱신 |
| `025-traceability-matrix.md` | 신규 작성 (PRD→설계→테스트 매핑) |
| `026-test-specification.md` | 신규 작성 (UT/IT/E2E 테스트 케이스) |

### 5.3 적용 통계

- ✅ 적용: 6건 (100%)
- 📝 조정 적용: 0건
- ⏸️ 보류: 0건
