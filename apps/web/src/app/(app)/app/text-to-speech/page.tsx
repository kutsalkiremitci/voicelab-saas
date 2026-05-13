"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useQueryClient, useMutation } from "@tanstack/react-query";
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
  Search,
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
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useCreditBalance } from "@/hooks/use-credits";
import { useTtsModels } from "@/hooks/use-models";
import { useLibraryVoices, type LibraryVoice } from "@/hooks/use-library";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/app/breadcrumbs";

// ─── Constants ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const MIN_PANEL_W = 280;
const MAX_PANEL_W = 680;

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

// Languages that have meaningful accent variants in the upstream library
const LANGUAGE_ACCENTS: Record<string, string[]> = {
  en: [
    "american", "british", "australian", "canadian", "irish", "scottish",
    "south african", "new zealand", "indian", "nigerian", "transatlantic",
  ],
  es: ["spanish", "mexican", "latin american"],
  fr: ["french", "canadian french"],
  pt: ["brazilian", "european"],
  de: ["german", "austrian"],
  ar: ["egyptian", "gulf", "levantine"],
};

const ALL_ACCENTS = [
  "american", "british", "australian", "canadian", "irish", "scottish",
  "south african", "new zealand", "indian", "nigerian", "transatlantic",
  "spanish", "mexican", "latin american",
  "french", "canadian french",
  "brazilian", "european",
  "german", "austrian",
  "egyptian", "gulf", "levantine",
];

const CATEGORIES = ["professional", "generated", "cloned", "premade", "high_quality", "famous"];
const GENDERS = ["male", "female", "neutral"];
const AGES = ["young", "middle_aged", "old"];

function prettyLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function paginationRange(current: number, total: number): (number | "ellipsis")[] {
  const c = current + 1;
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [1];
  if (c <= 3) {
    out.push(2, 3);
    if (total > 4) out.push("ellipsis");
    out.push(total);
  } else if (c >= total - 2) {
    out.push("ellipsis", total - 2, total - 1, total);
  } else {
    out.push("ellipsis", c - 1, c, c + 1, "ellipsis", total);
  }
  return out;
}

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
  searchable?: boolean;
};

