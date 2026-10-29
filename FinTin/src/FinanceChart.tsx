import { useId, useState } from "react";
import { formatAmount, money } from "./finance";

export type ChartSeries = { name: string; color: string; values: string[] };
export function FinanceChart({
  title,
  labels,
  series,
  currency,
  bars = false,
}: {
  title: string;
  labels: string[];
  series: ChartSeries[];
  currency: string;
  bars?: boolean;
}) {
  const id = useId();
  const [active, setActive] = useState<{
    series: number;
    point: number;
  } | null>(null);
  const numbers = series.map((s) => s.values.map(Number));
  const lo = Math.min(0, ...numbers.flat()),
    hi = Math.max(1, ...numbers.flat());
  const span = hi - lo,
    left = Math.max(
      100,
      Math.min(
        230,
        Math.max(
          formatAmount(String(lo)).length,
          formatAmount(String(hi)).length,
        ) * 6.5,
      ),
    ),
    width = 800 - left,
    top = 18,
    height = 210;
  const y = (v: number) => top + ((hi - v) / span) * height;
  const step = width / labels.length;
  const x = (i: number) => left + step * (i + 0.5);
  const groupWidth = step * 0.8,
    barWidth = groupWidth / series.length;
  return (
    <figure className="finance-chart" aria-label={title}>
      <ul className="chart-legend" aria-label="Series del gráfico">
        {series.map((s) => (
          <li key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
      <div className="chart-plot">
        <svg viewBox="0 0 820 265" role="img" aria-labelledby={id}>
          <title id={id}>
            {title}. Importes en {currency}. El detalle exacto está disponible
            en Ver datos.
          </title>
          {Array.from({ length: 5 }, (_, i) => hi - (span * i) / 4).map(
            (value, i) => (
              <g key={i}>
                <line
                  x1={left}
                  x2={left + width}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#e2e8f0"
                />
                <text
                  x={left - 8}
                  y={y(value) + 4}
                  textAnchor="end"
                  className="chart-axis"
                >
                  {formatAmount(String(value))}
                </text>
              </g>
            ),
          )}
          <line
            x1={left}
            x2={left + width}
            y1={y(0)}
            y2={y(0)}
            stroke="#94a3b8"
          />
          {labels.map(
            (label, i) =>
              (i % Math.ceil(labels.length / 12) === 0 ||
                i === labels.length - 1) && (
                <text
                  key={i}
                  x={x(i)}
                  y={250}
                  textAnchor="middle"
                  className="chart-axis"
                >
                  {label}
                </text>
              ),
          )}
          {series.map((s, si) => (
            <g key={s.name}>
              {!bars && (
                <polyline
                  points={numbers[si]
                    .map((n, i) => `${x(i)},${y(n)}`)
                    .join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                />
              )}
              {numbers[si].map((n, i) => {
                const description = `${labels[i]} · ${s.name}: ${money(s.values[i], currency)}`;
                const props = {
                  tabIndex: 0,
                  role: "img",
                  "aria-label": description,
                  onMouseEnter: () => setActive({ series: si, point: i }),
                  onMouseLeave: () => setActive(null),
                  onFocus: () => setActive({ series: si, point: i }),
                  onBlur: () => setActive(null),
                };
                return bars ? (
                  <rect
                    key={i}
                    {...props}
                    x={x(i) - groupWidth / 2 + si * barWidth}
                    y={Math.min(y(n), y(0))}
                    width={Math.max(1, barWidth - 1)}
                    height={Math.max(1, Math.abs(y(n) - y(0)))}
                    fill={s.color}
                  >
                    <title>{description}</title>
                  </rect>
                ) : (
                  <circle
                    key={i}
                    {...props}
                    cx={x(i)}
                    cy={y(n)}
                    r={4}
                    fill={s.color}
                    stroke="white"
                    strokeWidth="1"
                  >
                    <title>{description}</title>
                  </circle>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <div className="chart-tooltip" aria-live="polite">
        {active && active.point < labels.length && active.series < series.length
          ? `${labels[active.point]} · ${series[active.series].name}: ${money(series[active.series].values[active.point], currency)}`
          : `Importes en ${currency}. Sitúa el cursor o el foco sobre un dato.`}
      </div>
      <details className="chart-details">
        <summary>Ver datos</summary>
        <div className="table-wrap">
          <table className="compact-table" aria-label={`Datos: ${title}`}>
            <thead>
              <tr>
                <th>Periodo</th>
                {series.map((s) => (
                  <th key={s.name} className="numeric">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, i) => (
                <tr key={i}>
                  <th scope="row">{label}</th>
                  {series.map((s) => (
                    <td className="numeric" key={s.name}>
                      {money(s.values[i], currency)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
