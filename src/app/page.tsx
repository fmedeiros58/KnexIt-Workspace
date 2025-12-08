import { redirect } from "next/navigation";

// Rota raiz pública do portal deployado na Vercel.
// Ao acessar "/", o usuário é redirecionado diretamente para o produto SupaDrive.
// As rotas de login continuam funcionando em /login e /login/[productSlug].
export default function RootPage() {
  redirect("/supadrive");
}
