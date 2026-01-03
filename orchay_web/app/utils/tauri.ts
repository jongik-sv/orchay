/**
 * Tauri API 래퍼
 * Electron API와 Nitro API를 대체하는 Tauri 커맨드 호출
 *
 * 주의: SSR 환경에서 동작하도록 동적 import 사용
 */

// ============================================================
// 타입 정의
// ============================================================

export interface OrchayStructure {
  root: boolean;
  settings: boolean;
  templates: boolean;
  projects: boolean;
}

export interface InitStatusData {
  initialized: boolean;
  status: OrchayStructure;
}

export interface InitResponse {
  success: boolean;
  data: InitStatusData;
}

export interface SetBasePathResult {
  success: boolean;
  previous_path: string;
  current_path: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  path: string;
  status: string;
  wbsDepth?: number;
  createdAt?: string;
}

export interface ProjectListResponse {
  projects: ProjectListItem[];
  defaultProject: string | null;
  total: number;
}

export interface ProjectConfig {
  id: string;
  name: string;
  status?: string;
  wbsDepth?: number;
  createdAt?: string;
}

export interface DocumentInfo {
  name: string;
  path: string;
  exists: boolean;
  type: string;
  stage: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectFile {
  name: string;
  path: string;
  relativePath: string;
  type: 'markdown' | 'image' | 'json' | 'other';
  size: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Tauri 환경 감지
// ============================================================

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  // Tauri 2.0: __TAURI_INTERNALS__ or __TAURI_IPC__
  // Tauri 1.x: __TAURI__
  return '__TAURI__' in window ||
         '__TAURI_INTERNALS__' in window ||
         '__TAURI_IPC__' in window;
}

// ============================================================
// 동적 import 헬퍼
// ============================================================

async function getInvoke() {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

async function getOpen() {
  const { open } = await import('@tauri-apps/plugin-dialog');
  return open;
}

async function getListen() {
  const { listen } = await import('@tauri-apps/api/event');
  return listen;
}

// ============================================================
// Config 커맨드
// ============================================================

/**
 * 디렉토리 선택 다이얼로그
 */
export async function selectDirectory(): Promise<string | null> {
  console.log('[TauriAPI] selectDirectory called');
  try {
    const open = await getOpen();
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Orchay 홈 디렉토리 선택',
    });
    console.log('[TauriAPI] selectDirectory result:', selected);
    return selected as string | null;
  } catch (e) {
    console.error('[TauriAPI] selectDirectory failed:', e);
    return null;
  }
}

/**
 * 현재 base_path 조회
 */
export async function getBasePath(): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>('get_base_path');
}

/**
 * base_path 설정 및 저장
 */
export async function setBasePath(newPath: string): Promise<SetBasePathResult> {
  const invoke = await getInvoke();
  return invoke<SetBasePathResult>('set_base_path', { newPath });
}

/**
 * 최근 경로 목록 조회
 */
export async function getRecentPaths(): Promise<string[]> {
  const invoke = await getInvoke();
  return invoke<string[]>('get_recent_paths');
}

/**
 * DevTools 토글
 */
export async function toggleDevTools(): Promise<void> {
  const invoke = await getInvoke();
  return invoke<void>('toggle_devtools');
}

// ============================================================
// Files 커맨드
// ============================================================

/**
 * .orchay 초기화 상태 확인
 */
export async function checkInitStatus(basePath: string): Promise<InitResponse> {
  const invoke = await getInvoke();
  return invoke<InitResponse>('check_init_status', { basePath });
}

/**
 * .orchay 구조 생성
 */
export async function ensureOrchayStructure(basePath: string): Promise<InitResponse> {
  const invoke = await getInvoke();
  return invoke<InitResponse>('ensure_orchay_structure', { basePath });
}

/**
 * 파일 읽기 (텍스트)
 */
export async function readFileContent(filePath: string): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>('read_file_content', { filePath });
}

/**
 * 파일 읽기 (바이너리 → Base64)
 * 이미지 등 바이너리 파일을 Base64로 인코딩하여 반환
 */
export async function readFileContentBase64(filePath: string): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>('read_file_content_base64', { filePath });
}

