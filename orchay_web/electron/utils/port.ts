import { getPort as getPortPlease } from 'get-port-please'

/**
 * 사용 가능한 포트 찾기
 * @param preferredRange 선호 포트 범위 (기본: 3100-3200)
 */
export async function findAvailablePort(
  preferredRange: [number, number] = [3100, 3200]
): Promise<number> {
  return await getPortPlease({
    portRange: preferredRange,
    random: false // 범위 시작부터 순차 탐색
  })
}

/**
 * 특정 포트가 사용 가능한지 확인
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const availablePort = await getPortPlease({ port })
    return availablePort === port
  } catch {
    return false
  }
}
