# Supabase scripts

## Baseline capture (establish current state)

Run **before** applying `0021_add_performance_indexes` to record current indexes, table sizes, and row counts.

**Option A – Supabase Dashboard**

1. Open your project → SQL Editor.
2. Paste and run the contents of `baseline_capture.sql`.
3. Export or copy the result sets (indexes, row counts, sizes, RLS) and save as your baseline (e.g. `baseline_YYYYMMDD.txt`).

**Option B – Supabase CLI (remote DB)**

```bash
# If linked: npx supabase link
npx supabase db execute -f supabase/scripts/baseline_capture.sql
```

**Option C – Direct connection (psql)**

```bash
psql "$DATABASE_URL" -f supabase/scripts/baseline_capture.sql -o baseline_$(date +%Y%m%d).txt
```

Then apply the migration as usual (`supabase db push` or run migrations in the dashboard). Re-run the same script after the migration to compare indexes and sizes.
