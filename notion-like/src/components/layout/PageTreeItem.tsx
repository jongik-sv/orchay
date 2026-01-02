'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Page } from '@/lib/store';
import { PageTree } from './PageTree';
import { ContextMenu, createPageContextMenuItems } from '@/components/ui/ContextMenu';
import { DeleteModal } from '@/components/ui/DeleteModal';

interface PageTreeItemProps {
  page: Page;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelect: (pageId: string) => void;
  onAddSubpage?: (parentId: string) => void;
  onDeletePage?: (pageId: string) => void;
}

export function PageTreeItem({
  page,
  depth,
  isExpanded,
  onToggleExpand,
  onSelect,
  onAddSubpage,
  onDeletePage,
}: PageTreeItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const hasChildren = page.children && page.children.length > 0;
  const paddingLeft = depth * 12 + 8;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setContextMenu({ x: rect.left, y: rect.bottom + 4 });
  };

  const contextMenuItems = createPageContextMenuItems(page.id, {
    onOpen: () => onSelect(page.id),
    onAddSubpage: () => onAddSubpage?.(page.id),
    onDelete: () => setShowDeleteModal(true),
  });

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    onDeletePage?.(page.id);
  };

  return (
    <div>
      {/* 페이지 항목 */}
      <div
        className="group flex items-center gap-1 px-3 py-1.5 rounded-[4px] hover:bg-[#EFEFEF] cursor-pointer transition-colors"
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={() => onSelect(page.id)}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
        <span className="text-[18px] leading-none flex-shrink-0">{page.icon || '📄'}</span>

        {/* 페이지 제목 */}
        <span className="flex-1 text-[14px] text-[#37352F] font-[400] truncate">
          {page.title}
        </span>

        {/* 더보기 버튼 (호버 시 표시) */}
        {isHovered && (
          <button
            onClick={handleMoreClick}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#DFDFDF] transition-colors"
            data-testid={`more-btn-${page.id}`}
          >
            <MoreHorizontal size={14} className="text-[#787774]" />
          </button>
        )}
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 삭제 확인 모달 */}
      <DeleteModal
        isOpen={showDeleteModal}
        pageTitle={page.title}
        hasChildren={hasChildren ?? false}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* 하위 페이지 */}
      {hasChildren && isExpanded && (
        <PageTree
          pages={page.children!}
          depth={depth + 1}
          onAddSubpage={onAddSubpage}
          onDeletePage={onDeletePage}
        />
      )}
    </div>
  );
}
