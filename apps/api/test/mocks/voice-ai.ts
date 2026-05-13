import { mock } from "bun:test";

export type MockClient = {
  voices: {
    ivc: { create: ReturnType<typeof mock> };
    pvc: { create: ReturnType<typeof mock> };
    delete: ReturnType<typeof mock>;
  };
  textToSpeech: { convert: ReturnType<typeof mock> };
  speechToSpeech: { convert: ReturnType<typeof mock> };
  user: { subscription: { get: ReturnType<typeof mock> } };
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
  };
}
