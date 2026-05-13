import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    name: text("name"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    status: text("status", { enum: ["unverified", "active", "suspended"] })
      .notNull()
      .default("unverified"),
    tier: text("tier", { enum: ["free", "basic", "pro", "enterprise"] })
      .notNull()
      .default("free"),
    elevenlabsApiKey: text("elevenlabs_api_key"),
    elevenlabsPlan: text("elevenlabs_plan", {
      enum: ["starter", "creator", "pro", "scale"],
    }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("users_status_idx").on(t.status),
    tierIdx: index("users_tier_idx").on(t.tier),
  }),
);

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("email_verifications_user_id_idx").on(t.userId),
    expiresIdx: index("email_verifications_expires_at_idx").on(t.expiresAt),
  }),
);

export const credits = pgTable("credits", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(1000),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  exhaustedAt: timestamp("exhausted_at", { withTimezone: true }),
});

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    durationSec: numeric("duration_sec", { precision: 10, scale: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("recordings_user_id_created_at_idx").on(t.userId, t.createdAt),
  }),
);

export const voices = pgTable(
  "voices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recordingId: uuid("recording_id").references(() => recordings.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    elevenLabsVoiceId: text("elevenlabs_voice_id").notNull(),
    status: text("status", { enum: ["pending", "ready", "failed"] })
      .notNull()
      .default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("voices_user_id_created_at_idx").on(t.userId, t.createdAt),
    elevenLabsIdx: uniqueIndex("voices_elevenlabs_voice_id_idx").on(t.elevenLabsVoiceId),
  }),
);

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    voiceId: uuid("voice_id").references(() => voices.id, { onDelete: "set null" }),
    libraryVoiceId: uuid("library_voice_id").references(() => libraryVoices.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull().default("audio/mpeg"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    durationSec: numeric("duration_sec", { precision: 10, scale: 3 }),
    characterCount: integer("character_count").notNull(),
    settings: jsonb("settings"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("generations_user_id_created_at_idx").on(t.userId, t.createdAt),
    voiceCreatedIdx: index("generations_voice_id_created_at_idx").on(t.voiceId, t.createdAt),
  }),
);

export const libraryVoices = pgTable(
  "library_voices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    upstreamVoiceId: text("upstream_voice_id").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    gender: text("gender"),
    age: text("age"),
    accent: text("accent"),
    category: text("category"),
    previewUrl: text("preview_url"),
    language: text("language"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeIdx: index("library_voices_is_active_sort_idx").on(t.isActive, t.sortOrder),
    languageIdx: index("library_voices_language_idx").on(t.language),
    categoryIdx: index("library_voices_category_idx").on(t.category),
  }),
);

export const transcriptions = pgTable(
  "transcriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    audioKey: text("audio_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    durationSec: numeric("duration_sec", { precision: 10, scale: 3 }).notNull(),
    model: text("model").notNull().default("scribe_v2"),
    language: text("language").notNull(),
    languageProbability: numeric("language_probability", { precision: 5, scale: 4 })
      .notNull()
      .default("0"),
    text: text("text").notNull(),
    textOriginal: text("text_original").notNull(),
    words: jsonb("words").notNull(),
    wordsOriginal: jsonb("words_original").notNull(),
    options: jsonb("options").notNull(),
    creditsCharged: integer("credits_charged"),
    additionalFormats: jsonb("additional_formats"),
    editVersion: integer("edit_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("transcriptions_user_id_created_at_idx").on(t.userId, t.createdAt),
  }),
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    adminCreatedIdx: index("admin_audit_log_admin_id_created_at_idx").on(
      t.adminId,
      t.createdAt,
    ),
    actionIdx: index("admin_audit_log_action_idx").on(t.action),
  }),
);

export const usersRelations = relations(users, ({ many, one }) => ({
  recordings: many(recordings),
  voices: many(voices),
  generations: many(generations),
  transcriptions: many(transcriptions),
  emailVerifications: many(emailVerifications),
  credits: one(credits, { fields: [users.id], references: [credits.userId] }),
  adminAuditEntries: many(adminAuditLog),
}));

export const transcriptionsRelations = relations(transcriptions, ({ one }) => ({
  user: one(users, { fields: [transcriptions.userId], references: [users.id] }),
}));

export const recordingsRelations = relations(recordings, ({ one, many }) => ({
  user: one(users, { fields: [recordings.userId], references: [users.id] }),
  voices: many(voices),
}));

export const voicesRelations = relations(voices, ({ one, many }) => ({
  user: one(users, { fields: [voices.userId], references: [users.id] }),
  recording: one(recordings, {
    fields: [voices.recordingId],
    references: [recordings.id],
  }),
  generations: many(generations),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, { fields: [generations.userId], references: [users.id] }),
  voice: one(voices, { fields: [generations.voiceId], references: [voices.id] }),
  libraryVoice: one(libraryVoices, {
    fields: [generations.libraryVoiceId],
    references: [libraryVoices.id],
  }),
}));

export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
  user: one(users, { fields: [emailVerifications.userId], references: [users.id] }),
}));

export const creditsRelations = relations(credits, ({ one }) => ({
  user: one(users, { fields: [credits.userId], references: [users.id] }),
}));

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  admin: one(users, { fields: [adminAuditLog.adminId], references: [users.id] }),
}));

export type LibraryVoice = typeof libraryVoices.$inferSelect;
export type NewLibraryVoice = typeof libraryVoices.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type Credit = typeof credits.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
export type Voice = typeof voices.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type AdminAuditEntry = typeof adminAuditLog.$inferSelect;
export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;

export interface TranscribedWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "audio_event";
  speakerId?: string;
  logprob?: number;
}

export interface TranscribeOptions {
  languageCode?: string;
  tagAudioEvents: boolean;
  noVerbatim: boolean;
  keyterms: string[];
  includeSubtitles: boolean;
  diarize: boolean;
  numSpeakers?: number;
  model: "scribe_v1" | "scribe_v2";
  speakerNames?: Record<string, string>;
}

export type TranscriptionExportFormat = "txt" | "srt" | "vtt" | "json" | "pdf" | "docx" | "html";

export interface TranscriptionAdditionalFormatEntry {
  value?: string;
  storageKey?: string;
  editVersion: number;
}

export type TranscriptionAdditionalFormats = Partial<
  Record<TranscriptionExportFormat, TranscriptionAdditionalFormatEntry>
>;
