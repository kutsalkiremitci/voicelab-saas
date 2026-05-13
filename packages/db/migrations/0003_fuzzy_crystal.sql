CREATE TABLE "transcriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"audio_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"duration_sec" numeric(10, 3) NOT NULL,
	"model" text DEFAULT 'scribe_v2' NOT NULL,
	"language" text NOT NULL,
	"language_probability" numeric(5, 4) DEFAULT '0' NOT NULL,
	"text" text NOT NULL,
	"text_original" text NOT NULL,
	"words" jsonb NOT NULL,
	"words_original" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"credits_charged" integer,
	"additional_formats" jsonb,
	"edit_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transcriptions_user_id_created_at_idx" ON "transcriptions" USING btree ("user_id","created_at");