import type { Metadata } from "next";
import { PortfolioManager } from "@/components/forms/specialist-forms";
import { PageHeader } from "@/components/ui/misc";
import { requireSpecialist } from "@/lib/auth/session";
import { categoryOptions } from "@/lib/data/options";
import { listMyPortfolio } from "@/lib/data/specialist";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const user = await requireSpecialist();
  const [items, categories] = await Promise.all([listMyPortfolio(user.id), categoryOptions()]);
  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Portfolio"
        description="Show real examples of your work. Only upload work you have the right to share."
      />
      <PortfolioManager
        userId={user.id}
        categoryOptions={categories}
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          asset_path: item.asset_path,
          external_url: item.external_url,
          visibility: item.visibility,
          categoryName: item.categories?.name ?? null,
        }))}
      />
    </>
  );
}
