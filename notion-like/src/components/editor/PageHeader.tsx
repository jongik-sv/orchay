'use client';

import { useState, useEffect } from 'react';
import { IconPicker } from '@/components/ui/IconPicker';

export interface PageHeaderProps {
  // [MINOR-001] pageId는 향후 아이콘/커버 API 호출 시 사용 예정
  pageId: string;
  title: string;
  icon: string;
  coverUrl?: string;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string) => void;
  onCoverChange?: (coverUrl: string) => void;
}

/**
 * PageHeader Component
 *
 * Displays page metadata (icon, cover, title) with edit capabilities.
 * Integrates with IconPicker for emoji selection.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   pageId="page-1"
 *   title="My Page"
 *   icon="📄"
 *   onTitleChange={(title) => updatePage({ title })}
 *   onIconChange={(icon) => updatePage({ icon })}
 * />
 * ```
 */
export function PageHeader({
  pageId,
  title,
  icon,
  coverUrl,
  onTitleChange,
  onIconChange,
  onCoverChange,
}: PageHeaderProps) {
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [titleValue, setTitleValue] = useState(title);

  // [MAJOR-001] props 변경 시 titleValue 상태 동기화
  useEffect(() => {
    setTitleValue(title);
  }, [title]);

  const handleTitleBlur = () => {
    if (titleValue !== title) {
      onTitleChange(titleValue);
    }
  };

  const handleIconSelect = (selectedIcon: string) => {
    onIconChange(selectedIcon);
    setIsIconPickerOpen(false);
  };

  return (
    <div data-testid="page-header" className="bg-white border-b border-gray-200">
      {/* Cover Image Area */}
      {coverUrl && (
        <div className="w-full h-[200px] bg-gray-200 overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt="Cover"
            className="w-full h-full object-cover"
            data-testid="page-cover-image"
          />
        </div>
      )}

      {/* Icon and Title Area */}
      <div className="relative px-[96px] py-8 md:px-6">
        {/* Icon - [MINOR-002] group hover로 변경 버튼 접근성 개선 */}
        <div className="mb-4 relative group">
          <div
            className="w-[78px] h-[78px] text-[78px] cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
            data-testid="page-icon"
          >
            {icon}
          </div>
          {/* Icon Change Button - visible on icon hover */}
          <button
            onClick={() => setIsIconPickerOpen(true)}
            data-testid="icon-change-button"
            className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 bg-gray-300 hover:bg-gray-400 text-white px-2 py-1 rounded text-xs font-medium transition-all"
            title="Change page icon"
            aria-label="Change page icon"
          >
            Change
          </button>

          {/* IconPicker Dropdown */}
          <IconPicker
            isOpen={isIconPickerOpen}
            onIconSelect={handleIconSelect}
            onClose={() => setIsIconPickerOpen(false)}
            position="bottom"
          />
        </div>

        {/* Title Input */}
        <input
          type="text"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={handleTitleBlur}
          className="text-[40px] font-bold w-full max-w-2xl outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-400 transition-colors"
          data-testid="page-title-input"
          placeholder="Untitled"
        />
      </div>
    </div>
  );
}
