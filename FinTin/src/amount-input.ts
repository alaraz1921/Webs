import type { KeyboardEvent } from "react";

export function decimalComma(event: KeyboardEvent<HTMLInputElement>) {
  if (
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.nativeEvent.isComposing ||
    event.currentTarget.readOnly ||
    event.currentTarget.disabled ||
    !(
      (event.code === "NumpadDecimal" || event.location === 3) &&
      [".", ",", "Decimal"].includes(event.key)
    )
  )
    return;
  event.preventDefault();
  const input = event.currentTarget;
  input.setRangeText(
    ",",
    input.selectionStart ?? input.value.length,
    input.selectionEnd ?? input.value.length,
    "end",
  );
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
