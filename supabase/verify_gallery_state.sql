-- Run in Supabase → SQL Editor to see what the site reads/writes.
-- Expect one row: id = shared, state JSON with keys "0".."5", each { "t": tap count, "d": "YYYY-MM-DD" or "" }.

SELECT id, state, updated_at
FROM public.gallery_progress
WHERE id = 'shared';
