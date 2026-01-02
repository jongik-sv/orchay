"use client";

import { useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

interface EditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
}

/**
 * BlockNote 기반 블록 에디터 컴포넌트
 *
 * @param initialContent - JSON 형식의 초기 콘텐츠 (문자열)
 * @param onChange - 콘텐츠 변경 시 호출되는 콜백 함수
 *
 * @example
 * ```tsx
 * <Editor
 *   initialContent='[{"type":"paragraph"}]'
 *   onChange={(content) => console.log(content)}
 * />
 * ```
 */
export function Editor({ initialContent, onChange }: EditorProps) {
  // BlockNote 인스턴스 생성
  // initialContent가 있으면 JSON 파싱하여 전달, 없으면 undefined
  const editor = useCreateBlockNote({
    initialContent: initialContent
      ? (() => {
          try {
            return JSON.parse(initialContent);
          } catch (error) {
            console.error("[Editor] Failed to parse initialContent:", error);
            return undefined;
          }
        })()
      : undefined,
  });

  // 콘텐츠 변경 핸들러
  const handleChange = useCallback(() => {
    if (onChange && editor) {
      try {
        const content = JSON.stringify(editor.document);
        onChange(content);
      } catch (error) {
        console.error("[Editor] Failed to stringify document:", error);
      }
    }
  }, [onChange, editor]);

  if (!editor) {
    return <div className="flex items-center justify-center h-screen">Loading editor...</div>;
  }

  return (
    <div className="editor-container">
      {/* @ts-ignore BlockNoteView prop types */}
      <BlockNoteView editor={editor} onChange={handleChange} />
    </div>
  );
}
