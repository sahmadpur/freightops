CREATE TYPE "public"."packaging_type" AS ENUM('pallet', 'box', 'crate', 'bag', 'drum', 'roll', 'other');--> statement-breakpoint
ALTER TYPE "public"."finance_category" ADD VALUE 'ex1' BEFORE 'customs';--> statement-breakpoint
ALTER TYPE "public"."finance_category" ADD VALUE 'customs_duties' BEFORE 'broker';--> statement-breakpoint
CREATE TABLE "cargo_types" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargo_types_title_unique" UNIQUE("title")
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'created'::text;--> statement-breakpoint

-- Hand-edited after generation (same shape as 0016): drizzle-kit emits the type
-- swap but not the value mapping, so the cast below would fail on every order
-- sitting in a now-retired stage. Both are pre-departure states, so they map to
-- the new pickup-planned stage.
UPDATE "orders" SET "status" = 'waiting_pickup' WHERE "status" IN ('operations', 'booked');--> statement-breakpoint

DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('created', 'waiting_pickup', 'en_route', 'in_transit', 'ferry_wait', 'at_customs', 'delivered', 'closed');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'created'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "cargo_details" ADD COLUMN "packaging_type" "packaging_type";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ex1_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "rollback_number";--> statement-breakpoint

-- Hand-edited: seed the cargo-description dictionary from the corrections doc.
INSERT INTO "cargo_types" ("title", "sort_order") VALUES
  ('Spare Parts', 0), ('FMCG', 1), ('Oilfield Equipment', 2), ('Machinery', 3),
  ('Equipment', 4), ('Electronics', 5), ('Furniture', 6), ('Textile', 7),
  ('Food Products', 8), ('Chemicals', 9), ('Construction Materials', 10),
  ('Auto Parts', 11), ('Household Goods', 12), ('Medical Equipment', 13),
  ('Cosmetics', 14), ('Industrial Equipment', 15), ('Raw Materials', 16),
  ('General Cargo', 17);