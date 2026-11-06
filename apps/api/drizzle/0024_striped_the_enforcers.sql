DROP INDEX "uq_invoice_lease_period";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "replaces_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "void_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_replaces_invoice_id_invoices_id_fk" FOREIGN KEY ("replaces_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoice_replaces_invoice" ON "invoices" USING btree ("replaces_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoice_lease_period" ON "invoices" USING btree ("lease_id","period_start","period_end") WHERE "invoices"."status" = 'ISSUED';