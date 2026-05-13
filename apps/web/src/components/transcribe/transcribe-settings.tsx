"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LanguageCombobox } from "./language-combobox";
import { KeywordChipInput } from "./keyword-chip-input";

export type TranscribeModel = "scribe_v1" | "scribe_v2";

export interface TranscribeSettingsValue {
  model: TranscribeModel;
  languageCode: string | undefined;
  tagAudioEvents: boolean;
  noVerbatim: boolean;
  includeSubtitles: boolean;
  diarize: boolean;
  numSpeakers: number | undefined;
  keyterms: string[];
}

export const DEFAULT_TRANSCRIBE_SETTINGS: TranscribeSettingsValue = {
  model: "scribe_v2",
  languageCode: undefined,
  tagAudioEvents: false,
  noVerbatim: false,
  includeSubtitles: false,
  diarize: false,
  numSpeakers: undefined,
  keyterms: [],
};

interface Props {
  value: TranscribeSettingsValue;
  onChange: (next: TranscribeSettingsValue) => void;
  disabled?: boolean;
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="block cursor-pointer text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function TranscribeSettings({ value, onChange, disabled }: Props) {
  const t = useTranslations();
  const set = (patch: Partial<TranscribeSettingsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t("transcribe.settingsTitle")}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange(DEFAULT_TRANSCRIBE_SETTINGS)}
          disabled={disabled}
        >
          {t("transcribe.reset")}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t("transcribe.model")}</Label>
        <Select
          value={value.model}
          onValueChange={(v) => set({ model: v as TranscribeModel })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scribe_v2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t("transcribe.models.v2.label")}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t("transcribe.models.v2.hint")}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="scribe_v1">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t("transcribe.models.v1.label")}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t("transcribe.models.v1.hint")}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {t("transcribe.models.priceLine", { perMin: 20 })}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t("transcribe.language")}</Label>
        <LanguageCombobox
          value={value.languageCode}
          onChange={(code) => set({ languageCode: code })}
          disabled={disabled}
        />
      </div>

      <div className="divide-y">
        <SwitchRow
          id="tag-audio-events"
          label={t("transcribe.tagAudioEvents")}
          hint={t("transcribe.tagAudioEventsSub")}
          checked={value.tagAudioEvents}
          onChange={(v) => set({ tagAudioEvents: v })}
          disabled={disabled}
        />
        <SwitchRow
          id="include-subtitles"
          label={t("transcribe.includeSubtitles")}
          hint={t("transcribe.includeSubtitlesSub")}
          checked={value.includeSubtitles}
          onChange={(v) => set({ includeSubtitles: v })}
          disabled={disabled}
        />
        <SwitchRow
          id="no-verbatim"
          label={t("transcribe.noVerbatim")}
          hint={t("transcribe.noVerbatimSub")}
          checked={value.noVerbatim}
          onChange={(v) => set({ noVerbatim: v })}
          disabled={disabled}
        />
        <SwitchRow
          id="diarize"
          label={t("transcribe.diarize")}
          hint={t("transcribe.diarizeSub")}
          checked={value.diarize}
          onChange={(v) => set({ diarize: v, numSpeakers: v ? value.numSpeakers : undefined })}
          disabled={disabled}
        />
      </div>

      {value.diarize && (
        <div className="space-y-1.5">
          <Label htmlFor="num-speakers" className="text-sm font-medium">
            {t("transcribe.numSpeakers")}
          </Label>
          <Input
            id="num-speakers"
            type="number"
            min={1}
            max={32}
            placeholder={t("transcribe.numSpeakersPlaceholder")}
            value={value.numSpeakers ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : Number(e.target.value);
              set({ numSpeakers: v && Number.isFinite(v) ? Math.min(32, Math.max(1, v)) : undefined });
            }}
            disabled={disabled}
            className="h-9 w-32"
          />
        </div>
      )}

      <KeywordChipInput
        value={value.keyterms}
        onChange={(next) => set({ keyterms: next })}
        disabled={disabled}
      />
    </div>
  );
}
