CREATE TABLE "lease_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claimed_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lease_invite_lease" ON "lease_invitations" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "idx_lease_invite_expiry" ON "lease_invitations" USING btree ("expires_at");