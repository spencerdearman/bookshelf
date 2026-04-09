"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import Image from "next/image";

interface WorkData {
  title: string;
  description?: string | { value: string };
  covers?: number[];
  subjects?: string[];
  subject_places?: string[];
  subject_times?: string[];
  first_publish_date?: string;
  authors?: { author: { key: string }; type?: { key: string } }[];
}

interface AuthorData {
  name: string;
  bio?: string | { value: string };
  birth_date?: string;
  death_date?: string;
  photos?: number[];
}

interface RatingData {
  summary?: {
    average?: number;
    count?: number;
  };
}

interface EditionsData {
  size?: number;
  entries?: {
    number_of_pages?: number;
    publishers?: string[];
    publish_date?: string;
    isbn_13?: string[];
    isbn_10?: string[];
    languages?: { key: string }[];
  }[];
}

function extractText(val: string | { value: string } | undefined): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  return val.value ?? null;
}

export default function BookDetailPage() {
  const params = useParams();
  const key = params.key as string;
  const { session } = useSession();
  const { user } = useUser();

  const [work, setWork] = useState<WorkData | null>(null);
  const [authors, setAuthors] = useState<AuthorData[]>([]);
  const [rating, setRating] = useState<RatingData | null>(null);
  const [editions, setEditions] = useState<EditionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchBook() {
      try {
        const [workRes, ratingRes, editionsRes] = await Promise.all([
          fetch(`https://openlibrary.org/works/${key}.json`),
          fetch(`https://openlibrary.org/works/${key}/ratings.json`),
          fetch(`https://openlibrary.org/works/${key}/editions.json?limit=5`),
        ]);

        if (!workRes.ok) throw new Error("Book not found");

        const workData: WorkData = await workRes.json();
        setWork(workData);

        if (ratingRes.ok) {
          setRating(await ratingRes.json());
        }

        if (editionsRes.ok) {
          setEditions(await editionsRes.json());
        }

        if (workData.authors?.length) {
          const authorFetches = workData.authors.slice(0, 3).map((a) =>
            fetch(`https://openlibrary.org${a.author.key}.json`).then((r) =>
              r.ok ? r.json() : null
            )
          );
          const authorResults = await Promise.all(authorFetches);
          setAuthors(authorResults.filter(Boolean));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load book");
      } finally {
        setLoading(false);
      }
    }

    fetchBook();
  }, [key]);

  useEffect(() => {
    if (!session || !user) return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("ol_key", `/works/${key}`)
      .then(({ data }) => {
        if (data && data.length > 0) setSaved(true);
      });
  }, [session, user, key]);

  async function handleSave() {
    if (!session || !user || !work) return;
    setSaving(true);

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    const coverId = work.covers?.[0];
    const coverUrl = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : null;

    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      title: work.title,
      author: authors[0]?.name ?? "Unknown",
      cover_url: coverUrl,
      ol_key: `/works/${key}`,
    });

    if (!error) setSaved(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <p className="text-red-600 dark:text-red-400">{error ?? "Book not found"}</p>
        <a href="/search" className="text-sm font-medium text-black underline dark:text-zinc-50">
          Back to search
        </a>
      </div>
    );
  }

  const description = extractText(work.description);
  const coverId = work.covers?.[0];
  const coverUrl = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : null;
  const avg = rating?.summary?.average;
  const ratingCount = rating?.summary?.count;
  const editionCount = editions?.size;
  const firstEdition = editions?.entries?.[0];
  const pageCount = firstEdition?.number_of_pages;
  const publishers = firstEdition?.publishers;
  const isbn = firstEdition?.isbn_13?.[0] ?? firstEdition?.isbn_10?.[0];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <a
          href="/search"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back to search
        </a>

        <div className="flex flex-col gap-8 sm:flex-row">
          {/* Cover */}
          <div className="flex-shrink-0 self-start">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={work.title}
                width={240}
                height={360}
                className="w-48 rounded-xl shadow-lg sm:w-60"
                priority
              />
            ) : (
              <div className="flex h-72 w-48 items-center justify-center rounded-xl bg-zinc-200 text-sm text-zinc-400 shadow-lg sm:h-[360px] sm:w-60 dark:bg-zinc-800">
                No cover
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl dark:text-zinc-50">
                {work.title}
              </h1>
              {authors.length > 0 && (
                <p className="mt-1 text-lg text-zinc-600 dark:text-zinc-400">
                  by {authors.map((a) => a.name).join(", ")}
                </p>
              )}
            </div>

            {/* Rating */}
            {avg != null && avg > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={
                        star <= Math.round(avg)
                          ? "text-amber-400"
                          : "text-zinc-300 dark:text-zinc-600"
                      }
                    >
                      &#9733;
                    </span>
                  ))}
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {avg.toFixed(1)} {ratingCount != null && `(${ratingCount.toLocaleString()} ratings)`}
                </span>
              </div>
            )}

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3">
              {work.first_publish_date && (
                <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  First published {work.first_publish_date}
                </span>
              )}
              {pageCount && (
                <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {pageCount} pages
                </span>
              )}
              {editionCount != null && (
                <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {editionCount} edition{editionCount !== 1 ? "s" : ""}
                </span>
              )}
              {isbn && (
                <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  ISBN {isbn}
                </span>
              )}
              {publishers && publishers.length > 0 && (
                <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {publishers[0]}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={!user || saved || saving}
                className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
              >
                {saved ? "Saved to My Books" : saving ? "Saving..." : "Save to My Books"}
              </button>
              <a
                href={`https://openlibrary.org/works/${key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                View on Open Library
              </a>
            </div>

            {/* Description */}
            {description && (
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Description
                </h2>
                <p className="leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Subjects */}
        {work.subjects && work.subjects.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Subjects
            </h2>
            <div className="flex flex-wrap gap-2">
              {work.subjects.slice(0, 20).map((subject) => (
                <span
                  key={subject}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Author bios */}
        {authors.some((a) => extractText(a.bio)) && (
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              About the Author{authors.length > 1 ? "s" : ""}
            </h2>
            <div className="flex flex-col gap-6">
              {authors.map((author) => {
                const bio = extractText(author.bio);
                if (!bio) return null;
                const photoId = author.photos?.[0];
                return (
                  <div key={author.name} className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    {photoId && photoId > 0 ? (
                      <Image
                        src={`https://covers.openlibrary.org/a/id/${photoId}-M.jpg`}
                        alt={author.name}
                        width={64}
                        height={64}
                        className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg font-bold text-zinc-400 dark:bg-zinc-800">
                        {author.name[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-black dark:text-zinc-50">{author.name}</p>
                      {(author.birth_date || author.death_date) && (
                        <p className="text-xs text-zinc-500">
                          {author.birth_date}{author.death_date ? ` – ${author.death_date}` : ""}
                        </p>
                      )}
                      <p className="mt-1 text-sm leading-relaxed text-zinc-600 line-clamp-4 dark:text-zinc-400">
                        {bio}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Setting */}
        {((work.subject_places && work.subject_places.length > 0) ||
          (work.subject_times && work.subject_times.length > 0)) && (
          <div className="mt-10 flex flex-wrap gap-8">
            {work.subject_places && work.subject_places.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Places
                </h2>
                <div className="flex flex-wrap gap-2">
                  {work.subject_places.slice(0, 10).map((place) => (
                    <span key={place} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {place}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {work.subject_times && work.subject_times.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Time Periods
                </h2>
                <div className="flex flex-wrap gap-2">
                  {work.subject_times.slice(0, 10).map((time) => (
                    <span key={time} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
