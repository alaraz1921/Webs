import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
const years = Array.from({ length: 101 }, (_, i) => 2100 - i);
export function YearPicker({
  value,
  disabled = false,
  onChange,
  label = "Ejercicio",
}: {
  value: number;
  disabled?: boolean;
  onChange: (year: number) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(value);
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const id = useId();
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) button.current?.focus();
  };
  const expand = () => {
    if (!disabled) {
      setActive(value);
      typed.current.text = "";
      setOpen(true);
    }
  };
  const choose = (year: number) => {
    onChange(year);
    close(true);
  };
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (!open || !list.current) return;
    const option = document.getElementById(`${id}-${active}`);
    if (option)
      list.current.scrollTop =
        option.offsetTop -
        (list.current.clientHeight - option.offsetHeight) / 2;
  }, [open, active, id]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = years.indexOf(active);
    const steps: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 5,
      PageUp: -5,
    };
    if (event.key in steps) {
      event.preventDefault();
      setActive(
        years[
          Math.max(0, Math.min(years.length - 1, index + steps[event.key]))
        ],
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? years[0] : years[years.length - 1]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") close();
    else if (/^\d$/.test(event.key)) {
      event.preventDefault();
      const now = Date.now();
      typed.current.text =
        now - typed.current.at > 1000
          ? event.key
          : typed.current.text + event.key;
      typed.current.at = now;
      const found = years.find((y) => String(y).startsWith(typed.current.text));
      if (found !== undefined) setActive(found);
    }
  };
  return (
    <div
      className="field year-picker"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) close();
      }}
    >
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={button}
        type="button"
        className="year-trigger"
        role="combobox"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open && !disabled}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        disabled={disabled}
        onClick={() => (open ? close() : expand())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            expand();
          }
        }}
      >
        <span id={`${id}-value`}>{value}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div
          id={`${id}-list`}
          ref={list}
          className="year-options"
          role="listbox"
          aria-labelledby={`${id}-label`}
          tabIndex={-1}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={navigate}
        >
          {years.map((year) => (
            <div
              id={`${id}-${year}`}
              key={year}
              role="option"
              aria-selected={year === value}
              className={year === active ? "year-option active" : "year-option"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(year)}
            >
              {year}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
