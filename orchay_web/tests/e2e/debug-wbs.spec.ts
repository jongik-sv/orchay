import { test, expect } from '@playwright/test'

test('Debug WBS page loading', async ({ page }) => {
  // 네트워크 요청 로깅
  const requests: string[] = []
  const responses: Array<{ url: string; status: number; body?: string }> = []

  page.on('request', request => {
    requests.push(`${request.method()} ${request.url()}`)
  })

  page.on('response', async response => {
    const url = response.url()
    const status = response.status()
    let body = ''
    if (url.includes('/api/')) {
      try {
        body = await response.text()
      } catch { }
    }
    responses.push({ url, status, body: body.substring(0, 200) })
  })

  // 콘솔 로그
  const consoleLogs: string[] = []
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
  })

  // 페이지 이동
  await page.goto('/wbs?projectId=orchay')
  await page.waitForLoadState('networkidle')

  // 5초 대기
  await page.waitForTimeout(5000)

  // DOM 상태 확인
  const loadingVisible = await page.locator('[data-testid="loading-spinner"]').isVisible()
  const errorVisible = await page.locator('[data-testid="error-message"]').isVisible()
  const noProjectVisible = await page.locator('[data-testid="empty-state-no-project"]').isVisible()
  const wbsContentVisible = await page.locator('[data-testid="wbs-content"]').isVisible()
  const treePanelVisible = await page.locator('[data-testid="wbs-tree-panel"]').isVisible()
  const contentStateVisible = await page.locator('[data-testid="content-state"]').isVisible()
  const loadingStateVisible = await page.locator('[data-testid="loading-state"]').isVisible()
  const errorStateVisible = await page.locator('[data-testid="error-state"]').isVisible()

  // 결과 출력
  console.log('\n=== NETWORK REQUESTS ===')
  requests.forEach(r => console.log(r))

  console.log('\n=== API RESPONSES ===')
  responses.filter(r => r.url.includes('/api/')).forEach(r => {
    console.log(`${r.status} ${r.url}`)
    if (r.body) console.log(`  Body: ${r.body}...`)
  })

  console.log('\n=== CONSOLE LOGS ===')
  consoleLogs.forEach(l => console.log(l))

  console.log('\n=== DOM STATE ===')
  console.log(`loading-spinner: ${loadingVisible}`)
  console.log(`error-message: ${errorVisible}`)
  console.log(`empty-state-no-project: ${noProjectVisible}`)
  console.log(`wbs-content: ${wbsContentVisible}`)
  console.log(`wbs-tree-panel: ${treePanelVisible}`)
  console.log(`content-state: ${contentStateVisible}`)
  console.log(`loading-state: ${loadingStateVisible}`)
  console.log(`error-state: ${errorStateVisible}`)

  // 스크린샷 저장
  await page.screenshot({ path: 'test-results/debug-wbs.png' })
})
