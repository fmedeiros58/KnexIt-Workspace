"use client";

import { useEffect, useState } from "react";
import type { MailCampaign } from "@/lib/knexmail/types";

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<MailCampaign[]>([]);

  useEffect(() => {
    fetch("/api/knexmail/campaigns")
      .then((r) => r.json())
      .then((data) => setCampaigns(data.campaigns || []))
      .catch(() => {});
  }, []);

  const save = async (camp: MailCampaign) => {
    await fetch("/api/knexmail/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(camp),
    });
    setCampaigns((prev) => {
      const idx = prev.findIndex((c) => c.id === camp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = camp;
        return next;
      }
      return [...prev, camp];
    });
  };

  return { campaigns, save };
}

