/**
 * 문서 타입 설정 (TSK-05-02 R-03: 설정 파일로 이동)
 *
 * TaskDocuments.vue 등에서 사용하는 문서 타입별 스타일 설정
 */

export interface DocumentTypeStyle {
  icon: string;
  color: string;
  label: string;
}

/**
 * 문서 타입별 아이콘 및 색상 설정
 */
export const DOCUMENT_TYPE_CONFIG: Record<string, DocumentTypeStyle> = {
  design: {
    icon: 'pi pi-file-edit',
    color: 'var(--color-primary)',
    label: '설계 문서'
  },
  implementation: {
    icon: 'pi pi-code',
    color: 'var(--color-success)',
    label: '구현 문서'
  },
  test: {
    icon: 'pi pi-check-square',
    color: 'var(--color-warning)',
    label: '테스트 문서'
  },
  manual: {
    icon: 'pi pi-book',
    color: 'var(--color-level-project)',
    label: '매뉴얼'
  },
  analysis: {
    icon: 'pi pi-search',
    color: 'var(--color-danger)',
    label: '분석 문서'
  },
  review: {
    icon: 'pi pi-comments',
    color: 'var(--color-primary)',
    label: '리뷰 문서'
  }
} as const;

/**
 * 파일명으로 문서 타입 추론
 */
export function inferDocumentType(filename: string): string {
  if (filename.includes('design') || filename.startsWith('010-') || filename.startsWith('020-')) {
    return 'design';
  }
  if (filename.includes('implementation') || filename.startsWith('030-')) {
    return 'implementation';
  }
  if (filename.includes('test') || filename.startsWith('026-') || filename.startsWith('070-')) {
    return 'test';
  }
  if (filename.includes('manual') || filename.startsWith('080-')) {
    return 'manual';
  }
  if (filename.includes('analysis') || filename.includes('defect')) {
    return 'analysis';
  }
  if (filename.includes('review') || filename.startsWith('021-') || filename.startsWith('031-')) {
    return 'review';
  }
  return 'design'; // 기본값
}

/**
 * 문서 타입에 대한 스타일 정보 가져오기
 */
export function getDocumentTypeStyle(type: string): DocumentTypeStyle {
  return DOCUMENT_TYPE_CONFIG[type] || DOCUMENT_TYPE_CONFIG.design;
}
