CREATE TABLE "org_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"event_key" varchar(160) NOT NULL,
	"kind" varchar(48) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_notifications" ADD CONSTRAINT "org_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_notifications" ADD CONSTRAINT "org_notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_org_notification_recipient_event" ON "org_notifications" USING btree ("organization_id","recipient_user_id","event_key");--> statement-breakpoint
CREATE INDEX "idx_org_notification_inbox" ON "org_notifications" USING btree ("recipient_user_id","created_at");