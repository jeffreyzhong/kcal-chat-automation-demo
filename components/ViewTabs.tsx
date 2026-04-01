"use client";

import type { ViewTab } from "./Sidebar";

export function ViewTabs({
  activeView,
  onViewChange,
}: {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
}) {
  return (
    <div className="shrink-0 flex border-b border-border">
      <button
        onClick={() => onViewChange("chat")}
        className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
          activeView === "chat"
            ? "text-foreground border-b-2 border-accent"
            : "text-muted hover:text-foreground"
        }`}
      >
        Chat
      </button>
      <button
        onClick={() => onViewChange("automations")}
        className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
          activeView === "automations"
            ? "text-foreground border-b-2 border-accent"
            : "text-muted hover:text-foreground"
        }`}
      >
        Automations
      </button>
    </div>
  );
}
