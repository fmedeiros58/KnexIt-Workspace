import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AccessPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function AccessPage({ searchParams = {} }: AccessPageProps) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) params.append(key, item);
      });
      return;
    }
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  redirect(`/knexit-workspace/acesso/email${query ? `?${query}` : ""}`);
}
