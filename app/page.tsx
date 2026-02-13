import { redirect } from "next/navigation";

export default function RootPage() {
  if (process.env.KNEXCHAT_STANDALONE === "1") {
    redirect("/knexchat/web");
  }
  redirect("/knexit-workspace");
}
