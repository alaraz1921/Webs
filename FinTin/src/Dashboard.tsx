import { useEffect, useState } from "react";
import { annual, list, save, remove } from "./api";
import type { Movement, Reconciliation, Balance } from "./types";
import { kinds, labels, months } from "./types";
import { totals, sum, money, amount } from "./finance";
import { Field, Empty, ErrorBox, Panel, Form, text, ConfirmDelete } from "./ui";
import type { MasterProps } from "./Settings";
export interface YearProps extends MasterProps {
  year: number;
  currency: string;
  account: string;
  open: (f: {
    month?: number;
    category?: string;
    kind?: string;
    account?: string;
    through?: string;
  }) => void;
}
export function Summary({
  uid,
  year,
  currency,
  account,
  categories,
  open,
}: YearProps) {
  const [data, setData] = useState<Movement[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    annual(uid, year)
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [uid, year]);
  const rows = data.filter(
      (r) => r.moneda === currency && (!account || r.cuenta_id === account),
    ),
    t = totals(rows);
  const groups = [
    ...new Map(
      rows.map((r) => [
        `${r.tipo_movimiento}|${r.categoria_id || r.categoria_csv}`,
        {
          id: r.categoria_id || "",
          name:
            categories.find((c) => c.id === r.categoria_id)?.nombre ||
            r.categoria_csv ||
            "Sin categoría",
          kind: r.tipo_movimiento,
        },
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const monthly = months.map((_, i) =>
    totals(rows.filter((r) => Number(r.fecha_valor.slice(5, 7)) === i + 1)),
  );
  return (
    <>
      <ErrorBox error={error} />
      {busy ? (
        <Empty>Cargando resumen…</Empty>
      ) : (
        !error && (
          <>
            <div
              className="stats"
              role="group"
              aria-label="Totales del ejercicio"
            >
              {[...kinds, "balance" as const].map((key) => {
                const label = key === "balance" ? "Neto" : labels[key];
                return (
                  <article
                    className={"stat " + key}
                    key={key}
                    aria-label={"Total " + label}
                  >
                    <span>{label}</span>
                    <strong>{money(t[key], currency)}</strong>
                    <small>
                      {key === "balance"
                        ? "Ingresos menos gastos; sin no computables"
                        : key === "no_computable"
                          ? "Afectan al saldo de tus cuentas"
                          : "Total del ejercicio seleccionado"}
                    </small>
                  </article>
                );
              })}
            </div>
            {kinds.map((kind) => {
              const categoriesForKind = groups.filter((g) => g.kind === kind);
              return (
                <Panel key={kind} title={labels[kind]}>
                  <p className="muted">
                    Detalle por categoría y mes. Selecciona una cifra para
                    explorar sus movimientos.
                  </p>
                  <div className="table-wrap">
                    <table
                      className="matrix"
                      aria-label={labels[kind] + " por categorías y meses"}
                    >
                      <SummaryColumns label="Categoría" currency={currency} />
                      <tbody>
                        {categoriesForKind.map((g) => {
                          const categoryRows = rows.filter(
                            (r) =>
                              r.tipo_movimiento === kind &&
                              (g.id
                                ? r.categoria_id === g.id
                                : !r.categoria_id &&
                                  (r.categoria_csv || "Sin categoría") ===
                                    g.name),
                          );
                          return (
                            <tr key={g.id + g.name}>
                              <th scope="row">{g.name}</th>
                              {months.map((_, i) => (
                                <td key={i}>
                                  <button
                                    className="cell"
                                    onClick={() =>
                                      open({
                                        month: i + 1,
                                        category: g.id || "__none",
                                        kind,
                                      })
                                    }
                                  >
                                    {money(
                                      sum(
                                        categoryRows
                                          .filter(
                                            (r) =>
                                              Number(
                                                r.fecha_valor.slice(5, 7),
                                              ) ===
                                              i + 1,
                                          )
                                          .map((r) => r.importe),
                                      ),
                                      currency,
                                    )}
                                  </button>
                                </td>
                              ))}
                              <td className="numeric">
                                <b>
                                  {money(
                                    sum(categoryRows.map((r) => r.importe)),
                                    currency,
                                  )}
                                </b>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">
                            Total {labels[kind].toLowerCase()}
                          </th>
                          {monthly.map((m, i) => (
                            <td className="numeric" key={i}>
                              <b>{money(m[kind], currency)}</b>
                            </td>
                          ))}
                          <td className="numeric">
                            <b>{money(t[kind], currency)}</b>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {!categoriesForKind.length && (
                    <Empty>
                      No hay {labels[kind].toLowerCase()} para esta selección.
                    </Empty>
                  )}
                </Panel>
              );
            })}
            <Panel title="Totales y neto">
              <p className="muted">
                El Neto descuenta los gastos de los ingresos y excluye los no
                computables. Los importes conservan el signo del CSV, incluidas
                las devoluciones.
              </p>
              <div className="table-wrap">
                <table className="matrix" aria-label="Totales mensuales y neto">
                  <SummaryColumns label="Tipo" currency={currency} />
                  <tbody>
                    {[...kinds, "neto" as const].map((kind) => {
                      const key = kind === "neto" ? "balance" : kind;
                      return (
                        <tr
                          key={kind}
                          className={
                            kind === "neto" ? "summary-net" : undefined
                          }
                        >
                          <th scope="row">
                            {kind === "neto" ? "Neto" : labels[kind]}
                          </th>
                          {monthly.map((m, i) => (
                            <td className="numeric" key={i}>
                              {money(m[key], currency)}
                            </td>
                          ))}
                          <td className="numeric">
                            <b>{money(t[key], currency)}</b>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )
      )}
    </>
  );
}
function SummaryColumns({
  label,
  currency,
}: {
  label: string;
  currency: string;
}) {
  return (
    <thead>
      <tr>
        <th scope="col">
          {label} / {currency}
        </th>
        {months.map((m) => (
          <th scope="col" key={m}>
            {m}
          </th>
        ))}
        <th scope="col">Total</th>
      </tr>
    </thead>
  );
}
export function AccountsPage(props: YearProps & { reconcile?: boolean }) {
  const { uid, year, currency, account, accounts, open, reconcile } = props;
  const [data, setData] = useState<Reconciliation[]>([]),
    [flows, setFlows] = useState<Movement[]>([]),
    [balances, setBalances] = useState<Balance[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    Promise.all([
      list<Reconciliation>("v_conciliacion_mensual", uid),
      list<Balance>("saldos", uid),
      annual(uid, year),
    ])
      .then(([r, b, f]) => {
        if (live) {
          setData(r);
          setBalances(b);
          setFlows(f);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [uid, year, refresh]);
  const visible = accounts.filter(
      (a) => a.moneda === currency && (!account || a.id === account),
    ),
    rows = data.filter(
      (r) =>
        r.fecha_cierre.startsWith(String(year)) &&
        visible.some((a) => a.id === r.cuenta_id),
    );
  return (
    <>
      <ErrorBox error={error} />
      {busy ? (
        <Empty>Cargando cierres…</Empty>
      ) : (
        !error && (
          <>
            <Panel
              title={
                reconcile
                  ? "Cierres y diferencias"
                  : "Saldo calculado por cuenta"
              }
            >
              <p className="muted">
                Saldo inicial + todos los movimientos posteriores al corte. Los
                meses futuros aún no tienen cierre.
              </p>
              {!reconcile ? (
                <div className="table-wrap">
                  <table className="matrix">
                    <thead>
                      <tr>
                        <th>Cuenta / {currency}</th>
                        {months.map((m) => (
                          <th key={m}>{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((a) => (
                        <tr key={a.id}>
                          <th>
                            {a.nombre_producto}
                            <small>
                              {a.entidad} · Inicio {a.fecha_saldo_inicial}:{" "}
                              {money(a.saldo_inicial, currency)}
                            </small>
                          </th>
                          {months.map((_, i) => {
                            const r = rows.find(
                              (r) =>
                                r.cuenta_id === a.id &&
                                Number(r.fecha_cierre.slice(5, 7)) === i + 1,
                            );
                            return (
                              <td key={i}>
                                {r ? (
                                  <button
                                    className="cell"
                                    onClick={() =>
                                      open({
                                        account: a.id,
                                        through: r.fecha_cierre,
                                      })
                                    }
                                  >
                                    {money(r.saldo_calculado, currency)}
                                    <small>
                                      {r.saldo_real === null
                                        ? "Real pendiente"
                                        : `Real ${money(r.saldo_real, currency)}`}
                                    </small>
                                    <small>
                                      Entradas{" "}
                                      {money(
                                        sum(
                                          flows
                                            .filter(
                                              (f) =>
                                                f.cuenta_id === a.id &&
                                                Number(
                                                  f.fecha_valor.slice(5, 7),
                                                ) ===
                                                  i + 1 &&
                                                !f.importe.startsWith("-"),
                                            )
                                            .map((f) => f.importe),
                                        ),
                                        currency,
                                      )}
                                    </small>
                                    <small>
                                      Salidas{" "}
                                      {money(
                                        sum(
                                          flows
                                            .filter(
                                              (f) =>
                                                f.cuenta_id === a.id &&
                                                Number(
                                                  f.fecha_valor.slice(5, 7),
                                                ) ===
                                                  i + 1 &&
                                                f.importe.startsWith("-"),
                                            )
                                            .map((f) => f.importe),
                                        ),
                                        currency,
                                      )}
                                    </small>
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th>Cierre</th>
                        <th>Calculado</th>
                        <th>Real</th>
                        <th>Diferencia (real − calculado)</th>
                        <th>Movimientos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.cuenta_id + r.fecha_cierre}>
                          <td>
                            {
                              accounts.find((a) => a.id === r.cuenta_id)
                                ?.nombre_producto
                            }
                          </td>
                          <td>{r.fecha_cierre}</td>
                          <td className="numeric">
                            {money(r.saldo_calculado, r.moneda)}
                          </td>
                          <td className="numeric">
                            {r.saldo_real === null
                              ? "Pendiente"
                              : money(r.saldo_real, r.moneda)}
                          </td>
                          <td
                            className={
                              r.diferencia !== null &&
                              Number(r.diferencia) !== 0
                                ? "negative"
                                : ""
                            }
                          >
                            {r.diferencia === null ? (
                              <span className="badge">Sin saldo real</span>
                            ) : (
                              money(r.diferencia, r.moneda)
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                open({
                                  account: r.cuenta_id,
                                  through: r.fecha_cierre,
                                })
                              }
                            >
                              Revisar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!rows.length && (
                <Empty>No hay cierres para estas cuentas y ejercicio.</Empty>
              )}
            </Panel>
            <Panel title="Anotar saldo real">
              <p className="muted">
                Para conciliar un mes, indica su último día. También puedes
                guardar observaciones en otras fechas.
              </p>
              <Form
                onSave={async (d) => {
                  const a = text(d, "cuenta_id"),
                    date = text(d, "fecha_corte");
                  const existing = balances.find(
                    (b) => b.cuenta_id === a && b.fecha_corte === date,
                  );
                  await save(
                    "saldos",
                    uid,
                    {
                      cuenta_id: a,
                      fecha_corte: date,
                      saldo_real: amount(text(d, "saldo_real")),
                      nota: text(d, "nota"),
                    },
                    existing?.id,
                  );
                  setRefresh((v) => v + 1);
                }}
              >
                <div className="form-grid">
                  <Field label="Cuenta">
                    <select name="cuenta_id" required>
                      <option value="">Selecciona</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre_producto} · {a.moneda}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Fecha de corte">
                    <input name="fecha_corte" type="date" required />
                  </Field>
                  <Field label="Saldo real">
                    <input
                      name="saldo_real"
                      inputMode="decimal"
                      placeholder="0,00"
                      required
                    />
                  </Field>
                  <Field label="Nota">
                    <input name="nota" />
                  </Field>
                </div>
              </Form>
              <div className="item-list">
                {balances
                  .filter((b) => b.fecha_corte.startsWith(String(year)))
                  .map((b) => (
                    <div key={b.id}>
                      <span>
                        {
                          accounts.find((a) => a.id === b.cuenta_id)
                            ?.nombre_producto
                        }{" "}
                        · {b.fecha_corte}
                        <small>
                          {b.saldo_real} · {b.nota}
                        </small>
                      </span>
                      <ConfirmDelete
                        onDelete={async () => {
                          await remove("saldos", uid, b.id);
                          setRefresh((v) => v + 1);
                        }}
                      />
                    </div>
                  ))}
              </div>
            </Panel>
          </>
        )
      )}
    </>
  );
}
