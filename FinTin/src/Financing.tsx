import { useState } from "react";
import { remove, save } from "./api";
import {
  financingTotals,
  positiveAmount,
  type Financing,
  type Payment,
} from "./contracts";
import { displayDate, moneyWithSymbol } from "./finance";
import { alphabetical } from "./alphabetical";
import { ContractEditor, DecimalField, useContractRows } from "./ContractForms";
import { ConfirmDelete, Empty, ErrorBox, Field, Panel, text } from "./ui";

const table = "financiaciones";
const paymentsTable = "financiacion_pagos";

export function FinancingPage({ uid }: { uid: string }) {
  const purchases = useContractRows<Financing>(uid, table);
  const payments = useContractRows<Payment>(uid, paymentsTable);
  const [selectedId, setSelectedId] = useState("");
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
  const selectedPayments = [...(grouped.get(selected?.id) ?? [])].sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
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
                    {[
                      "Nombre",
                      "Notas",
                      "Importe compra",
                      "Importe pagado",
                      "Importe pendiente",
                      "Total cuotas",
                      "Cuotas pendientes",
                      "Acciones",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const group = grouped.get(row.id) ?? [];
                    const totals = financingTotals(row, group);
                    return (
                      <tr
                        key={row.id}
                        className={
                          selected.id === row.id
                            ? "financing-selected"
                            : undefined
                        }
                      >
                        <th scope="row">
                          <button
                            aria-pressed={selected.id === row.id}
                            onClick={() => setSelectedId(row.id)}
                          >
                            {row.nombre}
                          </button>
                        </th>
                        <td>{row.notas}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Aún no hay compras financiadas.</Empty>
          ))
        )}
      </Panel>
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
                    <th>Fecha</th>
                    <th>Importe</th>
                    <th>Nota</th>
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
            await save(
              table,
              uid,
              {
                nombre: text(data, "nombre"),
                notas: text(data, "notas"),
                importe_compra: positiveAmount(text(data, "importe")),
                total_cuotas: Number(text(data, "cuotas")),
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
