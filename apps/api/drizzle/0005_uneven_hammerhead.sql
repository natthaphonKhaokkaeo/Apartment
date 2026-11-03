CREATE TYPE "public"."evidence_upload_status" AS ENUM('INITIATED', 'PROCESSING', 'READY', 'CLAIMED', 'FAILED');--> statement-breakpoint
CREATE TABLE "evidence_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"content_type" varchar(32) NOT NULL,
	"content_length" integer NOT NULL,
	"checksum_sha256" varchar(44) NOT NULL,
	"status" "evidence_upload_status" DEFAULT 'INITIATED' NOT NULL,
	"evidence_key" uuid,
	"evidence_sha256" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "evidence_uploads_evidence_key_unique" UNIQUE("evidence_key")
);
--> statement-breakpoint
ALTER TABLE "evidence_uploads" ADD CONSTRAINT "evidence_uploads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_uploads" ADD CONSTRAINT "evidence_uploads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_uploads" ADD CONSTRAINT "evidence_uploads_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_uploads" ADD CONSTRAINT "evidence_uploads_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_evidence_upload_invoice_user" ON "evidence_uploads" USING btree ("invoice_id","submitted_by");--> statement-breakpoint
CREATE INDEX "idx_evidence_upload_expires" ON "evidence_uploads" USING btree ("expires_at");