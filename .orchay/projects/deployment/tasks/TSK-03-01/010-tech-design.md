# 기술 설계 (010-tech-design.md)

**Template Version:** 1.0.0 — **Last Updated:** 2025-12-30

> **설계 규칙**
> * 인프라/DevOps 중심 설계
> * 구현 코드 포함 금지 (워크플로우 YAML 구조만)
> * PRD와 일관성 유지

---

## 0. 문서 메타데이터

| 항목 | 내용 |
|------|------|
| Task ID | TSK-03-01 |
| Task명 | PyInstaller 빌드 워크플로우 |
| Category | infrastructure |
| Domain | devops |
| 상태 | [dd] 상세설계 |
| 작성일 | 2025-12-30 |
| 작성자 | Claude |

### 상위 문서 참조

| 문서 유형 | 경로 | 참조 섹션 |
|----------|------|----------|
| PRD | `.orchay/projects/deployment/prd.md` | 5.1 실행 파일 빌드 및 릴리스 |
| WBS | `.orchay/projects/deployment/wbs.md` | TSK-03-01 |

---

## 1. 목적

### 1.1 목표
GitHub Actions를 통해 orchay를 Windows, Linux, macOS용 단일 실행 파일로 자동 빌드하고, GitHub Releases에 배포하는 CI/CD 파이프라인 구축

### 1.2 기대 효과

| 효과 | 설명 |
|------|------|
| 자동화 | 태그 푸시만으로 3개 플랫폼 빌드 및 릴리스 자동화 |
| 일관성 | 모든 빌드가 동일한 환경에서 수행 |
| 접근성 | 사용자가 GitHub Releases에서 바로 다운로드 가능 |

---

## 2. 현재 상태

### 2.1 현재 배포 방식
```
현재: uv run --project orchay python -m orchay
문제점:
  - Python 설치 필요
  - uv 설치 필요
  - 가상환경 이해 필요
```

### 2.2 의존성

| 선행 Task | 상태 | 필요 산출물 |
|-----------|------|------------|
| TSK-02-04 | 대기 | 로컬 빌드 테스트 완료 |
| TSK-02-01 | [dd] | `orchay.spec` 파일 |

---

## 3. 목표 상태

### 3.1 릴리스 워크플로우

```
[태그 푸시 v*]
       │
       ▼
┌──────────────────────────────────────────────────────┐
│              GitHub Actions Workflow                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │   Linux    │  │  Windows   │  │   macOS    │     │
│  │  ubuntu-   │  │  windows-  │  │   macos-   │     │
│  │   latest   │  │   latest   │  │   latest   │     │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │
│        │               │               │             │
│        ▼               ▼               ▼             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ PyInstaller│  │ PyInstaller│  │ PyInstaller│     │
│  │   Build    │  │   Build    │  │   Build    │     │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │
│        │               │               │             │
│        ▼               ▼               ▼             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │   orchay   │  │orchay.exe  │  │   orchay   │     │
│  │  (linux)   │  │ (windows)  │  │  (macos)   │     │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │
│        │               │               │             │
│        └───────────────┼───────────────┘             │
│                        ▼                             │
│              ┌─────────────────┐                     │
│              │ GitHub Releases │                     │
│              │   Artifacts     │                     │
│              └─────────────────┘                     │
└──────────────────────────────────────────────────────┘
```

### 3.2 결과물

| 플랫폼 | 아티팩트명 | 파일명 |
|--------|-----------|--------|
| Linux | orchay-linux | `orchay` |
| Windows | orchay-windows | `orchay.exe` |
| macOS | orchay-macos | `orchay` |

---

## 4. 구현 계획

### 4.1 워크플로우 파일

| 항목 | 값 |
|------|-----|
| 파일 경로 | `.github/workflows/release.yml` |
| 트리거 | `push: tags: ['v*']`, `workflow_dispatch` |
| Jobs | `build` (matrix), `release` |

### 4.2 Matrix 전략

| 속성 | Linux | Windows | macOS |
|------|-------|---------|-------|
| os | `ubuntu-latest` | `windows-latest` | `macos-latest` |
| artifact | `orchay-linux` | `orchay-windows` | `orchay-macos` |
| suffix | (없음) | `.exe` | (없음) |

### 4.3 빌드 단계

1. **Checkout**: 코드 체크아웃
2. **Setup Python**: Python 3.12 설정
3. **Install Dependencies**: PyInstaller + orchay 패키지 설치
4. **Build**: spec 파일 기반 PyInstaller 빌드
5. **Upload Artifact**: 빌드 결과물 업로드

### 4.4 릴리스 단계

1. **Download Artifacts**: 모든 플랫폼 아티팩트 다운로드
2. **Rename**: 플랫폼별 명확한 파일명으로 변경
3. **Create Release**: GitHub Release 생성 및 파일 첨부

### 4.5 권한 설정

| 권한 | 값 | 용도 |
|------|-----|------|
| contents | write | Release 생성 및 파일 업로드 |

---

## 5. 기술적 결정

| 결정 | 고려 옵션 | 선택 | 근거 |
|------|----------|------|------|
| Python 버전 | 3.10, 3.11, 3.12 | 3.12 | 최신 안정 버전 |
| PyInstaller 버전 | 5.x, 6.x | 최신 | 호환성 및 버그 수정 |
| 빌드 방식 | `--onefile`, `--onedir` | `--onefile` | 배포 편의성 |
| Release 액션 | gh cli, softprops/action-gh-release | softprops | 간단한 설정 |

---

## 6. 인수 기준

- [ ] AC-01: `v*` 패턴 태그 푸시 시 워크플로우 자동 실행
- [ ] AC-02: Linux, Windows, macOS 3개 플랫폼 빌드 성공
- [ ] AC-03: GitHub Releases에 3개 바이너리 업로드 완료
- [ ] AC-04: 다운로드한 바이너리 실행 가능 (각 플랫폼)
- [ ] AC-05: `workflow_dispatch`로 수동 트리거 가능

---

## 7. 리스크 및 완화

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| PyInstaller 버전 호환성 | Medium | 버전 고정 (`pyinstaller==6.x`) |
| macOS 코드 서명 경고 | Low | 초기 버전은 서명 없이 배포 |
| 히든 임포트 누락 | High | TSK-02-02 결과 반영 |
| spec 파일 경로 오류 | Medium | 상대 경로 대신 절대 경로 사용 |

---

## 8. 의존성

| 의존 대상 | 유형 | 상태 | 설명 |
|----------|------|------|------|
| TSK-02-01 | 선행 | [dd] | spec 파일 생성 |
| TSK-02-02 | 선행 | [dd] | Hidden imports 설정 |
| TSK-02-04 | 선행 | [ ] | 로컬 빌드 테스트 완료 |

---

## 9. 다음 단계

- `/wf:approve` 명령어로 설계 승인 진행
- 승인 후 `/wf:build`로 구현

---

## 관련 문서

- PRD: `.orchay/projects/deployment/prd.md` (섹션 5.1)
- spec 파일: `orchay/orchay.spec` (TSK-02-01에서 생성)
- 상세설계: `020-detail-design.md` (필요시)

---

<!--
author: Claude
Template Version: 1.0.0
-->
