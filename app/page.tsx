"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageBubble } from "../components/MessageBubble";
import { EmptyState } from "../components/EmptyState";
import { ThinkingIndicator } from "../components/ThinkingIndicator";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "streaming" || status === "submitted";
  const isEmpty = messages.length === 0;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = text ?? input;
      if (!msg.trim()) return;
      sendMessage({ text: msg });
      if (!text) setInput("");
      // Refocus textarea
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [input, sendMessage, setInput]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-sm font-semibold text-foreground">Chat</h1>
        </div>
      </header>

      {/* Message area */}
      {isEmpty ? (
        <EmptyState onSend={handleSend} />
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6"
        >
          <div className="mx-auto max-w-3xl">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isLoading && <ThinkingIndicator />}
          </div>
        </div>
      )}

      {/* Input bar — pinned at bottom */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-2 focus-within:border-border-light transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted outline-none disabled:opacity-50 max-h-40 overflow-y-auto"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="shrink-0 rounded-lg bg-accent p-2 text-white transition-all hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            AI may make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
