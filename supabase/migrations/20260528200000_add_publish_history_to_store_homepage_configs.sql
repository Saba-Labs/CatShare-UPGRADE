alter table public.store_homepage_configs
add column if not exists publish_history jsonb not null default '[]'::jsonb;

comment on column public.store_homepage_configs.publish_history
is 'Rolling publish snapshots (newest first, max ~20) for restore in the site editor.';
