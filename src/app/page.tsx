"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

interface Favorite {
  id: number;
  user_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  ol_key: string;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const [books, setBooks] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase
      .from("favorites")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError("Couldn\u2019t load the bookshelf. Please refresh.");
        } else {
          setBooks(data ?? []);
        }
        setLoading(false);
      });
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="flex flex-col flex-1 bg-[#fafaf8] dark:bg-[#111]">
      {/* Hero */}
      <section className="px-4 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[#1a1a1a] sm:text-5xl dark:text-[#f5f5f3]">
            What are you reading?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-[#666] dark:text-[#999]">
            Discover books, save your favorites, and see what everyone else is into.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-md">
            <label htmlFor="home-search" className="sr-only">Search for a book</label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                id="home-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or author..."
                className="w-full rounded-2xl border border-[#e5e5e0] bg-white py-3.5 pl-11 pr-4 text-[15px] text-[#1a1a1a] outline-none transition-all placeholder:text-[#bbb] focus:border-[#ccc] focus:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#f5f5f3] dark:placeholder:text-[#555] dark:focus:border-[#444] dark:focus:shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
              />
            </div>
          </form>
        </div>
      </section>

      {/* Bookshelf */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        {books.length > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-[#999] dark:text-[#666]">
              Recently saved
            </h2>
            <span className="text-sm text-[#bbb] dark:text-[#555]">
              {books.length} book{books.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-500">{error}</p>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-[#999] dark:text-[#666]">
              No books on the shelf yet. Be the first to add one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {books.map((book) => (
              <a
                key={book.id}
                href={`/book/${book.ol_key.replace("/works/", "")}`}
                className="group flex flex-col"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#eee] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-200 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] group-hover:-translate-y-0.5 dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] dark:group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
                      <span className="text-xs font-medium text-[#999] line-clamp-3">{book.title}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 min-w-0">
                  <p className="text-[13px] font-medium leading-snug text-[#1a1a1a] line-clamp-1 dark:text-[#e5e5e3]">
                    {book.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#999] line-clamp-1 dark:text-[#666]">
                    {book.author}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
