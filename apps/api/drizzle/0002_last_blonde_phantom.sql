ALTER TABLE "lease_invitations" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;