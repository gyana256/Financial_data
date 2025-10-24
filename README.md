# Supabase Financial Data UI

A minimal Vite + React app that performs CRUD against a Supabase table `financial_data`.

Setup

1. Copy `.env.example` to `.env` in the project root and set your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Install and run:

```bash
cd fina/supabase-ui
npm install
npm run dev
```

SQL to create the table

```sql
create table public.financial_data (
  id serial primary key,
  name text not null,
  date date not null,
  type text not null,
  amount numeric not null
);
```

Notes

- This project uses anon key from Supabase for simplicity. For production, use row-level security and authenticated users.
