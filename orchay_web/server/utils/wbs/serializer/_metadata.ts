import type { WbsMetadata, SerializerOptions } from '../../../../types';

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * wbs.md 상단 메타데이터 블록 생성
 * @param metadata - WBS 메타데이터
 * @param options - 시리얼라이저 옵션
 * @returns 메타데이터 블록 문자열
 */
export function buildMetadataBlock(metadata: WbsMetadata, options?: SerializerOptions): string {
  const version = metadata.version || '1.0';
  const depth = metadata.depth || 4;
  const start = metadata.start || metadata.updated || getCurrentDate();

  // updateDate 옵션이 false가 아니면 현재 날짜로 갱신
  let updated: string;
  if (options?.updateDate === false) {
    updated = metadata.updated || getCurrentDate();
  } else {
    updated = getCurrentDate();
  }

  const lines = [
    `> version: ${version}`,
    `> depth: ${depth}`,
    `> updated: ${updated}`,
    `> start: ${start}`,
  ];

  return lines.join('\n');
}
