CREATE TYPE "public"."finance_adjustment_kind" AS ENUM('INTERNAL_CREDIT', 'REVERSE_MANUAL_PAYMENT', 'REFUND_REVIEW', 'DISPUTE_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."finance_adjustment_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "finance_adjustment_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" "finance_adjustment_kind" NOT NULL,
	"original_ledger_id" uuid,
	"amount_satang" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_adjustment_entries_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "finance_adjustment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" "finance_adjustment_kind" NOT NULL,
	"original_ledger_id" uuid,
	"amount_satang" integer NOT NULL,
	"reason" varchar(500) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"status" "finance_adjustment_status" DEFAULT 'PENDING' NOT NULL,
	"requested_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"review_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "finance_adjustment_entries" ADD CONSTRAINT "finance_adjustment_entries_request_id_finance_adjustment_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."finance_adjustment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_entries" ADD CONSTRAINT "finance_adjustment_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_entries" ADD CONSTRAINT "finance_adjustment_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_entries" ADD CONSTRAINT "finance_adjustment_entries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_entries" ADD CONSTRAINT "finance_adjustment_entries_original_ledger_id_payment_ledger_id_fk" FOREIGN KEY ("original_ledger_id") REFERENCES "public"."payment_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_entries" ADD CONSTRAINT "finance_adjustment_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_requests" ADD CONSTRAINT "finance_adjustment_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_requests" ADD CONSTRAINT "finance_adjustment_requests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_requests" ADD CONSTRAINT "finance_adjustment_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_requests" ADD CONSTRAINT "finance_adjustment_requests_original_ledger_id_payment_ledger_id_fk" FOREIGN KEY ("original_ledger_id") REFERENCES "public"."payment_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_requests" ADD CONSTRAINT "finance_adjustment_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustment_requests" ADD CONSTRAINT "finance_adjustment_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_finance_entries_invoice" ON "finance_adjustment_entries" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_entries_reversal_once" ON "finance_adjustment_entries" USING btree ("original_ledger_id");--> statement-breakpoint
CREATE INDEX "idx_finance_adjustments_property" ON "finance_adjustment_requests" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "idx_finance_adjustments_invoice" ON "finance_adjustment_requests" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_adjustments_request_idempotency" ON "finance_adjustment_requests" USING btree ("requested_by","idempotency_key");