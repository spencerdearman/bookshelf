import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bookshelf",
  description: "Track your favorite books",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <header className="sticky top-0 z-50 border-b border-[#e8e8e4] bg-[#fafaf8]/90 backdrop-blur-md dark:border-[#222] dark:bg-[#111]/90">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
              <nav className="flex items-center gap-5 sm:gap-6">
                <a href="/" className="text-[17px] font-semibold tracking-tight text-[#1a1a1a] dark:text-[#f5f5f3]">
                  Bookshelf
                </a>
                <div className="flex items-center gap-3 sm:gap-4">
                  <a href="/" className="text-[13px] text-[#888] transition-colors hover:text-[#1a1a1a] dark:text-[#777] dark:hover:text-[#f5f5f3]">
                    Home
                  </a>
                  <a href="/search" className="text-[13px] text-[#888] transition-colors hover:text-[#1a1a1a] dark:text-[#777] dark:hover:text-[#f5f5f3]">
                    Search
                  </a>
                  <Show when="signed-in">
                    <a href="/my-books" className="text-[13px] text-[#888] transition-colors hover:text-[#1a1a1a] dark:text-[#777] dark:hover:text-[#f5f5f3]">
                      My Books
                    </a>
                  </Show>
                </div>
              </nav>
              <div className="flex items-center gap-3">
                <Show when="signed-out">
                  <SignInButton>
                    <button className="text-[13px] text-[#888] transition-colors hover:text-[#1a1a1a] dark:text-[#777] dark:hover:text-[#f5f5f3]">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="rounded-lg bg-[#1a1a1a] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#333] dark:bg-[#f5f5f3] dark:text-[#1a1a1a] dark:hover:bg-[#ddd]">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
