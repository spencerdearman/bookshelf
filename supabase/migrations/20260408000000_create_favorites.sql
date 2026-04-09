create table favorites (
  id bigint generated always as identity primary key,
  user_id text not null,
  title text not null,
  author text not null,
  cover_url text,
  ol_key text not null,
  created_at timestamptz not null default now()
);

-- Index for fast lookups by user
create index favorites_user_id_idx on favorites (user_id);

-- Prevent duplicate books per user
create unique index favorites_user_ol_key_idx on favorites (user_id, ol_key);
