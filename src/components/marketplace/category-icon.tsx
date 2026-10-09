import {
  Activity,
  Briefcase,
  Clapperboard,
  Image as ImageIcon,
  LayoutTemplate,
  Megaphone,
  Palette,
  PenLine,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";

/**
 * Categories store an icon key in the database (categories.icon). Only keys
 * in this map render a specific icon; anything else falls back gracefully,
 * so admins can add categories without a code change.
 */
const ICONS: Record<string, LucideIcon> = {
  palette: Palette,
  clapperboard: Clapperboard,
  megaphone: Megaphone,
  "pen-line": PenLine,
  search: Search,
  "layout-template": LayoutTemplate,
  activity: Activity,
  presentation: Presentation,
  image: ImageIcon,
};

export const CATEGORY_ICON_KEYS = Object.keys(ICONS);

export function CategoryIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Briefcase;
  return <Icon className={className} aria-hidden />;
}
