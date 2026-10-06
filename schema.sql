-- MEUBLÉS SALAM — schéma Supabase (à exécuter dans SQL Editor)
create extension if not exists btree_gist;

create table units (
  id int primary key generated always as identity,
  name text not null unique,
  zone text not null check (zone in ('Rez-de-chaussée','Étage','Duplex','Appartement')),
  type text not null check (type in ('Chambre simple','Chambre ventilée','Chambre double','Duplex','Appartement')),
  price_per_night numeric(12,0) not null default 0 check (price_per_night >= 0),
  max_guests int not null default 2 check (max_guests > 0),
  status text not null default 'disponible' check (status in ('disponible','occupe','maintenance'))
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  last_name text not null,
  first_name text not null,
  phone text not null,
  id_number text not null,
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  unit_id int not null references units(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  nights int generated always as (check_out - check_in) stored,
  payment_mode text not null check (payment_mode in ('Espèces','Orange Money','Virement','Chèque','Wave')),
  total_amount numeric(12,0) not null check (total_amount >= 0),
  advance numeric(12,0) not null default 0 check (advance >= 0),
  status text not null default 'confirmee' check (status in ('confirmee','annulee')),
  created_at timestamptz not null default now(),
  check (check_out > check_in),
  check (advance <= total_amount),
  -- interdit deux réservations qui se chevauchent sur le même logement
  exclude using gist (unit_id with =, daterange(check_in, check_out) with &&) where (status <> 'annulee')
);

create sequence invoice_seq;
create table invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('FAC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 4, '0')),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  label text not null,
  nights int not null,
  total numeric(12,0) not null,
  advance numeric(12,0) not null default 0,
  balance numeric(12,0) generated always as (total - advance) stored,
  issued_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Autre' check (category in ('Plomberie','Électricité','Maintenance','Produits d''entretien','Équipements','Autre')),
  amount numeric(12,0) not null check (amount > 0),
  unit_id int references units(id) on delete set null,
  description text,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Sécurité : seuls les utilisateurs connectés accèdent aux données
do $$ declare t text; begin
  foreach t in array array['units','clients','bookings','invoices','expenses'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "staff_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Données d'amorçage : logements 1 à 14 (types et capacités modifiables ensuite)
insert into units (name, zone, type, max_guests)
select 'Rez ' || n, 'Rez-de-chaussée', 'Chambre simple', 2 from generate_series(1,6) n
union all select 'Étage ' || n, 'Étage', 'Chambre double', 2 from generate_series(7,10) n
union all select 'Duplex ' || n, 'Duplex', 'Duplex', 4 from generate_series(11,13) n
union all select 'Appartement 14', 'Appartement', 'Appartement', 4;

-- Réglages modifiables depuis l'application (gérante, téléphones, adresse)
create table settings (key text primary key, value text not null);
alter table settings enable row level security;
create policy "staff_all" on settings for all to authenticated using (true) with check (true);
insert into settings (key, value) values
  ('brand', 'Salame Hôtel'),
  ('manager', 'Madame Gniang'),
  ('phones', '77 671 18 26 / 77 659 26 11'),
  ('address', 'Santhiaba – Ziguinchor (BD 54 Route Kandé)');

create index bookings_client_idx on bookings(client_id);
create index expenses_date_idx on expenses(spent_on);
create index expenses_unit_idx on expenses(unit_id);
