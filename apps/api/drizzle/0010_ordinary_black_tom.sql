CREATE TABLE "line_outbox_dead_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"review_reason" varchar(500) NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_outbox_dead_reviews_outbox_id_unique" UNIQUE("outbox_id")
);
--> statement-breakpoint
ALTER TABLE "line_outbox_dead_reviews" ADD CONSTRAINT "line_outbox_dead_reviews_outbox_id_line_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."line_outbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_outbox_dead_reviews" ADD CONSTRAINT "line_outbox_dead_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_outbox_dead_reviews" ADD CONSTRAINT "line_outbox_dead_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_line_dead_reviews_org" ON "line_outbox_dead_reviews" USING btree ("organization_id","reviewed_at");