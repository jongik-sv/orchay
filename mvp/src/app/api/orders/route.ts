/**
 * 주문 API
 * POST /api/orders - 주문 생성
 * GET /api/orders?table={id} - 테이블별 주문 조회
 * TSK-01-03: 주문 생성/조회 API 구현
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getOrdersByTable } from '@/lib/db';

/**
 * 테이블별 주문 조회
 * GET /api/orders?table={tableId}
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tableIdStr = searchParams.get('table');

  if (!tableIdStr) {
    return NextResponse.json(
      { error: 'MISSING_TABLE_ID', message: '테이블 ID가 필요합니다' },
      { status: 400 }
    );
  }

  const tableId = parseInt(tableIdStr, 10);
  if (isNaN(tableId)) {
    return NextResponse.json(
      { error: 'INVALID_TABLE_ID', message: '유효하지 않은 테이블 ID입니다' },
      { status: 400 }
    );
  }

  try {
    const orders = getOrdersByTable(tableId);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[API] 주문 조회 실패:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * 주문 생성
 * POST /api/orders
 * Body: { tableId: number, items: [{ menuId: number, quantity: number }] }
 */
export async function POST(request: NextRequest) {
  let body: { tableId?: number; items?: { menuId: number; quantity: number }[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: '유효하지 않은 JSON 형식입니다' },
      { status: 400 }
    );
  }

  const { tableId, items } = body;

  // tableId 검증
  if (tableId === undefined || tableId === null) {
    return NextResponse.json(
      { error: 'MISSING_TABLE_ID', message: '테이블 ID가 필요합니다' },
      { status: 400 }
    );
  }

  // items 검증
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'EMPTY_ITEMS', message: '주문 항목이 없습니다' },
      { status: 400 }
    );
  }

  // 각 항목 검증
  for (const item of items) {
    if (!item.menuId || !item.quantity) {
      return NextResponse.json(
        { error: 'INVALID_ITEM', message: '주문 항목이 유효하지 않습니다' },
        { status: 400 }
      );
    }
    if (item.quantity < 1 || item.quantity > 99) {
      return NextResponse.json(
        { error: 'INVALID_QUANTITY', message: '수량은 1~99 사이여야 합니다' },
        { status: 400 }
      );
    }
  }

  try {
    const orderId = createOrder(tableId, items);
    return NextResponse.json({ orderId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'EMPTY_ITEMS') {
      return NextResponse.json(
        { error: 'EMPTY_ITEMS', message: '주문 항목이 없습니다' },
        { status: 400 }
      );
    }

    if (message === 'INVALID_QUANTITY') {
      return NextResponse.json(
        { error: 'INVALID_QUANTITY', message: '수량은 1~99 사이여야 합니다' },
        { status: 400 }
      );
    }

    console.error('[API] 주문 생성 실패:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
