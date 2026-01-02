'use client';

import { useEffect, useRef } from 'react';

interface DeleteModalProps {
  isOpen: boolean;
  pageTitle: string;
  hasChildren: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * DeleteModal - 페이지 삭제 확인 모달
 * Notion 스타일의 중앙 정렬 모달
 */
export function DeleteModal({
  isOpen,
  pageTitle,
  hasChildren,
  onConfirm,
  onCancel,
}: DeleteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 키 및 외부 클릭 처리
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      data-testid="delete-modal-backdrop"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
        data-testid="delete-modal"
      >
        <h2 className="text-lg font-semibold text-[#37352F] mb-2">
          Delete page?
        </h2>

        <p className="text-sm text-[#787774] mb-6">
          {hasChildren ? (
            <>
              이 페이지(<span className="font-medium">{pageTitle}</span>)와 모든 하위 페이지가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </>
          ) : (
            <>
              <span className="font-medium">{pageTitle}</span> 페이지가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </>
          )}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[#37352F] hover:bg-[#EFEFEF] rounded transition-colors"
            data-testid="delete-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 rounded transition-colors"
            data-testid="delete-modal-confirm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
