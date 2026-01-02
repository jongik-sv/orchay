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

// DB 스키마 타입 (snake_case)
export interface CategoryDb {
  id: number;
  name: string;
  sort_order: number;
}

// API 응답 타입 (camelCase)
export interface Category {
  id: number;
  name: string;
  sortOrder: number;
}

// ===================================
// Menu (메뉴)
// ===================================

// DB 스키마 타입 (snake_case)
export interface MenuDb {
  id: number;
  category_id: number;
  name: string;
  price: number;
  image_url: string | null;
  is_sold_out: boolean;
}

// API 응답 타입 (camelCase)
export interface Menu {
  id: number;
  categoryId: number;
  name: string;
  price: number;
  imageUrl: string | null;
  isSoldOut: boolean;
}

// 카테고리 정보 포함 API 응답 타입
export interface MenuWithCategory extends Menu {
  categoryName: string;
}

// ===================================
// Order (주문)
// ===================================

export interface Order {
  id: number;
  table_id: number;
  status: OrderStatus;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'cooking' | 'completed';

// 주문 항목 포함 타입 (메뉴 정보 포함)
export interface OrderWithItems extends Order {
  items: OrderItemWithMenu[];
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

// POST /api/orders 응답
export interface CreateOrderResponse {
  id: number;
  tableId: number;
  status: OrderStatus;
  createdAt: string;
  items: OrderItemWithMenu[];
}

// PATCH /api/orders/{id}/status 요청
export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

// PATCH /api/orders/{id}/status 응답
export interface UpdateOrderStatusResponse {
  id: number;
  status: OrderStatus;
  updatedAt: string;
}

// GET /api/categories 응답
export interface CategoriesResponse {
  categories: Category[];
}

// GET /api/menus 응답
export interface MenusResponse {
  menus: MenuWithCategory[];
}

// GET /api/orders 응답
export interface OrdersResponse {
  orders: OrderWithItems[];
}

// GET /api/kitchen/orders 응답
export interface KitchenOrdersResponse {
  orders: OrderWithItems[];
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
