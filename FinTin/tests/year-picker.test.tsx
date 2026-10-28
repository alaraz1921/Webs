// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YearPicker } from "../src/YearPicker";
afterEach(cleanup);
describe("Desplegable compacto de ejercicio", () => {
  it("permite alcanzar años alejados con teclado y confirmar", async () => {
    const change = vi.fn();
    render(<YearPicker value={2026} onChange={change} />);
    const u = userEvent.setup();
    const combo = screen.getByRole("combobox", { name: /Ejercicio/ });
    await u.click(combo);
    expect(
      within(screen.getByRole("listbox")).getAllByRole("option"),
    ).toHaveLength(101);
    expect(
      screen
        .getByRole("option", { name: "2026" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    await u.keyboard("{End}{Enter}");
    expect(change).toHaveBeenCalledWith(2000);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(combo);
  });
  it("Escape cancela la selección y también cierra al pulsar fuera", async () => {
    const change = vi.fn();
    render(
      <>
        <YearPicker value={2026} onChange={change} />
        <button>Otro control</button>
      </>,
    );
    const u = userEvent.setup();
    await u.click(screen.getByRole("combobox", { name: /Ejercicio/ }));
    await u.keyboard("{ArrowDown}{Escape}");
    expect(change).not.toHaveBeenCalled();
    await u.click(screen.getByRole("combobox", { name: /Ejercicio/ }));
    await u.click(screen.getByRole("button", { name: "Otro control" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("admite búsqueda numérica y respeta el estado deshabilitado", async () => {
    const change = vi.fn();
    const view = render(<YearPicker value={2026} onChange={change} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("combobox", { name: /Ejercicio/ }));
    await u.keyboard("2015{Enter}");
    expect(change).toHaveBeenCalledWith(2015);
    view.rerender(<YearPicker value={2026} disabled onChange={change} />);
    fireEvent.click(screen.getByRole("combobox", { name: /Ejercicio/ }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
