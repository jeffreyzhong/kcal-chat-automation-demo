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
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="9" cy="16" r="1" fill="white" stroke="none" />
            <circle cx="15" cy="16" r="1" fill="white" stroke="none" />
            <path d="M12 2v4" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
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
