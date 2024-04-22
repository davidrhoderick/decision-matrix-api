ALTER TABLE "user" ALTER COLUMN "emailVerified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matrix" ADD COLUMN "createdAt" text NOT NULL;--> statement-breakpoint
ALTER TABLE "matrix" ADD COLUMN "updatedAt" text NOT NULL;