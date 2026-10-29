import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function AccountCell({
  children,
  title,
  onMovements,
  onBalance,
}: {
  children: ReactNode;
  title: string;
  onMovements: () => void;
  onBalance: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const close = (restore = false) => {
    setPosition(null);
    if (restore) trigger.current?.focus();
  };
  const show = () => {
    const rect = trigger.current!.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 218)),
      top:
        rect.bottom + 104 > window.innerHeight
          ? Math.max(8, rect.top - 104)
          : rect.bottom + 4,
    });
  };
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (e: PointerEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setPosition(null);
    };
    const dismiss = () => setPosition(null);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [position]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="cell"
        title={title}
        aria-haspopup="menu"
        aria-expanded={!!position}
        aria-controls={position ? id : undefined}
        onClick={() => (position ? close() : show())}
        onContextMenu={(e) => {
          e.preventDefault();
          show();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        {children}
      </button>
      {position &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label="Opciones de la celda"
            className="account-cell-menu"
            style={position}
            onKeyDown={(e) => {
              const buttons = Array.from(
                menu.current!.querySelectorAll<HTMLButtonElement>("button"),
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close(true);
              } else if (e.key === "Tab") close(true);
              else if (
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
              ) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? buttons.length - 1
                      : (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          buttons.length) %
                        buttons.length;
                buttons[next].focus();
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close(true);
                onMovements();
              }}
            >
              Ver movimientos
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close(true);
                onBalance();
              }}
            >
              Saldo real
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
