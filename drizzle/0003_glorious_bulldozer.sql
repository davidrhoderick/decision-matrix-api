ALTER TABLE "matrix" ALTER COLUMN "name" SET DEFAULT 'My Decision';--> statement-breakpoint
ALTER TABLE "matrix" ALTER COLUMN "choices" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matrix" ALTER COLUMN "factors" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matrix" ALTER COLUMN "user_id" SET NOT NULL;