import { useTableSort, sortRows, SortHeader } from "./sorting";
import { useState } from "react";
import type { Account, Alias, Category, Kind } from "./types";
import { kinds, labels } from "./types";
import { amount, money } from "./finance";
import { decimalComma } from "./amount-input";
import { validCurrency } from "./csv";
import { save, remove } from "./api";
import { Panel, Field, Form, text, ConfirmDelete, Modal, Empty } from "./ui";
export interface MasterProps {
  uid: string;
  accounts: Account[];
  categories: Category[];
  aliases: Alias[];
  reload: () => Promise<void>;
}
export type SettingsSection = "cuentas" | "aliases" | "categorias";
export function Settings({
  uid,
  accounts,
  categories,
  aliases,
  reload,
  section,
}: MasterProps & { section?: SettingsSection }) {
  const [modal, setModal] = useState<"account" | "category" | "alias" | null>(
    null,
  );
  const [edit, setEdit] = useState<Account | null>(null),
    [category, setCategory] = useState<Category | null>(null),
    [alias, setAlias] = useState<Alias | null>(null),
    [busy, setBusy] = useState(false);
  type AccountKey =
    | "nombre_producto"
    | "entidad"
    | "tipo_producto"
    | "moneda"
    | "saldo_inicial"
    | "fecha_saldo_inicial"
    | "activo";
  type CategoryKey = "nombre" | "tipo_movimiento";
  type AliasKey =
    "entidad_csv" | "nombre_producto_csv" | "tipo_producto_csv" | "cuenta_id";
  const accountSort = useTableSort<AccountKey>(),
    categorySort = useTableSort<CategoryKey>(),
    aliasSort = useTableSort<AliasKey>();
  const accountLabel = (id: string) => {
    const a = accounts.find((c) => c.id === id);
    return a
      ? a.entidad + " · " + a.nombre_producto + " · " + a.moneda
      : "Cuenta no disponible";
  };
  const sortedAccounts = sortRows(
    accounts,
    accountSort.sort,
    (a, key) =>
      key === "activo"
        ? a.activo
          ? "Activa"
          : "Inactiva"
        : key === "tipo_producto"
          ? a.tipo_producto || "Sin tipo"
          : a[key],
    ["saldo_inicial"],
  );
  const sortedCategories = sortRows(categories, categorySort.sort, (c, key) =>
    key === "tipo_movimiento" ? labels[c.tipo_movimiento] : c.nombre,
  );
  const sortedAliases = sortRows(aliases, aliasSort.sort, (a, key) =>
    key === "cuenta_id"
      ? accountLabel(a.cuenta_id)
      : key === "tipo_producto_csv"
        ? a.tipo_producto_csv || "Sin tipo"
        : a[key],
  );
  return (
    <div className="settings-grid">
      {(!section || section === "cuentas") && (
        <Panel
          title="Cuentas y saldo de partida"
          actions={
            <button
              className="primary"
              onClick={() => {
                setEdit(null);
                setModal("account");
              }}
            >
              Nueva
            </button>
          }
        >
          <p className="muted">
            El saldo inicial corresponde al cierre de la fecha indicada. Los
            movimientos deben ser posteriores.
          </p>
          {accounts.length ? (
            <div className="table-wrap">
              <table className="compact-table" aria-label="Cuentas y saldos">
                <thead>
                  <tr>
                    <SortHeader
                      field="nombre_producto"
                      label="Producto"
                      {...accountSort}
                    />
                    <SortHeader
                      field="entidad"
                      label="Entidad"
                      {...accountSort}
                    />
                    <SortHeader
                      field="tipo_producto"
                      label="Tipo"
                      {...accountSort}
                    />
                    <SortHeader
                      field="moneda"
                      label="Moneda"
                      {...accountSort}
                    />
                    <SortHeader
                      field="saldo_inicial"
                      label="Saldo inicial"
                      {...accountSort}
                    />
                    <SortHeader
                      field="fecha_saldo_inicial"
                      label="Fecha del saldo inicial"
                      {...accountSort}
                    />
                    <SortHeader
                      field="activo"
                      label="Estado"
                      {...accountSort}
                    />
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <b>{a.nombre_producto}</b>
                      </td>
                      <td>{a.entidad}</td>
                      <td>{a.tipo_producto || "Sin tipo"}</td>
                      <td>{a.moneda}</td>
                      <td className="settings-amount">
                        {money(a.saldo_inicial, a.moneda)}
                      </td>
                      <td>
                        {a.fecha_saldo_inicial.split("-").reverse().join("/")}
                      </td>
                      <td>{a.activo ? "Activa" : "Inactiva"}</td>
                      <td className="settings-actions">
                        <button
                          aria-label={"Editar cuenta " + a.nombre_producto}
                          onClick={() => {
                            setEdit(a);
                            setModal("account");
                          }}
                        >
                          Editar
                        </button>
                        <ConfirmDelete
                          onDelete={async () => {
                            await remove("cuentas", uid, a.id);
                            await reload();
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              No hay cuentas. Crea una cuenta para definir su saldo de partida.
            </Empty>
          )}
        </Panel>
      )}
      {(!section || section === "categorias") && (
        <Panel
          title="Categorías"
          actions={
            <button
              className="primary"
              onClick={() => {
                setCategory(null);
                setModal("category");
              }}
            >
              Nueva
            </button>
          }
        >
          {categories.length ? (
            <div className="table-wrap">
              <table className="compact-table" aria-label="Categorías">
                <thead>
                  <tr>
                    <SortHeader
                      field="nombre"
                      label="Nombre"
                      {...categorySort}
                    />
                    <SortHeader
                      field="tipo_movimiento"
                      label="Tipo de movimiento"
                      {...categorySort}
                    />
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCategories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nombre}</td>
                      <td>{labels[c.tipo_movimiento]}</td>
                      <td className="settings-actions">
                        <button
                          aria-label={"Editar categoría " + c.nombre}
                          onClick={() => {
                            setCategory(c);
                            setModal("category");
                          }}
                        >
                          Editar
                        </button>
                        <ConfirmDelete
                          onDelete={async () => {
                            await remove("categorias", uid, c.id);
                            await reload();
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No hay categorías.</Empty>
          )}
        </Panel>
      )}
      {(!section || section === "aliases") && (
        <Panel
          title="Alias de cuentas"
          actions={
            <button
              className="primary"
              onClick={() => {
                setAlias(null);
                setModal("alias");
              }}
            >
              Nueva
            </button>
          }
        >
          <p className="muted">
            La asignación exige entidad, nombre y tipo de producto completos. Al
            cambiar el destino se reasignan los movimientos cuyo origen CSV se
            conserva. La moneda y la fecha inicial deben ser compatibles. Los
            CSV antiguos sin origen conservado deben reimportarse una vez.
          </p>
          {aliases.length ? (
            <div className="table-wrap">
              <table className="compact-table" aria-label="Alias del agregador">
                <thead>
                  <tr>
                    <SortHeader
                      field="entidad_csv"
                      label="Entidad CSV"
                      {...aliasSort}
                    />
                    <SortHeader
                      field="nombre_producto_csv"
                      label="Producto CSV"
                      {...aliasSort}
                    />
                    <SortHeader
                      field="tipo_producto_csv"
                      label="Tipo CSV"
                      {...aliasSort}
                    />
                    <SortHeader
                      field="cuenta_id"
                      label="Cuenta de destino"
                      {...aliasSort}
                    />
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAliases.map((a) => {
                    const target = accounts.find((c) => c.id === a.cuenta_id);
                    return (
                      <tr key={a.id}>
                        <td>{a.entidad_csv}</td>
                        <td>{a.nombre_producto_csv}</td>
                        <td>{a.tipo_producto_csv || "Sin tipo"}</td>
                        <td>
                          {target
                            ? target.entidad +
                              " · " +
                              target.nombre_producto +
                              " · " +
                              target.moneda
                            : "Cuenta no disponible"}
                        </td>
                        <td className="settings-actions">
                          <button
                            aria-label={
                              "Editar alias " +
                              a.entidad_csv +
                              " " +
                              a.nombre_producto_csv
                            }
                            onClick={() => {
                              setAlias(a);
                              setModal("alias");
                            }}
                          >
                            Editar
                          </button>
                          <ConfirmDelete
                            onDelete={async () => {
                              await remove("cuenta_aliases", uid, a.id);
                              await reload();
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No hay alias del agregador.</Empty>
          )}
        </Panel>
      )}
      {modal === "account" && (
        <Modal
          title={edit ? "Editar cuenta" : "Nueva cuenta"}
          onClose={() => setModal(null)}
          busy={busy}
        >
          <Form
            key={edit?.id || "new-account"}
            onBusyChange={setBusy}
            onCancel={() => setModal(null)}
            onSave={async (d) => {
              const moneda = text(d, "moneda").toUpperCase();
              if (!validCurrency(moneda))
                throw new Error("Moneda ISO 4217 inválida");
              await save(
                "cuentas",
                uid,
                {
                  entidad: text(d, "entidad"),
                  nombre_producto: text(d, "nombre_producto"),
                  tipo_producto: text(d, "tipo_producto"),
                  moneda,
                  saldo_inicial: amount(text(d, "saldo_inicial")),
                  fecha_saldo_inicial: text(d, "fecha_saldo_inicial"),
                  activo: d.has("activo"),
                },
                edit?.id,
              );
              await reload();
              setModal(null);
            }}
          >
            <div className="form-grid">
              {[
                ["entidad", "Entidad"],
                ["nombre_producto", "Nombre de producto"],
                ["tipo_producto", "Tipo de producto"],
                ["moneda", "Moneda"],
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <input
                    name={k}
                    required={k !== "tipo_producto"}
                    defaultValue={
                      edit?.[k as keyof Account]?.toString() ||
                      (k === "moneda" ? "EUR" : "")
                    }
                  />
                </Field>
              ))}
              <Field label="Saldo inicial">
                <input
                  name="saldo_inicial"
                  required
                  defaultValue={edit?.saldo_inicial.replace(".", ",") || "0,00"}
                  inputMode="decimal"
                  onKeyDown={decimalComma}
                />
              </Field>
              <Field label="Fecha del saldo inicial">
                <input
                  type="date"
                  name="fecha_saldo_inicial"
                  required
                  defaultValue={edit?.fecha_saldo_inicial}
                />
              </Field>
            </div>
            <label className="check">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={edit?.activo ?? true}
              />
              Cuenta activa
            </label>
          </Form>
        </Modal>
      )}
      {modal === "category" && (
        <Modal
          title={category ? "Editar categoría" : "Nueva categoría"}
          onClose={() => setModal(null)}
          busy={busy}
        >
          <Form
            key={category?.id || "new-category"}
            onBusyChange={setBusy}
            onCancel={() => setModal(null)}
            onSave={async (d) => {
              await save(
                "categorias",
                uid,
                {
                  nombre: text(d, "nombre"),
                  tipo_movimiento: text(d, "tipo_movimiento"),
                },
                category?.id,
              );
              await reload();
              setModal(null);
            }}
          >
            <Field label="Nombre">
              <input name="nombre" required defaultValue={category?.nombre} />
            </Field>
            <Field label="Tipo">
              <select
                name="tipo_movimiento"
                defaultValue={category?.tipo_movimiento}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {labels[k]}
                  </option>
                ))}
              </select>
            </Field>
          </Form>
        </Modal>
      )}
      {modal === "alias" && (
        <Modal
          title={alias ? "Editar alias" : "Nuevo alias"}
          onClose={() => setModal(null)}
          busy={busy}
        >
          <Form
            key={alias?.id || "new-alias"}
            onBusyChange={setBusy}
            onCancel={() => setModal(null)}
            onSave={async (d) => {
              await save(
                "cuenta_aliases",
                uid,
                {
                  entidad_csv: text(d, "entidad_csv"),
                  nombre_producto_csv: text(d, "nombre_producto_csv"),
                  tipo_producto_csv: text(d, "tipo_producto_csv"),
                  cuenta_id: text(d, "cuenta_id"),
                },
                alias?.id,
              );
              await reload();
              setModal(null);
            }}
          >
            {[
              ["entidad_csv", "Entidad CSV"],
              ["nombre_producto_csv", "Nombre de producto CSV"],
              ["tipo_producto_csv", "Tipo de producto CSV"],
            ].map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  name={k}
                  required={k !== "tipo_producto_csv"}
                  defaultValue={alias?.[k as keyof Alias]}
                />
              </Field>
            ))}
            <Field label="Cuenta de destino">
              <select
                name="cuenta_id"
                required
                defaultValue={alias?.cuenta_id || ""}
              >
                <option value="">Selecciona una cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.entidad} · {a.nombre_producto} · {a.moneda}
                  </option>
                ))}
              </select>
            </Field>
          </Form>
        </Modal>
      )}
    </div>
  );
}
export function CategoryOptions({
  categories,
  kind,
}: {
  categories: Category[];
  kind?: Kind;
}) {
  return (
    <>
      <option value="">Sin categoría</option>
      {categories
        .filter((c) => !kind || c.tipo_movimiento === kind)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre} · {labels[c.tipo_movimiento]}
          </option>
        ))}
    </>
  );
}
