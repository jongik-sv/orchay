'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Page } from '@/lib/store';
import { PageTree } from './PageTree';

interface PageTreeItemProps {
  page: Page;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelect: (pageId: string) => void;
}

export function PageTreeItem({
  page,
  depth,
  isExpanded,
  onToggleExpand,
  onSelect,
}: PageTreeItemProps) {
  const hasChildren = page.children && page.children.length > 0;
  const paddingLeft = depth * 12 + 8;

  return (
    <div>
      {/* 페이지 항목 */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] hover:bg-[#EFEFEF] cursor-pointer transition-colors"
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={() => onSelect(page.id)}
        data-testid={`page-tree-item-${page.id}`}
      >
        {/* 토글 버튼 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 transition-transform"
            data-testid={`toggle-btn-${page.id}`}
          >
            {isExpanded ? (
              <ChevronDown size={16} className="text-[#B4B4B3]" />
            ) : (
              <ChevronRight size={16} className="text-[#B4B4B3]" />
            )}
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {/* 페이지 아이콘 */}
        <span className="text-[18px] leading-none flex-shrink-0">{page.icon}</span>

        {/* 페이지 제목 */}
        <span className="text-[14px] text-[#37352F] font-[400] truncate">
          {page.title}
        </span>
      </div>

      {/* 하위 페이지 */}
      {hasChildren && isExpanded && (
        <PageTree pages={page.children!} depth={depth + 1} />
      )}
    </div>
  );
}
