-- =============================================================================
-- Storage buckets and object policies.
--
-- Public buckets (served via public URLs):
--   avatars/<user_id>/<file>
--   portfolio/<user_id>/<file>
-- Private buckets (served only via short-lived signed URLs after a
-- server-side permission check):
--   requirement-files/<requirement_id>/<file>
--   order-files/<order_id>/(deliverables|messages|disputes)/<file>
--
-- Bucket-level MIME/size limits are a first line of defence; the server also
-- sniffs file signatures after upload (src/lib/storage/file-validation.ts)
-- because Content-Type headers are client-supplied.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 10 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('requirement-files', 'requirement-files', false, 25 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/zip',
          'text/plain', 'text/csv',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('order-files', 'order-files', false, 50 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/zip',
          'text/plain', 'text/csv', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Safe text -> uuid conversion for path segments (NULL when malformed).
create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- Who may read files attached to a requirement.
create or replace function public.can_access_requirement_files(p_requirement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_requirement_id is not null and (
    public.owns_requirement(p_requirement_id)
    or public.is_invited_to_requirement(p_requirement_id)
    or public.is_admin()
    or exists (
      select 1 from public.orders
      where requirement_id = p_requirement_id and auth.uid() in (buyer_id, specialist_id)
    )
  );
$$;

-- Requirement files may be added while the requirement is still editable.
create or replace function public.can_upload_requirement_files(p_requirement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.requirements
    where id = p_requirement_id and buyer_id = auth.uid() and status in ('draft', 'open')
  );
$$;

create or replace function public.can_upload_order_file(p_order_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and auth.uid() in (o.buyer_id, o.specialist_id)
      and case p_kind
        when 'deliverables' then o.specialist_id = auth.uid() and o.status in ('in_progress', 'revision_requested')
        when 'messages' then true
        when 'disputes' then o.status = 'disputed'
        else false
      end
  );
$$;

-- Public buckets: anyone may read; owners manage their own folder.
create policy "public_assets_read" on storage.objects
  for select using (bucket_id in ('avatars', 'portfolio'));

create policy "public_assets_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public_assets_update_own" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public_assets_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = auth.uid()::text);

-- Requirement files.
create policy "requirement_files_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'requirement-files'
         and public.can_access_requirement_files(public.try_uuid((storage.foldername(name))[1])));

create policy "requirement_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'requirement-files'
              and public.can_upload_requirement_files(public.try_uuid((storage.foldername(name))[1])));

create policy "requirement_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'requirement-files'
         and public.can_upload_requirement_files(public.try_uuid((storage.foldername(name))[1])));

-- Order files: participants only (plus admins for dispute review).
create policy "order_files_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-files'
         and (public.is_order_participant(public.try_uuid((storage.foldername(name))[1])) or public.is_admin()));

create policy "order_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'order-files'
              and public.can_upload_order_file(public.try_uuid((storage.foldername(name))[1]), (storage.foldername(name))[2]));

-- Only un-submitted deliverables may be removed, and only by their uploader.
create policy "order_files_delete_draft" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'order-files'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[2] = 'deliverables'
    and not exists (
      select 1 from public.order_deliverables d
      where d.storage_path = name and d.submission_id is not null
    )
  );
