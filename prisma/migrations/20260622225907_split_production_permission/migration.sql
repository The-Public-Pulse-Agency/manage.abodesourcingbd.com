-- Production updates (cut/sew/finish + status remarks) now have their own "production"
-- permission, split out of "productionQc" (which keeps QC inspections + materials).
-- Backfill existing company roles so current access is preserved:
--   • roles that could EDIT productionQc  -> production: view + edit
--   • roles that could only VIEW it       -> production: view
UPDATE "Role"
SET permissions = jsonb_set(permissions, '{production}', '["view","edit"]'::jsonb)
WHERE permissions ? 'productionQc'
  AND (permissions->'productionQc') @> '"edit"'::jsonb
  AND NOT (permissions ? 'production');

UPDATE "Role"
SET permissions = jsonb_set(permissions, '{production}', '["view"]'::jsonb)
WHERE permissions ? 'productionQc'
  AND NOT (permissions ? 'production');
