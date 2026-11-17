import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { annual } from "./api";
import type { Movement } from "./types";
import { months } from "./types";
import type { MasterProps } from "./Settings";
import { YearPicker } from "./YearPicker";
import { Field, Panel, Empty, ErrorBox } from "./ui";
import { FinanceChart } from "./FinanceChart";
import { moneyWithSymbol } from "./finance";
import { comparisonData } from "./comparison-data";

export function ComparisonsPage({
  uid,
  accounts,
  categories,
  year,
}: MasterProps & { year: number }) {
  const [firstYear, setFirstYear] = useState(year - 1);
  const [secondYear, setSecondYear] = useState(year);
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Movement[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    Promise.all(
      [...new Set([firstYear, secondYear])].map((y) => annual(uid, y)),
    )
      .then((rows) => {
        if (live) setData(rows.flat());
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [uid, firstYear, secondYear]);
  const years: [number, number] = [
    Math.min(firstYear, secondYear),
    Math.max(firstYear, secondYear),
  ];
  const currencies = [
    ...new Set([
      ...accounts.map((a) => a.moneda),
      ...data.map((r) => r.moneda),
    ]),
  ].sort();
  if (!currencies.length) currencies.push("EUR");
  const period = (y: number) =>
    `${month ? months[Number(month) - 1] : "Ejercicio"} ${y}`;
  return (
    <>
      <div className="context-bar comparison-filters">
        <Field label="Mes">
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Todo el ejercicio</option>
            {months.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <YearPicker
          label="Primer ejercicio"
          value={firstYear}
          onChange={setFirstYear}
        />
        <YearPicker
          label="Segundo ejercicio"
          value={secondYear}
          onChange={setSecondYear}
        />
      </div>
      {firstYear === secondYear ? (
        <Empty>Selecciona dos ejercicios distintos.</Empty>
      ) : busy ? (
        <Empty>Cargando comparativas…</Empty>
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        currencies.map((currency) => {
          const result = comparisonData(
            data,
            years,
            month,
            currency,
            categories,
          );
          return (
            <section key={currency} aria-label={`Comparativas en ${currency}`}>
              <h2>
                {period(years[0])} y {period(years[1])} ·{" "}
                {currency === "EUR" ? "€" : currency}
              </h2>
              <p className="muted">
                Se compara por fecha de valor. Gastos con devoluciones
                descontadas; neto = ingresos − gastos. No computables excluidos.
                Importes separados por moneda.
              </p>
              <Panel title="Ingresos, gastos y neto">
                <FinanceChart
                  title="Comparación de ingresos, gastos y neto"
                  labels={month ? ["Ingresos", "Gastos", "Neto"] : months}
                  series={
                    month
                      ? years.map((y, i) => ({
                          name: period(y),
                          color: i === 0 ? "#94a3b8" : "#2563eb",
                          values: result.summary[i],
                        }))
                      : ["Ingresos", "Gastos", "Neto"].flatMap((name, metric) =>
                          years.map((y, i) => ({
                            name: `${name} ${y}`,
                            color: [
                              ["#93c5fd", "#2563eb"],
                              ["#fca5a5", "#dc2626"],
                              ["#86efac", "#15803d"],
                            ][metric][i],
                            values: result.monthly[i].map((m) => m[metric]),
                          })),
                        )
                  }
                  currency={currency}
                  bars
                />
                {!result.count.some(Boolean) && (
                  <Empty>No hay movimientos para estos periodos.</Empty>
                )}
              </Panel>
              <MirrorChart
                title="Gastos por categoría"
                rows={result.expenses}
                periods={years.map(period)}
                currency={currency}
              />
              <MirrorChart
                title="Ingresos por categoría"
                rows={result.income}
                periods={years.map(period)}
                currency={currency}
              />
            </section>
          );
        })
      )}
    </>
  );
}

function MirrorChart({
  title,
  rows,
  periods,
  currency,
}: {
  title: string;
  rows: { key: string; name: string; values: string[] }[];
  periods: string[];
  currency: string;
}) {
  const max = Decimal.max(
    1,
    ...rows.flatMap((r) => r.values.map((v) => new Decimal(v).abs())),
  );
  return (
    <Panel title={title}>
      {!rows.length ? (
        <Empty>
          No hay movimientos de este tipo para los periodos seleccionados.
        </Empty>
      ) : (
        <figure className="mirror-chart" aria-label={title}>
          <div className="mirror-periods">
            <strong>{periods[0]}</strong>
            <strong>{periods[1]}</strong>
          </div>
          <p className="muted">
            Misma escala en ambos lados. Las cifras negativas se muestran con
            barras rayadas.
          </p>
          {rows.map((row) => (
            <div className="mirror-row" key={row.key}>
              <div className="mirror-category">{row.name}</div>
              <div className="mirror-values">
                {row.values.map((value, i) => (
                  <span key={i}>{moneyWithSymbol(value, currency)}</span>
                ))}
              </div>
              <div className="mirror-bars">
                {row.values.map((value, i) => (
                  <div className="mirror-half" key={i}>
                    <div
                      className={`mirror-bar ${i === 0 ? "older" : "newer"}${new Decimal(value).lt(0) ? " refund" : ""}`}
                      style={{
                        width: `${new Decimal(value).abs().div(max).times(100).toNumber()}%`,
                      }}
                      title={`${periods[i]} · ${row.name}: ${moneyWithSymbol(value, currency)}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </figure>
      )}
    </Panel>
  );
}
