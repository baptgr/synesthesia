## Supabase Setup (MVP)

### 1) Create Project
- Create a Supabase project (if you don’t already have one).

### 2) Storage Buckets
- Buckets to create:
  - `tracks` — for mp3 files (private or public; private + signed URLs recommended)
  - `generated-images` — for generated image outputs (private + signed URLs recommended)

### 3) Database Schema
- Apply the SQL in `supabase/schema.sql` via the SQL editor.
- This creates minimal `tracks` and `generations` tables and an index.

### 4) Row Level Security (optional for MVP)
- For MVP, you can keep RLS off and only write via the backend using the service key.
- Later, consider enabling RLS with policies for safe read access.

### 5) Populate Tracks
- Insert at least 3 rows into `tracks` with known `id`, `title`, and `artist`.
- Upload mp3 files to `tracks/{track_id}.mp3` to match each `tracks.id`.

Example SQL to insert tracks (replace UUIDs/titles/artists):
```
insert into public.tracks (id, title, artist) values
  ('f53dcf2d-cb65-4e5a-9bf0-1b5f9e8fa111', 'Track One', 'Artist A'),
  ('b1e2dd4b-3ac5-459d-8f73-f62e3e1bd222', 'Track Two', 'Artist B'),
  ('c27d7d73-9d0a-4d84-98a0-5c7b0d2bc333', 'Track Three', 'Artist C');
```

### 6) Keys and URL
- In Supabase Settings → API, note your `Project URL`, `anon` key, and `service_role` key.
- Add them to your local `.env` (see `.env.example`).

### 7) Verify
- After uploading 3 mp3s, confirm each file exists at `tracks/{track_id}.mp3`.
- You will use signed URLs to serve these files in the app.