function FilterDropdown({ label, options, selected, onChange, searchable = false }: FilterDropdownProps) {
  const [q, setQ] = useState("");
  const filtered = searchable && q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  }

  const hasSelection = selected.length > 0;

  return (
    <Popover onOpenChange={(open) => { if (!open) setQ(""); }}>
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
      <PopoverContent className="w-56 p-0" align="start">
        {searchable && (
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none"
            />
            {q && (
              <button type="button" onClick={() => setQ("")}>
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        )}
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results.</p>
          ) : (
            filtered.map((opt) => {
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
            })
          )}
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
    audio.oncanplay = () => { setLoading(false); void audio.play(); setPlaying(true); };
    audio.onerror = () => { setLoading(false); audioRef.current = null; };
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
  const tags = [voice.accent, voice.useCase].filter(Boolean).map(prettyLabel);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted",
      )}
    >
      <VoiceAvatar name={voice.name} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{voice.name}</p>
        {tags.length > 0 && (
          <p className="truncate text-[10px] text-muted-foreground">
            {tags.join(" · ")}
          </p>
        )}
      </div>
      <PreviewButton voice={voice} />
    </div>
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
  const t = useTranslations();
  const { data: authData } = useAuth();
  const tier = authData?.user.tier ?? "free";
  const qc = useQueryClient();
  const { data: credits } = useCreditBalance();
  const { data: modelsData } = useTtsModels();

  // Panel state
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(MAX_PANEL_W);
  const [isDragging, setIsDragging] = useState(false);

  // Drag-resize
  useEffect(() => {
    if (!isDragging) return;
    function onMove(e: MouseEvent) {
      setPanelWidth(Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, window.innerWidth - e.clientX)));
    }
    function onUp() { setIsDragging(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

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

  const debounce = useDebouncedCallback((v: string) => { setDebouncedSearch(v); setPage(0); }, 300);
  useEffect(() => { debounce(search); }, [search, debounce]);

  const resetPage = useCallback(() => setPage(0), []);
  useEffect(resetPage, [filterLanguages, filterAccents, filterCategories, filterGenders, filterAges, resetPage]);

  // When language changes to one without accent support, clear accent filter
  const primaryLanguage = filterLanguages[0] ?? "";
  useEffect(() => {
    if (primaryLanguage && !LANGUAGE_ACCENTS[primaryLanguage]) {
      setFilterAccents([]);
    }
  }, [primaryLanguage]);

  const availableAccents = primaryLanguage
    ? (LANGUAGE_ACCENTS[primaryLanguage] ?? [])
    : ALL_ACCENTS;

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
  const totalPages = totalCount !== null && totalCount > 0
    ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    : null;

  const selectedModel = modelsData?.models.find((m) => m.modelId === modelId);
  const modelMax = selectedModel?.maximumTextLengthPerRequest ?? 5000;
  const maxLen = Math.min(5000, modelMax);
  const allowedFormats = OUTPUT_FORMATS.filter((f) =>
    (f.tiers as readonly string[]).includes(tier),
  );

  // Credits vs char count
  const charCount = text.length;
  const creditBalance = credits?.balance ?? null;
  const canAfford = creditBalance === null || charCount === 0 || creditBalance >= charCount;

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

  const creditShortfall = creditBalance !== null && charCount > 0 && charCount > creditBalance;

  return (
    <div className="flex -m-6 h-screen overflow-hidden">
      {/* ── Left: Editor ── */}
      <div className="flex flex-1 flex-col min-w-0 p-6 gap-4">
        <Breadcrumbs />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("tts.title")}</h1>
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
                {t("tts.selectVoiceHint")}
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
              {t("tts.browseVoices")}
            </button>
          )}
        </div>

        {/* Textarea */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <textarea
            className={cn(
              "flex-1 w-full resize-none rounded-xl border bg-background px-4 pt-3 pb-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              creditShortfall ? "border-destructive/60" : "border-input",
            )}
            placeholder={t("tts.textareaPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={maxLen}
          />
          {/* Char count + cost preview bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-xl border-t border-inherit bg-muted/60 px-3 py-1.5 pointer-events-none">
            <span
              className={cn(
                "text-xs tabular-nums font-medium",
                charCount > maxLen
                  ? "text-destructive"
                  : creditShortfall
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {charCount.toLocaleString()} {t("tts.chars")}
              {charCount > 0 && (
                <span className="ml-2 text-muted-foreground/70">
                  · {t("tts.costsCredits", { n: charCount.toLocaleString() })}
                </span>
              )}
              {charCount > maxLen && ` (${t("tts.max")} ${maxLen.toLocaleString()})`}
            </span>
            {creditBalance !== null && (
              <span
                className={cn(
                  "text-xs tabular-nums font-medium flex items-center gap-1.5",
                  creditShortfall ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {creditShortfall && "⚠"}
                <span>{creditBalance.toLocaleString()}</span>
                {charCount > 0 && (
                  <>
                    <span className="opacity-60">→</span>
                    <span className={cn(creditShortfall && "font-semibold")}>
                      {(creditBalance - charCount).toLocaleString()}
                    </span>
                  </>
                )}
                <span className="opacity-60">{t("common.credits")}</span>
              </span>
            )}
          </div>
        </div>

        {/* Model + Format */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">{t("tts.model")}</Label>
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
            <Label className="text-xs">{t("tts.format")}</Label>
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

        {/* Generate */}
        <div className="flex items-center justify-end gap-4">
          {creditShortfall && (
            <p className="text-xs text-destructive">
              {t("tts.needMoreCredits", { n: (charCount - creditBalance!).toLocaleString() })}
            </p>
          )}
          <Button
            disabled={
              !text.trim() ||
              charCount > maxLen ||
              !selectedVoice ||
              !canAfford ||
              generate.isPending
            }
            onClick={() => generate.mutate()}
            className="gap-2"
          >
            {generate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("tts.generateSpeech")}
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
        <div
          className="relative flex shrink-0 flex-col border-l bg-background"
          style={{ width: panelWidth }}
        >
          {/* Drag handle */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 group",
              isDragging && "bg-primary/20",
            )}
            onMouseDown={() => setIsDragging(true)}
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-full rounded bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Panel header */}
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("tts.exploreTitle")}</span>
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
          <div className="border-b px-3 py-2.5 shrink-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                placeholder={t("tts.searchVoicesPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-muted/40 pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Filter chips */}
          <div className="border-b px-3 py-2.5 space-y-2 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              <FilterDropdown
                label={t("tts.filters.language")}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                selected={filterLanguages}
                onChange={setFilterLanguages}
                searchable
              />
              {availableAccents.length > 0 && (
                <FilterDropdown
                  label={t("tts.filters.accent")}
                  options={availableAccents.map((a) => ({
                    value: a,
                    label: prettyLabel(a),
                  }))}
                  selected={filterAccents}
                  onChange={setFilterAccents}
                  searchable
                />
              )}
              <FilterDropdown
                label={t("tts.filters.category")}
                options={CATEGORIES.map((c) => ({ value: c, label: prettyLabel(c) }))}
                selected={filterCategories}
                onChange={setFilterCategories}
              />
              <FilterDropdown
                label={t("tts.filters.gender")}
                options={GENDERS.map((g) => ({ value: g, label: prettyLabel(g) }))}
                selected={filterGenders}
                onChange={setFilterGenders}
              />
              <FilterDropdown
                label={t("tts.filters.age")}
                options={AGES.map((a) => ({ value: a, label: prettyLabel(a) }))}
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
                {t("tts.clearAll")}
              </button>
            )}
          </div>

          {/* Voice list */}
          <div className="flex-1 overflow-y-auto">
            {isFetching && voices.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">{t("common.loading")}</span>
              </div>
            ) : voices.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                {t("tts.noVoicesFound")}
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
          <div className="flex items-center justify-between gap-1 border-t px-2 py-2 shrink-0">
            <button
              type="button"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {totalPages !== null ? (
              <div className="flex flex-1 items-center justify-center gap-0.5">
                {paginationRange(page, totalPages).map((item, i) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e${i}`}
                      className="px-1 text-[11px] text-muted-foreground/60"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      disabled={isFetching}
                      onClick={() => setPage(item - 1)}
                      className={cn(
                        "min-w-[26px] h-7 px-1.5 rounded text-[11px] tabular-nums transition-colors",
                        item - 1 === page
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
            ) : (
              <span className="flex-1 text-center text-[10px] text-muted-foreground">
                {t("tts.page")} {page + 1}
              </span>
            )}

            <button
              type="button"
              disabled={!hasMore || isFetching}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
