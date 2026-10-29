import { useTableSort, sortRows, SortHeader } from "./sorting";
import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { AccountCell } from "./AccountCell";
import { annual, list, save } from "./api";
import { decimalComma } from "./amount-input";
import type { Movement, Reconciliation, Balance } from "./types";
import { kinds, labels, months } from "./types";
import {
  totals,
  sum,
  money,
  amount,
  displayDate,
  formatAmount,
} from "./finance";
import { Field, Empty, ErrorBox, Panel, Form, text, Modal } from "./ui";
import type { MasterProps } from "./Settings";
export interface YearProps extends MasterProps {
  year: number;
  currency: string;
  account: string;
  showFlows?: boolean;
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
                      className="matrix compact-table year-matrix"
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
                <table
                  className="matrix compact-table year-matrix"
                  aria-label="Totales mensuales y neto"
                >
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
  const {
    uid,
    year,
    currency,
    account,
    accounts,
    open,
    reconcile,
    showFlows = true,
  } = props;
  const [data, setData] = useState<Reconciliation[]>([]),
    [flows, setFlows] = useState<Movement[]>([]),
    [balances, setBalances] = useState<Balance[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [refresh, setRefresh] = useState(0);
  const [closingMonth, setClosingMonth] = useState(""),
    [closingStatus, setClosingStatus] = useState(""),
    [balanceDialog, setBalanceDialog] = useState<Pick<
      Reconciliation,
      "cuenta_id" | "fecha_cierre" | "saldo_real"
    > | null>(null),
    [balanceBusy, setBalanceBusy] = useState(false);
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
  type AccountKey = "cuenta" | `month-${number}`;
  type ReconcileKey = "cuenta" | "cierre" | "calculado" | "real" | "diferencia";
  const accountSort = useTableSort<AccountKey>(),
    reconcileSort = useTableSort<ReconcileKey>();
  const visible = accounts.filter(
      (a) => a.moneda === currency && (!account || a.id === account),
    ),
    rows = data.filter(
      (r) =>
        r.fecha_cierre.startsWith(String(year)) &&
        visible.some((a) => a.id === r.cuenta_id),
    );
  const monthlyKeys: AccountKey[] = months.map(
    (_, i) => `month-${i + 1}` as AccountKey,
  );
  const sortedAccounts = sortRows(
    visible,
    accountSort.sort,
    (a, key) =>
      key === "cuenta"
        ? a.nombre_producto
        : (rows.find(
            (r) =>
              r.cuenta_id === a.id &&
              Number(r.fecha_cierre.slice(5, 7)) === Number(key.slice(6)),
          )?.saldo_calculado ?? null),
    monthlyKeys,
  );
  const sortedClosures = sortRows(
    rows.filter((r) => {
      if (
        closingMonth &&
        Number(r.fecha_cierre.slice(5, 7)) !== Number(closingMonth)
      )
        return false;
      if (!closingStatus) return true;
      if (closingStatus === "pending") return r.saldo_real === null;
      if (r.saldo_real === null) return false;
      const matches = new Decimal(r.saldo_real).eq(r.saldo_calculado);
      return closingStatus === "matched" ? matches : !matches;
    }),
    reconcileSort.sort,
    (r, key) => {
      if (key === "cuenta")
        return (
          accounts.find((a) => a.id === r.cuenta_id)?.nombre_producto || ""
        );
      if (key === "cierre") return r.fecha_cierre;
      if (key === "calculado") return r.saldo_calculado;
      if (key === "real") return r.saldo_real;
      return r.diferencia;
    },
    ["calculado", "real", "diferencia"],
  );
  const selectedBalance = balanceDialog
    ? balances.find(
        (b) =>
          b.cuenta_id === balanceDialog.cuenta_id &&
          b.fecha_corte === balanceDialog.fecha_cierre,
      )
    : undefined;
  const selectedAccount = accounts.find(
    (a) => a.id === balanceDialog?.cuenta_id,
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
              {!reconcile && (
                <p className="muted">
                  Cada fila agrupa una cuenta de destino y los movimientos de
                  todos sus alias. Verde: saldo real y calculado coinciden.
                  Rojo: hay diferencia. Sin color: saldo real pendiente o mes
                  sin cierre.
                </p>
              )}
              {reconcile && (
                <div className="reconciliation-filters">
                  <Field label="Mes de cierre">
                    <select
                      value={closingMonth}
                      onChange={(e) => setClosingMonth(e.target.value)}
                    >
                      <option value="">Todos los meses</option>
                      {months.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Estado de conciliación">
                    <select
                      value={closingStatus}
                      onChange={(e) => setClosingStatus(e.target.value)}
                    >
                      <option value="">Todos los estados</option>
                      <option value="different">Con diferencia</option>
                      <option value="matched">Sin diferencia</option>
                      <option value="pending">Sin saldo real</option>
                    </select>
                  </Field>
                </div>
              )}
              {!reconcile ? (
                <div className="table-wrap">
                  <table
                    className="matrix compact-table year-matrix account-matrix"
                    aria-label="Saldos mensuales por cuenta"
                  >
                    <thead>
                      <tr>
                        <SortHeader
                          field="cuenta"
                          label={`Cuenta / ${currency}`}
                          {...accountSort}
                        />
                        {months.map((m, i) => (
                          <SortHeader
                            key={m}
                            field={`month-${i + 1}`}
                            label={m}
                            {...accountSort}
                            numeric
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAccounts.map((a) => (
                        <tr key={a.id}>
                          <th>
                            {a.nombre_producto}
                            <small>{a.entidad}</small>
                            <small>
                              Inicio {displayDate(a.fecha_saldo_inicial)}
                            </small>
                            <small>
                              Saldo inicial {money(a.saldo_inicial, currency)}
                            </small>
                          </th>
                          {months.map((_, i) => {
                            const r = rows.find(
                              (r) =>
                                r.cuenta_id === a.id &&
                                Number(r.fecha_cierre.slice(5, 7)) === i + 1,
                            );
                            const matches =
                              r && r.saldo_real !== null
                                ? new Decimal(r.saldo_real).eq(
                                    r.saldo_calculado,
                                  )
                                : null;
                            const closingDate =
                              r?.fecha_cierre ||
                              new Date(Date.UTC(year, i + 1, 0))
                                .toISOString()
                                .slice(0, 10);
                            return (
                              <td
                                key={i}
                                className={
                                  matches === null
                                    ? undefined
                                    : matches
                                      ? "balance-match"
                                      : "balance-mismatch"
                                }
                              >
                                <AccountCell
                                  title={
                                    !r
                                      ? "Mes sin cierre calculado"
                                      : r.saldo_real === null
                                        ? "Saldo real pendiente"
                                        : matches
                                          ? "Saldo real y calculado coinciden"
                                          : `Diferencia: ${money(new Decimal(r.saldo_real).minus(r.saldo_calculado), currency)}`
                                  }
                                  onMovements={() =>
                                    open({
                                      account: a.id,
                                      month: i + 1,
                                    })
                                  }
                                  onBalance={() =>
                                    setBalanceDialog(
                                      r || {
                                        cuenta_id: a.id,
                                        fecha_cierre: closingDate,
                                        saldo_real:
                                          balances.find(
                                            (b) =>
                                              b.cuenta_id === a.id &&
                                              b.fecha_corte === closingDate,
                                          )?.saldo_real ?? null,
                                      },
                                    )
                                  }
                                >
                                  {r ? (
                                    <>
                                      {money(r.saldo_calculado, currency)}
                                      <small>
                                        {r.saldo_real === null
                                          ? "Real pendiente"
                                          : `Real ${money(r.saldo_real, currency)}`}
                                      </small>
                                      {showFlows && (
                                        <>
                                          <small>
                                            Entradas{" "}
                                            {formatAmount(
                                              sum(
                                                flows
                                                  .filter(
                                                    (f) =>
                                                      f.cuenta_id === a.id &&
                                                      Number(
                                                        f.fecha_valor.slice(
                                                          5,
                                                          7,
                                                        ),
                                                      ) ===
                                                        i + 1 &&
                                                      !f.importe.startsWith(
                                                        "-",
                                                      ),
                                                  )
                                                  .map((f) => f.importe),
                                              ),
                                            )}
                                          </small>
                                          <small>
                                            Salidas{" "}
                                            {formatAmount(
                                              sum(
                                                flows
                                                  .filter(
                                                    (f) =>
                                                      f.cuenta_id === a.id &&
                                                      Number(
                                                        f.fecha_valor.slice(
                                                          5,
                                                          7,
                                                        ),
                                                      ) ===
                                                        i + 1 &&
                                                      f.importe.startsWith("-"),
                                                  )
                                                  .map((f) => f.importe),
                                              ),
                                            )}
                                          </small>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                </AccountCell>
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
                  <table className="compact-table" aria-label="Conciliación">
                    <thead>
                      <tr>
                        <SortHeader
                          field="cuenta"
                          label="Cuenta"
                          {...reconcileSort}
                        />
                        <SortHeader
                          field="cierre"
                          label="Cierre"
                          {...reconcileSort}
                        />
                        <SortHeader
                          field="calculado"
                          label="Calculado"
                          {...reconcileSort}
                          numeric
                        />
                        <SortHeader
                          field="real"
                          label="Real"
                          {...reconcileSort}
                          numeric
                        />
                        <SortHeader
                          field="diferencia"
                          label="Diferencia (real − calculado)"
                          {...reconcileSort}
                          numeric
                        />
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClosures.map((r) => (
                        <tr
                          key={r.cuenta_id + r.fecha_cierre}
                          className={
                            r.saldo_real !== null &&
                            !new Decimal(r.saldo_real).eq(r.saldo_calculado)
                              ? "reconciliation-difference"
                              : undefined
                          }
                        >
                          <td>
                            {
                              accounts.find((a) => a.id === r.cuenta_id)
                                ?.nombre_producto
                            }
                          </td>
                          <td>{displayDate(r.fecha_cierre)}</td>
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
                              "numeric" +
                              (r.diferencia !== null &&
                              !new Decimal(r.diferencia).isZero()
                                ? " negative"
                                : "")
                            }
                          >
                            {r.diferencia === null ? (
                              <button
                                type="button"
                                className="badge"
                                onClick={() => setBalanceDialog(r)}
                              >
                                Sin saldo real
                              </button>
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
                            {r.saldo_real !== null && (
                              <button
                                type="button"
                                onClick={() => setBalanceDialog(r)}
                              >
                                Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!(reconcile ? sortedClosures : rows).length && (
                <Empty>No hay cierres para los filtros seleccionados.</Empty>
              )}
            </Panel>
          </>
        )
      )}
      {balanceDialog && (
        <Modal
          title={
            balanceDialog.saldo_real === null
              ? "Anotar saldo real"
              : "Editar saldo real"
          }
          onClose={() => setBalanceDialog(null)}
          busy={balanceBusy}
        >
          <Form
            onBusyChange={setBalanceBusy}
            onCancel={() => setBalanceDialog(null)}
            onSave={async (d) => {
              if (!selectedAccount)
                throw new Error("La cuenta ya no está disponible.");
              if (balanceDialog.saldo_real !== null && !selectedBalance)
                throw new Error(
                  "No se ha encontrado el saldo real. Actualiza la página antes de editarlo.",
                );
              await save(
                "saldos",
                uid,
                {
                  cuenta_id: balanceDialog.cuenta_id,
                  fecha_corte: balanceDialog.fecha_cierre,
                  saldo_real: amount(text(d, "saldo_real")),
                  nota: text(d, "nota"),
                },
                selectedBalance?.id,
              );
              setBalanceDialog(null);
              setRefresh((v) => v + 1);
            }}
          >
            <Field label="Cuenta">
              <input
                readOnly
                value={
                  selectedAccount
                    ? `${selectedAccount.nombre_producto} · ${selectedAccount.entidad} · ${selectedAccount.moneda}`
                    : "Cuenta no disponible"
                }
              />
            </Field>
            <Field label="Fecha de corte">
              <input type="date" readOnly value={balanceDialog.fecha_cierre} />
            </Field>
            <Field label="Saldo real">
              <input
                name="saldo_real"
                data-initial-focus
                inputMode="decimal"
                onKeyDown={decimalComma}
                required
                placeholder="0,00"
                defaultValue={(
                  selectedBalance?.saldo_real ??
                  balanceDialog.saldo_real ??
                  ""
                ).replace(".", ",")}
              />
            </Field>
            <Field label="Nota">
              <input name="nota" defaultValue={selectedBalance?.nota || ""} />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
