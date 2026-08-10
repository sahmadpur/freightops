-- Order lifecycle reduced to the six stages of specification §15, plus the
-- order's own KPI timestamps and the structured city pair.
--
-- Hand-edited after generation: drizzle-kit emits the type swap but not the
-- value mapping, so the cast would fail on every order sitting in a retired
-- stage. Same shape as 0011 — widen to text, remap, narrow back.

ALTER TABLE "orders" ADD COLUMN "from_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "to_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint

-- Recover when each order first reached delivered/closed from the audit trail,
-- so the KPI timestamps are not all null for everything shipped before today.
UPDATE "orders" o SET "delivered_at" = a.at
FROM (
  SELECT "entity_id", min("created_at") AS at FROM "audit_log"
  WHERE "entity_type" = 'order' AND "field" = 'status' AND "new_value" = 'delivered'
  GROUP BY "entity_id"
) a
WHERE a."entity_id" = o."id";--> statement-breakpoint

UPDATE "orders" o SET "closed_at" = a.at
FROM (
  SELECT "entity_id", min("created_at") AS at FROM "audit_log"
  WHERE "entity_type" = 'order' AND "field" = 'status' AND "new_value" = 'closed'
  GROUP BY "entity_id"
) a
WHERE a."entity_id" = o."id";--> statement-breakpoint

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint

-- The mapping. Pre-departure handling collapses into `operations`; `loaded` is
-- the point the carrier is committed, so it becomes `booked`; every moving
-- stage — including the border and customs stops — becomes `in_transit`.
UPDATE "orders" SET "status" = 'operations' WHERE "status" IN ('waiting_pickup', 'received');--> statement-breakpoint
UPDATE "orders" SET "status" = 'booked'     WHERE "status" = 'loaded';--> statement-breakpoint
UPDATE "orders" SET "status" = 'in_transit' WHERE "status" IN ('internal_transit', 'transit', 'at_border', 'at_customs', 'arrived');--> statement-breakpoint

DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('created', 'operations', 'booked', 'in_transit', 'delivered', 'closed');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'created'::"public"."order_status";--> statement-breakpoint

-- Give every existing order the single leg the new model expects, so the route
-- reads the same whether it came from a request or predates them. `container`
-- maps to sea unless the delivery format says the box moved by road.
INSERT INTO "transport_legs" ("parent_type", "parent_id", "leg_number", "transport_type", "origin_country", "destination_country")
SELECT 'order', o."id", 1,
  CASE
    WHEN o."transport_type" = 'sea' THEN 'sea'
    WHEN o."transport_type" = 'rail' THEN 'rail'
    WHEN o."transport_type" = 'air' THEN 'air'
    WHEN o."transport_type" = 'container' AND o."delivery_format" IN ('FTL', 'LTL') THEN 'road'
    WHEN o."transport_type" = 'container' THEN 'sea'
    ELSE 'road'
  END::"public"."transport_family",
  o."from_country", o."to_country"
FROM "orders" o
WHERE o."transport_type" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "transport_legs" l WHERE l."parent_type" = 'order' AND l."parent_id" = o."id"
  );--> statement-breakpoint

-- Cargo description was a list of free-text labels; carry the first row across
-- so the order's cargo block is not blank next to a request-born one.
INSERT INTO "cargo_details" ("parent_type", "parent_id", "description", "packages", "gross_weight_kg", "volume_m3")
SELECT 'order', o."id",
  NULLIF(array_to_string(ARRAY(SELECT jsonb_array_elements_text(o."cargo_items")), ', '), ''),
  o."packages", o."weight_kg", o."volume_m3"
FROM "orders" o
WHERE NOT EXISTS (
  SELECT 1 FROM "cargo_details" c WHERE c."parent_type" = 'order' AND c."parent_id" = o."id"
);
