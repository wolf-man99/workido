import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GigBrowser } from "@/components/marketplace/gig-browser";
import { Container, PageHeader } from "@/components/ui/misc";
import { getCategoryBySlug } from "@/lib/data/marketplace";

export async function generateMetadata(props: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const category = await getCategoryBySlug(slug);
  return category ? { title: category.name, description: category.description ?? undefined } : { title: "Category not found" };
}

export default async function CategoryPage(props: PageProps<"/categories/[slug]">) {
  const { slug } = await props.params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const params = await props.searchParams;

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeader
        eyebrow={
          <Link href="/categories" className="hover:underline">
            Categories
          </Link>
        }
        title={category.name}
        description={category.description ?? undefined}
      />
      <GigBrowser path={`/categories/${category.slug}`} params={params} fixedCategory={category.slug} />
    </Container>
  );
}
