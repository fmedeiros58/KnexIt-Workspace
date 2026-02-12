import AuthGuard from "@/components/AuthGuard";
import AccountManagementPageClient from "./AccountManagementPageClient";

export default function AccountManagementPage() {
  return (
    <AuthGuard>
      <AccountManagementPageClient />
    </AuthGuard>
  );
}
