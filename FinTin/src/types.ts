export type Kind = "ingreso" | "gasto" | "no_computable";
export interface Account {
  id: string;
  user_id: string;
  entidad: string;
  nombre_producto: string;
  tipo_producto: string;
  moneda: string;
  saldo_inicial: string;
  fecha_saldo_inicial: string;
  activo: boolean;
}
export interface Category {
  id: string;
  user_id: string;
  nombre: string;
  tipo_movimiento: Kind;
}
export interface Alias {
  id: string;
  user_id: string;
  cuenta_id: string;
  entidad_csv: string;
  nombre_producto_csv: string;
  tipo_producto_csv: string;
}
export interface Movement {
  id: string;
  cuenta_id: string;
  fecha_valor: string;
  fecha_operacion: string;
  importe: string;
  moneda: string;
  concepto: string;
  tipo_movimiento: Kind;
  categoria_id: string | null;
  categoria_csv: string;
  nota: string;
  origen: "csv" | "manual";
  entidad_csv?: string | null;
  nombre_producto_csv?: string | null;
  tipo_producto_csv?: string | null;
}
export interface Balance {
  id: string;
  cuenta_id: string;
  fecha_corte: string;
  saldo_real: string;
  nota: string;
}
export interface Batch {
  id: string;
  ejercicio: number;
  nombre_archivo: string;
  sha256_archivo: string;
  filas_esperadas: number;
  filas_importadas: number;
  estado: string;
  creado_en: string;
}
export interface Reconciliation {
  cuenta_id: string;
  fecha_cierre: string;
  moneda: string;
  saldo_calculado: string;
  saldo_real: string | null;
  diferencia: string | null;
}
export interface CsvRow {
  numero_fila: number;
  fecha_valor: string;
  fecha_operacion: string;
  importe: string;
  moneda: string;
  concepto: string;
  entidad_csv: string;
  nombre_producto_csv: string;
  tipo_producto_csv: string;
  tipo_movimiento: Kind;
  categoria_csv: string;
  nota: string;
}
export const kinds: Kind[] = ["ingreso", "gasto", "no_computable"];
export const labels: Record<Kind, string> = {
  ingreso: "Ingresos",
  gasto: "Gastos",
  no_computable: "No computables",
};
export const months = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
