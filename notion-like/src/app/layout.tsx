import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchay Notes - 올인원 워크스페이스",
  description: "Notion 같은 블록 기반 워크스페이스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
