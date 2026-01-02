// MenuCard 컴포넌트 - 메뉴 카드 (글래스모피즘 디자인)

import { MenuWithCategory } from '@/types';

interface MenuCardProps {
  menu: MenuWithCategory;
  onClick?: () => void;
}

export default function MenuCard({ menu, onClick }: MenuCardProps) {
  const handleClick = () => {
    if (!menu.isSoldOut && onClick) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`backdrop-blur-[16px] bg-white/25 border border-white/30 rounded-[1.25rem] overflow-hidden shadow-[0_8px_32px_rgba(139,92,246,0.15)] transition-all ${
        menu.isSoldOut
          ? 'opacity-60 cursor-not-allowed grayscale'
          : 'cursor-pointer hover:shadow-[0_12px_40px_rgba(139,92,246,0.25)] hover:scale-[1.02]'
      }`}
      data-testid={`menu-card-${menu.id}`}
    >
      {/* 이미지 영역 */}
      <div className="aspect-square relative bg-gray-100">
        {menu.imageUrl ? (
          <img
            src={menu.imageUrl}
            alt={menu.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-sm">이미지 없음</span>
          </div>
        )}
        {menu.isSoldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              품절
            </span>
          </div>
        )}
      </div>

      {/* 정보 영역 */}
      <div className="p-3">
        <h3 className="font-medium text-gray-800 truncate" data-testid={`menu-name-${menu.id}`}>
          {menu.name}
        </h3>
        <p className="text-primary-600 font-bold mt-1" data-testid={`menu-price-${menu.id}`}>
          {menu.price.toLocaleString()}원
        </p>
      </div>
    </div>
  );
}
