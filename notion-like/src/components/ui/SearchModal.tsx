'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Page, useAppStore } from '@/lib/store';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * SearchModal - Cmd+K로 열리는 검색 모달 컴포넌트
 *
 * 기능:
 * - 페이지 제목 기반 실시간 필터링
 * - 키보드 네비게이션 (화살표 위/아래, Enter, Esc)
 * - 검색 결과 클릭 또는 Enter로 페이지 이동
 */
export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const { pageCache, setCurrentPageId } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 검색어 기반 페이지 필터링
  const filteredPages = useMemo(() => {
    if (!query.trim()) {
      return pageCache;
    }
    const lowerQuery = query.toLowerCase();
    return pageCache.filter((page) =>
      page.title.toLowerCase().includes(lowerQuery)
    );
  }, [query, pageCache]);

  // 모달 열릴 때 포커스 및 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // 약간의 딜레이 후 포커스 (모달 렌더링 완료 후)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  // 검색어 변경 시 선택 인덱스 초기화
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 선택된 항목이 보이도록 스크롤
  useEffect(() => {
    if (listRef.current && filteredPages.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredPages.length]);

  // 페이지 이동 처리
  const handleNavigate = useCallback((page: Page) => {
    setCurrentPageId(page.id);
    router.push(`/${page.id}`);
    onClose();
  }, [setCurrentPageId, router, onClose]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredPages.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPages[selectedIndex]) {
          handleNavigate(filteredPages[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredPages, selectedIndex, handleNavigate, onClose]);

  // 오버레이 클릭 시 닫기
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh]"
      onClick={handleOverlayClick}
      data-testid="search-modal-overlay"
    >
      <div
        className="w-[500px] max-h-[400px] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden dark:bg-[#2F2F2F]"
        data-testid="search-modal"
      >
        {/* 검색 입력창 */}
        <div className="flex items-center px-4 py-3 border-b border-[#E9E9E7] dark:border-[#3F3F3F]">
          <Search className="w-5 h-5 text-[#787774] mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 text-[16px] text-[#37352F] placeholder-[#B4B4B3] outline-none bg-transparent dark:text-[#E6E6E4] dark:placeholder-[#6B6B6B]"
            data-testid="search-input"
            maxLength={100}
          />
        </div>

        {/* 검색 결과 목록 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto"
          data-testid="search-results"
        >
          {filteredPages.length === 0 ? (
            <div className="px-4 py-8 text-center text-[14px] text-[#787774] dark:text-[#6B6B6B]">
              검색 결과가 없습니다
            </div>
          ) : (
            filteredPages.map((page, index) => (
              <button
                key={page.id}
                onClick={() => handleNavigate(page)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-[#E8F0FE] dark:bg-[#2D4A77]'
                    : 'hover:bg-[#F7F6F3] dark:hover:bg-[#3A3A3A]'
                }`}
                data-testid={`search-result-${page.id}`}
              >
                <span className="text-[20px] flex-shrink-0">{page.icon || '📄'}</span>
                <span className="text-[14px] text-[#37352F] truncate dark:text-[#E6E6E4]">
                  {page.title || 'Untitled'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
