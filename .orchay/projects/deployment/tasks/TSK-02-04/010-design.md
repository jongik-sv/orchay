# TSK-02-04: 로컬 빌드 테스트 (Linux) - 통합설계

> **Category**: development
> **Domain**: qa
> **Status**: detail-design [dd]
> **PRD Reference**: PRD 4.1 로컬 빌드, PRD 4.10 로컬 빌드 테스트

---

## 1. 개요

### 1.1 배경

PyInstaller spec 파일 및 hidden imports 설정이 완료된 후, 실제 Linux 환경에서 빌드 및 실행 테스트를 수행하여 배포 가능 여부를 검증해야 합니다.

### 1.2 목적

- Linux 환경에서 PyInstaller 빌드 성공 여부 확인
- 생성된 바이너리(`dist/orchay`)의 정상 실행 검증
- WezTerm 레이아웃 생성 기능 동작 확인
- 스케줄러 기본 동작 검증

### 1.3 범위

| 포함 | 제외 |
|------|------|
| Linux 로컬 빌드 실행 | Windows/macOS 테스트 (TSK-04-02) |
| 바이너리 실행 테스트 | CI/CD 파이프라인 (TSK-03-01) |
| WezTerm 레이아웃 생성 확인 | UPX 압축 최적화 (TSK-02-05) |
| 스케줄러 기본 동작 검증 | 전체 E2E 테스트 |

---

## 2. 사용자 분석

### 2.1 대상 사용자

| 사용자 | 역할 | 목적 |
|--------|------|------|
| 개발자 | 빌드 테스터 | 로컬 환경에서 빌드 검증 |
| DevOps | 배포 준비자 | CI/CD 전 사전 검증 |

### 2.2 사용 환경

| 항목 | 요구사항 |
|------|----------|
| OS | Linux (Ubuntu 20.04+, glibc 2.31+) |
| Python | 3.10+ |
| WezTerm | PATH에 등록 |
| Claude Code | 설치됨 |

---

## 3. 유즈케이스

### 3.1 UC-01: 로컬 빌드 실행

**Actor**: 개발자

**사전조건**:
- TSK-02-01 (spec 파일) 완료
- TSK-02-02 (hidden imports) 완료
- TSK-02-03 (데이터 파일) 완료
- Python 가상환경 활성화

**기본 흐름**:
1. orchay 디렉토리로 이동
2. 의존성 설치 (`pip install -e .`)
3. PyInstaller 설치 (`pip install pyinstaller`)
4. spec 파일로 빌드 실행 (`pyinstaller orchay.spec`)
5. dist/orchay 바이너리 생성 확인

**사후조건**: `dist/orchay` 실행 파일 존재

### 3.2 UC-02: 바이너리 기본 실행 테스트

**Actor**: 개발자

**사전조건**: UC-01 완료

**기본 흐름**:
1. `./dist/orchay --help` 실행
2. 도움말 출력 확인
3. `./dist/orchay --version` 실행
4. 버전 정보 출력 확인

**사후조건**: 명령행 인터페이스 정상 동작 확인

### 3.3 UC-03: WezTerm 레이아웃 생성 테스트

**Actor**: 개발자

**사전조건**:
- UC-01 완료
- WezTerm 설치 및 PATH 등록

**기본 흐름**:
1. `./dist/orchay` 실행 (인수 없이)
2. WezTerm 창 생성 확인
3. 스케줄러 + Worker pane 레이아웃 확인
4. 스케줄러 pane에서 orchay 명령 실행 확인

**사후조건**: WezTerm에서 orchay 레이아웃 정상 생성

### 3.4 UC-04: 스케줄러 Dry-run 테스트

**Actor**: 개발자

**사전조건**: UC-01 완료

**기본 흐름**:
1. `.orchay` 프로젝트 디렉토리 존재 확인
2. `./dist/orchay --dry-run` 실행
3. Task 목록 출력 확인
4. 실제 dispatch 없이 상태만 표시 확인

**사후조건**: Dry-run 모드 정상 동작 확인

---

## 4. 사용자 시나리오

### 4.1 전체 빌드 및 테스트 시나리오

```
개발자 → orchay 디렉토리로 이동
       → pip install -e . && pip install pyinstaller
       → pyinstaller orchay.spec
       → 빌드 로그 확인 (WARNING 검토, ERROR 없음 확인)
       → ls -la dist/orchay (파일 크기 확인: 20-40MB 예상)
       → ./dist/orchay --help (도움말 출력 확인)
       → ./dist/orchay --version (버전 출력 확인)
       → ./dist/orchay (WezTerm 레이아웃 생성 확인)
       → WezTerm 창에서 스케줄러 동작 확인
       → 테스트 완료
```

---

## 5. 테스트 절차

### 5.1 환경 준비

```bash
# 1. 프로젝트 디렉토리 이동
cd orchay

# 2. 가상환경 생성 및 활성화 (uv 사용)
uv venv
source .venv/bin/activate

# 3. 의존성 설치
pip install -e .
pip install pyinstaller
```

