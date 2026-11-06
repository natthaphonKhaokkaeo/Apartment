ALTER TABLE "org_notifications" DROP CONSTRAINT "org_notifications_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org_notifications" DROP CONSTRAINT "org_notifications_recipient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org_notifications" ADD CONSTRAINT "org_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_notifications" ADD CONSTRAINT "org_notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;