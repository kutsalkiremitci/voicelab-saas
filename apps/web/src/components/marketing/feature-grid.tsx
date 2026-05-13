import { Mic, Sparkles, Languages, Headphones } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Mic,
    title: "Record once, clone forever",
    body: "Capture a clean minute of your voice. Generate hours of natural-sounding audio from text in any tone.",
  },
  {
    icon: Sparkles,
    title: "Studio-grade fidelity",
    body: "Default voices feel real. Pro cloning captures cadence, breath, and inflection — not just timbre.",
  },
  {
    icon: Languages,
    title: "Multilingual by default",
    body: "Speak Turkish today, English tomorrow, Spanish next week — same voice, no extra setup.",
  },
  {
    icon: Headphones,
    title: "Voice Conversion",
    body: "Drop in any audio, hand back the same performance in your voice. Preserve emotion and timing.",
  },
];

export function FeatureGrid() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Everything you need to ship voice</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="h-5 w-5 text-accent" />
                <CardTitle className="mt-3 text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
