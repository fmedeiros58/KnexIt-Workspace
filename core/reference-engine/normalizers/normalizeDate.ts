import type { DateParts } from "../core/BibliographicSource";

function toDatePartsFromIso(raw: string): DateParts {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (match) {
    return {
      year: match[1],
      month: match[2],
      day: match[3],
      raw: trimmed,
    };
  }

  return { raw: trimmed };
}

export function normalizeDate(date: DateParts | string | undefined): DateParts | undefined {
  if (!date) return undefined;
  if (typeof date === "string") {
    const normalized = date.trim();
    if (!normalized) return undefined;
    return toDatePartsFromIso(normalized);
  }

  const normalized: DateParts = {
    year: date.year?.trim(),
    month: date.month?.trim(),
    day: date.day?.trim(),
    raw: date.raw?.trim(),
  };

  if (!normalized.year && !normalized.month && !normalized.day && !normalized.raw) {
    return undefined;
  }

  return normalized;
}

const ABNT_MONTHS: Record<string, string> = {
  "01": "jan.",
  "02": "fev.",
  "03": "mar.",
  "04": "abr.",
  "05": "maio",
  "06": "jun.",
  "07": "jul.",
  "08": "ago.",
  "09": "set.",
  "10": "out.",
  "11": "nov.",
  "12": "dez.",
};

const APA_MONTHS: Record<string, string> = {
  "01": "January",
  "02": "February",
  "03": "March",
  "04": "April",
  "05": "May",
  "06": "June",
  "07": "July",
  "08": "August",
  "09": "September",
  "10": "October",
  "11": "November",
  "12": "December",
};

export function formatDateForAbnt(date: DateParts | undefined): string {
  if (!date) return "";
  if (date.day && date.month && date.year) {
    const month = ABNT_MONTHS[date.month.padStart(2, "0")] || date.month;
    return `${date.day} ${month} ${date.year}`;
  }
  if (date.month && date.year) {
    const month = ABNT_MONTHS[date.month.padStart(2, "0")] || date.month;
    return `${month} ${date.year}`;
  }
  return date.year || date.raw || "";
}

export function formatDateForApa(date: DateParts | undefined): string {
  if (!date) return "n.d.";
  if (date.year && date.month && date.day) {
    const month = APA_MONTHS[date.month.padStart(2, "0")] || date.month;
    return `${date.year}, ${month} ${date.day}`;
  }
  if (date.year && date.month) {
    const month = APA_MONTHS[date.month.padStart(2, "0")] || date.month;
    return `${date.year}, ${month}`;
  }
  return date.year || "n.d.";
}

