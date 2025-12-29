/**
 * WBS Parser - 헤더 파싱 함수
 * Task: TSK-02-02-01
 * 상세설계: 020-detail-design.md 섹션 3.2
 */

import type { WbsNodeType } from '../../../../types';
import type { NodeHeader } from './_types';
import {
  HEADER_PATTERN,
  WP_ID_PATTERN,
  ACT_ID_PATTERN,
  TSK_3LEVEL_PATTERN,
  TSK_4LEVEL_PATTERN,
} from './_patterns';

/**
 * 헤더 라인에서 노드 정보 추출
 *
 * @param line - 마크다운 헤더 라인 (예: "## WP-01: Platform Infrastructure")
 * @returns 파싱된 헤더 정보 또는 null
 *
 * FR-001: Markdown 헤더 파싱 (##, ###, ####)
 * BR-001: 헤더 레벨로 계층 결정
 * BR-002: ID 패턴으로 노드 타입 식별
 */
export function parseNodeHeader(line: string): NodeHeader | null {
  // HEADER_PATTERN 매칭
  const match = line.match(HEADER_PATTERN);

  if (!match) {
    return null;
  }

  const [, hashes, prefix, title] = match;

  // 제목이 비어있거나 공백만 있는 경우
  if (!title || !title.trim()) {
    return null;
  }

  // 레벨 계산 (# 개수)
  const level = hashes.length;

  // 전체 ID 추출 (prefix-XX-XX-XX 형태)
  const idMatch = line.match(new RegExp(`(${prefix}-[\\d-]+)`));
  if (!idMatch) {
    return null;
  }
  const id = idMatch[1];

  // 타입 결정 (ID 패턴 기반)
  const type = determineNodeType(id);
  if (!type) {
    return null;
  }

  return {
    id,
    type,
    title: title.trim(),
    level,
  };
}

/**
 * ID 패턴에 따라 노드 타입 결정
 *
 * @param id - 노드 ID (예: "WP-01", "ACT-01-02", "TSK-01-02-03")
 * @returns WbsNodeType 또는 null (알 수 없는 패턴)
 */
function determineNodeType(id: string): WbsNodeType | null {
  if (WP_ID_PATTERN.test(id)) {
    return 'wp';
  }

  if (ACT_ID_PATTERN.test(id)) {
    return 'act';
  }

  if (TSK_4LEVEL_PATTERN.test(id)) {
    return 'task';
  }

  if (TSK_3LEVEL_PATTERN.test(id)) {
    return 'task';
  }

  return null;
}
