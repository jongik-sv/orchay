/**
 * 메뉴 API
 * GET /api/menus
 * TSK-01-02: 카테고리/메뉴 조회 API 구현
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMenus } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSoldOut = searchParams.get('includeSoldOut') === 'true';

    const menus = getMenus(includeSoldOut);
    return NextResponse.json({ menus });
  } catch (error) {
    console.error('Failed to fetch menus:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menus' },
      { status: 500 }
    );
  }
}
