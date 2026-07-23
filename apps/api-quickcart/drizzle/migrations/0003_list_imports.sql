CREATE TABLE IF NOT EXISTS "list_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"source" varchar(10) NOT NULL,
	"raw_text" text NOT NULL,
	"transcript" text,
	"parse_result" jsonb NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"ambiguous_count" integer DEFAULT 0 NOT NULL,
	"unmatched_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "list_imports" ADD CONSTRAINT "list_imports_session_id_conversation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
