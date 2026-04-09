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
      .then(({ data }) => {
        setBooks(data ?? []);
        setLoading(false);
      });
  }, [session, user]);

  async function handleRemove(id: number) {
    if (!session) return;
    setRemovingId(id);

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    const { error } = await supabase.from("favorites").delete().eq("id", id);

    if (!error) {
      setBooks((prev) => prev.filter((b) => b.id !== id));
    }
    setRemovingId(null);
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
            My Books
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Your personal collection
          </p>
        </div>

        {!user ? (
          <p className="text-center text-zinc-500">Sign in to see your books.</p>
        ) : loading ? (
          <p className="text-center text-sm text-zinc-400">Loading...</p>
        ) : books.length === 0 ? (
          <div className="text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              You haven&apos;t saved any books yet.{" "}
              <a href="/search" className="font-medium text-black underline dark:text-zinc-50">
                Find some books
              </a>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => (
              <div
                key={book.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <a
                  href={`https://openlibrary.org${book.ol_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
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
                    onClick={() => handleRemove(book.id)}
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