/**
 * 파일 쓰기
 */
export async function writeFileContent(filePath: string, content: string): Promise<boolean> {
  const invoke = await getInvoke();
  return invoke<boolean>('write_file_content', { filePath, content });
}

// ============================================================
// Projects 커맨드
// ============================================================

/**
 * 프로젝트 목록 조회
 */
export async function getProjects(
  basePath: string,
  statusFilter?: string
): Promise<ProjectListResponse> {
  const invoke = await getInvoke();
  return invoke<ProjectListResponse>('get_projects', { basePath, statusFilter });
}

/**
 * 단일 프로젝트 조회
 */
export async function getProject(basePath: string, projectId: string): Promise<ProjectConfig> {
  const invoke = await getInvoke();
  return invoke<ProjectConfig>('get_project', { basePath, projectId });
}

/**
 * WBS 파일 조회
 */
export async function getWbs(basePath: string, projectId: string): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>('get_wbs', { basePath, projectId });
}

/**
 * WBS 파일 저장
 */
export async function putWbs(basePath: string, projectId: string, content: string): Promise<boolean> {
  const invoke = await getInvoke();
  return invoke<boolean>('put_wbs', { basePath, projectId, content });
}

/**
 * 설정 파일 조회
 */
export async function getSettings<T = unknown>(basePath: string, settingType: string): Promise<T> {
  const invoke = await getInvoke();
  return invoke<T>('get_settings', { basePath, settingType });
}

/**
 * Task 문서 목록 조회
 * 서버의 buildDocumentInfoList()와 동일한 결과를 반환
 */
export async function listTaskDocuments(
  basePath: string,
  projectId: string,
  taskId: string
): Promise<DocumentInfo[]> {
  const invoke = await getInvoke();
  return invoke<DocumentInfo[]>('list_task_documents', { basePath, projectId, taskId });
}

/**
 * 프로젝트 파일 목록 조회 (tasks 폴더 제외)
 */
export async function listProjectFiles(
  basePath: string,
  projectId: string
): Promise<ProjectFile[]> {
  const invoke = await getInvoke();
  return invoke<ProjectFile[]>('list_project_files', { basePath, projectId });
}

// ============================================================
// Watcher 커맨드
// ============================================================

/**
 * WBS 변경 이벤트 페이로드
 */
export interface WbsChangedEvent {
  projectId: string;
  path: string;
  timestamp: string;
}

/**
 * WBS Watcher 시작
 */
export async function startWbsWatcher(basePath: string): Promise<boolean> {
  const invoke = await getInvoke();
  return invoke<boolean>('start_watching', { basePath });
}

/**
 * WBS Watcher 중지
 */
export async function stopWbsWatcher(): Promise<boolean> {
  const invoke = await getInvoke();
  return invoke<boolean>('stop_watching');
}

/**
 * WBS Watcher 실행 상태 확인
 */
export async function isWatching(): Promise<boolean> {
  const invoke = await getInvoke();
  return invoke<boolean>('is_watching');
}

/**
 * WBS 변경 이벤트 리스너 등록
 * @returns unlisten 함수
 */
export async function onWbsChanged(
  callback: (event: WbsChangedEvent) => void
): Promise<() => void> {
  const listen = await getListen();
  return listen<WbsChangedEvent>('wbs-changed', (event) => {
    callback(event.payload);
  });
}

// ============================================================
// 통합 API 객체 (Electron API 호환)
// ============================================================

export const tauriAPI = {
  // 환경 감지
  isTauri: true,

  // Config
  selectDirectory,
  getBasePath,
  setBasePath,
  getRecentPaths,
  toggleDevTools,

  // Files
  checkInitStatus,
  ensureOrchayStructure,
  readFileContent,
  readFileContentBase64,
  writeFileContent,
  listTaskDocuments,
  listProjectFiles,

  // Projects
  getProjects,
  getProject,
  getWbs,
  putWbs,
  getSettings,

  // Watcher
  startWbsWatcher,
  stopWbsWatcher,
  isWatching,
  onWbsChanged,
};

export default tauriAPI;
