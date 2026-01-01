import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import { getPort } from 'get-port-please'
import { getServerPath, getDefaultBasePath } from './utils/paths'
import { loadAppConfig, updateBasePath, getRecentPaths, getSavedBasePath } from './utils/appConfig'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let serverPort: number = 3100

// 환경변수로 개발 모드 강제 설정 가능
const isDev = process.env.ELECTRON_DEV === 'true' ||
  (!app.isPackaged && process.env.ELECTRON_DEV !== 'false')

/**
 * Nitro 서버를 Electron 메인 프로세스 내에서 실행
 */
async function startServer(port: number): Promise<void> {
  const serverPath = getServerPath()

  // 저장된 경로 우선, 없으면 기본값 사용
  const savedPath = getSavedBasePath()
  const basePath = savedPath || getDefaultBasePath()

  console.log(`[Electron] Starting Nitro server at port ${port}`)
  console.log(`[Electron] Server path: ${serverPath}`)
  console.log(`[Electron] Base path: ${basePath}`)
  console.log(`[Electron] Saved path: ${savedPath || '(none)'}`)

  // 환경변수 설정
  process.env.PORT = String(port)
  process.env.HOST = '127.0.0.1'
  process.env.ORCHAY_BASE_PATH = basePath
  process.env.NODE_ENV = isDev ? 'development' : 'production'

  // Nitro 서버를 동적으로 import하여 실행
  try {
    const serverUrl = pathToFileURL(serverPath).href
    await import(serverUrl)
    console.log(`[Electron] Nitro server started successfully`)
  } catch (error) {
    console.error('[Electron] Failed to start Nitro server:', error)
    throw error
  }
}

/**
 * 서버가 준비될 때까지 대기
 * - 폴링 간격: 100ms (기존 500ms에서 단축)
 * - 최대 대기: 100회 × 100ms = 10초
 */
async function waitForServer(port: number, maxAttempts = 100): Promise<void> {
  const url = `http://127.0.0.1:${port}/api/init`

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        console.log(`[Electron] Server is ready after ${i + 1} attempts (${(i + 1) * 100}ms)`)
        return
      }
    } catch {
      // 서버가 아직 준비되지 않음
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error('Server failed to start within timeout')
}

/**
 * Splash 윈도우 생성 (즉시 표시)
 */
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 인라인 HTML로 로딩 화면 표시 (외부 파일 불필요)
  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          border-radius: 12px;
        }
        .logo {
          font-size: 48px;
          font-weight: bold;
          margin-bottom: 20px;
          background: linear-gradient(90deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #667eea;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .text {
          margin-top: 20px;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
        }
      </style>
    </head>
    <body>
      <div class="logo">Orchay</div>
      <div class="spinner"></div>
      <div class="text">Loading...</div>
    </body>
    </html>
  `

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)
  splashWindow.show()
}

/**
 * Splash 윈도우 닫기
 */
function closeSplashWindow(): void {
  if (splashWindow) {
    splashWindow.close()
    splashWindow = null
  }
}

/**
 * 메인 윈도우 생성
 */
async function createWindow(port: number): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Orchay',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    },
    show: false
  })

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 준비되면 윈도우 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  await mainWindow.loadURL(`http://127.0.0.1:${port}`)
}

/**
 * 서버 종료 (Electron 프로세스 종료 시 자동으로 종료됨)
 */
function stopServer(): void {
  console.log('[Electron] Stopping server...')
  // Nitro 서버는 같은 프로세스에서 실행되므로 앱 종료 시 자동 종료
}

// IPC 핸들러 등록
function setupIpcHandlers(): void {
  // 디렉토리 선택 다이얼로그
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Orchay 프로젝트 폴더 선택'
    })
    return result.filePaths[0] || null
  })

  // 현재 base path 조회
  ipcMain.handle('config:getBasePath', () => {
    return process.env.ORCHAY_BASE_PATH || getDefaultBasePath()
  })

  // base path 설정 (영구 저장 + 환경변수 갱신)
  ipcMain.handle('config:setBasePath', (_event, newPath: string) => {
    try {
      // 1. 영구 저장소에 저장
      updateBasePath(newPath)

      // 2. 환경변수 갱신 (서버가 같은 프로세스이므로 즉시 적용)
      process.env.ORCHAY_BASE_PATH = newPath

      console.log(`[Electron] Base path updated: ${newPath}`)
      return { success: true, path: newPath }
    } catch (error) {
      console.error('[Electron] Failed to set base path:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 최근 경로 목록 조회
  ipcMain.handle('config:getRecentPaths', () => {
    return getRecentPaths()
  })

  // DevTools 토글
  ipcMain.handle('dev:toggleDevTools', () => {
    mainWindow?.webContents.toggleDevTools()
  })
}

// 앱 초기화 (최적화: Splash + 병렬 처리)
app.whenReady().then(async () => {
  const startTime = Date.now()

  try {
    // 1. Splash 화면 즉시 표시 (사용자에게 빠른 피드백)
    createSplashWindow()
    console.log(`[Electron] Splash shown at ${Date.now() - startTime}ms`)

    // 2. IPC 핸들러 설정 (빠름)
    setupIpcHandlers()

    // 3. 포트 찾기와 서버 시작
    serverPort = await getPort({ portRange: [3100, 3200] })
    console.log(`[Electron] Using port ${serverPort}`)

    // 4. 개발 모드에서는 외부 서버 사용
    if (!isDev) {
      // 프로덕션: 서버 시작 후 대기
      await startServer(serverPort)
      await waitForServer(serverPort)
    } else {
      // 개발 모드: nuxt dev 서버가 이미 실행 중이라고 가정
      serverPort = 3000
    }
    console.log(`[Electron] Server ready at ${Date.now() - startTime}ms`)

    // 5. 메인 윈도우 생성
    await createWindow(serverPort)
    console.log(`[Electron] Window created at ${Date.now() - startTime}ms`)

    // 6. 메인 윈도우 준비되면 Splash 닫기
    mainWindow?.once('ready-to-show', () => {
      closeSplashWindow()
      console.log(`[Electron] App fully loaded at ${Date.now() - startTime}ms`)
    })
  } catch (error) {
    console.error('[Electron] Failed to initialize:', error)
    closeSplashWindow()
    app.quit()
  }
})

// 모든 윈도우가 닫히면 앱 종료
app.on('window-all-closed', () => {
  stopServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS: dock 아이콘 클릭 시 윈도우 재생성
app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow(serverPort)
  }
})

// 앱 종료 전 정리
app.on('before-quit', () => {
  stopServer()
})
