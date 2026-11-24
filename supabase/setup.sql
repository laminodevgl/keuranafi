create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null default 'super_admin'
    check (role in ('super_admin', 'employee')),
  is_suspended boolean not null default false
);

alter table public.admin_users
  add column if not exists role text not null default 'super_admin';
alter table public.admin_users
  add column if not exists is_suspended boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_users_role_check'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_role_check
      check (role in ('super_admin', 'employee'));
  end if;
end $$;

drop function if exists public.manage_admin_users(text, text, uuid);
drop function if exists public.manage_admin_users(text, uuid);
drop function if exists public.manage_admin_users(text, uuid, text);
create or replace function public.manage_admin_users(
  p_action text,
  p_user_id uuid default null,
  p_role text default null
)
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  role text,
  is_suspended boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_role text;
  target_is_suspended boolean;
  super_admin_count bigint;
begin
  if requesting_user_id is null or not exists (
    select 1
    from public.admin_users as admins
    where admins.user_id = requesting_user_id
      and admins.role = 'super_admin'
      and not admins.is_suspended
  ) then
    raise exception 'Seuls les administrateurs suprêmes peuvent gérer les comptes.'
      using errcode = '42501';
  end if;

  if p_action is distinct from 'list' then
    perform admins.user_id
    from public.admin_users as admins
    for update;

    if not exists (
      select 1
      from public.admin_users as admins
      where admins.user_id = requesting_user_id
        and admins.role = 'super_admin'
        and not admins.is_suspended
    ) then
      raise exception 'Seuls les administrateurs suprêmes peuvent gérer les comptes.'
        using errcode = '42501';
    end if;
  end if;

  if p_action = 'add' then
    if p_user_id is null then
      raise exception 'Le nouvel utilisateur est introuvable.';
    end if;
    if p_role is null or p_role not in ('super_admin', 'employee') then
      raise exception 'Le type de compte est invalide.';
    end if;

    select admins.role
    into target_role
    from public.admin_users as admins
    where admins.user_id = p_user_id
    for update;
    if target_role is not null then
      raise exception 'Ce compte dispose déjà d’un accès.';
    end if;
    insert into public.admin_users (user_id, role)
    values (p_user_id, p_role);
  elsif p_action in ('update_role', 'suspend', 'reactivate') then
    if p_user_id is null then
      raise exception 'Le compte à modifier est introuvable.';
    end if;

    select admins.role, admins.is_suspended
    into target_role, target_is_suspended
    from public.admin_users as admins
    where admins.user_id = p_user_id
    for update;
    if target_role is null then
      raise exception 'Ce compte n’existe plus dans la gestion des accès.';
    end if;

    if p_action = 'update_role' then
      if p_role is null or p_role not in ('super_admin', 'employee') then
        raise exception 'Le type de compte est invalide.';
      end if;
      if p_user_id = requesting_user_id and p_role <> 'super_admin' then
        raise exception 'Vous ne pouvez pas réduire les droits de votre propre compte.';
      end if;
      if target_role = 'super_admin' and p_role = 'employee' and not target_is_suspended then
        select count(*)
        into super_admin_count
        from public.admin_users as admins
        where admins.role = 'super_admin'
          and not admins.is_suspended;
        if super_admin_count <= 1 then
          raise exception 'Le dernier administrateur suprême ne peut pas être rétrogradé.';
        end if;
      end if;
      update public.admin_users as admins
      set role = p_role
      where admins.user_id = p_user_id;
    elsif p_action = 'suspend' then
      if p_user_id = requesting_user_id then
        raise exception 'Vous ne pouvez pas suspendre votre propre compte.';
      end if;
      if target_role = 'super_admin' and not target_is_suspended then
        select count(*)
        into super_admin_count
        from public.admin_users as admins
        where admins.role = 'super_admin'
          and not admins.is_suspended;
        if super_admin_count <= 1 then
          raise exception 'Le dernier administrateur suprême ne peut pas être suspendu.';
        end if;
      end if;
      update public.admin_users as admins
      set is_suspended = true
      where admins.user_id = p_user_id;
    else
      update public.admin_users as admins
      set is_suspended = false
      where admins.user_id = p_user_id;
    end if;
  elsif p_action is distinct from 'list' then
    raise exception 'Action de gestion invalide.';
  end if;

  return query
    select admins.user_id, users.email::text, admins.created_at, admins.role,
    admins.is_suspended
    from public.admin_users as admins
    join auth.users as users on users.id = admins.user_id
    order by admins.created_at asc;
