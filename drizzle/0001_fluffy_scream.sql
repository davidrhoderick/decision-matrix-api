CREATE TABLE IF NOT EXISTS "matrix" (
	"id" text PRIMARY KEY NOT NULL,
	"choices" json DEFAULT '{"list":["Choice 1","Choice 2"]}',
	"factors" json DEFAULT '{"list":["Factor 1","Factor 2"]}',
	"factorsChoices" json DEFAULT '{"matrix":[[1,2],[3,-1]]}',
	"user_id" text
);
