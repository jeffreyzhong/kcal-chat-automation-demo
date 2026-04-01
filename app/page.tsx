"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageBubble } from "../components/MessageBubble";
import { EmptyState } from "../components/EmptyState";
import { ThinkingIndicator } from "../components/ThinkingIndicator";
import { Sidebar } from "../components/Sidebar";
import { authClient } from "@/lib/auth/client";

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

export default function Chat() {
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");

  // Load user session
  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/auth/sign-in";
  };

  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: activeConversationIdRef.current }),
      }),
    []
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "streaming" || status === "submitted";
  const isEmpty = messages.length === 0;

  // Load conversations on mount
  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(setConversations);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Refresh conversation list after streaming finishes
  useEffect(() => {
    if (status === "ready" && activeConversationId) {
      fetch("/api/conversations")
        .then((r) => r.json())
        .then(setConversations);
    }
  }, [status, activeConversationId]);

  const loadConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      const msgs = await fetch(`/api/conversations/${id}/messages`).then((r) =>
        r.json()
      );
      const uiMessages = msgs.map(
        (m: { id: string; role: string; parts: unknown[] }) => ({
          id: m.id,
          role: m.role,
          parts: m.parts,
        })
      );
      setMessages(uiMessages);
    },
    [setMessages]
  );

  const createConversation = useCallback(async () => {
    const conv = await fetch("/api/conversations", { method: "POST" }).then(
      (r) => r.json()
    );
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
    setMessages([]);
  }, [setMessages]);

  const deleteConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [activeConversationId, setMessages]
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = text ?? input;
      if (!msg.trim()) return;

      // Auto-create conversation if none active
      if (!activeConversationIdRef.current) {
        const conv = await fetch("/api/conversations", {
          method: "POST",
        }).then((r) => r.json());
        setConversations((prev) => [conv, ...prev]);
        setActiveConversationId(conv.id);
        activeConversationIdRef.current = conv.id;
      }

      sendMessage({ text: msg });
      if (!text) setInput("");
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [input, sendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={loadConversation}
          onNew={createConversation}
          onDelete={deleteConversation}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-foreground flex-1">Chat</h1>
          {userEmail && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{userEmail}</span>
              <button
                onClick={handleSignOut}
                className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </header>

        {/* Message area */}
        {isEmpty ? (
          <EmptyState onSend={handleSend} />
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
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
    </div>
  );
}