end;
$$;

revoke all on function public.manage_admin_users(text, uuid, text)
  from public, anon;
grant execute on function public.manage_admin_users(text, uuid, text)
  to authenticated;

create table if not exists public.website_content (
  id integer primary key check (id = 1),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.website_content (id, content)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

create table if not exists public.accommodations (
  id text primary key,
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  image_alt text not null default '',
  images jsonb not null default '[]'::jsonb
    check (jsonb_typeof(images) = 'array'),
  capacity integer check (capacity is null or capacity between 1 and 100),
  max_children integer not null default 0,
  amenities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(amenities) = 'array'),
  price numeric(12, 2) check (price is null or price >= 0),
  beds jsonb not null default '[]'::jsonb
    check (jsonb_typeof(beds) = 'array'),
  is_published boolean not null default false,
  provisional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accommodations_max_children_range
    check (
      max_children between 0 and 100
      and (capacity is null or max_children <= capacity)
    )
);

alter table public.accommodations
  add column if not exists max_children integer;

update public.accommodations
set max_children = coalesce(capacity, 0)
where max_children is null;

alter table public.accommodations
  alter column max_children set default 0,
  alter column max_children set not null;

alter table public.accommodations
  add column if not exists images jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accommodations_max_children_range'
      and conrelid = 'public.accommodations'::regclass
  ) then
    alter table public.accommodations
      add constraint accommodations_max_children_range
      check (
        max_children between 0 and 100
        and (capacity is null or max_children <= capacity)
      );
  end if;
end $$;

update public.accommodations
set images = '[]'::jsonb
where images is null;

alter table public.accommodations
  alter column images set default '[]'::jsonb,
  alter column images set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accommodations_images_is_array'
      and conrelid = 'public.accommodations'::regclass
  ) then
    alter table public.accommodations
      add constraint accommodations_images_is_array
      check (jsonb_typeof(images) = 'array');
  end if;
end $$;

insert into public.accommodations (
  id, name, description, image_alt, images, capacity, amenities, price,
  beds, is_published, provisional
)
select
  room->>'id',
  coalesce(nullif(room->>'name', ''), 'Chambre sans nom'),
  coalesce(room->>'description', ''),
  coalesce(room->>'imageAlt', ''),
  case
    when jsonb_typeof(room->'images') = 'array' then room->'images'
    when nullif(room->>'image', '') is not null then jsonb_build_array(room->>'image')
    else '[]'::jsonb
  end,
  nullif(room->>'capacity', '')::integer,
  case when jsonb_typeof(room->'amenities') = 'array' then room->'amenities' else '[]'::jsonb end,
  nullif(room->>'price', '')::numeric,
  case when jsonb_typeof(room->'beds') = 'array' then room->'beds' else '[]'::jsonb end,
  coalesce((room->>'published')::boolean, false),
  coalesce((room->>'provisional')::boolean, false)
from public.website_content wc
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(wc.content->'accommodations') = 'array'
      then wc.content->'accommodations'
    else '[]'::jsonb
  end
) as room
where nullif(room->>'id', '') is not null
on conflict (id) do nothing;

