"use client";

import { use, useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/ui/audio-player";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  VoiceSettingsPanel,
  DEFAULT_VOICE_SETTINGS,
  type VoiceSettings,
} from "@/components/studio/voice-settings-panel";
import { useAuth } from "@/hooks/use-auth";
import { useCreditBalance } from "@/hooks/use-credits";
import { useTtsModels } from "@/hooks/use-models";
import { useLibraryVoice } from "@/hooks/use-library";
import { api, ApiError } from "@/lib/api";

type Generation = {
  id: string;
  url: string;
  mimeType: string;
  characterCount: number;
  settings: Record<string, unknown>;
  createdAt: string;
};

const OUTPUT_FORMATS = [
  { value: "mp3_44100_128", label: "MP3 128 kbps", tiers: ["free", "basic", "pro", "enterprise"] },
  { value: "mp3_44100_192", label: "MP3 192 kbps", tiers: ["pro", "enterprise"] },
  { value: "pcm_44100", label: "PCM 44.1 kHz", tiers: ["enterprise"] },
] as const;

function formatExt(outputFormat: string): string {
  return outputFormat.startsWith("pcm") ? "pcm" : "mp3";
}

export default function LibraryGeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: authData } = useAuth();
  const tier = authData?.user.tier ?? "free";
  const qc = useQueryClient();
  const { data: credits } = useCreditBalance();
  const { data: modelsData, isLoading: modelsLoading } = useTtsModels();
  const { data: voiceData, isLoading: voiceLoading } = useLibraryVoice(id);

  const [text, setText] = useState("");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [result, setResult] = useState<Generation | null>(null);

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

  const canAfford =
    tier !== "free" || !quote || !credits || credits.balance >= quote.amount;

  const generate = useMutation({
    mutationFn: () =>
      api.post<{ generation: Generation }>(`/library/voices/${id}/generate`, {
        text,
        modelId,
        outputFormat,
        settings,
      }),
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

  if (voiceLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!voiceData) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Voice not found</h1>
        <Link href="/app/library">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </Link>
      </div>
    );
  }

  const voice = voiceData.voice;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <Link href="/app/library">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Library
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{voice.name}</h1>
        {voice.description && (
          <p className="text-sm text-muted-foreground">{voice.description}</p>
        )}
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Text</Label>
            <span
              className={`text-xs tabular-nums ${text.length > maxLen ? "text-destructive" : "text-muted-foreground"}`}
            >
              {text.length} / {maxLen}
            </span>
          </div>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder="Enter text to speak…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={maxLen}
          />
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          {modelsLoading ? (
            <div className="h-9 rounded-md border bg-muted animate-pulse" />
          ) : (
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelsData?.models.map((m) => (
                  <SelectItem key={m.modelId} value={m.modelId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Output Format</Label>
          <Select value={outputFormat} onValueChange={setOutputFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedFormats.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <VoiceSettingsPanel settings={settings} onChange={setSettings} model={selectedModel} />

        {tier === "free" && quote && (
          <p className={`text-xs ${canAfford ? "text-muted-foreground" : "text-destructive"}`}>
            {canAfford
              ? `~${quote.amount} credits (balance: ${credits?.balance ?? 0})`
              : `Not enough credits — need ${quote.amount - (credits?.balance ?? 0)} more`}
          </p>
        )}

        <Button
          className="w-full"
          disabled={!text.trim() || text.length > maxLen || !canAfford || generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Generate
        </Button>

        {result && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <AudioPlayer src={result.url} className="flex-1" />
            <a
              href={result.url}
              download={`generation.${formatExt(outputFormat)}`}
              className="shrink-0"
            >
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
