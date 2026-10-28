import type { Account, Alias, Category, CsvRow, Movement } from "./types";
import { aliasKey, validateAccounts, validCurrency } from "./csv";
export const MAX_MANUAL_IMPORT_ROWS = 5000;
export type ManualImportRow = Pick<
  Movement,
  | "id"
  | "cuenta_id"
  | "fecha_valor"
  | "fecha_operacion"
  | "importe"
  | "moneda"
  | "concepto"
  | "tipo_movimiento"
  | "categoria_id"
  | "categoria_csv"
  | "nota"
>;
export function manualImportRows(
  rows: CsvRow[],
  accounts: Account[],
  aliases: Alias[],
  categories: Category[],
  ids: string[],
): ManualImportRow[] {
  if (!rows.length || rows.length > MAX_MANUAL_IMPORT_ROWS)
    throw new Error(
      `La carga manual debe tener entre 1 y ${MAX_MANUAL_IMPORT_ROWS} filas.`,
    );
  if (ids.length !== rows.length || new Set(ids).size !== ids.length)
    throw new Error("Identificadores de carga inválidos.");
  const errors = validateAccounts(rows, aliases, accounts);
  if (errors.length) throw new Error(errors[0]);
  return rows.map((r, i) => {
    if (!validCurrency(r.moneda))
      throw new Error(`Fila ${r.numero_fila}: moneda de cuenta inválida.`);
    const alias = aliases.find((a) => aliasKey(a) === aliasKey(r))!;
    const matching = categories.filter(
      (c) =>
        c.tipo_movimiento === r.tipo_movimiento &&
        c.nombre.trim().toLowerCase() === r.categoria_csv.trim().toLowerCase(),
    );
    return {
      id: ids[i],
      cuenta_id: alias.cuenta_id,
      fecha_valor: r.fecha_valor,
      fecha_operacion: r.fecha_operacion,
      importe: r.importe,
      moneda: r.moneda,
      concepto: r.concepto,
      tipo_movimiento: r.tipo_movimiento,
      categoria_id: matching.length === 1 ? matching[0].id : null,
      categoria_csv: r.categoria_csv,
      nota: r.nota,
    };
  });
}

const productKey = (r: Pick<CsvRow, "entidad_csv" | "nombre_producto_csv">) =>
  JSON.stringify(
    [r.entidad_csv, r.nombre_producto_csv].map((v) => v.trim().toLowerCase()),
  );
export function resolveManualAccounts(
  rows: CsvRow[],
  accounts: Account[],
  aliases: Alias[],
  assignments: Record<string, string>,
) {
  const products = [
    ...new Map(rows.map((r) => [productKey(r), r])).entries(),
  ].map(([key, row]) => {
    const matchingAliases = aliases.filter((a) => productKey(a) === key);
    const candidates = matchingAliases.length
      ? [
          ...new Set(
            matchingAliases
              .map((a) => a.cuenta_id)
              .filter((id) => accounts.some((c) => c.id === id)),
          ),
        ]
      : accounts
          .filter(
            (a) =>
              productKey({
                entidad_csv: a.entidad,
                nombre_producto_csv: a.nombre_producto,
              }) === key,
          )
          .map((a) => a.id);
    return {
      key,
      row,
      accountId:
        assignments[key] ?? (candidates.length === 1 ? candidates[0] : ""),
    };
  });
  const resolvedAliases: Alias[] = products
    .filter((p) => accounts.some((a) => a.id === p.accountId))
    .map((p, i) => ({
      id: "manual-" + i,
      user_id: accounts.find((a) => a.id === p.accountId)!.user_id,
      cuenta_id: p.accountId,
      entidad_csv: p.row.entidad_csv,
      nombre_producto_csv: p.row.nombre_producto_csv,
      tipo_producto_csv: "",
    }));
  return {
    products,
    aliases: resolvedAliases,
    rows: rows.map((r) => {
      const product = products.find((p) => p.key === productKey(r));
      const account = accounts.find((a) => a.id === product?.accountId);
      return { ...r, moneda: account?.moneda || "", tipo_producto_csv: "" };
    }),
  };
}