create table if not exists public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 6 and 30),
  arrival date not null,
  departure date not null,
  guests integer not null check (guests between 1 and 50),
  room text not null default '',
  room_id text,
  message text not null default '' check (char_length(message) <= 3000),
  first_name text,
  last_name text,
  adults integer check (adults is null or adults >= 1),
  children integer check (children is null or children >= 0),
  estimated_arrival_time time,
  receipt_path text,
  approved_checkin_time time,
  approved_checkout_time time,
  price_per_night_snapshot numeric(12, 2),
  total_amount_snapshot numeric(12, 2),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint reservation_dates_valid check (departure > arrival),
  constraint reservation_requests_adults_positive
    check (adults is null or adults >= 1),
  constraint reservation_requests_children_nonnegative
    check (children is null or children >= 0)
);

alter table public.reservation_requests
  add column if not exists room_id text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists adults integer,
  add column if not exists children integer,
  add column if not exists estimated_arrival_time time,
  add column if not exists receipt_path text,
  add column if not exists approved_checkin_time time,
  add column if not exists approved_checkout_time time,
  add column if not exists price_per_night_snapshot numeric(12, 2),
  add column if not exists total_amount_snapshot numeric(12, 2);

do $$
declare
  legacy_status_constraint record;
  has_legacy_status_constraint boolean := false;
begin
  for legacy_status_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.reservation_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%handled%'
  loop
    has_legacy_status_constraint := true;
    execute format(
      'alter table public.reservation_requests drop constraint %I',
      legacy_status_constraint.conname
    );
  end loop;

  if has_legacy_status_constraint then
    update public.reservation_requests
    set status = 'pending'
    where status in ('new', 'in_progress', 'handled');
  else
    update public.reservation_requests
    set status = 'pending'
    where status in ('new', 'handled');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_requests_status_check'
      and conrelid = 'public.reservation_requests'::regclass
  ) then
    alter table public.reservation_requests
      add constraint reservation_requests_status_check
      check (
        status in (
          'pending',
          'confirmed',
          'in_progress',
          'completed',
          'rejected',
          'cancelled'
        )
      );
  end if;
end $$;

alter table public.reservation_requests
  alter column status set default 'pending';

create table if not exists public.room_maintenance_blocks (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.accommodations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (reason in ('maintenance', 'cleaning')),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  constraint room_maintenance_blocks_valid_period check (ends_at > starts_at)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_requests_adults_positive'
      and conrelid = 'public.reservation_requests'::regclass
  ) then
    alter table public.reservation_requests
      add constraint reservation_requests_adults_positive
      check (adults is null or adults >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_requests_children_nonnegative'
      and conrelid = 'public.reservation_requests'::regclass
  ) then
    alter table public.reservation_requests
      add constraint reservation_requests_children_nonnegative
      check (children is null or children >= 0);
  end if;
end $$;

