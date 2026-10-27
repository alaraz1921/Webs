import { useState } from "react";
import type { Account, Alias, Category, Kind } from "./types";
import { kinds, labels } from "./types";
import { amount } from "./finance";
import { validCurrency } from "./csv";
import { save, remove } from "./api";
import { Panel, Field, Form, text, ConfirmDelete } from "./ui";
export interface MasterProps {
  uid: string;
  accounts: Account[];
  categories: Category[];
  aliases: Alias[];
  reload: () => Promise<void>;
}
export function Settings({
  uid,
  accounts,
  categories,
  aliases,
  reload,
}: MasterProps) {
  const [edit, setEdit] = useState<Account | null>(null),
    [category, setCategory] = useState<Category | null>(null),
    [alias, setAlias] = useState<Alias | null>(null);
  return (
    <div className="settings-grid">
      <Panel title="Cuentas y saldo de partida">
        <p className="muted">
          El saldo inicial corresponde al cierre de la fecha indicada. Los
          movimientos deben ser posteriores.
        </p>
        <div className="item-list">
          {accounts.map((a) => (
            <div key={a.id}>
              <span>
                <b>{a.nombre_producto}</b>
                <small>
                  {a.entidad} · {a.moneda} · {a.activo ? "Activa" : "Inactiva"}
                </small>
              </span>
              <button onClick={() => setEdit(a)}>Editar</button>
              <ConfirmDelete
                onDelete={async () => {
                  await remove("cuentas", uid, a.id);
                  await reload();
                }}
              />
            </div>
          ))}
        </div>
        <Form
          key={edit?.id || "new-account"}
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
            setEdit(null);
            await reload();
          }}
        >
          <h3>{edit ? "Editar cuenta" : "Nueva cuenta"}</h3>
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
        {edit && (
          <button onClick={() => setEdit(null)}>Cancelar edición</button>
        )}
      </Panel>
      <Panel title="Categorías">
        <div className="item-list">
          {categories.map((c) => (
            <div key={c.id}>
              <span>
                {c.nombre}
                <small>{labels[c.tipo_movimiento]}</small>
              </span>
              <button onClick={() => setCategory(c)}>Editar</button>
              <ConfirmDelete
                onDelete={async () => {
                  await remove("categorias", uid, c.id);
                  await reload();
                }}
              />
            </div>
          ))}
        </div>
        <Form
          key={category?.id || "new-category"}
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
            setCategory(null);
            await reload();
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
        {category && (
          <button onClick={() => setCategory(null)}>Cancelar edición</button>
        )}
      </Panel>
      <Panel title="Alias del agregador">
        <p className="muted">
          La asignación exige entidad, nombre y tipo de producto completos. Los
          cambios afectan a futuras importaciones.
        </p>
        <div className="item-list">
          {aliases.map((a) => (
            <div key={a.id}>
              <span>
                {a.entidad_csv} / {a.nombre_producto_csv} /{" "}
                {a.tipo_producto_csv || "Sin tipo"}
                <small>
                  →{" "}
                  {accounts.find((c) => c.id === a.cuenta_id)?.nombre_producto}
                </small>
              </span>
              <button onClick={() => setAlias(a)}>Editar</button>
              <ConfirmDelete
                onDelete={async () => {
                  await remove("cuenta_aliases", uid, a.id);
                  await reload();
                }}
              />
            </div>
          ))}
        </div>
        <Form
          key={alias?.id || "new-alias"}
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
            setAlias(null);
            await reload();
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
        {alias && (
          <button onClick={() => setAlias(null)}>Cancelar edición</button>
        )}
      </Panel>
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
