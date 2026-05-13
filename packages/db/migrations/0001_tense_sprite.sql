CREATE TABLE "library_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upstream_voice_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"gender" text,
	"age" text,
	"accent" text,
	"category" text,
	"preview_url" text,
	"language" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_voices_upstream_voice_id_unique" UNIQUE("upstream_voice_id")
);
--> statement-breakpoint
CREATE INDEX "library_voices_is_active_sort_idx" ON "library_voices" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "library_voices_language_idx" ON "library_voices" USING btree ("language");--> statement-breakpoint
CREATE INDEX "library_voices_category_idx" ON "library_voices" USING btree ("category");