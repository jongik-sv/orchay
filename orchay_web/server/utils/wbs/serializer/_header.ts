import type { WbsNode, SerializerContext } from '../../../../types';

/**
 * 노드 타입에 따른 마크다운 헤더 생성
 * @param node - WBS 노드
 * @param context - 시리얼라이저 컨텍스트
 * @returns 마크다운 헤더 문자열
 */
export function serializeHeader(node: WbsNode, context: SerializerContext): string {
  const id = node.id || 'UNKNOWN';
  const title = node.title || 'Untitled';

  switch (node.type) {
    case 'project':
      return `# WBS - ${title}`;

    case 'wp':
      return `## ${id}: ${title}`;

    case 'act':
      return `### ${id}: ${title}`;

    case 'task':
      // 3단계 구조에서는 ###, 4단계 구조에서는 ####
      if (context.maxDepth === 3) {
        return `### ${id}: ${title}`;
      }
      return `#### ${id}: ${title}`;

    default:
      // 알 수 없는 타입은 기본 ## 사용
      console.warn(`Unknown node type: ${node.type}, using default header level`);
      return `## ${id}: ${title}`;
  }
}
