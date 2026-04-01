"use client";

export function ThinkingIndicator() {
  return (
    <div className="flex gap-3 mb-6">
      {/* Avatar matching agent avatar */}
      <div className="shrink-0 mt-0.5">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
            <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
          </svg>
        </div>
      </div>

      {/* Animated dots */}
      <div className="flex items-center gap-1 pt-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="thinking-dot inline-block h-2 w-2 rounded-full bg-muted"
            style={{
              animation: "thinking-dot 1.4s ease-in-out infinite",
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
