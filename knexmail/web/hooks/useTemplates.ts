"use client";

import { useEffect, useState } from "react";
import type { MailTemplate } from "@/lib/knexmail/types";

export function useTemplates() {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);

  useEffect(() => {
    fetch("/api/knexmail/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const save = async (tmpl: MailTemplate) => {
    await fetch("/api/knexmail/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tmpl),
    });
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === tmpl.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tmpl;
        return next;
      }
      return [...prev, tmpl];
    });
  };

  return { templates, save };
}

