"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { UpstreamModel } from "@/hooks/use-models";

export type VoiceSettings = {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 1.0,
};

type Props = {
  settings: VoiceSettings;
  onChange: (s: VoiceSettings) => void;
  model: UpstreamModel | undefined;
};

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.toFixed(2)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v!)}
        disabled={disabled}
        className={disabled ? "opacity-40" : undefined}
      />
    </div>
  );
}

export function VoiceSettingsPanel({ settings, onChange, model }: Props) {
  const set = (patch: Partial<VoiceSettings>) =>
    onChange({ ...settings, ...patch });

  const styleDisabled = model ? !model.canUseStyle : false;
  const speakerBoostDisabled = model ? !model.canUseSpeakerBoost : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Voice Settings</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange(DEFAULT_VOICE_SETTINGS)}
        >
          Reset to defaults
        </Button>
      </div>

      <SliderRow
        label="Stability"
        value={settings.stability}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => set({ stability: v })}
      />
      <SliderRow
        label="Similarity Boost"
        value={settings.similarityBoost}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => set({ similarityBoost: v })}
      />
      <SliderRow
        label="Style"
        value={settings.style}
        min={0}
        max={1}
        step={0.01}
        disabled={styleDisabled}
        onChange={(v) => set({ style: v })}
      />
      <SliderRow
        label="Speed"
        value={settings.speed}
        min={0.7}
        max={1.2}
        step={0.05}
        onChange={(v) => set({ speed: v })}
      />

      <div className="flex items-center justify-between">
        <Label
          htmlFor="speaker-boost"
          className={`text-sm text-muted-foreground ${speakerBoostDisabled ? "opacity-40" : ""}`}
        >
          Speaker Boost
        </Label>
        <Switch
          id="speaker-boost"
          checked={settings.useSpeakerBoost}
          onCheckedChange={(v) => set({ useSpeakerBoost: v })}
          disabled={speakerBoostDisabled}
        />
      </div>
    </div>
  );
}
