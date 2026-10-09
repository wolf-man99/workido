-- =============================================================================
-- Initial marketplace reference data: categories and skills.
-- This is real configuration needed in every environment (not sample data).
-- Idempotent; admins can edit/deactivate rows later from /admin/categories.
-- =============================================================================

insert into public.categories (name, slug, description, icon, sort_order) values
  ('Graphic Design', 'graphic-design', 'Social creatives, carousels, thumbnails and brand assets.', 'palette', 10),
  ('Video Editing', 'video-editing', 'Short-form edits, reels, YouTube videos and motion graphics.', 'clapperboard', 20),
  ('Performance Marketing', 'performance-marketing', 'Google Ads, Meta Ads setup, optimisation and audits.', 'megaphone', 30),
  ('Content Writing', 'content-writing', 'Landing-page copy, LinkedIn posts, blogs and ad copy.', 'pen-line', 40),
  ('SEO', 'seo', 'Audits, keyword research and on-page optimisation.', 'search', 50),
  ('Web Design', 'web-design', 'Landing pages and websites that convert.', 'layout-template', 60),
  ('Analytics & Tracking', 'analytics-tracking', 'GA4, Google Tag Manager and conversion tracking.', 'activity', 70),
  ('Presentations', 'presentations', 'Pitch decks, sales decks and polished slides.', 'presentation', 80)
on conflict (slug) do nothing;

-- A few subcategories to demonstrate the hierarchy.
insert into public.categories (name, slug, description, icon, parent_id, sort_order)
select v.name, v.slug, v.description, v.icon, parent.id, v.sort_order
from (values
  ('Social Media Creatives', 'social-media-creatives', 'Posts, carousels and stories.', 'image', 'graphic-design', 11),
  ('Thumbnails', 'thumbnails', 'Click-worthy thumbnails for video platforms.', 'image', 'graphic-design', 12),
  ('Short-form Video', 'short-form-video', 'Reels, Shorts and TikTok-style edits.', 'clapperboard', 'video-editing', 21),
  ('Google Ads', 'google-ads', 'Search, Performance Max and YouTube campaigns.', 'megaphone', 'performance-marketing', 31),
  ('Meta Ads', 'meta-ads', 'Facebook and Instagram campaigns.', 'megaphone', 'performance-marketing', 32)
) as v(name, slug, description, icon, parent_slug, sort_order)
join public.categories parent on parent.slug = v.parent_slug
on conflict (slug) do nothing;

insert into public.skills (name, slug, category_id)
select v.name, v.slug, c.id
from (values
  ('Social media creatives', 'social-media-creatives', 'graphic-design'),
  ('Instagram carousels', 'instagram-carousels', 'graphic-design'),
  ('Thumbnail design', 'thumbnail-design', 'graphic-design'),
  ('Brand identity', 'brand-identity', 'graphic-design'),
  ('Canva', 'canva', 'graphic-design'),
  ('Adobe Photoshop', 'adobe-photoshop', 'graphic-design'),
  ('Adobe Illustrator', 'adobe-illustrator', 'graphic-design'),
  ('Short-form video editing', 'short-form-video-editing', 'video-editing'),
  ('YouTube video editing', 'youtube-video-editing', 'video-editing'),
  ('Motion graphics', 'motion-graphics', 'video-editing'),
  ('Subtitles & captions', 'subtitles-captions', 'video-editing'),
  ('Adobe Premiere Pro', 'adobe-premiere-pro', 'video-editing'),
  ('Adobe After Effects', 'adobe-after-effects', 'video-editing'),
  ('DaVinci Resolve', 'davinci-resolve', 'video-editing'),
  ('Google Ads', 'google-ads', 'performance-marketing'),
  ('Meta Ads', 'meta-ads', 'performance-marketing'),
  ('LinkedIn Ads', 'linkedin-ads', 'performance-marketing'),
  ('Ad account audits', 'ad-account-audits', 'performance-marketing'),
  ('Conversion rate optimisation', 'conversion-rate-optimisation', 'performance-marketing'),
  ('Landing-page copywriting', 'landing-page-copywriting', 'content-writing'),
  ('LinkedIn content', 'linkedin-content', 'content-writing'),
  ('Blog writing', 'blog-writing', 'content-writing'),
  ('Ad copywriting', 'ad-copywriting', 'content-writing'),
  ('Email copywriting', 'email-copywriting', 'content-writing'),
  ('SEO audits', 'seo-audits', 'seo'),
  ('Keyword research', 'keyword-research', 'seo'),
  ('On-page SEO', 'on-page-seo', 'seo'),
  ('Technical SEO', 'technical-seo', 'seo'),
  ('Local SEO', 'local-seo', 'seo'),
  ('Landing-page design', 'landing-page-design', 'web-design'),
  ('Figma', 'figma', 'web-design'),
  ('Webflow', 'webflow', 'web-design'),
  ('WordPress', 'wordpress', 'web-design'),
  ('Framer', 'framer', 'web-design'),
  ('GA4 configuration', 'ga4-configuration', 'analytics-tracking'),
  ('Google Tag Manager', 'google-tag-manager', 'analytics-tracking'),
  ('Conversion tracking', 'conversion-tracking', 'analytics-tracking'),
  ('Meta Pixel & Conversions API', 'meta-pixel-capi', 'analytics-tracking'),
  ('Looker Studio dashboards', 'looker-studio', 'analytics-tracking'),
  ('Pitch deck design', 'pitch-deck-design', 'presentations'),
  ('PowerPoint', 'powerpoint', 'presentations'),
  ('Google Slides', 'google-slides', 'presentations'),
  ('Keynote', 'keynote', 'presentations'),
  ('Sales decks', 'sales-decks', 'presentations')
) as v(name, slug, category_slug)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do nothing;
