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
  speechToText: { convert: ReturnType<typeof mock> };
  user: { subscription: { get: ReturnType<typeof mock> } };
  models: { list: ReturnType<typeof mock> };
};

export interface MockTranscribeWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "audio_event";
  speakerId?: string;
  logprob?: number;
}

export interface MockTranscribeResponse {
  languageCode: string;
  languageProbability: number;
  text: string;
  words: MockTranscribeWord[];
  audioDurationSecs: number;
  additionalFormats: Array<{
    requestedFormat: string;
    fileExtension: string;
    contentType: string;
    isBase64Encoded: boolean;
    content: string;
  }>;
}

export function makeMockTranscribeResponse(
  overrides: Partial<MockTranscribeResponse> = {},
): MockTranscribeResponse {
  return {
    languageCode: "en",
    languageProbability: 0.98,
    text: "Mock transcription output.",
    words: [
      { text: "Mock", start: 0, end: 0.4, type: "word", logprob: -0.1 },
      { text: " ", start: 0.4, end: 0.5, type: "spacing" },
      { text: "transcription", start: 0.5, end: 1.2, type: "word", logprob: -0.05 },
      { text: " ", start: 1.2, end: 1.3, type: "spacing" },
      { text: "output.", start: 1.3, end: 2.0, type: "word", logprob: -0.08 },
    ],
    audioDurationSecs: 2.0,
    additionalFormats: [],
    ...overrides,
  };
}

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
    speechToText: {
      convert: mock(async (_body: { additionalFormats?: Array<{ format: string }> }) => {
        const requested = _body?.additionalFormats ?? [];
        return makeMockTranscribeResponse({
          additionalFormats: requested.map((f) => {
            const fmt = f.format;
            if (fmt === "pdf" || fmt === "docx") {
              return {
                requestedFormat: fmt,
                fileExtension: fmt,
                contentType:
                  fmt === "pdf"
                    ? "application/pdf"
                    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                isBase64Encoded: true,
                content: Buffer.from(`mock-${fmt}-bytes`).toString("base64"),
              };
            }
            if (fmt === "html") {
              return {
                requestedFormat: fmt,
                fileExtension: "html",
                contentType: "text/html",
                isBase64Encoded: false,
                content: "<html><body>mock</body></html>",
              };
            }
            if (fmt === "srt") {
              return {
                requestedFormat: fmt,
                fileExtension: "srt",
                contentType: "application/x-subrip",
                isBase64Encoded: false,
                content: "1\n00:00:00,000 --> 00:00:02,000\nMock transcription output.\n",
              };
            }
            if (fmt === "txt") {
              return {
                requestedFormat: fmt,
                fileExtension: "txt",
                contentType: "text/plain",
                isBase64Encoded: false,
                content: "Mock transcription output.\n",
              };
            }
            if (fmt === "segmented_json") {
              return {
                requestedFormat: fmt,
                fileExtension: "json",
                contentType: "application/json",
                isBase64Encoded: false,
                content: JSON.stringify({ segments: [] }),
              };
            }
            return {
              requestedFormat: fmt,
              fileExtension: fmt,
              contentType: "text/plain",
              isBase64Encoded: false,
              content: "",
            };
          }),
        });
      }),
    },
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
