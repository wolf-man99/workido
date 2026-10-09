import "server-only";
import type { ChipOption } from "@/components/forms/chip-picker";
import { listCategories, listSkills } from "./marketplace";

/** Categories as picker options, subcategories labelled with their parent. */
export async function categoryOptions(): Promise<ChipOption[]> {
  const categories = await listCategories();
  const byId = new Map(categories.map((c) => [c.id, c]));
  return categories.map((c) => {
    const parent = c.parent_id ? byId.get(c.parent_id) : null;
    return { id: c.id, label: parent ? `${parent.name} › ${c.name}` : c.name };
  });
}

export async function topLevelCategoryOptions(): Promise<ChipOption[]> {
  return (await listCategories()).filter((c) => !c.parent_id).map((c) => ({ id: c.id, label: c.name }));
}

/** Skills grouped by their category name. */
export async function skillOptions(): Promise<ChipOption[]> {
  const [skills, categories] = await Promise.all([listSkills(), listCategories()]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return skills.map((s) => ({ id: s.id, label: s.name, group: (s.category_id && names.get(s.category_id)) || "Other" }));
}
