-- 002_sponsorship_module_update.sql
-- Run this against the Supabase database before deploying Task 2.
--
-- Changes:
--   1. sponsors.sponsor_type gains a third option: 'ads_package'
--   2. sponsors.package gains a sixth option: 'others'
--   3. sponsors.weight (new)        — Goods/Service "Weight" field, e.g. "5kg"
--   4. sponsors.package_name (new)  — Ads Package "Package Name" when Package Type = Others

-- 1. sponsor_type: allow 'ads_package'
ALTER TABLE public.sponsors DROP CONSTRAINT IF EXISTS sponsors_sponsor_type_check;
ALTER TABLE public.sponsors ADD CONSTRAINT sponsors_sponsor_type_check
  CHECK (sponsor_type IS NULL OR sponsor_type = ANY (ARRAY['finance'::text, 'goods_service'::text, 'ads_package'::text]));

-- 2. package: allow 'others'
ALTER TABLE public.sponsors DROP CONSTRAINT IF EXISTS sponsors_package_check;
ALTER TABLE public.sponsors ADD CONSTRAINT sponsors_package_check
  CHECK (package IS NULL OR package = ANY (ARRAY['title'::text, 'platinum'::text, 'gold'::text, 'silver'::text, 'supporting'::text, 'others'::text]));

-- 3. weight (Goods/Service, max 10 chars)
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS weight text;
ALTER TABLE public.sponsors DROP CONSTRAINT IF EXISTS sponsors_weight_check;
ALTER TABLE public.sponsors ADD CONSTRAINT sponsors_weight_check
  CHECK (weight IS NULL OR char_length(weight) <= 10);

-- 4. package_name (Ads Package "Others", max 75 chars)
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS package_name text;
ALTER TABLE public.sponsors DROP CONSTRAINT IF EXISTS sponsors_package_name_check;
ALTER TABLE public.sponsors ADD CONSTRAINT sponsors_package_name_check
  CHECK (package_name IS NULL OR char_length(package_name) <= 75);
