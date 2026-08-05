-- Hand-edited: the generated statements only dropped things. Backfills run
-- first so no data is lost that the new columns can still represent.

-- Cargo description became a multi-select; the old free text becomes its first item.
UPDATE "orders"
  SET "cargo_items" = jsonb_build_array("cargo_description")
  WHERE "cargo_description" IS NOT NULL AND btrim("cargo_description") <> '';
--> statement-breakpoint

-- The order now carries transport type and route itself. Take both from the
-- transport mode it was attached to. from/to were free text there, so only
-- adopt them when they already look like ISO 3166-1 alpha-2 codes; anything
-- else would render as an unresolvable country.
UPDATE "orders" o
  SET "transport_type" = tm."mode_type",
      "from_country" = CASE WHEN tm."from_country" ~ '^[A-Za-z]{2}$' THEN upper(tm."from_country") END,
      "to_country"   = CASE WHEN tm."to_country"   ~ '^[A-Za-z]{2}$' THEN upper(tm."to_country")   END
  FROM "transport_modes" tm
  WHERE o."transport_mode_id" = tm."id";
--> statement-breakpoint

-- orders.route (free text) and orders.client_order_id are dropped outright:
-- the client asked for route to be replaced by the structured from/to pair and
-- for the client order ID to go away entirely.
ALTER TABLE "orders" DROP CONSTRAINT "orders_transport_mode_id_transport_modes_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "client_order_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "transport_mode_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "route";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "cargo_description";--> statement-breakpoint

-- order_counters is superseded by monthly_counters. Existing orders keep the
-- numbers already stored on them; only new orders use the ALLYYMMNNN format.
DROP TABLE "order_counters" CASCADE;--> statement-breakpoint
DROP TABLE "transport_modes" CASCADE;
