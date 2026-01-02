# orchay_web: Electron → Tauri 마이그레이션 계획

## 개요

| 항목 | 내용 |
|------|------|
| **목표** | Electron을 Tauri로 완전 전환하여 시작 시간 개선 |
| **현재** | Electron + Nuxt 3 + Nitro (SSR) |
| **목표** | Tauri 2.0 + Nuxt 3 (SSG) + Rust 백엔드 |
| **예상 효과** | 시작 시간 1-2초 → <500ms, 번들 크기 341MB → ~15MB |

## 사전 조건

```bash
# Rust 툴체인 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # Unix
# Windows: https://rustup.rs 에서 rustup-init.exe 다운로드

# Windows 추가 요구사항
# - Microsoft C++ Build Tools
# - WebView2 (Windows 10/11은 기본 포함)

# Tauri CLI 설치
npm install -D @tauri-apps/cli @tauri-apps/api
```

---

## Phase 1: 기반 설정

### 1.1 Tauri 프로젝트 초기화

```bash
cd C:\project\orchay\orchay_web
npx tauri init
```

### 1.2 파일 생성/수정

| 파일 | 작업 |
|------|------|
| `src-tauri/tauri.conf.json` | 생성 - 앱 설정 |
| `src-tauri/Cargo.toml` | 생성 - Rust 의존성 |
| `src-tauri/src/main.rs` | 생성 - 엔트리포인트 |
| `nuxt.config.ts` | 수정 - SSG 전환 |

### 1.3 nuxt.config.ts 변경

```typescript
// 변경 전
ssr: true,
nitro: { preset: 'node-server' }

// 변경 후
ssr: false,
nitro: { preset: 'static' }
```

---

## Phase 2: Rust 커맨드 구현

### 2.1 구조

```
src-tauri/src/
├── main.rs              # 엔트리포인트
├── lib.rs               # 모듈 export
├── commands/
│   ├── mod.rs
│   ├── config.rs        # IPC 대체 (5개)
│   ├── files.rs         # API 대체 (파일 작업)
│   ├── projects.rs      # 프로젝트 CRUD
│   └── wbs.rs           # WBS 파싱
└── models/
    ├── mod.rs
    └── types.rs         # 공통 타입
```

### 2.2 IPC 핸들러 → Rust 커맨드 변환

| Electron IPC | Tauri Command | 플러그인 |
|--------------|---------------|----------|
| `dialog:selectDirectory` | `select_directory` | tauri-plugin-dialog |
| `config:getBasePath` | `get_base_path` | tauri-plugin-store |
| `config:setBasePath` | `set_base_path` | tauri-plugin-store |
| `config:getRecentPaths` | `get_recent_paths` | tauri-plugin-store |
| `dev:toggleDevTools` | `toggle_devtools` | 내장 |

### 2.3 Nitro API → Rust 커맨드 변환

| API 엔드포인트 | Rust 커맨드 |
|---------------|-------------|
| `GET /api/init` | `check_init_status` |
| `GET /api/config/basePath` | `get_base_path_status` |
| `PUT /api/config/basePath` | `set_base_path` |
| `GET /api/projects` | `get_projects` |
| `GET /api/projects/[id]` | `get_project` |
| `GET /api/projects/[id]/wbs` | `get_wbs` |
| `PUT /api/projects/[id]/wbs` | `put_wbs` |
| `GET /api/settings/workflows` | `get_workflows` |
| 기타 파일 작업 | `read_file`, `write_file` 등 |

---

## Phase 3: 프론트엔드 적응

### 3.1 Tauri API 래퍼 생성

**파일:** `app/utils/tauri.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';

export const tauriAPI = {
  selectDirectory: () => invoke<string | null>('select_directory'),
  getBasePath: () => invoke<string>('get_base_path'),
  setBasePath: (path: string) => invoke('set_base_path', { newPath: path }),
  // ...
};
```

### 3.2 Store 수정

**파일:** `app/stores/config.ts`

- `window.electronAPI` → `tauriAPI` 교체
- `$fetch('/api/...')` → `invoke('command')` 교체
- 환경 감지: `'__TAURI__' in window`

### 3.3 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/stores/config.ts` | Tauri API 통합 |
| `app/stores/projects.ts` | invoke 호출로 변경 |
| `app/stores/wbs.ts` | invoke 호출로 변경 |
| `app/plugins/setup.client.ts` | Tauri 초기화 |
| `app/components/setup/Dialog.vue` | API 호출 변경 |

---

## Phase 4: 빌드 및 테스트

### 4.1 개발 모드 테스트

```bash
npm run tauri dev
```

### 4.2 프로덕션 빌드

```bash
# Windows
npm run build && npx tauri build

# 크로스 플랫폼
rustup target add x86_64-pc-windows-msvc
rustup target add x86_64-apple-darwin aarch64-apple-darwin
rustup target add x86_64-unknown-linux-gnu
```

---

## Phase 5: 정리

### 5.1 삭제 대상

```
orchay_web/
├── electron/           # 전체 삭제
├── dist-electron/      # 전체 삭제
├── electron.vite.config.ts
├── electron-builder.yml
└── server/             # Nitro 서버 삭제 (선택적)
```

### 5.2 의존성 정리

**제거:**
- electron, electron-builder, electron-vite
- get-port-please, wait-on

**추가:**
- @tauri-apps/cli, @tauri-apps/api

---

## 핵심 파일 목록

### 수정 필요

| 파일 | 작업 |
|------|------|
| `nuxt.config.ts` | SSG 전환 |
| `app/stores/config.ts` | Tauri API 통합 |
| `app/stores/projects.ts` | invoke 호출 |
| `app/stores/wbs.ts` | invoke 호출 |
| `app/plugins/setup.client.ts` | Tauri 초기화 |
| `app/components/setup/Dialog.vue` | API 호출 변경 |
| `package.json` | 스크립트 및 의존성 |

### 새로 생성

| 파일 | 내용 |
|------|------|
| `src-tauri/tauri.conf.json` | Tauri 설정 |
| `src-tauri/Cargo.toml` | Rust 의존성 |
| `src-tauri/src/main.rs` | 앱 엔트리포인트 |
| `src-tauri/src/commands/*.rs` | Rust 커맨드 |
| `app/utils/tauri.ts` | API 래퍼 |

### 삭제 예정

| 파일/폴더 |
|----------|
| `electron/` (전체) |
| `electron.vite.config.ts` |
| `electron-builder.yml` |

---

## 위험 요소 및 대응

| 위험 | 대응 |
|------|------|
| Rust 학습 곡선 | Claude가 코드 작성 지원, 점진적 구현 |
| WBS 파서 복잡도 | pulldown-cmark 크레이트 활용 |
| 경로 호환성 | std::path::PathBuf로 플랫폼 추상화 |
| 빌드 시간 | sccache 캐싱, 개발시 debug 빌드 |

---

## 실행 순서

1. [ ] Rust 툴체인 설치 확인
2. [ ] `npx tauri init` 실행
3. [ ] `tauri.conf.json` 설정
4. [ ] `nuxt.config.ts` SSG 전환
5. [ ] `npm run tauri dev` 테스트 (빈 Rust)
6. [ ] Rust 커맨드 하나씩 구현 (config → files → projects → wbs)
7. [ ] 프론트엔드 store 수정
8. [ ] 전체 기능 테스트
9. [ ] Electron 파일 삭제
10. [ ] 프로덕션 빌드 테스트

---

*문서 작성일: 2025년 1월*
