(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canObserve = "IntersectionObserver" in window;

    root.classList.add("reveal-ready");

    const observer = canObserve && !reducedMotion
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.15,
            rootMargin: "0px 0px -5% 0px"
        })
        : null;

    const reveal = (element, animation = "") => {
        if (!(element instanceof HTMLElement) || element.classList.contains("reveal")) return;
        if (element.closest(".gallery-lightbox, .modal-backdrop")) return;

        element.classList.add("reveal");
        if (animation) element.classList.add(animation);

        if (observer) {
            observer.observe(element);
        } else {
            element.classList.add("visible");
        }
    };

    const revealMatches = (scope, selector, animation) => {
        if (scope.matches?.(selector)) reveal(scope, animation);
        scope.querySelectorAll?.(selector).forEach((element) => reveal(element, animation));
    };

    const staggerChildren = (scope, selector, delay = 120) => {
        const groups = new Set();

        if (scope.matches?.(selector)) groups.add(scope.parentElement);
        scope.querySelectorAll?.(selector).forEach((element) => groups.add(element.parentElement));

        groups.forEach((group) => {
            if (!group) return;
            [...group.children]
                .filter((child) => child.matches(selector))
                .forEach((child, index) => {
                    reveal(child, "reveal-up");
                    child.style.setProperty("--reveal-delay", `${Math.min(index, 5) * delay}ms`);
                });
        });
    };

    const prepare = (scope) => {
        if (!(scope instanceof HTMLElement) && scope !== document) return;

        revealMatches(
            scope,
            ".hero, main > section, main > article, .section, .countdown, .form-card, .data-panel, .admin-shortcut-panel, .admin-view, .gallery-header, .gallery-toolbar, .event-footer, .showcase-footer",
            "reveal-up"
        );
        revealMatches(
            scope,
            "h1, h2, h3, .eyebrow, .showcase-kicker, .showcase-lead, [data-event-subtitle], [data-presentation-text]",
            "reveal-up"
        );
        revealMatches(scope, ".showcase-copy, .intro-section .section-text", "reveal-left");
        revealMatches(scope, ".showcase-phone-wrap, .intro-section .image-panel", "reveal-right");
        revealMatches(
            scope,
            "img, .image-panel, .invitation-detail-image, .memories-preview > *, .gallery-grid > *",
            "reveal-zoom"
        );
        revealMatches(
            scope,
            "button, .primary-link, .secondary-link, .secondary-button, .memory-secondary-link, .showcase-button, .page-link, .gallery-back-link",
            ""
        );

        staggerChildren(
            scope,
            ".showcase-benefits article, .style-gallery figure, .showcase-type-grid article, .showcase-final article, .showcase-mini-features > span, .event-details > div, .gallery-grid > *, .memories-preview > *, .message-item, .guest-card",
            120
        );
    };

    prepare(document);

    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) prepare(node);
            });
        });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
})();
