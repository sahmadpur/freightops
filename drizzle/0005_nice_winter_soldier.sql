-- Rename the existing 'vehicle' mode to 'truck' (updates existing rows in place)
-- and add the new 'container' mode. Hand-written to avoid the destructive
-- drop/recreate drizzle-kit generates for enum edits, which would fail casting
-- existing 'vehicle' rows. The snapshot already reflects the final enum.
ALTER TYPE "public"."mode_type" RENAME VALUE 'vehicle' TO 'truck';--> statement-breakpoint
ALTER TYPE "public"."mode_type" ADD VALUE 'container';
