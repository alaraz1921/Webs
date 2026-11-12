import { useEffect, useState } from "react";
import { list } from "./api";
import type { Account, Reconciliation } from "./types";
import { displayDate, moneyWithSymbol, sum } from "./finance";
import { Empty, ErrorBox } from "./ui";

const types = ["Cuentas", "Tarjetas de crédito", "Inversiones", "Caja"];
export function balanceType(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (normalized.includes("cuenta")) return "Cuentas";
  if (normalized.includes("tarjeta") && normalized.includes("credito"))
    return "Tarjetas de crédito";
  if (normalized.includes("inversion")) return "Inversiones";
  if (normalized === "caja") return "Caja";
  return value.trim() || "Sin tipo";
}

export function AccountBalanceCards({
  uid,
  year,
  month,
  currency,
  entity,
  account,
  accounts,
}: {
  uid: string;
  year: number;
  month: string;
  currency: string;
  entity: string;
  account: string;
  accounts: Account[];
}) {
  const [data, setData] = useState<Reconciliation[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    list<Reconciliation>("v_conciliacion_mensual", uid)
      .then((rows) => {
        if (live) setData(rows);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [uid]);
  const visible = accounts.filter(
    (a) =>
      a.moneda === currency &&
      (!entity || a.entidad === entity) &&
      (!account || a.id === account),
  );
  const ids = new Set(visible.map((a) => a.id));
  const rows = data.filter(
    (r) =>
      ids.has(r.cuenta_id) &&
      r.fecha_cierre.startsWith(`${year}-`) &&
      (!month || r.fecha_cierre.slice(5, 7) === month),
  );
  const closing = rows.reduce(
    (latest, r) => (r.fecha_cierre > latest ? r.fecha_cierre : latest),
    "",
  );
  const names = [
    ...types,
    ...new Set(
      visible
        .map((a) => balanceType(a.tipo_producto))
        .filter((name) => !types.includes(name)),
    ),
  ];
  if (busy) return <Empty>Cargando saldos de cuentas…</Empty>;
  if (error) return <ErrorBox error={error} />;
  return (
    <div
      className="stats account-totals"
      role="group"
      aria-label="Saldos de cuentas por tipo"
    >
      {names.map((name) => {
        const group = visible.filter(
          (a) => balanceType(a.tipo_producto) === name,
        );
        const groupIds = new Set(group.map((a) => a.id));
        const balances = rows.filter(
          (r) => r.fecha_cierre === closing && groupIds.has(r.cuenta_id),
        );
        return (
          <article className="stat" key={name} aria-label={`Saldo ${name}`}>
            <span>{name}</span>
            <strong>
              {closing && (balances.length || !group.length)
                ? moneyWithSymbol(
                    sum(balances.map((r) => r.saldo_calculado)),
                    currency,
                  )
                : "—"}
            </strong>
            <small>
              {closing
                ? `Calculado al ${displayDate(closing)} · ${balances.length} de ${group.length} cuentas con cierre`
                : "Sin cierre disponible para el periodo"}
            </small>
          </article>
        );
      })}
    </div>
  );
}
