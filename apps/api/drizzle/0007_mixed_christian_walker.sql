ALTER TYPE "public"."evidence_upload_status" ADD VALUE 'EXPIRED';--> statement-breakpoint
ALTER TABLE "evidence_uploads" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_uploads" ADD COLUMN "expired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evidence_uploads" ADD COLUMN "cleaned_at" timestamp with time zone;