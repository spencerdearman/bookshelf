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
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=12&language=eng`
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
    if (!query.trim()) return;
    doSearch(query);
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
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl dark:text-zinc-50">
            Search Books
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Find books on Open Library and save your favorites
          </p>
        </div>

        <form onSubmit={handleSearch} className="mx-auto mb-10 flex max-w-lg flex-col gap-3 sm:flex-row">
          <label htmlFor="book-search" className="sr-only">
            Search by title or author
          </label>
          <input
            id="book-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or author..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm outline-none transition-colors focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && (
          <p className="mb-6 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="spinner" />
          </div>
        ) : searched && results.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-3xl dark:bg-zinc-800">
              🔍
            </div>
            <div>
              <p className="font-medium text-black dark:text-zinc-50">No results found</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Try a different title or author name.
              </p>
            </div>
          </div>
        ) : (
          results.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
              {results.map((book) => (
                <div
                  key={book.key}
                  className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <a href={`/book/${book.key.replace("/works/", "")}`}>
                    <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      {book.cover_i ? (
                        <Image
                          src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                          alt={book.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                          No cover
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold leading-tight text-black line-clamp-2 dark:text-zinc-50">
                        {book.title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 line-clamp-1">
                        {book.author_name?.[0] ?? "Unknown"}
                      </p>
                    </div>
                  </a>
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => handleSave(book)}
                      disabled={!user || savedKeys.has(book.key)}
                      className="w-full rounded-lg bg-black py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
                    >
                      {savedKeys.has(book.key) ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
