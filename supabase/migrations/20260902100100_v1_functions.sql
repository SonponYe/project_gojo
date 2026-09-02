-- Gojo · v1.0 functions & triggers
-- Onboarding (create / join family), invite codes, and the family-scope helper
-- that every RLS policy is built on.

-- ---------------------------------------------------------------------------
-- current_family_id() — the family the caller belongs to.
-- SECURITY DEFINER so it can read public.users without tripping that table's
-- own RLS (which would recurse). Used by every family-scoped policy.
-- ---------------------------------------------------------------------------
create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select family_id from public.users where id = auth.uid();
$$;

comment on function public.current_family_id() is 'The caller''s family_id. Building block for all RLS policies.';

-- ---------------------------------------------------------------------------
-- generate_invite_code() — 6 chars, unambiguous alphabet, guaranteed unique.
-- ---------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no I/L/O/0/1
  code     text;
  i        int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.families where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user() — mirror every new auth user into public.users.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- create_family(name) — start a new family, join it, log consent.
-- ---------------------------------------------------------------------------
create or replace function public.create_family(p_name text)
returns public.families
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_family public.families;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'family name is required' using errcode = '22023';
  end if;

  insert into public.families (name, invite_code)
  values (trim(p_name), public.generate_invite_code())
  returning * into v_family;

  update public.users
     set family_id = v_family.id,
         consent_accepted_at = coalesce(consent_accepted_at, now())
   where id = v_uid;

  return v_family;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_family(invite_code) — join an existing family, log consent.
-- ---------------------------------------------------------------------------
create or replace function public.join_family(p_invite_code text)
returns public.families
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_family public.families;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_family
    from public.families
   where invite_code = upper(trim(p_invite_code));

  if v_family.id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  update public.users
     set family_id = v_family.id,
         consent_accepted_at = now()
   where id = v_uid;

  return v_family;
end;
$$;

-- ---------------------------------------------------------------------------
-- regenerate_invite_code() — rotate the code for the caller's own family.
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_code      text;
begin
  if v_family_id is null then
    raise exception 'you are not in a family' using errcode = '22023';
  end if;

  v_code := public.generate_invite_code();
  update public.families set invite_code = v_code where id = v_family_id;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_family() — drop out of the current family and stop sharing.
-- ---------------------------------------------------------------------------
create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  delete from public.locations where user_id = v_uid;
  update public.users
     set family_id = null,
         is_sharing = false,
         consent_accepted_at = null
   where id = v_uid;
end;
$$;

-- Onboarding RPCs are callable by signed-in users only.
revoke all on function public.create_family(text)        from public, anon;
revoke all on function public.join_family(text)           from public, anon;
revoke all on function public.regenerate_invite_code()    from public, anon;
revoke all on function public.leave_family()              from public, anon;
grant execute on function public.create_family(text)      to authenticated;
grant execute on function public.join_family(text)        to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.leave_family()           to authenticated;
