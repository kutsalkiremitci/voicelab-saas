import { mock } from "bun:test";

export type MockClient = {
  voices: {
    ivc: { create: ReturnType<typeof mock> };
    pvc: { create: ReturnType<typeof mock> };
    delete: ReturnType<typeof mock>;
  };
  textToSpeech: { convertWithRawResponse: ReturnType<typeof mock> };
  speechToSpeech: { convertWithRawResponse: ReturnType<typeof mock> };
  user: { subscription: { get: ReturnType<typeof mock> } };
};

export function mockElevenLabsClient(): MockClient {
  return {
    voices: {
      ivc: { create: mock(async () => ({ voiceId: "mock-ivc-id" })) },
      pvc: { create: mock(async () => ({ voiceId: "mock-pvc-id" })) },
      delete: mock(async () => undefined),
    },
    textToSpeech: {
      convertWithRawResponse: mock(async () => ({
        headers: new Headers({ "x-character-count": "42" }),
        data: new Response(new Uint8Array([0xff, 0xfb])).body!,
      })),
    },
    speechToSpeech: {
      convertWithRawResponse: mock(async () => ({
        headers: new Headers({ "x-character-count": "500" }),
        data: new Response(new Uint8Array([0xff, 0xfb])).body!,
      })),
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
  };
}
