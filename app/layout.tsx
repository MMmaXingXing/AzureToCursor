import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azure to Cursor",
  description: "Azure OpenAI proxy service for LangChain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}