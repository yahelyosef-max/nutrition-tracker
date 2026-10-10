-- Nutrition tracker — milestone 1 schema.
-- Run once in Supabase → SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- Meal slots used across the app, in day order.
-- breakfast 08:00 · mid 10:30 · lunch 13:00 · afternoon 16:00 · evening 20:00 · night 22:30
create type meal_slot as enum ('breakfast', 'mid', 'lunch', 'afternoon', 'evening', 'night');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  shortcut_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('cut', 'maintain', 'bulk')),
  kcal_target int not null check (kcal_target between 800 and 6000),
  protein_target int not null check (protein_target between 20 and 400),
  started_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on phases (user_id, started_on desc);

create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  description text,
  kcal int not null check (kcal >= 0),
  protein int not null check (protein >= 0),
  default_slot meal_slot,
  has_vegetable boolean not null default false,
  shared boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on meals (user_id);

create table meal_variants (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  kcal_delta int not null default 0,
  protein_delta int not null default 0
);
create index on meal_variants (meal_id);

create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  storage_path text not null,
  taken_at timestamptz,
  recognition jsonb,
  confidence real,
  created_at timestamptz not null default now()
);

create table log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  eaten_on date not null,
  slot meal_slot not null,
  meal_id uuid references meals on delete set null,
  variant_id uuid references meal_variants on delete set null,
  name text not null,
  portion real not null default 1 check (portion > 0),
  kcal int not null check (kcal >= 0),
  protein int not null check (protein >= 0),
  source text not null check (source in ('library', 'photo', 'manual')),
  status text not null check (status in ('confirmed', 'skipped')),
  photo_id uuid references photos on delete set null,
  created_at timestamptz not null default now()
);
create index on log_entries (user_id, eaten_on desc);

create table weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  measured_on date not null,
  weight_kg real not null,
  body_fat_pct real,
  source text not null default 'manual',
  unique (user_id, measured_on)
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  done_on date not null,
  kind text not null,
  source text not null default 'manual'
);

-- Row level security: every row belongs to exactly one user.
alter table profiles enable row level security;
alter table phases enable row level security;
alter table meals enable row level security;
alter table meal_variants enable row level security;
alter table photos enable row level security;
alter table log_entries enable row level security;
alter table weights enable row level security;
alter table workouts enable row level security;

create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own phases" on phases for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own meals" on meals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own variants" on meal_variants for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own photos" on photos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own log" on log_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own weights" on weights for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own workouts" on workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Starter library for a new user: the meals imported from the Gemini summary.
create or replace function seed_starter_library(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  breakfast_id uuid;
begin
  insert into meals (user_id, name, description, kcal, protein, default_slot, has_vegetable)
  values (uid, 'בוקר קבוע', 'פיתת כוסמין, 2 ביצי עין, קורטדו (חלב 3%)', 370, 21, 'breakfast', false)
  returning id into breakfast_id;

  insert into meal_variants (meal_id, user_id, name, kcal_delta, protein_delta)
  values (breakfast_id, uid, 'עם ביצה נוספת', 78, 6);

  insert into meals (user_id, name, description, kcal, protein, default_slot, has_vegetable) values
    (uid, 'פרגיות + אורז + שעועית', 'מנת פרגיות מלאה, חצי מנת אורז, שעועית ירוקה', 700, 48, 'lunch', true),
    (uid, 'קורטדו', 'חלב 3%', 40, 2, 'mid', false),
    (uid, 'מעדן חלבון', null, 130, 20, 'afternoon', false),
    (uid, 'טוסט טורטיה וטופו', '2 טורטיות קטנות, ~150 ג׳ טופו, 2 פרוסות צהובה 9%', 485, 42, 'evening', false),
    (uid, 'בייגל סלמון', 'בייגל, ~50 ג׳ סלמון מעושן, ביצה, פלפל קלוי', 480, 30, 'evening', true),
    (uid, 'פיתה ונשנוש בשר', 'פיתת כוסמין, חמאת קשיו, צהובה 9%, טעימת אורז ובשר', 475, 27, 'evening', false),
    (uid, 'טוסט טונה', '2 פרוסות לחם, חצי קופסת טונה, פרוסת צהובה 9%', 260, 26, 'evening', false),
    (uid, 'בטטות לילה', '3 חצאי בטטה אפויים, 1.5 כף חמאת קשיו, מלח', 320, 8, 'night', false),
    (uid, 'טעימת עוף ואורז', '40–50 ג׳ חזה עוף, כמה כפות אורז לבן', 120, 14, 'night', false);
end;
$$;

-- On sign-up: profile, a maintenance phase, and the starter library.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email));

  insert into phases (user_id, kind, kcal_target, protein_target)
  values (new.id, 'maintain', 2350, 125);

  perform seed_starter_library(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

revoke execute on function seed_starter_library(uuid) from public, anon, authenticated;