create or replace function public.prevent_overlapping_room_reservations()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_stay_start timestamptz;
  new_stay_end timestamptz;
  new_stay tstzrange;
  room_capacity integer;
  room_max_children integer;
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.created_at := now();
    new.approved_checkin_time := null;
    new.approved_checkout_time := null;
    new.estimated_arrival_time := coalesce(
      new.estimated_arrival_time,
      time '14:00'
    );
    if new.estimated_arrival_time < time '14:00' then
      raise exception 'L’arrivée avant 14 h n’est pas disponible par formulaire. Appelez l’établissement pour demander une autorisation.'
        using errcode = '22007';
    end if;
  end if;

  if new.room_id is null or new.room_id = ''
     or not (
       new.status in ('confirmed', 'in_progress')
       or (
         new.status = 'pending'
         and new.created_at > now() - interval '30 minutes'
       )
     ) then
    return new;
  end if;

  select accommodations.capacity, accommodations.max_children
  into room_capacity, room_max_children
  from public.accommodations
  where accommodations.id = new.room_id;

  if not found then
    raise exception 'La chambre sélectionnée est introuvable.'
      using errcode = '23503';
  end if;

  if coalesce(new.children, 0) > room_max_children
     or (
       room_capacity is not null
       and coalesce(new.adults, new.guests, 0) + coalesce(new.children, 0) > room_capacity
     ) then
    raise exception 'Le nombre de voyageurs dépasse la capacité de cette chambre.'
      using errcode = '22023';
  end if;

  new_stay_start :=
    (new.arrival::timestamp + coalesce(new.approved_checkin_time, time '14:00'))
      at time zone 'Africa/Dakar';
  new_stay_end :=
    (new.departure::timestamp + coalesce(new.approved_checkout_time, time '12:00'))
      at time zone 'Africa/Dakar';
  if new_stay_end <= new_stay_start then
    raise exception 'La période de réservation doit être valide.'
      using errcode = '22007';
  end if;
  new_stay := tstzrange(new_stay_start, new_stay_end, '[)');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.room_id, 0)
  );

  if exists (
    select 1
    from public.reservation_requests existing
    where existing.room_id = new.room_id
      and existing.id is distinct from new.id
      and (
        existing.status in ('confirmed', 'in_progress')
        or (
          existing.status = 'pending'
          and existing.created_at > now() - interval '30 minutes'
        )
      )
      and tstzrange(
        (existing.arrival::timestamp + coalesce(existing.approved_checkin_time, time '14:00'))
          at time zone 'Africa/Dakar',
        (existing.departure::timestamp + coalesce(existing.approved_checkout_time, time '12:00'))
          at time zone 'Africa/Dakar',
        '[)'
      ) && new_stay
  ) then
    raise exception 'Ces dates ne sont plus disponibles pour cette chambre.'
      using errcode = '23P01';
  end if;

  if exists (
    select 1
    from public.room_maintenance_blocks maintenance
    where maintenance.room_id = new.room_id
      and tstzrange(maintenance.starts_at, maintenance.ends_at, '[)') && new_stay
  ) then
    raise exception 'Cette chambre est bloquée pour maintenance ou nettoyage sur ces dates.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_overlapping_room_reservations
  on public.reservation_requests;
create trigger prevent_overlapping_room_reservations
  before insert or update of room_id, arrival, departure, status, adults,
    children, guests,
    approved_checkin_time, approved_checkout_time
  on public.reservation_requests
  for each row
  execute function public.prevent_overlapping_room_reservations();

create or replace function public.set_reservation_price_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  room_rate numeric(12, 2);
begin
  if nullif(btrim(new.receipt_path), '') is not null then
    if new.receipt_path not like 'pending/%'
       or not exists (
         select 1
         from storage.objects
         where bucket_id = 'reservation-receipts'
           and name = new.receipt_path
       ) then
      raise exception 'Une capture de reçu valide doit être téléversée avant la demande.';
    end if;
  end if;

  if new.room_id is null or new.room_id = '' then
    raise exception 'Une chambre doit être sélectionnée pour la réservation.';
  end if;

  select accommodations.price
  into room_rate
  from public.accommodations
  where accommodations.id = new.room_id
    and accommodations.is_published = true;

  if not found then
    raise exception 'La chambre sélectionnée n’est pas disponible.';
  end if;
  if room_rate is null then
    raise exception 'Aucun tarif par nuit n’est défini pour cette chambre.';
  end if;

  new.price_per_night_snapshot := room_rate;
  new.total_amount_snapshot := room_rate * (new.departure - new.arrival);
  return new;
end;
$$;

drop trigger if exists set_reservation_price_snapshot
  on public.reservation_requests;
create trigger set_reservation_price_snapshot
  before insert on public.reservation_requests
  for each row
  execute function public.set_reservation_price_snapshot();

