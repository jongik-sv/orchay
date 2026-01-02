/**
 * 주방용 주문 API
 * GET /api/kitchen/orders - 주방 주문 목록 (pending, cooking)
 * TSK-01-03: 주문 생성/조회 API 구현
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKitchenOrders } from '@/lib/db';

/**
 * 주방 주문 목록 조회
 * GET /api/kitchen/orders?token={token}
 *
 * 인증: KITCHEN_TOKEN 환경변수와 일치하는 토큰 필요
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  // 토큰 인증 검사
  const kitchenToken = process.env.KITCHEN_TOKEN;
  if (kitchenToken && token !== kitchenToken) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '인증되지 않은 요청입니다' },
      { status: 401 }
    );
  }

  try {
    const orders = getKitchenOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[API] 주방 주문 조회 실패:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
