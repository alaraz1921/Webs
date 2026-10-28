import { useState } from "react";
import type { Account, Alias, Category, Kind } from "./types";
import { kinds, labels } from "./types";
import { amount, money } from "./finance";
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
export function Settings({
  uid,
  accounts,
  categories,
  aliases,
  reload,
}: MasterProps) {
  const [modal, setModal] = useState<"account" | "category" | "alias" | null>(
    null,
  );
  const [edit, setEdit] = useState<Account | null>(null),
    [category, setCategory] = useState<Category | null>(null),
    [alias, setAlias] = useState<Alias | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <div className="settings-grid">
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
            <table aria-label="Cuentas y saldos">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Entidad</th>
                  <th>Tipo</th>
                  <th>Moneda</th>
                  <th>Saldo inicial</th>
                  <th>Fecha del saldo inicial</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
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
            <table aria-label="Categorías">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo de movimiento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
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
      <Panel
        title="Alias del agregador"
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
          La asignación exige entidad, nombre y tipo de producto completos. Los
          cambios afectan a futuras importaciones.
        </p>
        {aliases.length ? (
          <div className="table-wrap">
            <table aria-label="Alias del agregador">
              <thead>
                <tr>
                  <th>Entidad CSV</th>
                  <th>Producto CSV</th>
                  <th>Tipo CSV</th>
                  <th>Cuenta de destino</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((a) => {
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
