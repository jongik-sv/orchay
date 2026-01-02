// 주방용 주문 API
// GET /api/kitchen/orders
// TSK-01-03에서 구현 예정

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ orders: [] });
}
