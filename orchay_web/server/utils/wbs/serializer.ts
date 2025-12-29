import type { WbsNode, WbsMetadata, SerializerContext, SerializerOptions } from '../../../types';
import { SerializationError } from '../../../types';
import { serializeHeader } from './serializer/_header';
import { serializeAttributes } from './serializer/_attributes';
import { buildMetadataBlock } from './serializer/_metadata';

// Note: For testing, import directly from submodules:
// - serializeHeader from './serializer/_header'
// - serializeAttributes from './serializer/_attributes'
// - buildMetadataBlock from './serializer/_metadata'

const MAX_RECURSION_DEPTH = 10;
const MAX_NODE_COUNT = 1000;
const MAX_TITLE_LENGTH = 200;

/**
 * 트리의 최대 깊이 계산 (3단계 vs 4단계 판단)
 * @param nodes - WBS 노드 배열
 * @returns maxDepth (3 또는 4)
 */
export function calculateMaxDepth(nodes: WbsNode[]): number {
  const visited = new Set<string>();

  function hasActOrDeepTask(nodeList: WbsNode[]): boolean {
    for (const node of nodeList) {
      // 순환 참조 방지
      if (visited.has(node.id)) {
        continue;
      }
      visited.add(node.id);

      // ACT 노드가 있으면 4단계
      if (node.type === 'act') {
        return true;
      }
      // Task ID 패턴이 TSK-XX-XX-XX 형식이면 4단계
      if (node.type === 'task' && /^TSK-\d+-\d+-\d+$/.test(node.id)) {
        return true;
      }
      // 자식 노드 재귀 확인
      if (node.children && node.children.length > 0) {
        if (hasActOrDeepTask(node.children)) {
          return true;
        }
      }
    }
    return false;
  }

  return hasActOrDeepTask(nodes) ? 4 : 3;
}

/**
 * 전체 노드 수 계산 (순환 참조 감지 포함)
 * @param nodes - WBS 노드 배열
 * @param visited - 방문한 노드 ID Set
 * @returns 전체 노드 수
 * @throws SerializationError 순환 참조 감지 시
 */
function countNodes(nodes: WbsNode[], visited: Set<string> = new Set()): number {
  let count = 0;
  for (const node of nodes) {
    // 순환 참조 감지
    if (visited.has(node.id)) {
      throw new SerializationError(`Circular reference detected: ${node.id}`);
    }
    visited.add(node.id);
    count++;
    if (node.children && node.children.length > 0) {
      count += countNodes(node.children, visited);
    }
  }
  return count;
}

/**
 * 특수 문자 이스케이프 (마크다운 인젝션 방지)
 * 헤더 내에서 사용되는 #, 제목의 시작 부분에서만 처리
 */
