'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import MenuHeader from '@/components/MenuHeader';
import CategoryTabs from '@/components/CategoryTabs';
import MenuCard from '@/components/MenuCard';
import { Category, MenuWithCategory, CategoriesResponse, MenusResponse } from '@/types';

function OrderPageContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table');

  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<MenuWithCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 카테고리별 섹션 참조
  const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const [categoriesRes, menusRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/menus?includeSoldOut=true')
      ]);

      if (!categoriesRes.ok || !menusRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const categoriesData: CategoriesResponse = await categoriesRes.json();
      const menusData: MenusResponse = await menusRes.json();

      setCategories(categoriesData.categories);
      setMenus(menusData.menus);
      if (categoriesData.categories.length > 0) {
        setActiveCategory(categoriesData.categories[0].id);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('메뉴를 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tableNumber) {
      setError('테이블 정보를 찾을 수 없습니다');
      setIsLoading(false);
      return;
    }

    fetchData();
  }, [tableNumber, fetchData]);

  // 카테고리 스크롤 함수
  const scrollToCategory = (categoryId: number) => {
    setActiveCategory(categoryId);
    const element = categoryRefs.current[categoryId];
    if (element) {
      const headerOffset = 140; // MenuHeader(72px) + CategoryTabs(~68px)
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // 재시도 함수
  const handleRetry = () => {
    fetchData();
  };

  // 카테고리별 메뉴 그룹화
  const menusByCategory = categories.map(category => ({
    ...category,
    menus: menus.filter(menu => menu.categoryId === category.id)
  }));

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="backdrop-blur-[16px] bg-white/25 border border-white/30 rounded-[1.25rem] p-8 shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-700 mt-4 text-center">메뉴를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <div className="backdrop-blur-[16px] bg-white/25 border border-white/30 rounded-[1.25rem] p-6 text-center shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
          <p className="text-gray-700 mb-4" data-testid="error-message">{error}</p>
          {tableNumber && (
            <button
              onClick={handleRetry}
              className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-xl font-medium shadow-[0_4px_16px_rgba(139,92,246,0.30)] hover:shadow-[0_6px_24px_rgba(139,92,246,0.40)] transition-all"
              data-testid="retry-button"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    );
  }

  // 메뉴 없음 상태
  if (menus.length === 0) {
    return (
      <div className="min-h-screen">
        <MenuHeader tableNumber={Number(tableNumber)} />
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
          <div className="backdrop-blur-[16px] bg-white/25 border border-white/30 rounded-[1.25rem] p-6 text-center shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
            <p className="text-gray-700" data-testid="empty-message">등록된 메뉴가 없습니다</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <MenuHeader tableNumber={Number(tableNumber)} />

      <CategoryTabs
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={scrollToCategory}
      />

      {/* 메뉴 목록 */}
      <div className="px-4 pt-4" data-testid="menu-list">
        {menusByCategory.map((category) => (
          category.menus.length > 0 && (
            <div
              key={category.id}
              ref={(el) => { categoryRefs.current[category.id] = el; }}
              className="mb-8"
              data-testid={`category-section-${category.id}`}
            >
              {/* 카테고리 제목 */}
              <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">
                {category.name}
              </h2>

              {/* 메뉴 그리드: 반응형 2열/3열/4열 */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {category.menus.map((menu) => (
                  <MenuCard
                    key={menu.id}
                    menu={menu}
                    onClick={() => {
                      // TSK-03-02에서 장바구니 추가 기능 구현 예정
                      console.log('Menu clicked:', menu.id);
                    }}
                  />
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// Loading fallback 컴포넌트
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="backdrop-blur-[16px] bg-white/25 border border-white/30 rounded-[1.25rem] p-8 shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-700 mt-4 text-center">로딩 중...</p>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OrderPageContent />
    </Suspense>
  );
}
