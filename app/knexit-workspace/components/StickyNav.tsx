"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string;
};

type StickyNavProps = {
  items: NavItem[];
};

type ScrollRoot = Element | Window;

export default function StickyNav({ items }: StickyNavProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<ScrollRoot | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [isStuck, setIsStuck] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeHref, setActiveHref] = useState(items[0]?.href ?? "");
  const stickyBackdropClassName = isStuck ? "before:bg-transparent" : "before:bg-[#E5F3F4]";

  const getScrollRoot = useCallback(() => {
    if (scrollRootRef.current) return scrollRootRef.current;
    const start = sentinelRef.current;
    let current = start?.parentElement ?? null;
    while (current && current !== document.body) {
      const overflowY = getComputedStyle(current).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollRootRef.current = current;
        return current;
      }
      current = current.parentElement;
    }
    scrollRootRef.current = window;
    return window;
  }, []);

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    setHasOverflow(maxScrollLeft > 1);
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft < maxScrollLeft - 1);
  }, []);

  const handleScrollClick = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    const amount = Math.max(140, Math.round(container.clientWidth * 0.6));
    container.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

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

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    updateScrollState();
    const handleScroll = () => updateScrollState();
    container.addEventListener("scroll", handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(container);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [items.length, updateScrollState]);

  useEffect(() => {
    if (!items.length) return;
    setActiveHref(items[0]?.href ?? "");
  }, [items]);

  useEffect(() => {
    if (!items.length) return;
    const root = getScrollRoot();
    const resolveActive = () => {
      const rootTop = root instanceof Element ? root.getBoundingClientRect().top : 0;
      const navHeight = navRef.current?.getBoundingClientRect().height ?? 0;
      const offsetTop = navHeight + 12;
      const sections = items
        .map((item) => ({ href: item.href, element: document.querySelector(item.href) }))
        .filter((entry): entry is { href: string; element: Element } => Boolean(entry.element));

      if (!sections.length) return;

      let currentHref = sections[0].href;
      for (const section of sections) {
        const top = section.element.getBoundingClientRect().top - rootTop;
        if (top <= offsetTop) {
          currentHref = section.href;
        }
      }

      setActiveHref((prev) => (prev === currentHref ? prev : currentHref));
    };

    const handleScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        resolveActive();
      });
    };

    resolveActive();
    if (root instanceof Element) {
      root.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      window.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("resize", handleScroll);

    return () => {
      if (root instanceof Element) {
        root.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("resize", handleScroll);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [getScrollRoot, items]);

  const scrollPaddingClassName = hasOverflow ? "px-9" : "px-2";
  const leftArrowClassName = hasOverflow && canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none";
  const rightArrowClassName = hasOverflow && canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none";

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />
      <section
        className={`sticky top-0 z-20 py-3 relative hidden min-[600px]:block before:pointer-events-none before:absolute before:inset-0 before:z-0 before:transition-[background-color] before:content-[''] ${stickyBackdropClassName}`}
      >
        <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-6">
          <nav
            ref={navRef}
            className="relative mx-auto w-fit max-w-[min(92vw,56rem)] overflow-hidden rounded-full border border-slate-200 bg-[#FAFBFA] px-2 py-1 shadow-md"
          >
            <button
              type="button"
              onClick={() => handleScrollClick("left")}
              className={`absolute left-2 top-1/2 z-10 -translate-y-1/2 p-1 text-slate-500 transition hover:text-slate-700 ${leftArrowClassName}`}
              aria-label="Rolagem para a esquerda"
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                <path
                  d="M9.59 2.09 3.68 8l5.91 5.91L8 15.5.5 8 8 .5l1.59 1.59Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <div ref={scrollRef} className={`no-scrollbar min-w-0 overflow-x-auto scroll-smooth ${scrollPaddingClassName}`}>
              <ul className="mx-auto flex w-fit min-w-max flex-nowrap items-center gap-2 py-0.5">
                {items.map((item) => (
                  <li key={item.href} className="shrink-0">
                    <a
                      href={item.href}
                      className={`inline-flex items-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium no-underline transition hover:no-underline ${
                        activeHref === item.href
                          ? "bg-slate-200/80 text-slate-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      aria-current={activeHref === item.href ? "location" : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => handleScrollClick("right")}
              className={`absolute right-2 top-1/2 z-10 -translate-y-1/2 p-1 text-slate-500 transition hover:text-slate-700 ${rightArrowClassName}`}
              aria-label="Rolagem para a direita"
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                <path
                  d="M.41 2.09 6.32 8 .41 13.91 2 15.5 9.5 8 2 .5.41 2.09Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </nav>
        </div>
      </section>
    </>
  );
}
