"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import Image from "next/image";

interface BookResult {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><div className="spinner" /></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const { session } = useSession();
  const { user } = useUser();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const doSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 3) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&limit=12`
      );
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setResults(data.docs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !user) return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    supabase
      .from("favorites")
      .select("ol_key")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setSavedKeys(new Set(data.map((r) => r.ol_key)));
        }
      });
  }, [session, user]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      doSearch(q);
    }
  }, [searchParams, doSearch]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (trimmed.length < 3) {
      setError("Please enter at least 3 characters.");
      return;
    }
    setError(null);
    doSearch(trimmed);
  }

  async function handleSave(book: BookResult) {
    if (!session || !user) return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    const coverUrl = book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
      : null;

    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      title: book.title,
      author: book.author_name?.[0] ?? "Unknown",
      cover_url: coverUrl,
      ol_key: book.key,
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setSavedKeys((prev) => new Set(prev).add(book.key));
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-[#fafaf8] dark:bg-[#111]">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a] sm:text-4xl dark:text-[#f5f5f3]">
            Search Books
          </h1>
          <p className="mt-2 text-[#888] dark:text-[#777]">
            Find books on Open Library and save your favorites
          </p>
        </div>

        <form onSubmit={handleSearch} className="mx-auto mb-10 max-w-lg">
          <label htmlFor="book-search" className="sr-only">
            Search by title or author
          </label>
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
              id="book-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or author..."
              className="w-full rounded-2xl border border-[#e5e5e0] bg-white py-3.5 pl-11 pr-4 text-[15px] text-[#1a1a1a] outline-none transition-all placeholder:text-[#bbb] focus:border-[#ccc] focus:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#f5f5f3] dark:placeholder:text-[#555] dark:focus:border-[#444] dark:focus:shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
            />
          </div>
        </form>

        {error && (
          <p className="mb-6 text-center text-sm text-red-500 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="spinner" />
          </div>
        ) : searched && results.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f3]">No results found</p>
            <p className="text-sm text-[#999] dark:text-[#666]">
              Try a different title or author name.
            </p>
          </div>
        ) : (
          results.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5">
              {results.map((book) => (
                <div key={book.key} className="flex flex-col">
                  <a
                    href={`/book/${book.key.replace("/works/", "")}`}
                    className="group"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#eee] shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all duration-200 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] group-hover:-translate-y-0.5 dark:bg-[#222] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] dark:group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                      {book.cover_i ? (
                        <Image
                          src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                          alt={book.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
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
                        {book.author_name?.[0] ?? "Unknown"}
                      </p>
                    </div>
                  </a>
                  <button
                    onClick={() => handleSave(book)}
                    disabled={!user || savedKeys.has(book.key)}
                    className="mt-2 w-full rounded-xl py-2 text-[12px] font-medium transition-colors border border-[#e5e5e0] text-[#1a1a1a] hover:bg-[#f0f0ec] disabled:border-[#e5e5e0] disabled:text-[#bbb] disabled:hover:bg-transparent dark:border-[#2a2a2a] dark:text-[#e5e5e3] dark:hover:bg-[#222] dark:disabled:text-[#555] dark:disabled:hover:bg-transparent"
                  >
                    {savedKeys.has(book.key) ? "Saved" : "Save"}
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
