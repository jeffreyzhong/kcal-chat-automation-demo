/**
 * Convert a cron expression to a human-readable string.
 * Handles common patterns; falls back to raw expression for unusual ones.
 */
export function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dom, month, dow] = parts;

  // Every N minutes: */N * * * *
  if (minute.startsWith("*/") && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    const n = parseInt(minute.slice(2), 10);
    if (n === 1) return "Every minute";
    return `Every ${n} min`;
  }

  // Every N hours: 0 */N * * *
  if (minute === "0" && hour.startsWith("*/") && dom === "*" && month === "*" && dow === "*") {
    const n = parseInt(hour.slice(2), 10);
    if (n === 1) return "Every hour";
    return `Every ${n} hours`;
  }

  // Every hour: 0 * * * *  or  M * * * *
  if (hour === "*" && dom === "*" && month === "*" && dow === "*" && !minute.includes("/") && !minute.includes(",")) {
    return "Every hour";
  }

  // Specific time patterns
  if (dom === "*" && month === "*" && !minute.includes("/") && !minute.includes(",") && !hour.includes("/") && !hour.includes(",") && hour !== "*") {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const time = formatTime(h, m);

    if (dow === "*") return `Daily at ${time}`;
    if (dow === "1-5") return `Weekdays at ${time}`;
    if (dow === "0,6") return `Weekends at ${time}`;
    if (dow === "1") return `Mondays at ${time}`;
    if (dow === "0") return `Sundays at ${time}`;

    const dayNames: Record<string, string> = {
      "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed",
      "4": "Thu", "5": "Fri", "6": "Sat",
    };

    // Single day: 0-6
    if (/^[0-6]$/.test(dow)) return `${dayNames[dow]}s at ${time}`;

    // Comma-separated days
    if (/^[0-6](,[0-6])+$/.test(dow)) {
      const days = dow.split(",").map((d) => dayNames[d]).join(", ");
      return `${days} at ${time}`;
    }

    return `${dow} at ${time}`;
  }

  return cron;
}

function formatTime(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${h12} ${period}`;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}
