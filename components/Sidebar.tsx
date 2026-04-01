"use client";

import { ViewTabs } from "./ViewTabs";

export type ViewTab = "chat" | "automations";

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  activeView,
  onViewChange,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
}) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-[#141414]">
      <ViewTabs activeView={activeView} onViewChange={onViewChange} />

      {activeView === "chat" && (
        <>
          {/* New chat button */}
          <div className="p-3">
            <button
              onClick={onNew}
              className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New chat
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                  c.id === activeId
                    ? "bg-surface text-foreground"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
                onClick={() => onSelect(c.id)}
              >
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 ml-1 p-1 rounded text-muted hover:text-red-400 transition-all"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