create or replace function public.prevent_overlapping_room_maintenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.ends_at <= new.starts_at then
    raise exception 'La fin de la période doit être postérieure au début.'
      using errcode = '22007';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.room_id, 0)
  );

  if exists (
    select 1
    from public.room_maintenance_blocks existing
    where existing.room_id = new.room_id
      and existing.id is distinct from new.id
      and tstzrange(existing.starts_at, existing.ends_at, '[)')
          && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Une autre période de maintenance chevauche ces dates.'
      using errcode = '23P01';
  end if;

  if exists (
    select 1
    from public.reservation_requests request
    where request.room_id = new.room_id
      and (
        request.status in ('confirmed', 'in_progress')
        or (
          request.status = 'pending'
          and request.created_at > now() - interval '30 minutes'
        )
      )
      and tstzrange(
        (request.arrival::timestamp + coalesce(request.approved_checkin_time, time '14:00'))
          at time zone 'Africa/Dakar',
        (request.departure::timestamp + coalesce(request.approved_checkout_time, time '12:00'))
          at time zone 'Africa/Dakar',
        '[)'
      ) && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Cette période chevauche une réservation confirmée, en cours ou en attente de moins de 30 minutes.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_overlapping_room_maintenance
  on public.room_maintenance_blocks;
create trigger prevent_overlapping_room_maintenance
  before insert or update of room_id, starts_at, ends_at
  on public.room_maintenance_blocks
  for each row
  execute function public.prevent_overlapping_room_maintenance();

create or replace function public.get_booked_room_dates(p_room_id text)
returns table (arrival date, departure date)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with blocked_nights as (
    select
      occupied_nights.night::date as arrival,
      occupied_nights.night::date + 1 as departure
    from public.reservation_requests as request
    cross join lateral generate_series(
      request.arrival::timestamp,
      request.departure::timestamp,
      interval '1 day'
    ) as occupied_nights(night)
    where request.room_id = p_room_id
      and (
        request.status in ('confirmed', 'in_progress')
        or (
          request.status = 'pending'
          and request.created_at > now() - interval '30 minutes'
        )
      )
      and tstzrange(
        ((occupied_nights.night::date::timestamp + time '14:00')
          at time zone 'Africa/Dakar'),
        (((occupied_nights.night::date + 1)::timestamp + time '12:00')
          at time zone 'Africa/Dakar'),
        '[)'
      ) && tstzrange(
        (request.arrival::timestamp + coalesce(request.approved_checkin_time, time '14:00'))
          at time zone 'Africa/Dakar',
        (request.departure::timestamp + coalesce(request.approved_checkout_time, time '12:00'))
          at time zone 'Africa/Dakar',
        '[)'
      )
    union
    select
      occupied_nights.night::date as arrival,
      occupied_nights.night::date + 1 as departure
    from public.room_maintenance_blocks as maintenance
    cross join lateral generate_series(
      maintenance.starts_at at time zone 'Africa/Dakar',
      maintenance.ends_at at time zone 'Africa/Dakar',
      interval '1 day'
    ) as occupied_nights(night)
    where maintenance.room_id = p_room_id
      and tstzrange(
        ((occupied_nights.night::date::timestamp + time '14:00')
          at time zone 'Africa/Dakar'),
        (((occupied_nights.night::date + 1)::timestamp + time '12:00')
          at time zone 'Africa/Dakar'),
        '[)'
      ) && tstzrange(maintenance.starts_at, maintenance.ends_at, '[)')
  )
  select blocked_nights.arrival, blocked_nights.departure
  from blocked_nights
  where exists (
    select 1
    from public.accommodations
    where accommodations.id = p_room_id
      and accommodations.is_published = true
  )
  order by blocked_nights.arrival;
$$;

revoke all on function public.get_booked_room_dates(text) from public;
grant execute on function public.get_booked_room_dates(text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_requests_room_id_fkey'
      and conrelid = 'public.reservation_requests'::regclass
  ) then
    alter table public.reservation_requests
      add constraint reservation_requests_room_id_fkey
      foreign key (room_id)
      references public.accommodations(id)
      on delete restrict;
  end if;
end $$;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (char_length(phone) between 6 and 30),
  email text not null default '' check (char_length(email) <= 254),
  subject text not null check (char_length(subject) between 3 and 120),
  request_type text not null check (char_length(request_type) between 2 and 80),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'handled')),
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 6 and 30),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total numeric(12, 2) not null check (total >= 0),
  note text not null default '' check (char_length(note) <= 2000),
  receipt_path text,
  status text not null default 'new'
    check (status in ('new', 'preparing', 'ready', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.debt_records (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('receivable', 'payable')),
  person_name text not null check (char_length(person_name) between 2 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  description text not null default '' check (char_length(description) <= 1000),
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'settled')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint debt_records_settled_at_matches_status
    check (
      (status = 'unpaid' and settled_at is null)
      or (status = 'settled' and settled_at is not null)
    )
);

alter table public.restaurant_orders
  add column if not exists receipt_path text;

create or replace function public.validate_restaurant_order_receipt()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if nullif(btrim(new.receipt_path), '') is null
     or new.receipt_path not like 'pending/%'
     or not exists (
       select 1
       from storage.objects
       where bucket_id = 'restaurant-order-receipts'
         and name = new.receipt_path
     ) then
    raise exception 'Un reçu de paiement valide doit être téléversé avant la commande.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_restaurant_order_receipt
  on public.restaurant_orders;
create trigger validate_restaurant_order_receipt
  before insert on public.restaurant_orders
  for each row
  execute function public.validate_restaurant_order_receipt();

alter table public.admin_users enable row level security;
alter table public.accommodations enable row level security;
alter table public.website_content enable row level security;
alter table public.reservation_requests enable row level security;
alter table public.room_maintenance_blocks enable row level security;
alter table public.contact_messages enable row level security;
alter table public.restaurant_orders enable row level security;
alter table public.debt_records enable row level security;

create or replace function public.has_active_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as admins
    where admins.user_id = (select auth.uid())
      and not admins.is_suspended
  );
