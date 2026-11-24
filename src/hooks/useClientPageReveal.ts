import { useEffect } from "react";

export default function useClientPageReveal(
  pageSelector: string,
  replayOnScroll = false,
) {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(pageSelector);
    if (
      !page ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            if (!replayOnScroll) currentObserver.unobserve(entry.target);
            return;
          }

          const leftViewport =
            entry.boundingClientRect.bottom <= 0 ||
            entry.boundingClientRect.top >= window.innerHeight;
          if (replayOnScroll && leftViewport) {
            entry.target.classList.remove("is-visible");
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const observeNewElements = () => {
      page.querySelectorAll<HTMLElement>("[data-client-reveal]").forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        observer.observe(element);
      });
    };

    page.classList.add("client-reveal-ready");
    observeNewElements();
    const mutations = new MutationObserver(observeNewElements);
    mutations.observe(page, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      page.classList.remove("client-reveal-ready");
    };
  }, [pageSelector, replayOnScroll]);
}
