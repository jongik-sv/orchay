// 메뉴 API
// GET /api/menus
// TSK-01-02에서 구현 예정

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ menus: [] });
}
