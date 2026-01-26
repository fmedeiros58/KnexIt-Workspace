import { Suspense } from "react";

import KnexChatPage from "../../../../knexchat/web/page";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <KnexChatPage />
    </Suspense>
  );
}
