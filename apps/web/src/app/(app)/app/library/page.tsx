"use client";

import { useState, useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Mic } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLibraryVoices, type LibraryVoice } from "@/hooks/use-library";

const GENDERS = ["male", "female", "neutral"];
const AGES = ["young", "middle aged", "old"];
const PAGE_SIZE = 20;

function PreviewButton({ voice }: { voice: LibraryVoice }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggle() {
    if (!voice.previewUrl) return;
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        void audioRef.current.play();
        setPlaying(true);
      }
      return;
    }
    setLoading(true);
    const audio = new Audio(`/api/v1/library/voices/${voice.voiceId}/preview`);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.oncanplaythrough = () => {
      setLoading(false);
      void audio.play();
      setPlaying(true);
    };
    audio.onerror = () => setLoading(false);
  }

  if (!voice.previewUrl) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted hover:bg-muted/80 transition-colors shrink-0"
      aria-label={playing ? "Pause preview" : "Play preview"}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : playing ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function VoiceCard({ voice }: { voice: LibraryVoice }) {
  const tags = [voice.gender, voice.age, voice.accent, voice.useCase].filter(Boolean);

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mic className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate text-sm">{voice.name}</p>
          {voice.language && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {voice.language}
            </Badge>
          )}
        </div>
        {voice.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{voice.description}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground capitalize"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PreviewButton voice={voice} />
        <Link
          href={`/app/library/${voice.voiceId}/generate`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Generate
        </Link>
      </div>
    </div>
  );
}

type FilterChipsProps = {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
};

function FilterChips({ label, options, value, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">{label}:</span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? undefined : opt)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gender, setGender] = useState<string | undefined>();
  const [age, setAge] = useState<string | undefined>();
  const [page, setPage] = useState(0);

  const debounce = useDebouncedCallback((v: string) => {
    setDebouncedSearch(v);
    setPage(0);
  }, 300);

  useEffect(() => {
    debounce(search);
  }, [search, debounce]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [gender, age]);

  const filters = {
    gender,
    age,
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, isFetching } = useLibraryVoices(filters);
  const voices = data?.voices ?? [];
  const totalCount = data?.totalCount ?? null;
  const hasMore = data?.hasMore ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Voice Library</h1>
        <p className="text-sm text-muted-foreground">
          Pre-built voices — no cloning required. Available to all users.
          {totalCount != null && (
            <span className="ml-1 text-muted-foreground/60">({totalCount.toLocaleString()} voices)</span>
          )}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="search"
          placeholder="Search voices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <FilterChips label="Gender" options={GENDERS} value={gender} onChange={setGender} />
        <FilterChips label="Age" options={AGES} value={age} onChange={setAge} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading voices…
        </div>
      ) : voices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No voices found.{" "}
          {Object.values({ gender, age, search: debouncedSearch }).some(Boolean)
            ? "Try adjusting filters."
            : "No voices available."}
        </p>
      ) : (
        <>
          <div className={cn("grid gap-3 sm:grid-cols-1 lg:grid-cols-2", isFetching && "opacity-60 pointer-events-none")}>
            {voices.map((v) => (
              <VoiceCard key={v.voiceId} voice={v} />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Page {page + 1}
              {totalCount != null && ` of ${Math.ceil(totalCount / PAGE_SIZE)}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => p - 1)}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1",
                  (page === 0 || isFetching) && "opacity-50 pointer-events-none",
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={!hasMore || isFetching}
                onClick={() => setPage((p) => p + 1)}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1",
                  (!hasMore || isFetching) && "opacity-50 pointer-events-none",
                )}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
