import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { ToastProvider } from "@/components/toast-provider";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "Chat Application",
  description: "A modern chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthSessionProvider>
          <QueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
