import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withParams } from "@/lib/validation/filters";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  await requireAdmin();
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const role = params.role === "buyer" || params.role === "specialist" || params.role === "admin" ? params.role : undefined;
  const status = params.status === "active" || params.status === "suspended" ? params.status : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createSupabaseServerClient();
  const { data: users, error } = await supabase.rpc("admin_search_users", {
    p_query: q || undefined,
    p_role: role,
    p_status: status,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error("Could not load users");
  const total = Number(users?.[0]?.total_count ?? 0);

  return (
    <>
      <PageHeader title="Users" description="Search accounts, review roles and manage access." />
      <form method="get" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:flex-row">
        <Input name="q" type="search" defaultValue={q} placeholder="Name, username or email" aria-label="Search users" className="sm:flex-1" />
        <Select name="role" defaultValue={role ?? ""} aria-label="Role" className="sm:w-40">
          <option value="">All roles</option>
          <option value="buyer">Buyers</option>
          <option value="specialist">Specialists</option>
          <option value="admin">Admins</option>
        </Select>
        <Select name="status" defaultValue={status ?? ""} aria-label="Status" className="sm:w-40">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Button type="submit">Search</Button>
      </form>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 font-semibold">User</th>
              <th className="p-3 font-semibold">Email</th>
              <th className="p-3 font-semibold">Roles</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(users ?? []).map((user) => (
              <tr key={user.id} className="hover:bg-mist/50">
                <td className="p-3">
                  <Link href={`/admin/users/${user.id}`} className="font-semibold hover:underline">
                    {user.full_name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    @{user.username}
                    {user.is_sample ? " · sample" : ""}
                  </span>
                </td>
                <td className="p-3 text-ink-soft">{user.email}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((r) => (
                      <Badge key={r} tone={r === "admin" ? "dark" : "neutral"} className="capitalize">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <Badge tone={user.account_status === "active" ? "success" : "danger"} className="capitalize">
                    {user.account_status}
                  </Badge>
                </td>
                <td className="p-3 text-ink-soft">{formatDate(user.created_at)}</td>
              </tr>
            ))}
            {(users ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefForPage={(next) => withParams("/admin/users", params, { page: String(next) })} />
    </>
  );
}
