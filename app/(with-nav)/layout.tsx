// app/(with-nav)/layout.tsx
import type { Metadata } from "next";
import Nav from "@/components/Nav"; // mantém o import do seu componente

export const metadata: Metadata = {
  title: "Knexit",
};

export default function WithNavLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {/* Se você usa offset do Nav, mantenha seu padding aqui */}
      <main style={{ paddingTop: "var(--header-h, 0px)" }}>{children}</main>
    </>
  );
}
