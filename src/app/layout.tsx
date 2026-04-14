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
  title: "Vector",
  description: "Track and log your flights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-[#1d1d1f] antialiased">
        <ClerkProvider>
          <header className="sticky top-0 z-50 bg-[#1d1d1f]">
            <div className="mx-auto flex h-11 max-w-[980px] items-center justify-between px-5">
              <nav className="flex items-center gap-7">
                <a href="/" className="font-mono text-[13px] font-semibold tracking-tight text-white">
                  Vector
                </a>
                <div className="flex items-center gap-6">
                  <a href="/" className="text-[12px] text-[#d1d1d6] transition-colors hover:text-white">
                    Dashboard
                  </a>
                  <Show when="signed-in">
                    <a href="/log" className="text-[12px] text-[#d1d1d6] transition-colors hover:text-white">
                      Log
                    </a>
                    <a href="/logbook" className="text-[12px] text-[#d1d1d6] transition-colors hover:text-white">
                      Logbook
                    </a>
                    <a href="/leaderboard" className="text-[12px] text-[#d1d1d6] transition-colors hover:text-white">
                      Leaderboard
                    </a>
                  </Show>
                </div>
              </nav>
              <div className="flex items-center gap-4">
                <Show when="signed-out">
                  <SignInButton>
                    <button className="text-[12px] text-[#d1d1d6] transition-colors hover:text-white">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="rounded-full bg-white px-3.5 py-1 text-[12px] font-medium text-[#1d1d1f] transition-opacity hover:opacity-80">
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
