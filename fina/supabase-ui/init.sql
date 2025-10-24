-- SQL to create the table used by the app
create table if not exists public.financial_data (
  id serial primary key,
  name text not null,
  date date not null,
  type text not null,
  amount numeric not null
);
