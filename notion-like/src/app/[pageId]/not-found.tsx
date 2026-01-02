'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-gray-500 mb-8">
          요청하신 페이지가 존재하지 않거나 삭제되었습니다.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white rounded-md hover:bg-[#2F2F2F] transition-colors"
        >
          <Home size={16} />
          <span>홈으로 돌아가기</span>
        </Link>
      </div>
    </div>
  );
}
