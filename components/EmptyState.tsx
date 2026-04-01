"use client";

const suggestions = [
  "Summarize my latest email",
  "Star a repo on GitHub",
  "What's on my calendar this week?",
  "Create a GitHub issue",
];

export function EmptyState({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
      {/* Icon */}
      <div className="mb-6 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-border flex items-center justify-center">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-violet-400"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">
        How can I help?
      </h2>
      <p className="text-muted text-sm mb-8 text-center max-w-md">
        I can connect to your apps and take actions on your behalf.
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover hover:border-border-light"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
