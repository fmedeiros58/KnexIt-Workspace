import { redirect } from "next/navigation";
import { getProduct } from "@/lib/products";

type LoginProductPageProps = {
  params: { productSlug: string };
};

export const dynamic = "force-dynamic";

export default function LoginProductPage({ params }: LoginProductPageProps) {
  const fallback = "/knexit-workspace/acesso?stay=1";
  const product = getProduct(params.productSlug);
  if (!product) {
    redirect(fallback);
  }
  const paramsQuery = new URLSearchParams();
  paramsQuery.set("returnTo", product.homePath);
  if (product.slug === "knexchat") {
    redirect(`/knexit-workspace/acesso/novo?${paramsQuery.toString()}`);
  }
  redirect(`/knexit-workspace/acesso?${paramsQuery.toString()}`);
}
