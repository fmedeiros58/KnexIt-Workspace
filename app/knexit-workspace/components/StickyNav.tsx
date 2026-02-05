"use client";

import { useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string;
};

type StickyNavProps = {
  items: NavItem[];
};

export default function StickyNav({ items }: StickyNavProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />
      <section className={`sticky top-0 z-20 py-3 ${isStuck ? "bg-transparent" : "bg-[#E5F3F4]"}`}>
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <nav className="mx-auto w-full max-w-4xl rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <ul className="flex flex-wrap items-center justify-center gap-2">
              {items.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-slate-600 no-underline transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </>
  );
}
