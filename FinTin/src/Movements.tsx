import { alphabetical, compareText } from "./alphabetical";
import { useEffect, useState } from "react";
import type { Movement, Kind } from "./types";
import { kinds, labels } from "./types";
import { accountBalances, movements, remove, save, type Filters } from "./api";
import { amount, moneyWithSymbol, displayDate } from "./finance";
import { decimalComma } from "./amount-input";
import { Field, Form, Empty, ErrorBox, text, ConfirmDelete, Panel } from "./ui";
import { CategoryOptions, type MasterProps } from "./Settings";
import { SortHeader, useTableSort } from "./sorting";
import type { MovementSortKey } from "./movement-sorting";
import Decimal from "decimal.js";
export const filtersFor = (year: number): Filters => ({
  from: `${year}-01-01`,
  to: `${year}-12-31`,
  account: "",
  category: "",
  kind: "",
  origin: "",
  search: "",
  entity: "",
  currency: "",
});
export function MovementPage(
  props: MasterProps & {
    filters: Filters;
    setFilters: (f: Filters) => void;
    year?: number;
  },
) {
  const { uid, accounts, categories, filters: f, setFilters } = props;
  const selectedAccount = accounts.find((account) => account.id === f.account);
  const { sort, onSort } = useTableSort<MovementSortKey>();
  const sortColumn = (key: MovementSortKey) => {
    setPage(0);
    onSort(key);
  };
  const [page, setPage] = useState(0),
    [data, setData] = useState<{
      rows: Movement[];
      count: number;
      totals?: {
        currency: string;
        total: string;
        positive: string;
        negative: string;
      }[];
    }>({
      rows: [],
      count: 0,
    }),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0),
    [edit, setEdit] = useState<Movement | null | undefined>(undefined);
  const [balances, setBalances] = useState<{
    calculated: string | null;
    crossMonth: string;
    real: string | null;
    realDate: string | null;
  } | null>(null);
  const hasBalanceDifference =
    balances?.calculated != null &&
    balances.real != null &&
    !new Decimal(balances.calculated).eq(balances.real);
  const change = (key: keyof Filters, value: string) => {
    setFilters({ ...f, [key]: value });
    setPage(0);
  };
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      Promise.all([
        movements(
          uid,
          f,
          page,
          f.entity
            ? accounts.filter((a) => a.entidad === f.entity).map((a) => a.id)
            : undefined,
          sort,
          { accounts, categories },
        ),
        selectedAccount && f.to
          ? accountBalances(uid, selectedAccount, f.to, f.from)
          : Promise.resolve(null),
      ])
        .then(([d, balance]) => {
          if (live) {
            setData(d);
            setBalances(balance);
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [uid, f, page, refresh, accounts, categories, sort, selectedAccount]);
  return (
    <>
      <div className="toolbar">
        <p className="muted">CSV protegidos · manuales editables</p>
        <button className="primary" onClick={() => setEdit(null)}>
          + Movimiento manual
        </button>
      </div>
      <div className="filters">
        {(["from", "to"] as const).map((k) => (
          <Field key={k} label={k === "from" ? "Desde" : "Hasta"}>
            <input
              type="date"
              value={f[k]}
              onChange={(e) => change(k, e.target.value)}
            />
          </Field>
        ))}
        <Field label="Concepto">
          <input
            aria-label="Buscar concepto"
            type="search"
            placeholder="Concepto…"
            value={f.search}
            onChange={(e) => change("search", e.target.value)}
          />
        </Field>
        <Field label="Origen">
          <select
            value={f.origin}
            onChange={(e) => change("origin", e.target.value)}
          >
            <option value="">Todos</option>
            <option value="csv">CSV</option>
            <option value="manual">Manual</option>
          </select>
        </Field>
        <Field label="Tipo">
          <select
            value={f.kind}
            onChange={(e) => change("kind", e.target.value)}
          >
            <option value="">Todos</option>
            {alphabetical(kinds, (k) => labels[k]).map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoría">
          <select
            value={f.category}
            onChange={(e) => change("category", e.target.value)}
          >
            <option value="">Todas</option>
            <option value="__none">Sin categoría</option>
            {alphabetical(categories, (c) => c.nombre).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Entidad">
          <select
            value={f.entity}
            onChange={(e) => change("entity", e.target.value)}
          >
            <option value="">Todas</option>
            {[...new Set(accounts.map((a) => a.entidad))]
              .sort(compareText)
              .map((a) => (
                <option key={a}>{a}</option>
              ))}
          </select>
        </Field>
        <Field label="Cuenta">
          <select
            value={f.account}
            onChange={(e) => change("account", e.target.value)}
          >
            <option value="">Todas</option>
            {alphabetical(accounts, (a) => a.nombre_producto).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre_producto}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moneda">
          <select
            value={f.currency}
            onChange={(e) => change("currency", e.target.value)}
          >
            <option value="">Todas</option>
            {[...new Set(accounts.map((a) => a.moneda))]
              .sort(compareText)
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </select>
        </Field>
        <div className="filter-actions">
          <button
            type="button"
            onClick={() => {
              setFilters(filtersFor(props.year ?? new Date().getFullYear()));
              setPage(0);
            }}
          >
            Borrar filtros
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Empty>Cargando movimientos…</Empty>
      ) : (
        !error && (
          <>
            <section
              className="movement-totals"
              aria-label="Totales de movimientos filtrados"
            >
              {(data.totals?.length
                ? data.totals
                : [
                    {
                      currency: selectedAccount?.moneda || f.currency || "EUR",
                      total: "0",
                      positive: "0",
                      negative: "0",
                    },
                  ]
              ).map((t) => (
                <div
                  className={`movement-total-row${selectedAccount ? " with-balances" : ""}${hasBalanceDifference ? " with-difference" : ""}`}
                  key={t.currency}
                >
                  <div>
                    <span>Total</span>
                    <strong>{moneyWithSymbol(t.total, t.currency)}</strong>
                  </div>
                  <div>
                    <span>Positivos</span>
                    <strong className="positive">
                      {moneyWithSymbol(t.positive, t.currency)}
                    </strong>
                  </div>
                  <div>
                    <span>Negativos</span>
                    <strong className="negative">
                      {moneyWithSymbol(t.negative, t.currency)}
                    </strong>
                  </div>
                  {selectedAccount && (
                    <>
                      <div>
                        <span>
                          Saldo calculado
                          {f.to ? ` · ${displayDate(f.to)}` : ""}
                        </span>
                        <strong>
                          {!f.to
                            ? "Indica fecha Hasta"
                            : balances?.calculated === null
                              ? "Sin saldo inicial para esta fecha"
                              : balances?.calculated != null
                                ? moneyWithSymbol(
                                    balances.calculated,
                                    selectedAccount.moneda,
                                  )
                                : "—"}
                        </strong>
                      </div>
                      {hasBalanceDifference && (
                        <div>
                          <span>Suma de movimientos entre meses</span>
                          <strong>
                            {moneyWithSymbol(
                              balances.crossMonth,
                              selectedAccount.moneda,
                            )}
                          </strong>
                          <small>Fecha valor en el periodo filtrado</small>
                        </div>
                      )}
                      <div>
                        <span>
                          Saldo real
                          {balances?.realDate
                            ? ` · ${displayDate(balances.realDate)}`
                            : ""}
                        </span>
                        <strong>
                          {!f.to
                            ? "Indica fecha Hasta"
                            : balances?.real != null
                              ? moneyWithSymbol(
                                  balances.real,
                                  selectedAccount.moneda,
                                )
                              : "Sin saldo real"}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <small>
                Todos los movimientos filtrados, incluyendo las demás páginas.
                Importes separados por moneda.
              </small>
            </section>
            <div className="table-wrap">
              <table className="compact-table movements-table">
                <thead>
                  <tr>
                    {(
                      [
                        ["date", "Fecha valor"],
                        ["operationDate", "Fecha operación"],
                        ["concept", "Concepto"],
                        ["source", "Cuenta de origen (CSV)"],
                        ["destination", "Cuenta de destino"],
                        ["category", "Categoría"],
                        ["origin", "Origen"],
                        ["amount", "Importe"],
                      ] as const
                    ).map(([field, label]) => (
                      <SortHeader
                        key={field}
                        field={field}
                        label={label}
                        sort={sort}
                        onSort={sortColumn}
                        numeric={field === "amount"}
                      />
                    ))}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{displayDate(r.fecha_valor)}</td>
                      <td>
                        {r.fecha_operacion !== r.fecha_valor ? (
                          <strong>{displayDate(r.fecha_operacion)}</strong>
                        ) : (
                          displayDate(r.fecha_operacion)
                        )}
                      </td>
                      <td>
                        {r.concepto || "Sin concepto"}
                        {r.nota && <small>{r.nota}</small>}
                      </td>
                      <td>
                        {r.nombre_producto_csv ||
                          (r.origen === "csv"
                            ? "Origen no conservado"
                            : "Alta manual")}
                        <small>{r.entidad_csv}</small>
                        {r.origen === "csv" && !r.nombre_producto_csv && (
                          <small>
                            Reimporta el CSV para recuperar su origen.
                          </small>
                        )}
                      </td>
                      <td>
                        {accounts.find((a) => a.id === r.cuenta_id)
                          ?.nombre_producto || "Cuenta no disponible"}
                        <small>
                          {accounts.find((a) => a.id === r.cuenta_id)?.entidad}
                        </small>
                      </td>
                      <td>
                        {categories.find((c) => c.id === r.categoria_id)
                          ?.nombre ||
                          r.categoria_csv ||
                          "Sin categoría"}
                        <small>{labels[r.tipo_movimiento]}</small>
                      </td>
                      <td>
                        <span className="badge">
                          {r.origen === "csv" ? "CSV · solo lectura" : "Manual"}
                        </span>
                      </td>
                      <td
                        className={
                          "numeric " +
                          (r.importe.startsWith("-") ? "negative" : "positive")
                        }
                      >
                        {moneyWithSymbol(r.importe, r.moneda)}
                      </td>
                      <td>
                        {r.origen === "manual" && (
                          <>
                            <button onClick={() => setEdit(r)}>Editar</button>
                            <ConfirmDelete
                              onDelete={async () => {
                                await remove("movimientos", uid, r.id);
                                setRefresh((v) => v + 1);
                                await props.reload();
                              }}
                            />
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.count && (
              <Empty>No hay movimientos para estos filtros.</Empty>
            )}
            <div className="pagination">
              <span>
                {data.count} movimientos · página {page + 1} de{" "}
                {Math.max(1, Math.ceil(data.count / 50))}
              </span>
              <button disabled={!page} onClick={() => setPage((v) => v - 1)}>
                Anterior
              </button>
              <button
                disabled={(page + 1) * 50 >= data.count}
                onClick={() => setPage((v) => v + 1)}
              >
                Siguiente
              </button>
            </div>
          </>
        )
      )}
      {edit !== undefined && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Movimiento manual"
          >
            <button className="close" onClick={() => setEdit(undefined)}>
              Cerrar
            </button>
            <Panel
              title={edit ? "Editar movimiento" : "Nuevo movimiento manual"}
            >
              <MovementForm
                key={edit?.id || "new"}
                {...props}
                edit={edit}
                done={async () => {
                  setEdit(undefined);
                  setRefresh((v) => v + 1);
                  await props.reload();
                }}
              />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
function MovementForm({
  uid,
  accounts,
  categories,
  edit,
  done,
}: MasterProps & { edit: Movement | null; done: () => Promise<void> }) {
  const [kind, setKind] = useState<Kind>(edit?.tipo_movimiento || "gasto");
  return (
    <Form
      onSave={async (d) => {
        const a = accounts.find((a) => a.id === text(d, "cuenta_id"));
        if (!a) throw new Error("Selecciona una cuenta");
        const date = text(d, "fecha_valor");
        if (date <= a.fecha_saldo_inicial)
          throw new Error("La fecha valor debe ser posterior al saldo inicial");
        await save(
          "movimientos",
          uid,
          {
            origen: "manual",
            fecha_valor: date,
            fecha_operacion: text(d, "fecha_operacion"),
            importe: amount(text(d, "importe")),
            moneda: a.moneda,
            concepto: text(d, "concepto"),
            cuenta_id: a.id,
            tipo_movimiento: kind,
            categoria_id: text(d, "categoria_id") || null,
            nota: text(d, "nota"),
          },
          edit?.id,
        );
        await done();
      }}
    >
      <div className="form-grid">
        <Field label="Fecha valor">
          <input
            name="fecha_valor"
            type="date"
            required
            defaultValue={edit?.fecha_valor}
          />
        </Field>
        <Field label="Fecha operación">
          <input
            name="fecha_operacion"
            type="date"
            required
            defaultValue={edit?.fecha_operacion}
          />
        </Field>
        <Field label="Cuenta">
          <select
            name="cuenta_id"
            required
            defaultValue={edit?.cuenta_id || ""}
          >
            <option value="">Selecciona una cuenta</option>
            {alphabetical(accounts, (a) => a.nombre_producto).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre_producto} · {a.moneda}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Importe con signo">
          <input
            name="importe"
            inputMode="decimal"
            onKeyDown={decimalComma}
            required
            placeholder="-10,00"
            defaultValue={edit?.importe.replace(".", ",")}
          />
        </Field>
        <Field label="Tipo">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {alphabetical(kinds, (k) => labels[k]).map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoría">
          <select
            key={kind}
            name="categoria_id"
            defaultValue={
              edit?.tipo_movimiento === kind ? edit?.categoria_id || "" : ""
            }
          >
            <CategoryOptions categories={categories} kind={kind} />
          </select>
        </Field>
      </div>
      <Field label="Concepto">
        <input name="concepto" defaultValue={edit?.concepto} />
      </Field>
      <Field label="Nota">
        <textarea name="nota" defaultValue={edit?.nota} />
      </Field>
    </Form>
  );
}
