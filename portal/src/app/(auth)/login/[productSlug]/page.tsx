import { redirect } from "next/navigation";
import LoginPageClient from "../LoginPageClient";
import { getProduct } from "../../../lib/products";

type ProductLoginPageProps = {
  params: {
    productSlug: string;
  };
};

export default function ProductLoginPage({ params }: ProductLoginPageProps) {
  const normalizedSlug = params.productSlug?.toLowerCase();
  const product = getProduct(normalizedSlug);
  if (!product) {
    redirect("/login");
    return null;
  }
  return <LoginPageClient routeProductSlug={product.slug} />;
}
