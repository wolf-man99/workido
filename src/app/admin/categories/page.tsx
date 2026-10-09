import type { Metadata } from "next";
import { CategoryForm } from "@/components/admin/admin-forms";
import { CategoryRow } from "@/components/admin/category-row";
import { CATEGORY_ICON_KEYS } from "@/components/marketplace/category-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  // Admins see inactive categories too (RLS).
  const { data: categories, error } = await supabase.from("categories").select("*").order("sort_order");
  if (error) throw new Error("Could not load categories");
  const parents = (categories ?? []).filter((category) => !category.parent_id).map((category) => ({ id: category.id, name: category.name }));
  const names = new Map((categories ?? []).map((category) => [category.id, category.name]));

  return (
    <>
      <PageHeader title="Categories" description="Categories organise discovery and matching. Deactivate instead of deleting so existing listings keep their history." />
      <Card>
        <CardHeader>
          <CardTitle>New category</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            categoryId={null}
            parents={parents}
            iconKeys={CATEGORY_ICON_KEYS}
            defaults={{ name: "", slug: "", description: "", icon: "", parentId: "", sortOrder: "100", isActive: true }}
          />
        </CardContent>
      </Card>
      <ul className="flex flex-col gap-2">
        {(categories ?? []).map((category) => (
          <CategoryRow
            key={category.id}
            id={category.id}
            parents={parents}
            iconKeys={CATEGORY_ICON_KEYS}
            parentName={category.parent_id ? (names.get(category.parent_id) ?? null) : null}
            defaults={{
              name: category.name,
              slug: category.slug,
              description: category.description ?? "",
              icon: category.icon ?? "",
              parentId: category.parent_id ?? "",
              sortOrder: String(category.sort_order),
              isActive: category.is_active,
            }}
          />
        ))}
      </ul>
    </>
  );
}
