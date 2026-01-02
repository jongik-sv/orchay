"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Editor } from "@/components/editor/Editor";

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

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  // 페이지 데이터 로드
  useEffect(() => {
    if (!pageId) return;

    const loadPage = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/pages/${pageId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setSaveState({
              status: "error",
              message: "페이지를 찾을 수 없습니다.",
            });
          } else {
            setSaveState({
              status: "error",
              message: "페이지를 불러오는 중 오류가 발생했습니다.",
            });
          }
          return;
        }

        const data = await response.json();
        setPageData(data);
        setSaveState({ status: "idle" });
      } catch (error) {
        console.error("[PageContent] Failed to load page:", error);
        setSaveState({
          status: "error",
          message: "페이지를 불러오는 중 오류가 발생했습니다.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [pageId]);

  // 콘텐츠 저장 함수
  const saveContent = useCallback(
    async (content: string) => {
      if (!pageId) return;

      try {
        setSaveState({ status: "saving" });

        const response = await fetch(`/api/pages/${pageId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          throw new Error(`Save failed with status ${response.status}`);
        }

        const updatedPage = await response.json();
        setPageData(updatedPage);
        setSaveState({ status: "saved" });

        // 2초 후 상태 초기화
        setTimeout(() => {
          setSaveState({ status: "idle" });
        }, 2000);
      } catch (error) {
        console.error("[PageContent] Failed to save content:", error);
        setSaveState({
          status: "error",
          message: "저장 실패. 다시 시도해주세요.",
        });
      }
    },
    [pageId]
  );

  // Debounce된 저장 함수 (1초)
  const debouncedSave = useMemo(() => debounce(saveContent, 1000), [saveContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">불러오는 중...</div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">
          {saveState.message || "페이지를 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between px-12 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {pageData.icon && (
            <span className="text-4xl">{pageData.icon}</span>
          )}
          <h1 className="text-3xl font-bold">{pageData.title}</h1>
        </div>

        {/* 저장 상태 표시 */}
        <div className="text-sm">
          {saveState.status === "saving" && (
            <span className="text-blue-600">저장 중...</span>
          )}
          {saveState.status === "saved" && (
            <span className="text-green-600">저장됨 ✓</span>
          )}
          {saveState.status === "error" && (
            <span className="text-red-600">{saveState.message}</span>
          )}
        </div>
      </div>

      {/* 에디터 영역 */}
      <div className="flex-1 overflow-auto bg-white">
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
  );
}
