ALTER TABLE "generations" DROP CONSTRAINT "generations_voice_id_voices_id_fk";
--> statement-breakpoint
ALTER TABLE "generations" ALTER COLUMN "voice_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "library_voice_id" uuid;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_library_voice_id_library_voices_id_fk" FOREIGN KEY ("library_voice_id") REFERENCES "public"."library_voices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE set null ON UPDATE no action;