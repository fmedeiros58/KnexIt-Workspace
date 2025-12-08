"use client";

import { useEffect, useState } from "react";

type MailEnvStatus = {
  provider: string | null;
  configured: boolean;
};

export function useKnexMailEnv() {
  const [status, setStatus] = useState<MailEnvStatus>({ provider: null, configured: false });

  useEffect(() => {
    fetch("/api/knexmail/status")
      .then((r) => r.json())
      .then((data) => setStatus({ provider: data.provider || null, configured: !!data.configured }))
      .catch(() => {});
  }, []);

  return status;
}

