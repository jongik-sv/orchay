/**
 * Electron 앱 설정 영구 저장소
 * Task: 홈 디렉토리 선택 기능
 *
 * userData 경로에 설정 파일을 저장하여 앱 재시작 시에도 유지됩니다.
 */

import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * 앱 설정 인터페이스
 */
interface AppConfig {
  version: 1;
  basePath: string;
  recentPaths?: string[];
  lastOpenedProject?: string;
}

/**
 * 기본 앱 설정
 */
const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  basePath: '',
  recentPaths: [],
};

/**
 * 설정 파일 경로
 * userData: Windows에서는 %APPDATA%/orchay
 */
function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'orchay-config.json');
}

/**
 * 앱 설정 로드
 *
 * @returns 저장된 설정 또는 기본값
 */
export function loadAppConfig(): AppConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.log('[AppConfig] No config file found, using defaults');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as AppConfig;
    console.log(`[AppConfig] Loaded config from ${configPath}`);
    return config;
  } catch (error) {
    console.error('[AppConfig] Failed to load config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 앱 설정 저장
 *
 * @param config - 저장할 설정
 */
export function saveAppConfig(config: AppConfig): void {
  const configPath = getConfigPath();

  try {
    // 디렉토리가 없으면 생성
    const configDir = dirname(configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[AppConfig] Saved config to ${configPath}`);
  } catch (error) {
    console.error('[AppConfig] Failed to save config:', error);
  }
}

/**
 * 기본 경로 업데이트
 * 최근 경로 목록도 함께 업데이트합니다.
 *
 * @param newPath - 새 기본 경로
 */
export function updateBasePath(newPath: string): void {
  const config = loadAppConfig();

  // 기존 경로와 동일하면 무시
  if (config.basePath === newPath) {
    return;
  }

  // 최근 경로 목록 업데이트 (최대 5개)
  const recentPaths = config.recentPaths || [];
  const filteredPaths = recentPaths.filter((p) => p !== newPath);
  const updatedRecentPaths = [newPath, ...filteredPaths].slice(0, 5);

  const updatedConfig: AppConfig = {
    ...config,
    basePath: newPath,
    recentPaths: updatedRecentPaths,
  };

  saveAppConfig(updatedConfig);
}

/**
 * 최근 경로 목록 조회
 *
 * @returns 최근 사용한 경로 목록
 */
export function getRecentPaths(): string[] {
  const config = loadAppConfig();
  return config.recentPaths || [];
}

/**
 * 저장된 기본 경로 조회
 *
 * @returns 저장된 기본 경로 또는 빈 문자열
 */
export function getSavedBasePath(): string {
  const config = loadAppConfig();
  return config.basePath || '';
}
