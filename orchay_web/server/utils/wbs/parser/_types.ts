/**
 * WBS Parser - 타입 정의
 * Task: TSK-02-02-01
 */

import type { WbsNodeType, TaskCategory, Priority, ScheduleRange, CompletedTimestamps } from '../../../../types';

/**
 * 노드 헤더 정보
 */
export interface NodeHeader {
  level: number;         // 헤더 레벨 (1~4)
  id: string;            // 노드 ID (예: "WP-01", "TSK-01-01")
  title: string;         // 노드 제목
  type: WbsNodeType;     // 노드 타입
}

/**
 * 노드 속성 정보
 */
export interface NodeAttributes {
  category?: TaskCategory;
  status?: string;
  priority?: Priority;
  assignee?: string;
  schedule?: ScheduleRange;
  tags?: string[];
  depends?: string;
  requirements?: string[];
  ref?: string;
  customAttributes?: Record<string, string>;  // TSK-03-05: 커스텀 속성 (예: test-result)
  completed?: CompletedTimestamps;  // TSK-03-06: 단계별 완료시각
}

/**
 * 플랫 노드 (트리 빌드 전)
 */
export interface FlatNode {
  level: number;
  id: string;
  type: WbsNodeType;
  title: string;
  attributes: NodeAttributes;
  rawContent: string;  // 원본 마크다운 내용 (요구사항 등)
}
