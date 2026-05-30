-- Remove rolling publish snapshots; keep only draft (layout) and live (published_layout).
alter table public.store_homepage_configs
drop column if exists publish_history;
