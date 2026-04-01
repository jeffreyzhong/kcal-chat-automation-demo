"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getToolName, isToolUIPart } from "ai";
import { ToolCallDisplay } from "./ToolCallDisplay";
import type { UIMessage } from "ai";

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  // Collect tool parts to group them
  const toolParts = message.parts.filter((p) => isToolUIPart(p));
  const textParts = message.parts.filter((p) => p.type === "text");
  const hasTools = toolParts.length > 0;

  if (isUser) {
    const text = textParts.map((p) => (p as { text: string }).text).join("");
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-user-bubble px-4 py-2.5 text-user-bubble-text text-[0.9375rem] leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  // Agent message
  return (
    <div className="flex gap-3 mb-6">
      {/* Avatar */}
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

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Tool calls grouped at top */}
        {hasTools && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {toolParts.map((part, i) => {
              const toolPart = part as {
                input: unknown;
                output?: unknown;
              };
              return (
                <ToolCallDisplay
                  key={i}
                  toolName={getToolName(part)}
                  input={toolPart.input}
                  output={toolPart.output}
                  isLoading={toolPart.output == null}
                />
              );
            })}
          </div>
        )}

        {/* Text content with markdown */}
        {textParts.map((part, i) => {
          const text = (part as { text: string }).text;
          if (!text.trim()) return null;
          return (
            <div key={i} className="prose-chat text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          );
        })}
      </div>
    </div>
  );
}
