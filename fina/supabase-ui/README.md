# Supabase Financial Data UI

A minimal Vite + React app that performs CRUD against a Supabase table `financial_data`.

Setup

1. Copy `env-example.txt` to `.env` in the project root and set your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
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

Pagination, sorting and filtering

- The app uses server-side pagination — change page size with the selector and navigate pages with the pagination controls.
- Click on table headers to sort by that column. Use the search box and type filter for server-side filtering.

CSV import / export

- Export: click "Export CSV" to download the currently visible page as CSV.
- Import: click "Import CSV" and upload a CSV with headers (e.g. name,date,type,amount). The import will bulk-insert valid rows.

Excel import / export

- Export: click "Export XLSX" to download the currently visible page as an Excel file (.xlsx).
- Import: click "Import XLSX" and upload an .xlsx or .xls file. The first sheet will be parsed and rows with `name`, `date`, and `amount` will be bulk-inserted.

Dependency

- This app uses the `xlsx` (SheetJS) library to read and write Excel files in the browser. It has been added to `package.json`.

- The dashboard uses `chart.js` + `react-chartjs-2` to render small interactive mini-charts (tooltips + hover). These packages were added to `package.json`.

Install updated deps after pulling changes:

```bash
cd fina/supabase-ui
npm install
```

Security note: CSV import accepts values as-is — validate data before importing in production.
