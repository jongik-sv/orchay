import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import { getPort } from 'get-port-please'
import { getServerPath, getDefaultBasePath } from './utils/paths'

let mainWindow: BrowserWindow | null = null
let serverPort: number = 3100

// 환경변수로 개발 모드 강제 설정 가능
const isDev = process.env.ELECTRON_DEV === 'true' ||
  (!app.isPackaged && process.env.ELECTRON_DEV !== 'false')

/**
 * Nitro 서버를 Electron 메인 프로세스 내에서 실행
 */
async function startServer(port: number): Promise<void> {
  const serverPath = getServerPath()
  const basePath = getDefaultBasePath()

  console.log(`[Electron] Starting Nitro server at port ${port}`)
  console.log(`[Electron] Server path: ${serverPath}`)
  console.log(`[Electron] Base path: ${basePath}`)

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
 */
async function waitForServer(port: number, maxAttempts = 30): Promise<void> {
  const url = `http://127.0.0.1:${port}/api/init`

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        console.log(`[Electron] Server is ready after ${i + 1} attempts`)
        return
      }
    } catch {
      // 서버가 아직 준비되지 않음
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error('Server failed to start within timeout')
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

  // DevTools 토글
  ipcMain.handle('dev:toggleDevTools', () => {
    mainWindow?.webContents.toggleDevTools()
  })
}

// 앱 초기화
app.whenReady().then(async () => {
  try {
    // 사용 가능한 포트 찾기
    serverPort = await getPort({ portRange: [3100, 3200] })
    console.log(`[Electron] Using port ${serverPort}`)

    // IPC 핸들러 설정
    setupIpcHandlers()

    // 개발 모드에서는 외부 서버 사용 가능
    if (!isDev) {
      await startServer(serverPort)
      await waitForServer(serverPort)
    } else {
      // 개발 모드: nuxt dev 서버가 이미 실행 중이라고 가정
      serverPort = 3000
    }

    await createWindow(serverPort)
  } catch (error) {
    console.error('[Electron] Failed to initialize:', error)
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
