import { useState } from "react";
import Decimal from "decimal.js";
import { remove, save } from "./api";
import {
  financingTotals,
  positiveAmount,
  type Financing,
  type Payment,
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

const table = "financiaciones";
const paymentsTable = "financiacion_pagos";
const columns = [
  ["nombre", "Nombre"],
  ["notas", "Notas"],
  ["fecha_inicio", "Inicio"],
  ["fecha_fin", "Fin"],
  ["importe_compra", "Importe compra"],
  ["paid", "Importe pagado"],
  ["pending", "Importe pendiente"],
  ["total_cuotas", "Total cuotas"],
  ["installments", "Cuotas pendientes"],
] as const;
type Column = (typeof columns)[number][0];
const numeric: Column[] = [
  "importe_compra",
  "paid",
  "pending",
  "total_cuotas",
  "installments",
];
const paymentColumns = [
  ["fecha", "Fecha"],
  ["importe", "Importe"],
  ["nota", "Nota"],
] as const;

export function FinancingPage({ uid }: { uid: string }) {
  const purchases = useContractRows<Financing>(uid, table);
  const payments = useContractRows<Payment>(uid, paymentsTable);
  const [selectedId, setSelectedId] = useState("");
  const sorting = useTableSort<Column>();
  const paymentSorting = useTableSort<(typeof paymentColumns)[number][0]>();
  const [editor, setEditor] = useState<Financing | null | undefined>();
  const [paymentEditor, setPaymentEditor] = useState<
    Payment | null | undefined
  >();
  const rows = alphabetical(purchases.rows, (r) => r.nombre);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const grouped = new Map<string, Payment[]>();
  for (const payment of payments.rows) {
    const group = grouped.get(payment.financiacion_id) ?? [];
    group.push(payment);
    grouped.set(payment.financiacion_id, group);
  }
  const orderedPayments = [...(grouped.get(selected?.id ?? "") ?? [])].sort(
    (a, b) => b.fecha.localeCompare(a.fecha),
  );
  const selectedPayments = sortRows(
    orderedPayments,
    paymentSorting.sort,
    (p, key) => p[key],
    ["importe"],
  );
  const sorted = sortRows(
    rows.map((row) => {
      const group = grouped.get(row.id) ?? [];
      return { row, group, totals: financingTotals(row, group) };
    }),
    sorting.sort,
    ({ row, totals }, key) =>
      key === "paid" || key === "pending" || key === "installments"
        ? totals[key].toString()
        : row[key],
    numeric,
  );
  const busy = purchases.busy || payments.busy;
  const error = purchases.error || payments.error;
  return (
    <>
      <Panel
        title="Compras financiadas"
        actions={
          <button className="primary" onClick={() => setEditor(null)}>
            Nueva financiación
          </button>
        }
      >
        <ErrorBox error={error} />
        {busy ? (
          <Empty>Cargando financiaciones y pagos…</Empty>
        ) : (
          !error &&
          (rows.length ? (
            <div className="table-wrap">
              <table className="compact-table" aria-label="Compras financiadas">
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
                  {sorted.map(({ row, group, totals }) => (
                    <ContractRow
                      key={row.id}
                      selected={selected?.id === row.id}
                      onSelect={() => setSelectedId(row.id)}
                    >
                      <th scope="row">{row.nombre}</th>
                      <td>{row.notas}</td>
                      <td>
                        {row.fecha_inicio ? displayDate(row.fecha_inicio) : "—"}
                      </td>
                      <td>
                        {row.fecha_fin ? displayDate(row.fecha_fin) : "—"}
                      </td>
                      <td className="numeric">
                        {moneyWithSymbol(row.importe_compra)}
                      </td>
                      <td className="numeric">
                        {moneyWithSymbol(totals.paid)}
                      </td>
                      <td className="numeric">
                        {moneyWithSymbol(totals.pending)}
                      </td>
                      <td className="numeric">{row.total_cuotas}</td>
                      <td className="numeric">{totals.installments}</td>
                      <td>
                        <button onClick={() => setEditor(row)}>Editar</button>
                        <ConfirmDelete
                          onDelete={async () => {
                            if (group.length)
                              throw new Error(
                                "Elimina primero los pagos de esta financiación.",
                              );
                            await remove(table, uid, row.id);
                            if (selectedId === row.id) setSelectedId("");
                            purchases.refresh();
                          }}
                        />
                      </td>
                    </ContractRow>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Aún no hay compras financiadas.</Empty>
          ))
        )}
      </Panel>
      {!busy && !error && selected && (
        <FinancingDetails financing={selected} payments={selectedPayments} />
      )}
      {!busy && !error && selected && (
        <Panel
          title={`Pagos de ${selected.nombre}`}
          actions={
            <button className="primary" onClick={() => setPaymentEditor(null)}>
              Registrar pago
            </button>
          }
        >
          {selectedPayments.length ? (
            <div className="table-wrap">
              <table className="compact-table" aria-label="Pagos realizados">
                <thead>
                  <tr>
                    {paymentColumns.map(([field, label]) => (
                      <SortHeader
                        key={field}
                        field={field}
                        label={label}
                        numeric={field === "importe"}
                        {...paymentSorting}
                      />
                    ))}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{displayDate(payment.fecha)}</td>
                      <td className="numeric">
                        {moneyWithSymbol(payment.importe)}
                      </td>
                      <td>{payment.nota}</td>
                      <td>
                        <button onClick={() => setPaymentEditor(payment)}>
                          Editar
                        </button>
                        <ConfirmDelete
                          onDelete={async () => {
                            await remove(paymentsTable, uid, payment.id);
                            payments.refresh();
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Aún no hay pagos registrados.</Empty>
          )}
        </Panel>
      )}
      {editor !== undefined && (
        <ContractEditor
          title={editor ? "Editar financiación" : "Nueva financiación"}
          onClose={() => setEditor(undefined)}
          onSave={async (data) => {
            const start = text(data, "inicio");
            const end = text(data, "fin");
            if (start && end && end < start)
              throw new Error(
                "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
              );
            await save(
              table,
              uid,
              {
                nombre: text(data, "nombre"),
                notas: text(data, "notas"),
                importe_compra: positiveAmount(text(data, "importe")),
                total_cuotas: Number(text(data, "cuotas")),
                fecha_inicio: start || null,
                fecha_fin: end || null,
              },
              editor?.id,
            );
            setEditor(undefined);
            purchases.refresh();
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
          <DecimalField
            label="Importe compra (€)"
            name="importe"
            value={editor?.importe_compra}
          />
          <Field label="Total cuotas">
            <input
              name="cuotas"
              type="number"
              min="1"
              max="2147483647"
              required
              defaultValue={editor?.total_cuotas}
            />
          </Field>
          <Field label="Notas">
            <textarea name="notas" defaultValue={editor?.notas} />
          </Field>
          <Field label="Fecha de inicio">
            <input
              name="inicio"
              type="date"
              required={!editor}
              defaultValue={editor?.fecha_inicio ?? ""}
            />
          </Field>
          <Field label="Fecha de fin">
            <input
              name="fin"
              type="date"
              required={!editor}
              defaultValue={editor?.fecha_fin ?? ""}
            />
          </Field>
        </ContractEditor>
      )}
      {paymentEditor !== undefined && selected && (
        <ContractEditor
          title={paymentEditor ? "Editar pago" : "Registrar pago"}
          onClose={() => setPaymentEditor(undefined)}
          onSave={async (data) => {
            await save(
              paymentsTable,
              uid,
              {
                financiacion_id: selected.id,
                fecha: text(data, "fecha"),
                importe: positiveAmount(text(data, "importe")),
                nota: text(data, "nota"),
              },
              paymentEditor?.id,
            );
            setPaymentEditor(undefined);
            payments.refresh();
          }}
        >
          <Field label="Fecha">
            <input
              name="fecha"
              type="date"
              required
              defaultValue={paymentEditor?.fecha}
            />
          </Field>
          <DecimalField
            label="Importe (€)"
            name="importe"
            value={paymentEditor?.importe}
          />
          <Field label="Nota">
            <textarea name="nota" defaultValue={paymentEditor?.nota} />
          </Field>
          <p className="muted">Cada pago registrado cuenta como una cuota.</p>
        </ContractEditor>
      )}
    </>
  );
}

function FinancingDetails({
  financing,
  payments,
}: {
  financing: Financing;
  payments: Payment[];
}) {
  const totals = financingTotals(financing, payments);
  const paidShare = Decimal.min(
    100,
    totals.paid.div(financing.importe_compra).times(100),
  ).toNumber();
  return (
    <Panel title={`Detalle de ${financing.nombre}`}>
      <div className="stats contract-stats">
        <article className="stat">
          <span>Importe pendiente</span>
          <strong>{moneyWithSymbol(totals.pending)}</strong>
        </article>
        <article className="stat">
          <span>Cuotas pendientes</span>
          <strong>{totals.installments}</strong>
        </article>
        <article className="stat">
          <span>Fecha de fin</span>
          <strong>
            {financing.fecha_fin
              ? displayDate(financing.fecha_fin)
              : "Sin indicar"}
          </strong>
        </article>
      </div>
      <figure className="financing-chart">
        <div
          className="financing-pie"
          aria-hidden="true"
          style={{
            background: `conic-gradient(#2563eb 0% ${paidShare}%, #bfdbfe ${paidShare}% 100%)`,
          }}
        />
        <figcaption>
          <strong>
            Total financiado: {moneyWithSymbol(financing.importe_compra)}
          </strong>
          <ul className="chart-legend">
            <li>
              <i style={{ background: "#2563eb" }} /> Pagado:{" "}
              {moneyWithSymbol(totals.paid)}
            </li>
            <li>
              <i style={{ background: "#bfdbfe" }} /> Pendiente:{" "}
              {moneyWithSymbol(Decimal.max(0, totals.pending))}
            </li>
          </ul>
          {totals.pending.lt(0) && (
            <small>
              Pagado de más: {moneyWithSymbol(totals.pending.abs())}
            </small>
          )}
        </figcaption>
      </figure>
    </Panel>
  );
}