$$;

revoke all on function public.has_active_admin_access() from public, anon;
grant execute on function public.has_active_admin_access() to authenticated;

drop policy if exists "Admins can verify their own account" on public.admin_users;
create policy "Admins can verify their own account"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Public can read website content" on public.website_content;
create policy "Public can read website content"
  on public.website_content for select to anon, authenticated
  using (true);

drop policy if exists "Admins can manage website content" on public.website_content;
create policy "Admins can manage website content"
  on public.website_content for all to authenticated
  using (public.has_active_admin_access())
  with check (public.has_active_admin_access());

drop policy if exists "Public can read published accommodations" on public.accommodations;
create policy "Public can read published accommodations"
  on public.accommodations for select to anon, authenticated
  using (is_published = true);

drop policy if exists "Admins can manage accommodations" on public.accommodations;
create policy "Admins can manage accommodations"
  on public.accommodations for all to authenticated
  using (public.has_active_admin_access())
  with check (public.has_active_admin_access());

drop policy if exists "Public can submit reservation requests" on public.reservation_requests;
create policy "Public can submit reservation requests"
  on public.reservation_requests for insert to anon, authenticated
  with check (status = 'pending');

drop policy if exists "Admins can manage reservation requests" on public.reservation_requests;
create policy "Admins can manage reservation requests"
  on public.reservation_requests for all to authenticated
  using (public.has_active_admin_access())
  with check (public.has_active_admin_access());

drop policy if exists "Admins can manage room maintenance" on public.room_maintenance_blocks;
create policy "Admins can manage room maintenance"
  on public.room_maintenance_blocks for all to authenticated
  using (public.has_active_admin_access())
  with check (public.has_active_admin_access());

drop policy if exists "Public can submit contact messages" on public.contact_messages;
create policy "Public can submit contact messages"
  on public.contact_messages for insert to anon, authenticated
  with check (status = 'new');

drop policy if exists "Admins can manage contact messages" on public.contact_messages;
create policy "Admins can manage contact messages"
  on public.contact_messages for all to authenticated
  using (public.has_active_admin_access())
  with check (public.has_active_admin_access());

drop policy if exists "Public can submit restaurant orders" on public.restaurant_orders;
create policy "Public can submit restaurant orders"
  on public.restaurant_orders for insert to anon, authenticated
  with check (status = 'new');

