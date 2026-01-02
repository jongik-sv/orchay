'use client';

import { useEffect, useRef } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

/**
 * ContextMenu - 우클릭 컨텍스트 메뉴 컴포넌트
 * Notion 스타일의 드롭다운 메뉴
 */
export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 뷰포트 내에서 위치 조정
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - (items.length * 40 + 16)),
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-[#E9E9E7] py-2 min-w-[180px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      data-testid="context-menu"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[#EFEFEF] transition-colors cursor-pointer ${
            item.danger ? 'text-red-600' : 'text-[#37352F]'
          }`}
          data-testid={`context-menu-item-${item.id}`}
        >
          {item.icon && (
            <span className={`w-4 h-4 ${item.danger ? 'text-red-600' : 'text-[#787774]'}`}>
              {item.icon}
            </span>
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * 페이지 트리용 기본 컨텍스트 메뉴 아이템 생성
 */
export function createPageContextMenuItems(
  pageId: string,
  handlers: {
    onOpen: () => void;
    onAddSubpage: () => void;
    onDelete: () => void;
  }
): ContextMenuItem[] {
  return [
    {
      id: 'open',
      label: 'Open',
      icon: <FileText size={16} />,
      onClick: handlers.onOpen,
    },
    {
      id: 'add-subpage',
      label: 'Add subpage',
      icon: <Plus size={16} />,
      onClick: handlers.onAddSubpage,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 size={16} />,
      danger: true,
      onClick: handlers.onDelete,
    },
  ];
}
