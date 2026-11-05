CREATE TABLE "maintenance_ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_length" integer NOT NULL,
	"sha256" text NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_ticket_attachment_size_positive" CHECK (content_length > 0 AND content_length <= 2097152)
);
--> statement-breakpoint
ALTER TABLE "maintenance_ticket_attachments" ADD CONSTRAINT "fk_maintenance_attachment_ticket" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket_attachments" ADD CONSTRAINT "fk_maintenance_attachment_org" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket_attachments" ADD CONSTRAINT "fk_maintenance_attachment_property" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket_attachments" ADD CONSTRAINT "fk_maintenance_attachment_uploader" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_maintenance_ticket_attachments_ticket" ON "maintenance_ticket_attachments" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_maintenance_ticket_attachment_hash" ON "maintenance_ticket_attachments" USING btree ("ticket_id","sha256");