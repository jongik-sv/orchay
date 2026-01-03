'use client';

/**
 * PageSkeleton - Notion 스타일 페이지 로딩 스켈레톤
 * 페이지 로딩 중 표시되는 플레이스홀더 UI
 */
export function PageSkeleton() {
  return (
    <div
      className="flex flex-col h-full w-full bg-[var(--notion-bg-primary)]"
      data-testid="page-skeleton"
    >
      {/* 커버 이미지 영역 스켈레톤 */}
      <div className="w-full h-[200px] skeleton" />

      {/* 컨텐츠 영역 */}
      <div className="px-12 py-8">
        {/* 아이콘 영역 스켈레톤 */}
        <div className="w-[78px] h-[78px] rounded-lg skeleton -mt-10 mb-4" />

        {/* 제목 영역 스켈레톤 */}
        <div className="h-[40px] w-[60%] rounded skeleton mb-8" />

        {/* 본문 라인 스켈레톤 */}
        <div className="space-y-3">
          <div className="h-[20px] w-[90%] rounded skeleton" />
          <div className="h-[20px] w-[75%] rounded skeleton" />
          <div className="h-[20px] w-[85%] rounded skeleton" />
          <div className="h-[20px] w-[60%] rounded skeleton" />
        </div>
      </div>
    </div>
  );
}
