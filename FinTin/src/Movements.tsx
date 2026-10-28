import { useEffect, useState } from "react";
import type { Movement, Kind } from "./types";
import { kinds, labels } from "./types";
import { movements, remove, save, type Filters } from "./api";
import { amount, money, displayDate } from "./finance";
import { Field, Form, Empty, ErrorBox, text, ConfirmDelete, Panel } from "./ui";
import { CategoryOptions, type MasterProps } from "./Settings";
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
  const [page, setPage] = useState(0),
    [data, setData] = useState<{ rows: Movement[]; count: number }>({
      rows: [],
      count: 0,
    }),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0),
    [edit, setEdit] = useState<Movement | null | undefined>(undefined);
  const change = (key: keyof Filters, value: string) => {
    setFilters({ ...f, [key]: value });
    setPage(0);
  };
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      movements(
        uid,
        f,
        page,
        f.entity
          ? accounts.filter((a) => a.entidad === f.entity).map((a) => a.id)
          : undefined,
      )
        .then((d) => {
          if (live) setData(d);
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
  }, [uid, f, page, refresh, accounts]);
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
        <Field label="Buscar concepto">
          <input
            type="search"
            placeholder="Concepto…"
            value={f.search}
            onChange={(e) => change("search", e.target.value)}
          />
        </Field>
        <Field label="Cuenta">
          <select
            value={f.account}
            onChange={(e) => change("account", e.target.value)}
          >
            <option value="">Todas</option>
            {accounts.map((a) => (
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
            {[...new Set(accounts.map((a) => a.moneda))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Entidad">
          <select
            value={f.entity}
            onChange={(e) => change("entity", e.target.value)}
          >
            <option value="">Todas</option>
            {[...new Set(accounts.map((a) => a.entidad))].map((a) => (
              <option key={a}>{a}</option>
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select
            value={f.kind}
            onChange={(e) => change("kind", e.target.value)}
          >
            <option value="">Todos</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
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
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Fecha valor / operación</th>
                    <th>Concepto / cuenta</th>
                    <th>Categoría</th>
                    <th>Origen</th>
                    <th className="numeric">Importe</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {displayDate(r.fecha_valor)}
                        <small>{displayDate(r.fecha_operacion)}</small>
                      </td>
                      <td>
                        {r.concepto || "Sin concepto"}
                        <small>
                          {
                            accounts.find((a) => a.id === r.cuenta_id)
                              ?.nombre_producto
                          }{" "}
                          {r.nota && `· ${r.nota}`}
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
                        {money(r.importe, r.moneda)}
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
            {accounts.map((a) => (
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
            {kinds.map((k) => (
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
