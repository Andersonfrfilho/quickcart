CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"name" varchar(120),
	"email" varchar(160),
	"default_address" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"current_state" varchar(40) DEFAULT 'greeting' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mode" varchar(10) DEFAULT 'bot' NOT NULL,
	"last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_sessions_customer_phone_unique" UNIQUE("customer_phone")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"wa_message_id" varchar(80),
	"type" varchar(20) NOT NULL,
	"body" text,
	"payload" jsonb,
	"status" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_conversation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