function sanitizeTitle(title: string): string {
  if (!title) return 'Untitled';

  // 제목 길이 제한
  let sanitized = title.length > MAX_TITLE_LENGTH ? title.slice(0, MAX_TITLE_LENGTH) : title;

  // 마크다운 헤더 시작 패턴 방지 (제목이 #으로 시작하는 경우)
  if (sanitized.startsWith('#')) {
    sanitized = sanitized.replace(/^#+\s*/, '');
  }

  return sanitized;
}

/**
 * 단일 노드와 그 하위 노드를 재귀적으로 직렬화
 * @param node - WBS 노드
 * @param context - 시리얼라이저 컨텍스트
 * @returns 마크다운 블록 문자열
 */
function serializeNode(node: WbsNode, context: SerializerContext): string {
  // 재귀 깊이 검사
  if (context.currentDepth > MAX_RECURSION_DEPTH) {
    throw new SerializationError('Maximum recursion depth exceeded');
  }

  // 순환 참조 검사
  if (context.visited.has(node.id)) {
    throw new SerializationError(`Circular reference detected: ${node.id}`);
  }
  context.visited.add(node.id);

  const lines: string[] = [];

  // 제목 정제
  const sanitizedNode = {
    ...node,
    title: sanitizeTitle(node.title),
  };

  // 헤더 생성
  const header = serializeHeader(sanitizedNode, context);
  lines.push(header);

  // 속성 라인들 추가
  const attributes = serializeAttributes(node);
  if (attributes.length > 0) {
    lines.push(...attributes);
  }

  // 빈 줄 추가 (노드 사이 구분)
  lines.push('');

  // 자식 노드 재귀 처리
  if (node.children && node.children.length > 0) {
    context.currentDepth++;

    for (const child of node.children) {
      const childOutput = serializeNode(child, context);
      lines.push(childOutput);
    }

    context.currentDepth--;
  }

  // 백트래킹 시 visited에서 제거
  context.visited.delete(node.id);

  return lines.join('\n');
}

/**
 * WBS 트리 전체를 Markdown으로 변환
 * @param nodes - WBS 노드 배열
 * @param metadata - WBS 메타데이터
 * @param options - 시리얼라이저 옵션
 * @returns 완전한 Markdown 문자열
 */
export function serializeWbs(
  nodes: WbsNode[],
  metadata: WbsMetadata,
  options?: SerializerOptions
): string {
  // 입력 검증
  if (!nodes || nodes.length === 0) {
    // 빈 트리: 메타데이터만 포함
    const metadataBlock = buildMetadataBlock(metadata, options);
    return metadataBlock + '\n';
  }

  // 노드 수 제한 검사
  const nodeCount = countNodes(nodes);
  if (nodeCount > MAX_NODE_COUNT) {
    throw new SerializationError(`Too many nodes: ${nodeCount} exceeds limit of ${MAX_NODE_COUNT}`);
  }

  // 최대 깊이 계산
  const maxDepth = calculateMaxDepth(nodes);

  // 컨텍스트 초기화
  const context: SerializerContext = {
    currentDepth: 0,
    wpCount: 0,
    maxDepth,
    visited: new Set<string>(),
  };

  const parts: string[] = [];

  // 1. 프로젝트 헤더 (첫 번째 노드가 project 타입인 경우)
  const firstNode = nodes[0];
  if (firstNode.type === 'project') {
    const header = serializeHeader(firstNode, context);
    parts.push(header);
    parts.push('');

    // 메타데이터 블록
    const metadataBlock = buildMetadataBlock(metadata, options);
    parts.push(metadataBlock);
    parts.push('');
    parts.push('---');
    parts.push('');

    // 프로젝트의 자식 노드들 처리
    if (firstNode.children && firstNode.children.length > 0) {
      for (let i = 0; i < firstNode.children.length; i++) {
        const child = firstNode.children[i];

        // WP 사이에 구분선 추가
        if (child.type === 'wp' && context.wpCount > 0) {
          parts.push('---');
          parts.push('');
        }

        context.currentDepth = 1;
        const childOutput = serializeNode(child, context);
        parts.push(childOutput);

        if (child.type === 'wp') {
          context.wpCount++;
        }
      }
    }
  } else {
    // 프로젝트 노드가 없는 경우: 메타데이터만 포함하고 노드들 직렬화
    const metadataBlock = buildMetadataBlock(metadata, options);
    parts.push(metadataBlock);
    parts.push('');
    parts.push('---');
    parts.push('');

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // WP 사이에 구분선 추가
      if (node.type === 'wp' && context.wpCount > 0) {
        parts.push('---');
        parts.push('');
      }

      context.currentDepth = 1;
      const nodeOutput = serializeNode(node, context);
      parts.push(nodeOutput);

      if (node.type === 'wp') {
        context.wpCount++;
      }
    }
  }

  // 최종 결과 조립
  let result = parts.join('\n');

  // 끝에 불필요한 빈 줄 정리
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trimEnd() + '\n';

  return result;
}

// Note: serializeHeader, serializeAttributes, buildMetadataBlock는 Nuxt가 serializer/ 폴더에서 직접 auto-import
