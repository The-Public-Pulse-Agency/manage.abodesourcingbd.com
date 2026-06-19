-- De-duplicate styles that are the SAME under one brand but differ only by case/whitespace
-- (e.g. "AQ Polo" vs "AQ Polo "). The DB already blocks exact (brandId, styleCode) dupes via
-- @@unique, so this only catches case/space variants. Different brands sharing a code are NOT
-- merged. Order lines on a duplicate are repointed to the keeper (earliest row).

-- 1) Repoint order lines dup -> keeper, but only where it won't collide with an existing
--    (poId, styleId, colourKey) line already on the keeper.
WITH ranked AS (
  SELECT id,
    row_number() OVER (PARTITION BY "brandId", lower(btrim("styleCode")) ORDER BY "createdAt" ASC, id ASC) AS rn,
    first_value(id) OVER (PARTITION BY "brandId", lower(btrim("styleCode")) ORDER BY "createdAt" ASC, id ASC) AS keeper
  FROM "Style"
)
UPDATE "OrderLine" ol
SET "styleId" = r.keeper
FROM ranked r
WHERE r.rn > 1 AND ol."styleId" = r.id
  AND NOT EXISTS (
    SELECT 1 FROM "OrderLine" k
    WHERE k."poId" = ol."poId" AND k."styleId" = r.keeper AND k."colourKey" = ol."colourKey"
  );

-- 2) Delete duplicate styles that no longer have any order lines referencing them.
WITH ranked AS (
  SELECT id,
    row_number() OVER (PARTITION BY "brandId", lower(btrim("styleCode")) ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Style"
)
DELETE FROM "Style" s
USING ranked r
WHERE s.id = r.id AND r.rn > 1
  AND NOT EXISTS (SELECT 1 FROM "OrderLine" ol WHERE ol."styleId" = s.id);

-- 3) Trim surviving style codes/names so the new case/space guard stays consistent.
UPDATE "Style" SET "styleCode" = btrim("styleCode") WHERE "styleCode" <> btrim("styleCode");
UPDATE "Style" SET "name" = btrim("name") WHERE "name" <> btrim("name");
