"use client";

import { use, useState, useRef } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Mic, Upload, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VoiceSettingsPanel,
  DEFAULT_VOICE_SETTINGS,
  type VoiceSettings,
} from "@/components/studio/voice-settings-panel";
import { useAuth } from "@/hooks/use-auth";
import { useCreditBalance } from "@/hooks/use-credits";
import { useTtsModels, useS2sModels } from "@/hooks/use-models";
import { api, ApiError } from "@/lib/api";
import type { Voice } from "@/hooks/use-voices";

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
  { value: "pcm_44100", label: "PCM 44.1 kHz (uncompressed)", tiers: ["enterprise"] },
] as const;

function formatExt(outputFormat: string): string {
  return outputFormat.startsWith("pcm") ? "pcm" : "mp3";
}

function InlinePlayer({
  url,
  outputFormat,
}: {
  url: string;
  mimeType: string;
  outputFormat: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
      <AudioPlayer src={url} className="flex-1" />
      <a href={url} download={`generation.${formatExt(outputFormat)}`} className="shrink-0">
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Download
        </Button>
      </a>
    </div>
  );
}

function TtsTab({ voice, tier }: { voice: Voice; tier: string }) {
  const qc = useQueryClient();
  const { data: credits } = useCreditBalance();
  const { data: modelsData, isLoading: modelsLoading } = useTtsModels();

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
      api.post<{ generation: Generation }>(`/voices/${voice.id}/generate`, {
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
        const p = err.payload as {
          error?: { code?: string; details?: { deficit?: number } };
        };
        if (p.error?.code === "INSUFFICIENT_CREDITS") {
          toast.error(
            `Not enough credits — need ${p.error.details?.deficit ?? "more"} more`,
          );
        } else {
          toast.error("Generation failed. Please try again.");
        }
      }
    },
  });

  return (
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
        <p
          className={`text-xs ${canAfford ? "text-muted-foreground" : "text-destructive"}`}
        >
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
        <InlinePlayer url={result.url} mimeType={result.mimeType} outputFormat={outputFormat} />
      )}
    </div>
  );
}

function S2sTab({ voice, tier }: { voice: Voice; tier: string }) {
  const qc = useQueryClient();
  const { data: modelsData, isLoading: modelsLoading } = useS2sModels();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [modelId, setModelId] = useState("eleven_multilingual_sts_v2");
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [result, setResult] = useState<Generation | null>(null);
  const [dragging, setDragging] = useState(false);

  const selectedModel = modelsData?.models.find((m) => m.modelId === modelId);
  const allowedFormats = OUTPUT_FORMATS.filter((f) =>
    (f.tiers as readonly string[]).includes(tier),
  );

  const convert = useMutation({
    mutationFn: () => {
      if (!audioFile) throw new Error("No audio file selected");
      const form = new FormData();
      form.append("audio", audioFile);
      form.append("modelId", modelId);
      form.append("outputFormat", outputFormat);
      form.append("settings", JSON.stringify(settings));
      return api.postForm<{ generation: Generation }>(
        `/voices/${voice.id}/speech-to-speech`,
        form,
      );
    },
    onSuccess: (data) => {
      setResult(data.generation);
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
      qc.invalidateQueries({ queryKey: ["generations"] });
    },
    onError: () => {
      toast.error("Voice conversion failed. Please try again.");
    },
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setAudioFile(file);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Audio Input</Label>
        <div
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {audioFile ? (
            <div className="flex items-center justify-center gap-3">
              <Mic className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium truncate max-w-[200px]">
                {audioFile.name}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setAudioFile(null);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop audio here or click to upload
              </p>
              <p className="text-xs text-muted-foreground">MP3, WAV, WebM, OGG accepted</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAudioFile(f);
            }}
          />
        </div>
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

      <Button
        className="w-full"
        disabled={!audioFile || convert.isPending}
        onClick={() => convert.mutate()}
      >
        {convert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Convert Voice
      </Button>

      {result && (
        <InlinePlayer url={result.url} mimeType={result.mimeType} outputFormat={outputFormat} />
      )}
    </div>
  );
}

export default function VoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: authData } = useAuth();
  const tier = authData?.user.tier ?? "free";

  const { data, isLoading, error } = useQuery({
    queryKey: ["voices", id],
    queryFn: () => api.get<{ voice: Voice }>(`/voices/${id}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Voice not found</h1>
        <Link href="/app/voices">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to voices
          </Button>
        </Link>
      </div>
    );
  }

  const voice = data.voice;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <Link href="/app/voices">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voices
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{voice.label}</h1>
          <Badge variant={voice.status === "ready" ? "default" : "secondary"}>
            {voice.status}
          </Badge>
        </div>
        {voice.description && (
          <p className="text-sm text-muted-foreground">{voice.description}</p>
        )}
      </div>

      {voice.status !== "ready" ? (
        <p className="text-sm text-muted-foreground">Voice is not ready yet. Please wait.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tts">
              <TabsList className="mb-4">
                <TabsTrigger value="tts">Generate from text</TabsTrigger>
                <TabsTrigger
                  value="s2s"
                  disabled={tier === "free"}
                  title={tier === "free" ? "Upgrade to use Voice Conversion" : undefined}
                >
                  Convert audio
                  {tier === "free" && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      Basic+
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tts">
                <TtsTab voice={voice} tier={tier} />
              </TabsContent>
              <TabsContent value="s2s">
                <S2sTab voice={voice} tier={tier} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
