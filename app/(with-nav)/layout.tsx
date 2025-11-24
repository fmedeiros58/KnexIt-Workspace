// app/(with-nav)/layout.tsx
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "KnexIT",
};

export default function WithNavLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: "var(--header-h, 0px)" }}>{children}</main>
    </>
  );
}
