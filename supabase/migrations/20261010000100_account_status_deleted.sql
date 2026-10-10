-- Account deletion: status for accounts whose owner deleted them but whose
-- order history must stay for the other party (see the next migration).
-- In its own migration because a new enum value can't be used in the same
-- transaction that adds it.
alter type public.account_status add value if not exists 'deleted';
