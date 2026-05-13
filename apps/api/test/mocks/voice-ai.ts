import { mock } from "bun:test";
import type { UpstreamModel } from "../../src/services/voice-ai";

export type MockClient = {
  voices: {
    ivc: { create: ReturnType<typeof mock> };
    pvc: { create: ReturnType<typeof mock> };
    delete: ReturnType<typeof mock>;
  };
  textToSpeech: { convert: ReturnType<typeof mock> };
  speechToSpeech: { convert: ReturnType<typeof mock> };
  user: { subscription: { get: ReturnType<typeof mock> } };
  models: { list: ReturnType<typeof mock> };
};

function makeAudioResponse(charCount: string) {
  return {
    withRawResponse: async () => ({
      data: new Response(new Uint8Array([0xff, 0xfb])).body!,
      rawResponse: {
        headers: new Headers({ "x-character-count": charCount }),
      },
    }),
  };
}

export function mockModels(): UpstreamModel[] {
  return [
    {
      modelId: "eleven_multilingual_v2",
      name: "Eleven Multilingual v2",
      description: "Mock TTS model",
      canDoTextToSpeech: true,
      canDoVoiceConversion: false,
      canBeFinetuned: false,
      canUseStyle: true,
      canUseSpeakerBoost: true,
      servesProVoices: false,
      requiresAlphaAccess: false,
      tokenCostFactor: 1,
      maxCharactersRequestFreeUser: 2500,
      maxCharactersRequestSubscribedUser: 5000,
      maximumTextLengthPerRequest: 5000,
      languages: [{ languageId: "en", name: "English" }],
    },
    {
      modelId: "eleven_turbo_v2_5",
      name: "Eleven Turbo v2.5",
      description: "Mock fast TTS model",
      canDoTextToSpeech: true,
      canDoVoiceConversion: false,
      canBeFinetuned: false,
      canUseStyle: false,
      canUseSpeakerBoost: true,
      servesProVoices: false,
      requiresAlphaAccess: false,
      tokenCostFactor: 0.5,
      maxCharactersRequestFreeUser: 2500,
      maxCharactersRequestSubscribedUser: 5000,
      maximumTextLengthPerRequest: 5000,
      languages: [{ languageId: "en", name: "English" }],
    },
    {
      modelId: "eleven_multilingual_sts_v2",
      name: "Eleven Multilingual STS v2",
      description: "Mock S2S model",
      canDoTextToSpeech: false,
      canDoVoiceConversion: true,
      canBeFinetuned: false,
      canUseStyle: false,
      canUseSpeakerBoost: false,
      servesProVoices: false,
      requiresAlphaAccess: false,
      tokenCostFactor: 1,
      maxCharactersRequestFreeUser: 0,
      maxCharactersRequestSubscribedUser: 0,
      maximumTextLengthPerRequest: 0,
      languages: [{ languageId: "en", name: "English" }],
    },
  ];
}

export function mockElevenLabsClient(): MockClient {
  const tts = mock((_voiceId: string, _body: unknown) => makeAudioResponse("42"));
  const s2s = mock((_voiceId: string, _body: unknown) => makeAudioResponse("500"));

  return {
    voices: {
      ivc: { create: mock(async () => ({ voiceId: "mock-ivc-id" })) },
      pvc: { create: mock(async () => ({ voiceId: "mock-pvc-id" })) },
      delete: mock(async () => undefined),
    },
    textToSpeech: { convert: tts },
    speechToSpeech: { convert: s2s },
    user: {
      subscription: {
        get: mock(async () => ({
          tier: "starter",
          characterCount: 0,
          characterLimit: 30000,
          voiceLimit: 10,
          voiceUsed: 0,
          canExtendCharacterLimit: false,
          nextCharacterCountResetUnix:
            Math.floor(Date.now() / 1000) + 86400 * 30,
        })),
      },
    },
    models: {
      list: mock(async () => mockModels()),
    },
  };
}
