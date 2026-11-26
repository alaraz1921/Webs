import { useState } from "react";
import { remove, save } from "./api";
import { dateInMadrid } from "./chart-data";
import {
  depositTerms,
  percentage,
  positiveAmount,
  type Deposit,
} from "./contracts";
import { displayDate, moneyWithSymbol } from "./finance";
import { alphabetical } from "./alphabetical";
import { ContractEditor, DecimalField, useContractRows } from "./ContractForms";
import { ConfirmDelete, Empty, ErrorBox, Field, Panel, text } from "./ui";

const table = "depositos";

export function DepositsPage({ uid }: { uid: string }) {
  const { rows, busy, error, refresh } = useContractRows<Deposit>(uid, table);
  const [search, setSearch] = useState("");
  const [holder, setHolder] = useState("");
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<Deposit | null | undefined>();
  const today = dateInMadrid(new Date());
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visible = alphabetical(rows, (row) => row.nombre)
    .map((row) => ({ row, ...depositTerms(row) }))
    .filter(
      ({ row, maturity }) =>
        (!holder || row.titular === holder) &&
        normalize(row.nombre + " " + row.notas).includes(
          normalize(search.trim()),
        ) &&
        (!status || (maturity <= today ? "expired" : "active") === status),
    );
  return (
    <>
      <div className="context-bar">
        <Field label="Buscar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Titular">
          <select value={holder} onChange={(e) => setHolder(e.target.value)}>
            <option value="">Todos</option>
            {alphabetical(
              [...new Set(rows.map((r) => r.titular))],
              (name) => name,
            ).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="active">Vigentes</option>
            <option value="expired">Vencidos</option>
          </select>
        </Field>
      </div>
      <Panel
        title="Depósitos a plazo fijo"
        actions={
          <button className="primary" onClick={() => setEditor(null)}>
            Nuevo depósito
          </button>
        }
      >
        <ErrorBox error={error} />
        {busy ? (
          <Empty>Cargando depósitos…</Empty>
        ) : (
          !error &&
          (visible.length ? (
            <div className="table-wrap">
              <table
                className="compact-table"
                aria-label="Depósitos a plazo fijo"
              >
                <thead>
                  <tr>
                    {[
                      "Nombre",
                      "Titular",
                      "Apertura",
                      "Meses",
                      "Vencimiento",
                      "Interés anual",
                      "Aportación",
                      "Beneficio neto",
                      "Liquidación",
                      "Notas",
                      "Acciones",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ row, maturity, net, settlement }) => (
                    <tr key={row.id}>
                      <th scope="row">{row.nombre}</th>
                      <td>{row.titular}</td>
                      <td>{displayDate(row.fecha_apertura)}</td>
                      <td>{row.duracion_meses}</td>
                      <td>{displayDate(maturity)}</td>
                      <td className="numeric">
                        {Number(row.interes).toLocaleString("es-ES")} %
                      </td>
                      <td className="numeric">
                        {moneyWithSymbol(row.aportacion)}
                      </td>
                      <td className="numeric">{moneyWithSymbol(net)}</td>
                      <td className="numeric">{moneyWithSymbol(settlement)}</td>
                      <td>{row.notas}</td>
                      <td>
                        <button onClick={() => setEditor(row)}>Editar</button>
                        <ConfirmDelete
                          onDelete={async () => {
                            await remove(table, uid, row.id);
                            refresh();
                            if (
                              holder === row.titular &&
                              !rows.some(
                                (r) => r.id !== row.id && r.titular === holder,
                              )
                            )
                              setHolder("");
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No hay depósitos para estos filtros.</Empty>
          ))
        )}
      </Panel>
      {editor !== undefined && (
        <ContractEditor
          title={editor ? "Editar depósito" : "Nuevo depósito"}
          onClose={() => setEditor(undefined)}
          onSave={async (data) => {
            await save(
              table,
              uid,
              {
                titular: text(data, "titular"),
                nombre: text(data, "nombre"),
                notas: text(data, "notas"),
                fecha_apertura: text(data, "fecha"),
                duracion_meses: Number(text(data, "meses")),
                interes: percentage(text(data, "interes")),
                retencion: percentage(text(data, "retencion")),
                aportacion: positiveAmount(text(data, "aportacion")),
              },
              editor?.id,
            );
            if (holder && holder !== text(data, "titular")) setHolder("");
            setEditor(undefined);
            refresh();
          }}
        >
          <Field label="Nombre">
            <input
              name="nombre"
              required
              data-initial-focus
              defaultValue={editor?.nombre}
            />
          </Field>
          <Field label="Titular">
            <input name="titular" required defaultValue={editor?.titular} />
          </Field>
          <Field label="Fecha de apertura">
            <input
              name="fecha"
              type="date"
              required
              defaultValue={editor?.fecha_apertura}
            />
          </Field>
          <Field label="Duración en meses">
            <input
              name="meses"
              type="number"
              min="1"
              max="1200"
              required
              defaultValue={editor?.duracion_meses}
            />
          </Field>
          <DecimalField
            label="Interés anual (%)"
            name="interes"
            value={editor?.interes}
          />
          <DecimalField
            label="Retención estimada (%)"
            name="retencion"
            value={editor?.retencion ?? "0"}
          />
          <DecimalField
            label="Aportación (€)"
            name="aportacion"
            value={editor?.aportacion}
          />
          <Field label="Notas">
            <textarea name="notas" defaultValue={editor?.notas} />
          </Field>
          <p className="muted">
            El vencimiento se calcula por meses. El beneficio aplica interés
            simple anual y la retención que indiques. La liquidación suma
            aportación y beneficio neto.
          </p>
        </ContractEditor>
      )}
    </>
  );
}
