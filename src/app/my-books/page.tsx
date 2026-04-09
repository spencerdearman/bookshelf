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
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl dark:text-zinc-50">
            My Books
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Your personal collection
          </p>
        </div>

        {!user ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-3xl dark:bg-zinc-800">
              🔒
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">Sign in to see your books.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="spinner" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-3xl dark:bg-zinc-800">
              📖
            </div>
            <div>
              <p className="font-medium text-black dark:text-zinc-50">No books saved yet</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                <a href="/search" className="font-medium text-black underline dark:text-zinc-50">
                  Find some books
                </a>{" "}
                to start your collection.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => (
              <div
                key={book.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <a
                  href={`/book/${book.ol_key.replace("/works/", "")}`}
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {book.cover_url ? (
                      <Image
                        src={book.cover_url}
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
                      {book.author}
                    </p>
                  </div>
                </a>
                <div className="px-3 pb-3">
                  <button
                    onClick={() => handleRemove(book.id, book.title)}
                    disabled={removingId === book.id}
                    className="w-full rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    {removingId === book.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
