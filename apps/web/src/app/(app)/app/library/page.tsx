"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Pause,
  Play,
  PanelRightClose,
  PanelRightOpen,
  Download,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useCreditBalance } from "@/hooks/use-credits";
import { useTtsModels } from "@/hooks/use-models";
import { useLibraryVoices, type LibraryVoice } from "@/hooks/use-library";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const LANGUAGES = [
  { code: "af", label: "Afrikaans" },
  { code: "ar", label: "Arabic" },
  { code: "hy", label: "Armenian" },
  { code: "bg", label: "Bulgarian" },
  { code: "ca", label: "Catalan" },
  { code: "zh", label: "Chinese" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "et", label: "Estonian" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "lv", label: "Latvian" },
  { code: "lt", label: "Lithuanian" },
  { code: "ms", label: "Malay" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sk", label: "Slovak" },
  { code: "es", label: "Spanish" },
  { code: "sv", label: "Swedish" },
  { code: "tl", label: "Filipino" },
  { code: "ta", label: "Tamil" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
];

const ACCENTS = [
  "American", "British", "Australian", "Canadian", "Irish", "Scottish",
  "South African", "New Zealand", "Indian", "Nigerian", "Transatlantic",
];

const CATEGORIES = ["professional", "generated", "cloned", "premade", "high_quality", "famous"];
const GENDERS = ["male", "female", "neutral"];
const AGES = ["young", "middle aged", "old"];

const OUTPUT_FORMATS = [
  { value: "mp3_44100_128", label: "MP3 128 kbps", tiers: ["free", "basic", "pro", "enterprise"] },
  { value: "mp3_44100_192", label: "MP3 192 kbps", tiers: ["pro", "enterprise"] },
  { value: "pcm_44100", label: "PCM 44.1 kHz", tiers: ["enterprise"] },
] as const;

// ─── Avatar ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-emerald-500",
  "bg-sky-500", "bg-orange-500", "bg-pink-500", "bg-teal-500",
  "bg-indigo-500", "bg-lime-500", "bg-red-500", "bg-cyan-500",
];

function voiceColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

function VoiceAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className={cn(
        "shrink-0 rounded-full flex items-center justify-center text-white font-semibold select-none",
        voiceColor(name),
        size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
      )}
    >
      {initials}
    </div>
  );
}

// ─── Filter Dropdown ───────────────────────────────────────────────────────

type FilterDropdownProps = {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
};

function FilterDropdown({ label, options, selected, onChange }: FilterDropdownProps) {
  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  }

  const hasSelection = selected.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            hasSelection
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
          )}
        >
          {label}
          {hasSelection && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <div className="max-h-56 overflow-y-auto py-1">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                <div
                  className={cn(
                    "h-4 w-4 shrink-0 rounded border flex items-center justify-center",
                    checked ? "border-primary bg-primary" : "border-border",
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </div>
                <span className="capitalize">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t px-3 py-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Voice Preview Button ──────────────────────────────────────────────────

function PreviewButton({ voice }: { voice: LibraryVoice }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!voice.previewUrl) return;
    if (audioRef.current) {
      if (playing) { audioRef.current.pause(); setPlaying(false); }
      else { void audioRef.current.play(); setPlaying(true); }
      return;
    }
    setLoading(true);
    const audio = new Audio(`/api/v1/library/voices/${voice.voiceId}/preview`);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.oncanplaythrough = () => { setLoading(false); void audio.play(); setPlaying(true); };
    audio.onerror = () => setLoading(false);
  }

  if (!voice.previewUrl) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-6 w-6 items-center justify-center rounded-full border bg-background hover:bg-muted transition-colors shrink-0"
      aria-label={playing ? "Pause" : "Preview"}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : playing ? (
        <Pause className="h-3 w-3" />
      ) : (
        <Play className="h-3 w-3" />
      )}
    </button>
  );
}

// ─── Voice Item ────────────────────────────────────────────────────────────

