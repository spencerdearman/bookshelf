"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import Image from "next/image";

interface Favorite {
  id: number;
  title: string;
  author: string;
  cover_url: string | null;
  ol_key: string;
  created_at: string;
}

export default function MyBooksPage() {
  const { session } = useSession();
  const { user } = useUser();
  const [books, setBooks] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!session || !user) {
      setLoading(false);
      return;
    }

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    supabase
      .from("favorites")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError("Couldn\u2019t load your books. Please refresh.");
        } else {
          setBooks(data ?? []);
        }
        setLoading(false);
      });
  }, [session, user]);

  async function handleRemove(id: number, title: string) {
    if (!session) return;
    if (!confirm(`Remove "${title}" from your books?`)) return;

    setRemovingId(id);

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    const { error } = await supabase.from("favorites").delete().eq("id", id);

    if (error) {
      alert(`Failed to remove: ${error.message}`);
    } else {
      setBooks((prev) => prev.filter((b) => b.id !== id));
    }
    setRemovingId(null);
  }

  return (
    <div className="flex flex-col flex-1 bg-[#fafaf8] dark:bg-[#111]">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a] sm:text-4xl dark:text-[#f5f5f3]">
            My Books
          </h1>
          <p className="mt-2 text-[#888] dark:text-[#777]">
            Your personal collection
          </p>
        </div>

        {!user ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-[#999] dark:text-[#666]">Sign in to see your books.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-500">{error}</p>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f3]">No books saved yet</p>
            <p className="text-sm text-[#999] dark:text-[#666]">
              <a href="/search" className="underline hover:text-[#1a1a1a] dark:hover:text-[#f5f5f3]">
                Find some books
              </a>{" "}
              to start your collection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => (
              <div key={book.id} className="flex flex-col">
                <a
                  href={`/book/${book.ol_key.replace("/works/", "")}`}
                  className="group"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#eee] shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all duration-200 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] group-hover:-translate-y-0.5 dark:bg-[#222] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] dark:group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    {book.cover_url ? (
                      <Image
                        src={book.cover_url}
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
                      {book.author}
                    </p>
                  </div>
                </a>
                <button
                  onClick={() => handleRemove(book.id, book.title)}
                  disabled={removingId === book.id}
                  className="mt-2 w-full rounded-xl py-2 text-[12px] font-medium transition-colors border border-[#e5e5e0] text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-[#2a2a2a] dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  {removingId === book.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
