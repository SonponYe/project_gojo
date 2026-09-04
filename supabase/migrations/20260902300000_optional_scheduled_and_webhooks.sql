-- Gojo · OPTIONAL, scheduled cleanup + chat push webhook.
--
-- This migration is safe to run as-is: every block is guarded and will simply
-- no-op if the required extension isn't available or the settings aren't set.
-- It wires up two nice-to-haves:
--
--   1. pg_cron , hard-resolve SOS alerts older than 30 minutes.
--   2. pg_net  , POST to the `notify-message` Edge Function on every new chat
--                 message so members get a push when the app is closed.
--
-- To enable the chat webhook, set these once (Dashboard → Database → Settings,
-- or psql).  Use the *service role* key, it never reaches a client.
--
--   alter database postgres set app.settings.functions_base_url =
--     'https://<PROJECT_REF>.supabase.co/functions/v1';
--   alter database postgres set app.settings.service_role_key = '<SERVICE_ROLE_KEY>';

-- ---------------------------------------------------------------------------
-- 1. Scheduled auto-clear of stale SOS alerts
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    perform cron.schedule(
      'gojo-resolve-stale-sos',
      '*/5 * * * *',
      $cron$
        update public.sos_alerts
           set resolved_at = created_at + interval '30 minutes'
         where resolved_at is null
           and created_at < now() - interval '30 minutes';
      $cron$
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Chat message → push notification webhook
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := current_setting('app.settings.functions_base_url', true);
  v_key  text := current_setting('app.settings.service_role_key', true);
begin
  if v_base is null or v_key is null then
    return new; -- webhook not configured; local notifications still work
  end if;

  perform net.http_post(
    url     := v_base || '/notify-message',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object('message_id', new.id)
  );
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;

    drop trigger if exists on_message_created on public.messages;
    create trigger on_message_created
      after insert on public.messages
      for each row execute function public.notify_new_message();
  end if;
end;
$$;
