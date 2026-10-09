-- Records when the matching engine last ran for a requirement, so the UI can
-- distinguish "never matched" from "matched, but no suitable specialists".
alter table public.requirements add column matches_computed_at timestamptz;
