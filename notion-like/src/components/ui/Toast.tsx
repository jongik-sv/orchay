'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore, Toast as ToastType } from '@/lib/store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

/**
 * 개별 Toast 아이템 컴포넌트
 */
function ToastItem({ toast, onRemove }: { toast: ToastType; onRemove: (id: string) => void }) {
  const { id, type, message } = toast;

  // 3초 후 자동 제거
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [id, onRemove]);

  // 타입별 스타일 및 아이콘
  const typeConfig = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-[var(--notion-green)]',
      textColor: 'text-white',
      borderColor: 'border-[var(--notion-green)]',
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-[var(--notion-red)]',
      textColor: 'text-white',
      borderColor: 'border-[var(--notion-red)]',
    },
    info: {
      icon: Info,
      bgColor: 'bg-[var(--notion-blue)]',
      textColor: 'text-white',
      borderColor: 'border-[var(--notion-blue)]',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-[var(--notion-orange)]',
      textColor: 'text-white',
      borderColor: 'border-[var(--notion-orange)]',
    },
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
        ${config.bgColor} ${config.textColor}
        animate-slide-in-right
        min-w-[280px] max-w-[400px]
      `}
      data-testid="toast"
      data-toast-type={type}
      role="alert"
      aria-live="polite"
    >
      <IconComponent size={20} className="flex-shrink-0" />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={() => onRemove(id)}
        className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="닫기"
        data-testid="toast-close-btn"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/**
 * ToastContainer - Toast 알림을 표시하는 컨테이너
 * 화면 우하단에 고정 위치
 */
export function ToastContainer() {
  const toasts = useAppStore((state) => state.toasts);
  const removeToast = useAppStore((state) => state.removeToast);

  const handleRemove = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={handleRemove} />
      ))}
    </div>
  );
}