drop policy if exists "Admins can manage restaurant orders" on public.restaurant_orders;
create policy "Admins can manage restaurant orders"
  on public.restaurant_orders for all to authenticated
  using (public.has_active_admin_access())
  with check (public.has_active_admin_access());

drop policy if exists "Admins can manage debt records" on public.debt_records;
create policy "Admins can manage debt records"
  on public.debt_records for all to authenticated
  using (public.has_active_admin_access())
  with check (public.has_active_admin_access());

drop policy if exists "Public can view accommodation photos" on storage.objects;
create policy "Public can view accommodation photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'accommodation-photos');

drop policy if exists "Admins can upload accommodation photos" on storage.objects;
create policy "Admins can upload accommodation photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'accommodation-photos'
    and public.has_active_admin_access()
  );

drop policy if exists "Admins can update accommodation photos" on storage.objects;
create policy "Admins can update accommodation photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'accommodation-photos'
    and public.has_active_admin_access()
  )
  with check (
    bucket_id = 'accommodation-photos'
    and public.has_active_admin_access()
  );

drop policy if exists "Admins can delete accommodation photos" on storage.objects;
create policy "Admins can delete accommodation photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'accommodation-photos'
    and public.has_active_admin_access()
  );

drop policy if exists "Public can upload reservation payment receipts" on storage.objects;
create policy "Public can upload reservation payment receipts"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'reservation-receipts'
    and name like 'pending/%'
  );

drop policy if exists "Public can clean up failed reservation receipt uploads" on storage.objects;
create policy "Public can clean up failed reservation receipt uploads"
  on storage.objects for delete to anon, authenticated
  using (
    bucket_id = 'reservation-receipts'
    and name like 'pending/%'
  );

drop policy if exists "Admins can view reservation payment receipts" on storage.objects;
create policy "Admins can view reservation payment receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reservation-receipts'
    and public.has_active_admin_access()
  );

drop policy if exists "Admins can delete reservation payment receipts" on storage.objects;
create policy "Admins can delete reservation payment receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reservation-receipts'
    and public.has_active_admin_access()
  );

drop policy if exists "Public can upload restaurant order payment receipts" on storage.objects;
create policy "Public can upload restaurant order payment receipts"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'restaurant-order-receipts'
    and name like 'pending/%'
  );

drop policy if exists "Public can clean up failed restaurant order receipts" on storage.objects;
create policy "Public can clean up failed restaurant order receipts"
  on storage.objects for delete to anon, authenticated
  using (
    bucket_id = 'restaurant-order-receipts'
    and name like 'pending/%'
  );

drop policy if exists "Admins can view restaurant order payment receipts" on storage.objects;
create policy "Admins can view restaurant order payment receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'restaurant-order-receipts'
    and public.has_active_admin_access()
  );

drop policy if exists "Admins can delete restaurant order payment receipts" on storage.objects;
create policy "Admins can delete restaurant order payment receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'restaurant-order-receipts'
    and public.has_active_admin_access()
  );

grant select on public.website_content to anon, authenticated;
grant select on public.accommodations to anon, authenticated;
grant insert, update, delete on public.accommodations to authenticated;
grant insert on public.reservation_requests, public.contact_messages,
  public.restaurant_orders to anon, authenticated;
grant select, insert, update, delete on public.website_content,
  public.reservation_requests, public.contact_messages,
  public.restaurant_orders to authenticated;
grant select, insert, update, delete
  on public.room_maintenance_blocks, public.debt_records to authenticated;
grant select on public.admin_users to authenticated;

do $$
declare
  realtime_publication_all_tables boolean;
begin
  select puballtables
  into realtime_publication_all_tables
  from pg_publication
  where pubname = 'supabase_realtime';

  if found and not realtime_publication_all_tables then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'reservation_requests'
    ) then
      alter publication supabase_realtime
        add table public.reservation_requests;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'room_maintenance_blocks'
    ) then
      alter publication supabase_realtime
        add table public.room_maintenance_blocks;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'contact_messages'
    ) then
      alter publication supabase_realtime
        add table public.contact_messages;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
