/**
 * URL 경로 인코딩/디코딩 공통 유틸리티
 *
 * 한글, 공백, 괄호 등 특수문자가 포함된 파일명/폴더명을
 * URL 경로에서 안전하게 사용하기 위한 함수들
 *
 * 사용처:
 * - Frontend: API 호출 시 경로 인코딩
 * - Backend: 라우트 파라미터 디코딩
 */

/**
 * URL 경로 세그먼트 인코딩
 * 파일명이나 폴더명을 URL 경로에 사용할 때 호출
 *
 * @param segment 인코딩할 경로 세그먼트 (파일명, 폴더명 등)
 * @returns URL 안전한 인코딩된 문자열
 *
 * @example
 * encodePathSegment('한글파일.md') // '%ED%95%9C%EA%B8%80%ED%8C%8C%EC%9D%BC.md'
 * encodePathSegment('file (draft).md') // 'file%20%28draft%29.md'
 * encodePathSegment('test file.md') // 'test%20file.md'
 */
export function encodePathSegment(segment: string): string {
  if (!segment) return '';

  // encodeURIComponent는 알파벳, 숫자, - _ . ~ 를 제외한 모든 문자 인코딩
  // 경로 구분자 /는 포함하면 안 되므로 segment 단위로 처리
  return encodeURIComponent(segment);
}

/**
 * URL 경로 세그먼트 디코딩
 * 라우트 파라미터에서 받은 값을 실제 파일 시스템 경로로 변환할 때 호출
 *
 * @param segment 디코딩할 경로 세그먼트
 * @returns 디코딩된 원본 문자열
 * @throws 잘못된 인코딩 시 원본 반환 (안전한 폴백)
 *
 * @example
 * decodePathSegment('%ED%95%9C%EA%B8%80%ED%8C%8C%EC%9D%BC.md') // '한글파일.md'
 * decodePathSegment('file%20%28draft%29.md') // 'file (draft).md'
 */
export function decodePathSegment(segment: string): string {
  if (!segment) return '';

  try {
    return decodeURIComponent(segment);
  } catch {
    // 디코딩 실패 시 원본 반환 (이미 디코딩된 경우 등)
    return segment;
  }
}

/**
 * API 경로 빌더
 * 여러 세그먼트를 안전하게 인코딩하여 API 경로 구성
 *
 * @param basePath 기본 경로 (예: '/api/tasks')
 * @param segments 경로 세그먼트들 (각각 인코딩됨)
 * @returns 완성된 API 경로
 *
 * @example
 * buildApiPath('/api/tasks', 'TSK-01-01', 'documents', '한글문서.md')
 * // '/api/tasks/TSK-01-01/documents/%ED%95%9C%EA%B8%80%EB%AC%B8%EC%84%9C.md'
 */
export function buildApiPath(basePath: string, ...segments: string[]): string {
  const encodedSegments = segments
    .filter(s => s) // 빈 문자열 제거
    .map(s => encodePathSegment(s));

  // basePath 끝의 슬래시 제거 후 결합
  const cleanBase = basePath.replace(/\/+$/, '');

  if (encodedSegments.length === 0) {
    return cleanBase;
  }

  return `${cleanBase}/${encodedSegments.join('/')}`;
}

/**
 * 쿼리 파라미터 빌더
 * 쿼리 스트링에 사용할 파라미터 인코딩
 *
 * @param params 키-값 쌍의 파라미터 객체
 * @returns 인코딩된 쿼리 스트링 (? 미포함)
 *
 * @example
 * buildQueryString({ project: '한글프로젝트', page: '1' })
 * // 'project=%ED%95%9C%EA%B8%80%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8&page=1'
 */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return entries.join('&');
}

/**
 * 쿼리 파라미터가 포함된 전체 URL 빌더
 *
 * @param basePath 기본 경로
 * @param segments 경로 세그먼트들
 * @param query 쿼리 파라미터
 * @returns 완성된 URL
 *
 * @example
 * buildApiUrl('/api/tasks', ['TSK-01-01'], { project: '한글' })
 * // '/api/tasks/TSK-01-01?project=%ED%95%9C%EA%B8%80'
 */
export function buildApiUrl(
  basePath: string,
  segments: string[] = [],
  query?: Record<string, string | number | undefined>
): string {
  const path = buildApiPath(basePath, ...segments);

  if (!query || Object.keys(query).length === 0) {
    return path;
  }

  const queryString = buildQueryString(query);
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * 경로 탐색 공격 방지 검증
 * 디코딩된 경로에서 위험한 패턴 검사
 *
 * @param segment 검증할 경로 세그먼트
 * @returns 안전 여부
 */
export function isPathSegmentSafe(segment: string): boolean {
  if (!segment) return false;

  // 디코딩 후 검사
  const decoded = decodePathSegment(segment);

  // 위험한 패턴
  const dangerousPatterns = [
    /\.\./,           // 상위 디렉토리 이동
    /^[/\\]/,         // 절대 경로
    /[/\\]/,          // 경로 구분자 포함
    /%/,              // 이중 인코딩 시도
    /\0/,             // Null 바이트
  ];

  return !dangerousPatterns.some(pattern => pattern.test(decoded));
}

/**
 * 안전하게 디코딩 (검증 포함)
 * 서버에서 라우트 파라미터 처리 시 사용
 *
 * @param segment 디코딩할 경로 세그먼트
 * @returns 디코딩된 문자열 또는 null (위험한 경우)
 */
export function safeDecodePathSegment(segment: string): string | null {
  if (!segment) return null;

  const decoded = decodePathSegment(segment);

  if (!isPathSegmentSafe(decoded)) {
    return null;
  }

  return decoded;
}
