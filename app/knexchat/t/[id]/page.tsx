import { redirect } from "next/navigation";

export default function KnexchatThreadPage({ params }: { params: { id: string } }) {
  const threadId = encodeURIComponent(params.id);
  redirect(`/knexchat/web?thread=${threadId}`);
}
