import type { Account, Category, Movement } from "./types";
import { sortRows, type SortState } from "./sorting";

export type MovementSortKey =
  | "date"
  | "concept"
  | "source"
  | "destination"
  | "category"
  | "origin"
  | "amount";
export type MovementLookups = { accounts: Account[]; categories: Category[] };

export function sortedMovements(
  rows: readonly Movement[],
  sort: SortState<MovementSortKey>,
  { accounts, categories }: MovementLookups,
) {
  const accountNames = new Map(accounts.map((a) => [a.id, a.nombre_producto]));
  const categoryNames = new Map(categories.map((c) => [c.id, c.nombre]));
  return sortRows(
    rows,
    sort,
    (r, key) => {
      switch (key) {
        case "date":
          return r.fecha_valor;
        case "concept":
          return r.concepto || "Sin concepto";
        case "source":
          return (
            r.nombre_producto_csv ||
            (r.origen === "csv" ? "Origen no conservado" : "Alta manual")
          );
        case "destination":
          return accountNames.get(r.cuenta_id) || "Cuenta no disponible";
        case "category":
          return (
            categoryNames.get(r.categoria_id || "") ||
            r.categoria_csv ||
            "Sin categoría"
          );
        case "origin":
          return r.origen === "csv" ? "CSV" : "Manual";
        case "amount":
          return r.importe;
      }
    },
    ["amount"],
  );
}
