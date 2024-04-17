ALTER TABLE "matrix" ALTER COLUMN "choices" SET DEFAULT '{"list":["Choice 1","Choice 2"]}'::json;--> statement-breakpoint
ALTER TABLE "matrix" ALTER COLUMN "factors" SET DEFAULT '{"list":["Factor 1","Factor 2"]}'::json;--> statement-breakpoint
ALTER TABLE "matrix" ALTER COLUMN "factorsChoices" SET DEFAULT '{"matrix":[[1,2],[3,-1]]}'::json;--> statement-breakpoint
ALTER TABLE "matrix" ALTER COLUMN "factorsChoices" SET NOT NULL;