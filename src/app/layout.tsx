import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Plane } from "lucide-react";
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
  title: "SkyLog",
  description: "Track and log your flights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#0f172a] text-slate-200 antialiased">
        <ClerkProvider appearance={{ baseTheme: dark }}>
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
              <nav className="flex items-center gap-5 sm:gap-6">
                <a href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
                  <Plane className="h-5 w-5 text-blue-400" />
                  SkyLog
                </a>
                <div className="flex items-center gap-3 sm:gap-4">
                  <a href="/" className="text-[13px] text-slate-400 transition-colors hover:text-white">
                    Dashboard
                  </a>
                  <Show when="signed-in">
                    <a href="/log" className="text-[13px] text-slate-400 transition-colors hover:text-white">
                      Log Flight
                    </a>
                    <a href="/logbook" className="text-[13px] text-slate-400 transition-colors hover:text-white">
                      Logbook
                    </a>
                    <a href="/leaderboard" className="text-[13px] text-slate-400 transition-colors hover:text-white">
                      Leaderboard
                    </a>
                  </Show>
                </div>
              </nav>
              <div className="flex items-center gap-3">
                <Show when="signed-out">
                  <SignInButton>
                    <button className="text-[13px] text-slate-400 transition-colors hover:text-white">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="rounded-lg bg-blue-500 px-3.5 py-1.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-blue-400">
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
