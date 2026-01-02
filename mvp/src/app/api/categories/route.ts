// 카테고리 API
// GET /api/categories
// TSK-01-02에서 구현 예정

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ categories: [] });
}
