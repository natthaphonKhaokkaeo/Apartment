CREATE TABLE "privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(32) DEFAULT 'REQUESTED' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"reviewed_by" uuid,
	"review_reason" text,
	"policy_evidence_ref" varchar(200),
	"policy_retention_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	CONSTRAINT "privacy_request_status" CHECK ("privacy_requests"."status" IN ('REQUESTED','APPROVED','REJECTED','CANCELLED','PROFILE_ANONYMIZED'))
);
--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_privacy_request_user_key" ON "privacy_requests" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_privacy_request_status" ON "privacy_requests" USING btree ("status","created_at");