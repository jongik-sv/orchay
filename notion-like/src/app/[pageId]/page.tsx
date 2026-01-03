"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, notFound } from "next/navigation";
import { Star, Loader2, Check, AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClientSidebar } from "@/components/layout/ClientSidebar";
import { Editor } from "@/components/editor/Editor";
import { PageHeader } from "@/components/editor/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useAppStore } from "@/lib/store";

interface PageData {
  id: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
  parent_id: string | null;
  content: string | null;
  is_favorite: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SaveState {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
}

/**
 * Debounce 유틸리티 함수
 * @param fn 실행할 함수
 * @param delay 지연 시간 (ms)
 * @returns Debounce된 함수
 */
function debounce<T extends unknown[]>(
  fn: (...args: T) => unknown,
  delay: number
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export default function PageContent() {
  const params = useParams();
  const pageId = params?.pageId as string;
  const setCurrentPageId = useAppStore((state) => state.setCurrentPageId);
  const addToast = useAppStore((state) => state.addToast);

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  // [MINOR-004] setTimeout cleanup을 위한 ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // [MINOR-004] 컴포넌트 언마운트 시 timeout cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // URL 변경 시 Zustand 상태 동기화
  useEffect(() => {
    if (pageId) {
      setCurrentPageId(pageId);
    }
  }, [pageId, setCurrentPageId]);

  // 페이지 데이터 로드
  useEffect(() => {
    if (!pageId) return;

    const loadPage = async () => {
      try {
        setLoading(true);
        setNotFoundState(false);
        const response = await fetch(`/api/pages/${pageId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setNotFoundState(true);
            return;
          }
          const errorMsg = "페이지를 불러오는 중 오류가 발생했습니다.";
          setSaveState({ status: "error", message: errorMsg });
          addToast("error", errorMsg);
          return;
        }

        const data = await response.json();
        setPageData(data);
        setSaveState({ status: "idle" });
      } catch {
        const errorMsg = "페이지를 불러오는 중 오류가 발생했습니다.";
        setSaveState({ status: "error", message: errorMsg });
        addToast("error", errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [pageId, addToast]);

  // 404 상태일 때 notFound() 호출
  useEffect(() => {
    if (notFoundState && !loading) {
      notFound();
    }
  }, [notFoundState, loading]);

  // [MAJOR-002] 공통 페이지 업데이트 함수 - DRY 원칙 적용
  const updatePage = useCallback(
    async (updates: Partial<PageData>, errorMessage: string) => {
      if (!pageId) return;

      try {
        setSaveState({ status: "saving" });

        const response = await fetch(`/api/pages/${pageId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Update failed with status ${response.status}`);
        }

        const updatedPage = await response.json();
        setPageData(updatedPage);
        setSaveState({ status: "saved" });

        // [MINOR-004] timeout cleanup 적용
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          setSaveState({ status: "idle" });
        }, 2000);
      } catch {
        setSaveState({ status: "error", message: errorMessage });
        addToast("error", errorMessage);
      }
    },
    [pageId, addToast]
  );

  // 콘텐츠 저장 함수
  const saveContent = useCallback(
    (content: string) => updatePage({ content }, "저장 실패. 다시 시도해주세요."),
    [updatePage]
  );

  // Debounce된 저장 함수 (1초)
  const debouncedSave = useMemo(() => debounce(saveContent, 1000), [saveContent]);

  // 즐겨찾기 토글 - [MAJOR-002] 공통 함수 사용
  const toggleFavorite = useCallback(() => {
    if (!pageData) return;
    const newFavoriteState = pageData.is_favorite === 0 ? true : false;
    updatePage({ is_favorite: newFavoriteState ? 1 : 0 }, "즐겨찾기 변경에 실패했습니다.");
  }, [pageData, updatePage]);

  // 제목 변경 핸들러 - [MAJOR-002] 공통 함수 사용
  const handleTitleChange = useCallback(
    (title: string) => updatePage({ title }, "제목 저장에 실패했습니다."),
    [updatePage]
  );

  // 아이콘 변경 핸들러 - [MAJOR-002] 공통 함수 사용
  const handleIconChange = useCallback(
    (icon: string) => updatePage({ icon }, "아이콘 저장에 실패했습니다."),
    [updatePage]
  );

  if (loading) {
    return (
      <MainLayout sidebar={<ClientSidebar />}>
        <PageSkeleton />
      </MainLayout>
    );
  }

  if (!pageData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--notion-bg-primary)]">
        <div className="text-lg text-red-500">
          {saveState.message || "페이지를 불러올 수 없습니다."}
        </div>
      </div>
    );
  }

  return (
    <MainLayout sidebar={<ClientSidebar />}>
      <div className="flex flex-col h-full w-full">
        {/* 페이지 헤더 */}
        <div className="relative">
          <PageHeader
            pageId={pageData.id}
            title={pageData.title}
            icon={pageData.icon || "📄"}
            coverUrl={pageData.cover_url || undefined}
            onTitleChange={handleTitleChange}
            onIconChange={handleIconChange}
          />

          {/* 즐겨찾기 버튼 - 헤더 우측 상단에 위치 */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={toggleFavorite}
              className="p-2 rounded hover:bg-[var(--notion-bg-tertiary)] transition-colors bg-[var(--notion-bg-primary)]/80 backdrop-blur-sm"
              title={pageData.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
              aria-label={pageData.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
              data-testid="favorite-toggle-btn"
            >
              <Star
                size={20}
                className={
                  pageData.is_favorite
                    ? "text-[#E9B44C] fill-[#E9B44C]"
                    : "text-[var(--notion-text-tertiary)]"
                }
              />
            </button>

            {/* 저장 상태 표시 */}
            <div
              className="flex items-center gap-1.5 text-sm bg-[var(--notion-bg-primary)]/80 backdrop-blur-sm px-2 py-1 rounded"
              data-testid="save-status"
              data-save-state={saveState.status}
            >
              {saveState.status === "saving" && (
                <>
                  <Loader2 size={14} className="text-blue-600 animate-spin" />
                  <span className="text-blue-600">저장 중...</span>
                </>
              )}
              {saveState.status === "saved" && (
                <>
                  <Check size={14} className="text-green-600" />
                  <span className="text-green-600">저장됨</span>
                </>
              )}
              {saveState.status === "error" && (
                <>
                  <AlertCircle size={14} className="text-red-600" />
                  <span className="text-red-600">{saveState.message}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 에디터 영역 */}
        <div className="flex-1 overflow-auto bg-[var(--notion-bg-primary)]">
          <div className="px-12 py-8">
            <Editor
              initialContent={pageData.content || undefined}
              onChange={(content) => {
                debouncedSave(content);
              }}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
