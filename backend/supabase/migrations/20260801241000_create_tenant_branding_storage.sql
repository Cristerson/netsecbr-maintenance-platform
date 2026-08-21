-- Entrega 11: armazenamento privado de logos por tenant.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-branding', 'tenant-branding', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "branding_logo_select_own_tenant"
on storage.objects for select to authenticated
using (
  bucket_id = 'tenant-branding'
  and (
    (select public.is_netsecbr_admin())
    or public.is_tenant_member((storage.foldername(name))[1]::uuid)
  )
);

create policy "branding_logo_insert_tenant_admin"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenant-branding'
  and (
    (select public.is_netsecbr_admin())
    or public.is_tenant_admin((storage.foldername(name))[1]::uuid)
  )
);

create policy "branding_logo_update_tenant_admin"
on storage.objects for update to authenticated
using (
  bucket_id = 'tenant-branding'
  and ((select public.is_netsecbr_admin()) or public.is_tenant_admin((storage.foldername(name))[1]::uuid))
)
with check (
  bucket_id = 'tenant-branding'
  and ((select public.is_netsecbr_admin()) or public.is_tenant_admin((storage.foldername(name))[1]::uuid))
);

create policy "branding_logo_delete_tenant_admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'tenant-branding'
  and ((select public.is_netsecbr_admin()) or public.is_tenant_admin((storage.foldername(name))[1]::uuid))
);