### 5.2 빌드 실행

```bash
# spec 파일 기반 빌드
pyinstaller orchay.spec

# 또는 직접 빌드 (spec 없이)
pyinstaller --onefile --name orchay src/orchay/__main__.py
```

### 5.3 테스트 체크리스트

| 테스트 | 명령어 | 예상 결과 |
|--------|--------|----------|
| 파일 존재 | `ls -la dist/orchay` | 20-40MB 실행 파일 |
| 도움말 | `./dist/orchay --help` | 사용법 출력 |
| 버전 | `./dist/orchay --version` | 버전 정보 출력 |
| 레이아웃 | `./dist/orchay` | WezTerm 창 생성 |
| Dry-run | `./dist/orchay --dry-run` | Task 목록 출력 |

---

## 6. 예상 이슈 및 해결방안

### 6.1 ModuleNotFoundError

**증상**: 실행 시 특정 모듈을 찾을 수 없음

**원인**: Hidden imports 누락

**해결**:
1. 오류 메시지에서 누락 모듈 확인
2. `orchay.spec`의 `hiddenimports` 배열에 추가
3. 재빌드

### 6.2 FileNotFoundError (리소스)

**증상**: 설정 파일이나 리소스 로드 실패

**원인**: 데이터 파일 미포함

**해결**:
1. `orchay.spec`의 `datas` 배열에 리소스 경로 추가
2. 코드에서 `sys._MEIPASS` 기반 경로 사용 확인
3. 재빌드

### 6.3 glibc 버전 불일치

**증상**: `GLIBC_X.XX not found` 오류

**원인**: 빌드 환경과 실행 환경의 glibc 버전 차이

**해결**:
1. 더 오래된 Linux (Ubuntu 20.04 등)에서 빌드
2. 또는 Docker 컨테이너로 빌드 환경 통일

### 6.4 WezTerm 미설치

**증상**: `wezterm: command not found`

**원인**: WezTerm이 PATH에 없음

**해결**:
1. WezTerm 설치: `flatpak install flathub org.wezfurlong.wezterm`
2. PATH 등록 확인

---

## 7. 비즈니스 규칙

| 규칙 | 설명 |
|------|------|
| BR-01 | 빌드는 반드시 대상 플랫폼에서 실행해야 함 |
| BR-02 | 바이너리는 단일 실행 파일이어야 함 (onefile) |
| BR-03 | 콘솔 모드 유지 (GUI 없음) |
| BR-04 | 외부 의존성 없이 실행 가능해야 함 (Python 미설치 환경) |

---

## 8. 에러 처리

### 8.1 빌드 실패

| 오류 유형 | 메시지 예시 | 조치 |
|----------|------------|------|
| 의존성 오류 | `ModuleNotFoundError` | pip install 확인 |
| spec 오류 | `Invalid spec file` | spec 문법 확인 |
| 권한 오류 | `Permission denied` | 파일 권한 확인 |

### 8.2 실행 실패

| 오류 유형 | 메시지 예시 | 조치 |
|----------|------------|------|
| 라이브러리 누락 | `libXXX.so not found` | 시스템 라이브러리 설치 |
| 모듈 누락 | `No module named XXX` | hidden imports 추가 |
| 리소스 누락 | `FileNotFoundError` | datas 설정 추가 |

---

## 9. 의존성

### 9.1 선행 Task

| Task | 상태 | 설명 |
|------|------|------|
| TSK-02-01 | [dd] | PyInstaller spec 파일 생성 |
| TSK-02-02 | [ ] | Hidden Imports 분석 및 설정 |
| TSK-02-03 | [ ] | 데이터 파일 및 리소스 번들링 |

### 9.2 외부 의존성

| 의존성 | 버전 | 용도 |
|--------|------|------|
| PyInstaller | 6.x | 빌드 도구 |
| Python | 3.10+ | 빌드 환경 |
| WezTerm | latest | 실행 테스트 |

---

## 10. 후속 작업

| Task | 설명 |
|------|------|
| TSK-02-05 | UPX 압축 설정 (선택) |
| TSK-03-01 | GitHub Actions 빌드 워크플로우 |
| TSK-04-02 | 크로스 플랫폼 배포 테스트 |

---

## 11. 구현 범위

### 11.1 영향 영역

| 영역 | 변경 내용 |
|------|----------|
| 빌드 | PyInstaller 빌드 프로세스 검증 |
| 테스트 | 수동 테스트 절차 수행 |
| 문서 | 테스트 결과 기록 |

### 11.2 제약사항

- Linux 환경에서만 빌드/테스트 가능
- WezTerm 설치 필수
- 실제 Task dispatch 테스트는 제외 (dry-run만)

---

## 12. 설계 완료 체크리스트

- [x] 테스트 목적 정의
- [x] 테스트 절차 문서화
- [x] 예상 이슈 및 해결방안 정리
- [x] 의존성 확인
- [x] 수용 기준 명확화

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-30 | 초기 통합설계 작성 |
