CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"emoji" varchar(8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"brand" varchar(80),
	"description" text,
	"unit" varchar(16) NOT NULL,
	"unit_size" varchar(24),
	"price_in_cents" integer NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"barcode" varchar(14),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Índices trigram (spec §2/§3.2): usados tanto pelo autocomplete público quanto pelo
-- matcher de lista de compras (Fase 4) — mesma expressão immutable_unaccent da 0000.
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (lower(immutable_unaccent(name)) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_brand_trgm_idx ON products USING gin (lower(immutable_unaccent(coalesce(brand, ''))) gin_trgm_ops);
