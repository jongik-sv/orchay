# TSK-02-01 - 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-01 |
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-02 |
| 상태 | 작성중 |

---

## 1. 테스트 전략

### 1.1 테스트 범위

| 구분 | 포함 | 제외 |
|------|-----|------|
| 서버 시작 | Custom Server 실행 | - |
| 연결 관리 | 연결/해제 로깅 | 재연결 로직 |
| 룸 조인 | table/kitchen 룸 | 이벤트 브로드캐스트 |
| 입력 검증 | tableId 유효성 | - |

### 1.2 테스트 유형

| 유형 | 설명 | 도구 |
|------|------|------|
| 수동 테스트 | 브라우저 콘솔에서 Socket.io 연결 | 브라우저 DevTools |
| 서버 로그 검증 | 터미널 출력 확인 | 육안 검사 |

---

## 2. 테스트 케이스

### TC-01: Custom Server 시작

| 항목 | 내용 |
|------|------|
| ID | TC-01 |
| 우선순위 | 높음 |
| 유즈케이스 | - |
| 사전 조건 | 의존성 설치 완료 (`npm install`) |
| 테스트 단계 | 1. 터미널에서 `npm run dev` 실행 |
| 예상 결과 | `> Ready on http://localhost:3000` 출력 |
| 성공 기준 | 서버가 정상 시작되고 3000 포트 리스닝 |

**검증 명령어:**
```bash
npm run dev
# 예상 출력: > Ready on http://localhost:3000
```

---

### TC-02: 테이블 룸 조인

| 항목 | 내용 |
|------|------|
| ID | TC-02 |
| 우선순위 | 높음 |
| 유즈케이스 | UC-01 |
| 사전 조건 | TC-01 통과 (서버 실행 중) |
| 테스트 단계 | 1. 브라우저 콘솔에서 Socket.io 연결<br>2. `join:table` 이벤트 전송 |
| 예상 결과 | 서버 로그에 룸 조인 메시지 출력 |
| 성공 기준 | `[Socket.io] {id} → table:5 조인` 로그 확인 |

**검증 스크립트 (브라우저 콘솔):**
```javascript
const socket = io('http://localhost:3000');
socket.on('connect', () => {
  console.log('연결됨:', socket.id);
  socket.emit('join:table', 5);
});
```

**서버 예상 로그:**
```
[Socket.io] 연결됨: {socket.id}
[Socket.io] {socket.id} → table:5 조인
```

---

### TC-03: 주방 룸 조인

| 항목 | 내용 |
|------|------|
| ID | TC-03 |
| 우선순위 | 높음 |
| 유즈케이스 | UC-02 |
| 사전 조건 | TC-01 통과 (서버 실행 중) |
| 테스트 단계 | 1. 브라우저 콘솔에서 Socket.io 연결<br>2. `join:kitchen` 이벤트 전송 |
| 예상 결과 | 서버 로그에 kitchen 룸 조인 메시지 출력 |
| 성공 기준 | `[Socket.io] {id} → kitchen 조인` 로그 확인 |

**검증 스크립트 (브라우저 콘솔):**
```javascript
const socket = io('http://localhost:3000');
socket.on('connect', () => {
  console.log('연결됨:', socket.id);
  socket.emit('join:kitchen');
});
```

**서버 예상 로그:**
```
[Socket.io] 연결됨: {socket.id}
[Socket.io] {socket.id} → kitchen 조인
```

---

### TC-04: 연결 해제 처리

| 항목 | 내용 |
|------|------|
| ID | TC-04 |
| 우선순위 | 중간 |
| 유즈케이스 | UC-03 |
| 사전 조건 | TC-02 또는 TC-03 통과 (연결 상태) |
| 테스트 단계 | 1. 브라우저 탭 닫기 또는 `socket.disconnect()` 호출 |
| 예상 결과 | 서버 로그에 연결 해제 메시지 출력 |
| 성공 기준 | `[Socket.io] 연결 해제: {id}` 로그 확인 |

**검증 스크립트 (브라우저 콘솔):**
```javascript
socket.disconnect();
```

**서버 예상 로그:**
```
[Socket.io] 연결 해제: {socket.id}
```

---

### TC-05: 잘못된 tableId 처리

| 항목 | 내용 |
|------|------|
| ID | TC-05 |
| 우선순위 | 중간 |
| 유즈케이스 | UC-01 (예외 케이스) |
| 사전 조건 | TC-01 통과 (서버 실행 중) |
| 테스트 단계 | 1. 문자열 tableId로 `join:table` 전송<br>2. 음수 tableId로 전송<br>3. 범위 초과 tableId로 전송 |
| 예상 결과 | 서버 로그에 경고 메시지 출력, 룸 조인 안 됨 |
| 성공 기준 | `[Socket.io] 잘못된 tableId:` 로그 확인 |

**검증 스크립트 (브라우저 콘솔):**
```javascript
// 케이스 1: 문자열
socket.emit('join:table', 'invalid');
// 예상: [Socket.io] 잘못된 tableId: invalid

// 케이스 2: 음수
socket.emit('join:table', -1);
// 예상: [Socket.io] 잘못된 tableId: -1

// 케이스 3: 범위 초과
socket.emit('join:table', 999);
// 예상: [Socket.io] 잘못된 tableId: 999
```

---

### TC-06: 소켓 에러 핸들링

| 항목 | 내용 |
|------|------|
| ID | TC-06 |
| 우선순위 | 낮음 |
| 유즈케이스 | - |
| 사전 조건 | TC-01 통과 (서버 실행 중) |
| 테스트 단계 | 소켓 에러 이벤트 발생 시 로그 확인 |
| 예상 결과 | 에러 로그 출력, 서버 크래시 없음 |
| 성공 기준 | `[Socket.io] 소켓 에러:` 로그 확인 |

---

## 3. 테스트 결과 템플릿

| TC ID | 테스트명 | 결과 | 비고 |
|-------|---------|------|------|
| TC-01 | Custom Server 시작 | - | |
| TC-02 | 테이블 룸 조인 | - | |
| TC-03 | 주방 룸 조인 | - | |
| TC-04 | 연결 해제 처리 | - | |
| TC-05 | 잘못된 tableId 처리 | - | |
| TC-06 | 소켓 에러 핸들링 | - | |

---

## 4. 수용 기준 체크리스트

- [ ] AC-01: `npm run dev`로 Custom Server 실행
- [ ] AC-02: 클라이언트 연결 시 로그 출력
- [ ] AC-03: `join:table` 이벤트로 룸 조인
- [ ] AC-04: `join:kitchen` 이벤트로 룸 조인
- [ ] AC-05: 잘못된 tableId 입력 시 경고 로그 출력

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 (리뷰 반영) |
