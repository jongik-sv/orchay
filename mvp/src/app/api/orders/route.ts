// 주문 API
// POST /api/orders, GET /api/orders
// TSK-01-03에서 구현 예정

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ orders: [] });
}

export async function POST() {
  return NextResponse.json({ orderId: null });
}
