"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type UpstreamModel = {
  modelId: string;
  name: string;
  description: string;
  canDoTextToSpeech: boolean;
  canDoVoiceConversion: boolean;
  canUseStyle: boolean;
  canUseSpeakerBoost: boolean;
  requiresAlphaAccess: boolean;
  maximumTextLengthPerRequest: number;
};

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => api.get<{ models: UpstreamModel[] }>("/models"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTtsModels() {
  const { data, ...rest } = useModels();
  return {
    ...rest,
    data: data
      ? {
          ...data,
          models: data.models.filter(
            (m) => m.canDoTextToSpeech && !m.requiresAlphaAccess,
          ),
        }
      : undefined,
  };
}

export function useS2sModels() {
  const { data, ...rest } = useModels();
  return {
    ...rest,
    data: data
      ? {
          ...data,
          models: data.models.filter(
            (m) => m.canDoVoiceConversion && !m.requiresAlphaAccess,
          ),
        }
      : undefined,
  };
}
