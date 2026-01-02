'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { ClientSidebar } from '@/components/layout/ClientSidebar';

export default function Home() {
  return (
    <MainLayout sidebar={<ClientSidebar />}>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Orchay Notes</h1>
        <p className="text-gray-600">
          Notion-like block-based workspace application
        </p>
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="font-semibold text-blue-900 mb-2">개발 안내</h2>
          <p className="text-sm text-blue-800">
            왼쪽 사이드바에서 페이지를 선택하여 탐색할 수 있습니다.
            페이지 우클릭 또는 더보기 버튼으로 하위 페이지 추가/삭제가 가능합니다.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
