import { describe, expect, test } from "bun:test";
import type { TranscribedWord } from "@voicelab/db/schema";
import {
  buildSegments,
  formatSrtTime,
  formatVttTime,
  renderSrt,
  renderVtt,
  renderTxt,
  renderSegmentedJson,
  srtToVtt,
} from "../../src/lib/srt-vtt";

const W = (text: string, start: number, end: number, extra: Partial<TranscribedWord> = {}): TranscribedWord => ({
  text,
  start,
  end,
  type: "word",
  ...extra,
});

describe("formatSrtTime / formatVttTime", () => {
  test("zero → 00:00:00,000", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
    expect(formatVttTime(0)).toBe("00:00:00.000");
  });

  test("65.123 seconds → 00:01:05,123", () => {
    expect(formatSrtTime(65.123)).toBe("00:01:05,123");
    expect(formatVttTime(65.123)).toBe("00:01:05.123");
  });

  test("negative clamps to zero", () => {
    expect(formatSrtTime(-1)).toBe("00:00:00,000");
  });
});

describe("buildSegments", () => {
  test("groups words across small gaps until silence threshold", () => {
    const words: TranscribedWord[] = [
      W("Hello", 0, 0.4),
      W(" ", 0.4, 0.5, { type: "spacing" }),
      W("world", 0.5, 0.9),
      W(" ", 0.9, 1.5, { type: "spacing" }),
      W("Goodbye", 1.5, 2.1),
    ];
    const segments = buildSegments(words, { silenceGapSec: 0.4 });
    expect(segments.length).toBe(2);
    expect(segments[0]!.text.startsWith("Hello")).toBe(true);
    expect(segments[1]!.text.startsWith("Goodbye")).toBe(true);
  });

  test("speaker change starts a new segment", () => {
    const words: TranscribedWord[] = [
      W("Alice", 0, 0.4, { speakerId: "speaker_0" }),
      W("speaks.", 0.5, 1.0, { speakerId: "speaker_0" }),
      W("Bob", 1.1, 1.4, { speakerId: "speaker_1" }),
    ];
    const segments = buildSegments(words);
    expect(segments.length).toBe(2);
    expect(segments[0]!.speakerLabel).toBe("Speaker 1");
    expect(segments[1]!.speakerLabel).toBe("Speaker 2");
  });

  test("custom speaker names override fallbacks", () => {
    const words: TranscribedWord[] = [
      W("Hi", 0, 0.4, { speakerId: "speaker_0" }),
      W("Hello", 0.5, 1.0, { speakerId: "speaker_1" }),
    ];
    const segments = buildSegments(words, {
      speakerNames: { speaker_0: "Alice", speaker_1: "Bob" },
    });
    expect(segments[0]!.speakerLabel).toBe("Alice");
    expect(segments[1]!.speakerLabel).toBe("Bob");
  });

  test("audio_event breaks its own segment", () => {
    const words: TranscribedWord[] = [
      W("Hi", 0, 0.4),
      W("(laughter)", 0.5, 1.0, { type: "audio_event" }),
      W("there", 1.1, 1.4),
    ];
    const segments = buildSegments(words);
    expect(segments.length).toBe(3);
    expect(segments[1]!.text).toContain("laughter");
  });
});

describe("renderSrt / renderVtt / renderTxt", () => {
  const words: TranscribedWord[] = [
    W("Hello", 0, 0.4),
    W(" ", 0.4, 0.5, { type: "spacing" }),
    W("world.", 0.5, 1.0),
  ];

  test("renderSrt produces numbered cues with comma timecodes", () => {
    const segs = buildSegments(words);
    const out = renderSrt(segs);
    expect(out).toContain("1\n00:00:00,000 --> 00:00:01,000");
    expect(out).toContain("Hello world.");
  });

  test("renderVtt starts with WEBVTT header and uses dot timecodes", () => {
    const segs = buildSegments(words);
    const out = renderVtt(segs);
    expect(out.startsWith("WEBVTT")).toBe(true);
    expect(out).toContain("00:00:00.000 --> 00:00:01.000");
  });

  test("renderTxt outputs plain lines", () => {
    const segs = buildSegments(words);
    expect(renderTxt(segs).trim()).toBe("Hello world.");
  });

  test("renderSegmentedJson includes timing + speaker", () => {
    const segs = buildSegments(
      [
        W("Hi", 0, 0.4, { speakerId: "speaker_0" }),
        W("Hello", 0.5, 1.0, { speakerId: "speaker_1" }),
      ],
      { speakerNames: { speaker_0: "Alice" } },
    );
    const json = renderSegmentedJson(segs);
    expect(json.segments[0]!.speaker).toBe("Alice");
    expect(json.segments[1]!.speakerId).toBe("speaker_1");
  });

  test("srtToVtt converts comma to dot and adds WEBVTT header", () => {
    const srt = "1\n00:00:00,000 --> 00:00:01,500\nHello\n";
    const vtt = srtToVtt(srt);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500");
  });
});
