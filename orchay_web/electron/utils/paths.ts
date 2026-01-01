import { app } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * Nitro 서버 엔트리 파일 경로
 */
export function getServerPath(): string {
  if (app.isPackaged) {
    // 패키징된 앱: resources/server 디렉토리
    return path.join(process.resourcesPath, 'server', 'server', 'index.mjs')
  }
  // 개발 모드: .output 디렉토리
  return path.join(__dirname, '../../.output/server/index.mjs')
}

/**
 * 기본 ORCHAY_BASE_PATH 경로
 *
 * 우선순위:
 * 1. 환경변수 ORCHAY_BASE_PATH
 * 2. 패키징된 앱: 실행 파일이 있는 디렉토리
 * 3. 개발 모드: 현재 작업 디렉토리
 */
export function getDefaultBasePath(): string {
  // 1. 환경변수가 설정되어 있으면 사용
  if (process.env.ORCHAY_BASE_PATH) {
    return process.env.ORCHAY_BASE_PATH
  }

  // 2. 패키징된 앱: 실행 파일 디렉토리 사용
  //    (다른 PC에 복사해도 설정 없이 바로 동작)
  if (app.isPackaged) {
    return path.dirname(process.execPath)
  }

  // 3. 개발 모드: 현재 작업 디렉토리
  return process.cwd()
}

/**
 * 앱 데이터 경로 (설정 저장용)
 */
export function getAppDataPath(): string {
  return app.getPath('userData')
}

/**
 * 로그 파일 경로
 */
export function getLogPath(): string {
  return path.join(app.getPath('logs'), 'orchay.log')
}
