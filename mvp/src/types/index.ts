// ===================================
// Table (테이블)
// ===================================

export interface Table {
  id: number;
  table_number: number;
  status: TableStatus;
}

export type TableStatus = 'available' | 'occupied';

// ===================================
// Category (카테고리)
// ===================================

export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

// ===================================
// Menu (메뉴)
// ===================================

export interface Menu {
  id: number;
  category_id: number;
  name: string;
  price: number;
  image_url: string | null;
  is_sold_out: boolean;
}

// 카테고리 정보 포함 조인 타입
export interface MenuWithCategory extends Menu {
  category_name: string;
}

// ===================================
// Order (주문)
// ===================================

export interface Order {
  id: number;
  table_id: number;
  status: OrderStatus;
  created_at: string;
}

export type OrderStatus = 'pending' | 'cooking' | 'completed';

// 주문 항목 포함 타입
export interface OrderWithItems extends Order {
  items: OrderItem[];
  table_number: number;
}

// ===================================
// OrderItem (주문 항목)
// ===================================

export interface OrderItem {
  id: number;
  order_id: number;
  menu_id: number;
  quantity: number;
  status: OrderItemStatus;
}

export type OrderItemStatus = 'pending' | 'cooking' | 'completed';

// 메뉴 정보 포함 타입
export interface OrderItemWithMenu extends OrderItem {
  menu_name: string;
  menu_price: number;
}

// ===================================
// API 요청/응답 타입
// ===================================

// POST /api/orders 요청
export interface CreateOrderRequest {
  tableId: number;
  items: {
    menuId: number;
    quantity: number;
  }[];
}

// PATCH /api/orders/{id}/status 요청
export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

// ===================================
// WebSocket 이벤트 페이로드
// ===================================

export interface OrderNewEvent {
  orderId: number;
  tableNumber: number;
  items: OrderItemWithMenu[];
  createdAt: string;
}

export interface OrderStatusEvent {
  orderId: number;
  status: OrderStatus;
}
