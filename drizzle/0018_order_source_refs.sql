ALTER TABLE "orders" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quotation_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contact_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "responsible_user_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cargo_ready_date" date;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "requested_delivery_date" date;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "special_instructions" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;