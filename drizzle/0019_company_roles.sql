-- Companies unified: carriers fold into accounts, which gain a roles text[]
-- (client/agent/carrier/supplier/customs_broker/other — several at once).
-- Hand-written data moves around drizzle-kit's DDL; order matters.
ALTER TABLE "accounts" ADD COLUMN "roles" text[] DEFAULT '{client}'::text[] NOT NULL;--> statement-breakpoint
-- Map every carrier to an account: an existing account with the same title
-- absorbs it (gains the 'carrier' role), otherwise the carrier row moves over
-- keeping its id, so unmerged FK values stay valid as-is.
CREATE TEMP TABLE "carrier_map" AS
SELECT c.id AS carrier_id,
       COALESCE(a.id, c.id) AS account_id,
       (a.id IS NOT NULL) AS merged
FROM "carriers" c
LEFT JOIN LATERAL (
  SELECT id FROM "accounts" a WHERE lower(a.title) = lower(c.title) ORDER BY a.created_at LIMIT 1
) a ON true;--> statement-breakpoint
INSERT INTO "accounts" (id, title, address, notes, roles, deleted_at, created_at, updated_at, created_by)
SELECT c.id, c.title, c.address, c.notes, '{carrier}', c.deleted_at, c.created_at, c.updated_at, c.created_by
FROM "carriers" c
JOIN "carrier_map" m ON m.carrier_id = c.id AND NOT m.merged;--> statement-breakpoint
UPDATE "accounts" a SET roles = array_append(a.roles, 'carrier')
FROM "carrier_map" m
WHERE m.merged AND a.id = m.account_id AND NOT ('carrier' = ANY(a.roles));--> statement-breakpoint
-- Remap references through the mapping (only merged ids actually change).
UPDATE "orders" o SET carrier_id = m.account_id
FROM "carrier_map" m WHERE o.carrier_id = m.carrier_id AND m.merged;--> statement-breakpoint
UPDATE "contacts" ct SET parent_type = 'account', parent_id = m.account_id
FROM "carrier_map" m WHERE ct.parent_type = 'carrier' AND ct.parent_id = m.carrier_id;--> statement-breakpoint
-- Swap the FK to accounts, then drop the old table. The 'carrier' value stays
-- in the contact_parent enum (unused) — dropping an enum value is a type rewrite.
ALTER TABLE "orders" DROP CONSTRAINT "orders_carrier_id_carriers_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_carrier_id_accounts_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TABLE "carrier_map";--> statement-breakpoint
ALTER TABLE "carriers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "carriers" CASCADE;
