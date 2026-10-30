import { expect, it } from "vitest";
import {
  sortedMovements,
  type MovementLookups,
  type MovementSortKey,
} from "../src/movement-sorting";
import type { Movement } from "../src/types";

const rows = [
  {
    id: "a",
    cuenta_id: "a",
    categoria_id: "a",
    categoria_csv: "",
    concepto: "Zeta",
    nombre_producto_csv: "Zeta",
    fecha_valor: "2026-01-31",
    fecha_operacion: "2026-02-02",
    importe: "9999999999999999.99",
    origen: "csv",
  },
  {
    id: "b",
    cuenta_id: "b",
    categoria_id: "b",
    categoria_csv: "",
    concepto: "Álamo",
    nombre_producto_csv: "Álamo",
    fecha_valor: "2026-02-01",
    fecha_operacion: "2026-02-01",
    importe: "9999999999999999.98",
    origen: "manual",
  },
] as Movement[];
const lookups = {
  accounts: [
    { id: "a", nombre_producto: "Zeta" },
    { id: "b", nombre_producto: "Álamo" },
  ],
  categories: [
    { id: "a", nombre: "Zeta" },
    { id: "b", nombre: "Álamo" },
  ],
} as MovementLookups;

it.each<MovementSortKey>([
  "concept",
  "source",
  "destination",
  "category",
  "amount",
])("ordena %s por el valor visible y conserva precisión de céntimos", (key) => {
  expect(
    sortedMovements(rows, { key, direction: "asc" }, lookups).map((r) => r.id),
  ).toEqual(["b", "a"]);
  expect(
    sortedMovements(rows, { key, direction: "desc" }, lookups).map((r) => r.id),
  ).toEqual(["a", "b"]);
  expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
});
it.each<MovementSortKey>(["date", "origin"])(
  "ordena %s de forma ascendente y descendente",
  (key) => {
    expect(
      sortedMovements(rows, { key, direction: "asc" }, lookups).map(
        (r) => r.id,
      ),
    ).toEqual(["a", "b"]);
    expect(
      sortedMovements(rows, { key, direction: "desc" }, lookups).map(
        (r) => r.id,
      ),
    ).toEqual(["b", "a"]);
  },
);
it("ordena la fecha de operación independientemente de la fecha valor", () => {
  expect(
    sortedMovements(
      rows,
      { key: "operationDate", direction: "asc" },
      lookups,
    ).map((r) => r.id),
  ).toEqual(["b", "a"]);
});
