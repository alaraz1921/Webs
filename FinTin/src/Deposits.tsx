import { useState } from "react";
import { remove, save } from "./api";
import { dateInMadrid } from "./chart-data";
import {
  depositTerms,
  depositProgress,
  settlementAmount,
  percentage,
  positiveAmount,
  type Deposit,
} from "./contracts";
import { displayDate, moneyWithSymbol } from "./finance";
import { alphabetical } from "./alphabetical";
import {
  ContractEditor,
  ContractRow,
  DecimalField,
  useContractRows,
} from "./ContractForms";
import { SortHeader, sortRows, useTableSort } from "./sorting";
import { ConfirmDelete, Empty, ErrorBox, Field, Panel, text } from "./ui";

const table = "depositos";
const columns = [
  ["nombre", "Nombre"],
  ["titular", "Titular"],
  ["fecha_apertura", "Apertura"],
  ["duracion_meses", "Meses"],
  ["maturity", "Vencimiento"],
  ["interes", "Interés anual"],
  ["aportacion", "Aportación"],
  ["net", "Beneficio neto"],
  ["importe_liquidacion", "Liquidación"],
  ["notas", "Notas"],
] as const;
type Column = (typeof columns)[number][0];
const numeric: Column[] = [
  "duracion_meses",
  "interes",
  "aportacion",
  "net",
  "importe_liquidacion",
];

export function DepositsPage({ uid }: { uid: string }) {
  const { rows, busy, error, refresh } = useContractRows<Deposit>(uid, table);
  const [search, setSearch] = useState("");
  const [holder, setHolder] = useState("");
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<Deposit | null | undefined>();
  const [selectedId, setSelectedId] = useState("");
  const sorting = useTableSort<Column>();
  const today = dateInMadrid(new Date());
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visible = alphabetical(rows, (row) => row.nombre)
    .map((row) => {
      const terms = depositTerms(row);
      return {
        row,
        ...terms,
        progress: depositProgress(row, terms.maturity, today),
      };
    })
    .filter(
      ({ row, progress }) =>
        (!holder || row.titular === holder) &&
        normalize(row.nombre + " " + row.notas).includes(
          normalize(search.trim()),
        ) &&
        (!status || (progress.expired ? "expired" : "active") === status),
    );
  const selected =
    visible.find(({ row }) => row.id === selectedId) ?? visible[0];
  const sorted = sortRows(
    visible,
    sorting.sort,
    (entry, key) =>
      key === "maturity"
        ? entry.maturity
        : key === "net"
          ? entry.net.toString()
          : entry.row[key],
    numeric,
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
                    {columns.map(([field, label]) => (
                      <SortHeader
                        key={field}
                        field={field}
                        label={label}
                        numeric={numeric.includes(field)}
                        {...sorting}
                      />
                    ))}
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ row, maturity, net }) => (
                    <ContractRow
                      key={row.id}
                      selected={selected?.row.id === row.id}
                      onSelect={() => setSelectedId(row.id)}
                    >
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
                      <td className="numeric">
                        {row.importe_liquidacion == null
                          ? "—"
                          : moneyWithSymbol(row.importe_liquidacion)}
                      </td>
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
                    </ContractRow>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No hay depósitos para estos filtros.</Empty>
          ))
        )}
      </Panel>
      {!busy && !error && selected && (
        <Panel title={`Detalle de ${selected.row.nombre}`}>
          <dl className="contract-facts">
            <div>
              <dt>Titular</dt>
              <dd>{selected.row.titular}</dd>
            </div>
            <div>
              <dt>Apertura</dt>
              <dd>{displayDate(selected.row.fecha_apertura)}</dd>
            </div>
            <div>
              <dt>Vencimiento</dt>
              <dd>{displayDate(selected.maturity)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                {selected.progress.settled
                  ? "Vencido y liquidado"
                  : selected.progress.expired
                    ? "Vencido, pendiente de liquidación"
                    : today < selected.row.fecha_apertura
                      ? "Pendiente de apertura"
                      : "Vigente"}
              </dd>
            </div>
            <div>
              <dt>Aportación</dt>
              <dd>{moneyWithSymbol(selected.row.aportacion)}</dd>
            </div>
            <div>
              <dt>Beneficio neto estimado</dt>
              <dd>{moneyWithSymbol(selected.net)}</dd>
            </div>
            <div>
              <dt>Importe de liquidación</dt>
              <dd>
                {selected.row.importe_liquidacion == null
                  ? "Sin registrar"
                  : moneyWithSymbol(selected.row.importe_liquidacion)}
              </dd>
            </div>
          </dl>
          <label className="contract-progress">
            Tiempo transcurrido del plazo · {selected.progress.percent} %
            <progress max={100} value={selected.progress.percent} />
          </label>
          <p className="muted">
            {selected.progress.elapsed} días transcurridos del plazo ·{" "}
            {selected.progress.settled
              ? "Liquidación registrada"
              : `${selected.progress.remaining} días hasta el vencimiento`}
          </p>
          {selected.row.notas && <p>{selected.row.notas}</p>}
        </Panel>
      )}
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
                importe_liquidacion: settlementAmount(
                  text(data, "liquidacion"),
                ),
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
          <DecimalField
            label="Importe de liquidación (€)"
            name="liquidacion"
            required={false}
            value={editor?.importe_liquidacion ?? undefined}
          />
          <p className="muted">
            El vencimiento se calcula por meses. El beneficio aplica interés
            simple anual y la retención que indiques. Rellena la liquidación
            cuando se abone el depósito.
          </p>
        </ContractEditor>
      )}
    </>
  );
}
