-- Run in Supabase → SQL Editor.
-- Uses UPSERT: creates the `shared` row if it does not exist (UPDATE alone affects 0 rows when no row yet).

INSERT INTO public.gallery_progress (id, state, updated_at)
VALUES (
  'shared',
  '{"0":{"t":0,"d":""},"1":{"t":0,"d":""},"2":{"t":0,"d":""},"3":{"t":0,"d":""},"4":{"t":0,"d":""},"5":{"t":0,"d":""}}'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  state = EXCLUDED.state,
  updated_at = EXCLUDED.updated_at
RETURNING id, state, updated_at;
-- ↑ Shows 1 row in Results so you can confirm all "t" values are 0. "Success, no rows" without RETURNING is easy to misread.
