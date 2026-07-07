ALTER TYPE "public"."doc_type" ADD VALUE 'carrier_invoice' BEFORE 'packing_list';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier_invoice_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier_invoice_date" date;