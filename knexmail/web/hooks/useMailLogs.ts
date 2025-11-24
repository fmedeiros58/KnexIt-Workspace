"use client";

import { useEffect, useState } from "react";
import type { MailLog } from "@/lib/knexmail/types";

export function useMailLogs() {
  const [logs, setLogs] = useState<MailLog[]>([]);

  useEffect(() => {
    fetch("/api/knexmail/logs")
      .then((r) => r.json())
      .then((data) => setLogs(data.logs || []))
      .catch(() => {});
  }, []);

  return { logs };
}

