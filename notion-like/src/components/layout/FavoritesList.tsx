'use client';

import { useRouter } from 'next/navigation';
import { Page, useAppStore } from '@/lib/store';
import { Star } from 'lucide-react';

interface FavoritesListProps {
  favorites: Page[];
  onToggleFavorite?: (pageId: string, isFavorite: boolean) => void;
}

/**
 * FavoritesList - 즐겨찾기 페이지 목록 컴포넌트
 *
 * Sidebar의 Favorites 섹션에 표시되는 즐겨찾기 페이지 목록입니다.
 * 페이지 클릭 시 해당 페이지로 이동하며, 별 아이콘으로 즐겨찾기 해제 가능합니다.
 */
export function FavoritesList({ favorites, onToggleFavorite }: FavoritesListProps) {
  const router = useRouter();
  const { setCurrentPageId, currentPageId } = useAppStore();

  const handleSelect = (pageId: string) => {
    setCurrentPageId(pageId);
    router.push(`/${pageId}`);
  };

  const handleToggleFavorite = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    onToggleFavorite?.(pageId, false);
  };

  if (!favorites || favorites.length === 0) {
    return (
      <div
        className="px-3 py-2 text-[12px] text-[#B4B4B3] italic"
        data-testid="favorites-empty"
      >
        No favorites yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0" data-testid="favorites-list">
      {favorites.map((page) => (
        <div
          key={page.id}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-[4px] cursor-pointer transition-colors ${
            currentPageId === page.id ? 'bg-[#EFEFEF]' : 'hover:bg-[#EFEFEF]'
          }`}
          onClick={() => handleSelect(page.id)}
          data-testid={`favorite-item-${page.id}`}
        >
          {/* 별 아이콘 (즐겨찾기 해제 버튼) */}
          <button
            onClick={(e) => handleToggleFavorite(e, page.id)}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
            title="Remove from Favorites"
            aria-label="Remove from Favorites"
            data-testid={`unfavorite-btn-${page.id}`}
          >
            <Star size={14} className="text-[#E9B44C] fill-[#E9B44C]" />
          </button>

          {/* 페이지 아이콘 */}
          <span className="text-[16px] leading-none flex-shrink-0">
            {page.icon || '📄'}
          </span>

          {/* 페이지 제목 */}
          <span className="flex-1 text-[14px] text-[#37352F] font-[400] truncate">
            {page.title}
          </span>
        </div>
      ))}
    </div>
  );
}