function VoiceItem({
  voice,
  selected,
  onClick,
}: {
  voice: LibraryVoice;
  selected: boolean;
  onClick: () => void;
}) {
  const tags = [voice.accent, voice.useCase].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        selected
          ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
          : "hover:bg-muted",
      )}
    >
      <VoiceAvatar name={voice.name} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{voice.name}</p>
        {tags.length > 0 && (
          <p className="truncate text-[10px] text-muted-foreground capitalize">
            {tags.join(" · ")}
          </p>
        )}
      </div>
      <PreviewButton voice={voice} />
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

type Generation = {
  id: string;
  url: string;
  mimeType: string;
  characterCount: number;
};

export default function TextToSpeechPage() {
  const { data: authData } = useAuth();
  const tier = authData?.user.tier ?? "free";
  const qc = useQueryClient();
  const { data: credits } = useCreditBalance();
  const { data: modelsData } = useTtsModels();

  // Panel state
  const [panelOpen, setPanelOpen] = useState(true);

  // Editor state
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<LibraryVoice | null>(null);
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [result, setResult] = useState<Generation | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filterLanguages, setFilterLanguages] = useState<string[]>([]);
  const [filterAccents, setFilterAccents] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterGenders, setFilterGenders] = useState<string[]>([]);
  const [filterAges, setFilterAges] = useState<string[]>([]);

  const debounce = useDebouncedCallback((v: string) => {
    setDebouncedSearch(v);
    setPage(0);
  }, 300);
  useEffect(() => { debounce(search); }, [search, debounce]);

  const resetPage = useCallback(() => setPage(0), []);
  useEffect(resetPage, [filterLanguages, filterAccents, filterCategories, filterGenders, filterAges, resetPage]);

  const filters = {
    search: debouncedSearch || undefined,
    language: filterLanguages[0],
    accent: filterAccents[0],
    category: filterCategories[0],
    gender: filterGenders[0],
    age: filterAges[0],
    page,
    pageSize: PAGE_SIZE,
  };

  const { data: libraryData, isFetching } = useLibraryVoices(filters);
  const voices = libraryData?.voices ?? [];
  const hasMore = libraryData?.hasMore ?? false;
  const totalCount = libraryData?.totalCount ?? null;

  const selectedModel = modelsData?.models.find((m) => m.modelId === modelId);
  const maxLen = selectedModel?.maximumTextLengthPerRequest ?? 5000;
  const allowedFormats = OUTPUT_FORMATS.filter((f) =>
    (f.tiers as readonly string[]).includes(tier),
  );

  const { data: quote } = useQuery({
    queryKey: ["quote", "tts", text],
    queryFn: () =>
      api.post<{ amount: number }>("/credits/quote", { operation: "tts", payload: { text } }),
    enabled: tier === "free" && text.length > 0,
    staleTime: 30_000,
  });

  const canAfford = tier !== "free" || !quote || !credits || credits.balance >= quote.amount;

  const generate = useMutation({
    mutationFn: () => {
      if (!selectedVoice) throw new Error("No voice selected");
      return api.post<{ generation: Generation }>(
        `/library/voices/${selectedVoice.voiceId}/generate`,
        { text, modelId, outputFormat },
      );
    },
    onSuccess: (data) => {
      setResult(data.generation);
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
      qc.invalidateQueries({ queryKey: ["generations"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const p = err.payload as { error?: { code?: string; details?: { deficit?: number } } };
        if (p.error?.code === "INSUFFICIENT_CREDITS") {
          toast.error(`Not enough credits — need ${p.error.details?.deficit ?? "more"} more`);
        } else {
          toast.error("Generation failed. Please try again.");
        }
      }
    },
  });

  const anyFilter =
    filterLanguages.length > 0 ||
    filterAccents.length > 0 ||
    filterCategories.length > 0 ||
    filterGenders.length > 0 ||
    filterAges.length > 0;

  function clearAllFilters() {
    setFilterLanguages([]);
    setFilterAccents([]);
    setFilterCategories([]);
    setFilterGenders([]);
    setFilterAges([]);
    setSearch("");
  }

  return (
    <div className="flex -m-6 h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Left: Editor ── */}
      <div className="flex flex-1 flex-col min-w-0 p-6 gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Text to Speech</h1>
            {selectedVoice ? (
              <div className="flex items-center gap-2 mt-0.5">
                <VoiceAvatar name={selectedVoice.name} size="sm" />
                <span className="text-sm text-muted-foreground">{selectedVoice.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedVoice(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Select a voice from the panel →
              </p>
            )}
          </div>
          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
              Browse voices
            </button>
          )}
        </div>

        {/* Text area */}
        <div className="relative flex-1 flex flex-col">
          <textarea
            className="flex-1 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Enter the text you want to convert to speech…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={maxLen}
          />
          <span
            className={cn(
              "absolute bottom-3 right-3 text-[10px] tabular-nums pointer-events-none",
              text.length > maxLen ? "text-destructive" : "text-muted-foreground/50",
            )}
          >
            {text.length}/{maxLen}
          </span>
        </div>

        {/* Model + Format selects */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelsData?.models.map((m) => (
                  <SelectItem key={m.modelId} value={m.modelId} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Format</Label>
            <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedFormats.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Credits + Generate */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            {tier === "free" && credits != null && (
              <span
                className={cn(
                  quote && credits.balance < quote.amount ? "text-destructive" : "",
                )}
              >
                {credits.balance.toLocaleString()} credits remaining
                {quote && ` · ~${quote.amount} for this text`}
              </span>
            )}
          </div>
          <Button
            disabled={
              !text.trim() ||
              text.length > maxLen ||
              !selectedVoice ||
              !canAfford ||
              generate.isPending
            }
            onClick={() => generate.mutate()}
            className="gap-2"
          >
            {generate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Speech
          </Button>
        </div>

        {/* Result player */}
        {result && (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <audio controls className="flex-1 h-8" src={result.url} />
            <a
              href={result.url}
              download={`speech.${outputFormat.startsWith("pcm") ? "pcm" : "mp3"}`}
            >
              <Button variant="outline" size="sm" className="gap-1">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* ── Right: Explore Panel ── */}
      {panelOpen && (
        <div className="flex w-[340px] shrink-0 flex-col border-l bg-background">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Explore</span>
              {totalCount != null && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {totalCount.toLocaleString()}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="border-b px-3 py-3">
            <input
              type="search"
              placeholder="Search voices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-muted/40 px-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Filter chips */}
          <div className="border-b px-3 py-2.5 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <FilterDropdown
                label="Language"
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                selected={filterLanguages}
                onChange={setFilterLanguages}
              />
              <FilterDropdown
                label="Accent"
                options={ACCENTS.map((a) => ({ value: a.toLowerCase(), label: a }))}
                selected={filterAccents}
                onChange={setFilterAccents}
              />
              <FilterDropdown
                label="Category"
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                selected={filterCategories}
                onChange={setFilterCategories}
              />
              <FilterDropdown
                label="Gender"
                options={GENDERS.map((g) => ({ value: g, label: g }))}
                selected={filterGenders}
                onChange={setFilterGenders}
              />
              <FilterDropdown
                label="Age"
                options={AGES.map((a) => ({ value: a, label: a }))}
                selected={filterAges}
                onChange={setFilterAges}
              />
            </div>
            {anyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear all filters
              </button>
            )}
          </div>

          {/* Voice list */}
          <div className="flex-1 overflow-y-auto">
            {isFetching && voices.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : voices.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No voices found.
              </p>
            ) : (
              <div
                className={cn(
                  "py-1 transition-opacity",
                  isFetching && "opacity-50 pointer-events-none",
                )}
              >
                {voices.map((v) => (
                  <VoiceItem
                    key={v.voiceId}
                    voice={v}
                    selected={selectedVoice?.voiceId === v.voiceId}
                    onClick={() => setSelectedVoice(v)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span className="text-[10px] text-muted-foreground">
              Page {page + 1}
              {totalCount != null && ` · ${totalCount.toLocaleString()} voices`}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-6 w-6 items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={!hasMore || isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-6 w-6 items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
