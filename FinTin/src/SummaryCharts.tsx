import { useEffect, useRef, useState } from "react";
import { annual } from "./api";
import type { Category, Movement } from "./types";
import { months } from "./types";
import { money } from "./finance";
import {
  categoryEvolution,
  dateInMadrid,
  expenseCategories,
  lastTwelveMonths,
  monthlyChartData,
  topExpenses,
} from "./chart-data";
import { FinanceChart } from "./FinanceChart";
import { Empty, ErrorBox, Field, Panel } from "./ui";
import { YearPicker } from "./YearPicker";

function MonthFilter({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (month: string) => void;
  label: string;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todo el ejercicio</option>
        {months.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>
            {m}
          </option>
        ))}
      </select>
    </Field>
  );
}
const periodLabel = (period: string) =>
  `${months[Number(period.slice(5, 7)) - 1]} ${period.slice(2, 4)}`;
export type ChartPeriod = "rolling" | "year";
export type ChartPeriods = { balance: ChartPeriod; flow: ChartPeriod };
function PeriodFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ChartPeriod;
  onChange: (value: ChartPeriod) => void;
}) {
  return (
    <div className="chart-filters chart-period-filter">
      <Field label={label}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as ChartPeriod)}
        >
          <option value="year">Doce meses del ejercicio</option>
          <option value="rolling">Últimos 12 meses</option>
        </select>
      </Field>
    </div>
  );
}
export function SummaryCharts({
  uid,
  year,
  rows,
  categories,
  currency,
  account,
  chartPeriods,
  setChartPeriod,
}: {
  uid: string;
  year: number;
  rows: Movement[];
  categories: Category[];
  currency: string;
  account: string;
  chartPeriods: ChartPeriods;
  setChartPeriod: (chart: keyof ChartPeriods, value: ChartPeriod) => void;
}) {
  const [today] = useState(() => dateInMadrid(new Date()));
  const periods = lastTwelveMonths(today);
  const [topYear, setTopYear] = useState(year),
    [topMonth, setTopMonth] = useState("");
  const [evolutionYear, setEvolutionYear] = useState(year),
    [evolutionMonth, setEvolutionMonth] = useState(""),
    [category, setCategory] = useState("");
  const cache = useRef({ uid, years: new Map<number, Movement[]>() });
  const [loaded, setLoaded] = useState(new Map<number, Movement[]>()),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const required = [
    ...new Set([
      ...periods.map((p) => Number(p.slice(0, 4))),
      topYear,
      evolutionYear,
      year,
    ]),
  ]
    .sort()
    .join(",");
  useEffect(() => {
    setTopYear(year);
    setEvolutionYear(year);
  }, [year]);
  useEffect(() => {
    let live = true;
    if (cache.current.uid !== uid) cache.current = { uid, years: new Map() };
    const current = cache.current.years;
    current.set(
      year,
      rows.filter((r) => r.fecha_valor.startsWith(`${year}-`)),
    );
    const missing = required
      .split(",")
      .map(Number)
      .filter((y) => !current.has(y));
    setBusy(true);
    setError("");
    Promise.all(
      missing.map(async (y) => {
        const data = await annual(uid, y);
        current.set(
          y,
          data.filter((r) => r.fecha_valor.startsWith(`${y}-`)),
        );
      }),
    )
      .then(() => {
        if (live) setLoaded(new Map(current));
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [uid, year, rows, required]);
  const filtered = (y: number) =>
    (loaded.get(y) || []).filter(
      (r) => r.moneda === currency && (!account || r.cuenta_id === account),
    );
  const rollingRows = [...new Set(periods.map((p) => Number(p.slice(0, 4))))]
    .flatMap(filtered)
    .filter((r) => r.fecha_valor <= today);
  const exercisePeriods = months.map(
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const chartMonths = (period: ChartPeriod) =>
    period === "rolling" ? periods : exercisePeriods;
  const top = topExpenses(filtered(topYear), categories, topMonth);
  const options = expenseCategories(filtered(evolutionYear), categories);
  const selected = options.some((c) => c.key === category)
    ? category
    : options[0]?.key || "";
  const evolution = categoryEvolution(
    filtered(evolutionYear),
    evolutionYear,
    evolutionMonth,
    selected,
  );
  const seriesFor = (period: ChartPeriod) => {
    const monthly = monthlyChartData(
      period === "rolling" ? rollingRows : filtered(year),
      chartMonths(period),
    );
    return [
      {
        name: "Ingresos",
        color: "#2563eb",
        values: monthly.map((m) => m.income),
      },
      {
        name: "Gastos",
        color: "#dc2626",
        values: monthly.map((m) => m.expense),
      },
      {
        name: "No computables",
        color: "#94a3b8",
        values: monthly.map((m) => m.other),
      },
      { name: "Neto", color: "#15803d", values: monthly.map((m) => m.net) },
    ];
  };
  const chart = (content: React.ReactNode) =>
    busy ? (
      <Empty>Cargando gráficos…</Empty>
    ) : error ? (
      <ErrorBox error={error} />
    ) : (
      content
    );
  return (
    <section className="summary-charts" aria-label="Gráficos financieros">
      <Panel
        title={
          chartPeriods.balance === "rolling"
            ? "Balance mensual · últimos 12 meses"
            : `Balance mensual · ejercicio ${year}`
        }
      >
        <PeriodFilter
          label="Periodo del balance mensual"
          value={chartPeriods.balance}
          onChange={(value) => setChartPeriod("balance", value)}
        />
        <p className="muted">
          {periodLabel(chartMonths(chartPeriods.balance)[0])} –{" "}
          {periodLabel(chartMonths(chartPeriods.balance)[11])}
          {chartPeriods.balance === "rolling" ? ", hasta hoy." : "."} Gastos con
          devoluciones descontadas; neto = ingresos − gastos.
        </p>
        {chart(
          <FinanceChart
            title={
              chartPeriods.balance === "rolling"
                ? "Balance mensual de los últimos 12 meses"
                : `Balance mensual del ejercicio ${year}`
            }
            labels={chartMonths(chartPeriods.balance).map(periodLabel)}
            series={seriesFor(chartPeriods.balance)}
            currency={currency}
            bars
          />,
        )}
      </Panel>
      <Panel
        title={
          chartPeriods.flow === "rolling"
            ? "Evolución de ingresos y gastos · últimos 12 meses"
            : `Evolución de ingresos y gastos · ejercicio ${year}`
        }
      >
        <PeriodFilter
          label="Periodo de ingresos y gastos"
          value={chartPeriods.flow}
          onChange={(value) => setChartPeriod("flow", value)}
        />
        <p className="muted">
          {periodLabel(chartMonths(chartPeriods.flow)[0])} –{" "}
          {periodLabel(chartMonths(chartPeriods.flow)[11])}. Se aplican la
          cuenta y moneda seleccionadas.
        </p>
        {chart(
          <FinanceChart
            title="Evolución mensual de ingresos y gastos"
            labels={chartMonths(chartPeriods.flow).map(periodLabel)}
            series={seriesFor(chartPeriods.flow).slice(0, 2)}
            currency={currency}
          />,
        )}
      </Panel>
      <Panel title="Gastos por categorías · las 6 principales">
        <div className="chart-filters">
          <div>
            <YearPicker
              value={topYear}
              onChange={setTopYear}
              label="Ejercicio de categorías"
            />
          </div>
          <MonthFilter
            label="Mes de categorías"
            value={topMonth}
            onChange={setTopMonth}
          />
        </div>
        {chart(
          top.length ? (
            <ul className="category-bars" aria-label="Categorías con más gasto">
              {top.map((c) => (
                <li key={c.key}>
                  <div>
                    <span>{c.name}</span>
                    <strong>{money(c.value, currency)}</strong>
                  </div>
                  <div className="category-bar-track">
                    <div
                      style={{
                        width: `${(Number(c.value) / Number(top[0].value)) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No hay gastos netos positivos para esta selección.</Empty>
          ),
        )}
      </Panel>
      <Panel title="Evolución del gasto de una categoría">
        <div className="chart-filters">
          <div>
            <YearPicker
              value={evolutionYear}
              onChange={setEvolutionYear}
              label="Ejercicio de evolución"
            />
          </div>
          <MonthFilter
            label="Mes de evolución"
            value={evolutionMonth}
            onChange={setEvolutionMonth}
          />
          <Field label="Categoría de evolución">
            <select
              value={selected}
              onChange={(e) => setCategory(e.target.value)}
            >
              {!options.length && (
                <option value="">Sin categorías de gasto</option>
              )}
              {options.map((c) => (
                <option value={c.key} key={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {chart(
          selected ? (
            <FinanceChart
              title={
                evolutionMonth
                  ? "Gasto diario de la categoría"
                  : "Gasto mensual de la categoría"
              }
              labels={evolution.map((e) =>
                evolutionMonth
                  ? e.period.slice(8, 10)
                  : months[Number(e.period.slice(5, 7)) - 1],
              )}
              series={[
                {
                  name:
                    options.find((c) => c.key === selected)?.name || "Gastos",
                  color: "#dc2626",
                  values: evolution.map((e) => e.value),
                },
              ]}
              currency={currency}
            />
          ) : (
            <Empty>Selecciona una categoría con movimientos de gasto.</Empty>
          ),
        )}
      </Panel>
    </section>
  );
}
