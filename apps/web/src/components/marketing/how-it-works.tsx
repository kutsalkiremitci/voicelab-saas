const STEPS = [
  {
    n: "1",
    title: "Sign up, verify, get 1,000 credits",
    body: "Email confirmation activates your account and unlocks the free trial.",
  },
  {
    n: "2",
    title: "Record or pick a voice",
    body: "Use the in-browser studio to capture your voice, or start from the curated catalog.",
  },
  {
    n: "3",
    title: "Generate, download, ship",
    body: "Type or paste text, tweak the voice settings, hand the MP3 to your editor.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm font-semibold">
                {s.n}
              </span>
              <h3 className="text-lg font-medium tracking-tight">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
