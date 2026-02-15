import { redirect } from "next/navigation";
import { getProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

type LoginPageRouteProps = {
  searchParams: {
    from?: string;
    product?: string;
    redirect?: string;
    next?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageRouteProps) {
  const fallback = "/knexit-workspace/acesso?stay=1";
  const returnTo = searchParams.redirect ?? searchParams.from ?? searchParams.next ?? null;
  const productSlug = searchParams.product ?? null;
  const product = productSlug ? getProduct(productSlug) : null;
  const target = returnTo || product?.homePath || null;

  if (!target) {
    redirect(fallback);
  }

  const params = new URLSearchParams();
  params.set("returnTo", target);
  redirect(`/knexit-workspace/acesso?${params.toString()}`);
}
