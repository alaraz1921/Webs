import { useEffect, useMemo, useRef, useState } from "react";
import {
  manualImportRows,
  MAX_MANUAL_IMPORT_ROWS,
  resolveManualAccounts,
} from "./manual-import";
import type { Batch, CsvRow } from "./types";
import { kinds, labels } from "./types";
import {
  aliasKey,
  parseCsv,
  parseManualCsv,
  manualHeaders,
  readCsv,
  fileHash,
  validateAccounts,
} from "./csv";
import {
  client,
  checked,
  list,
  prepare,
  save,
  annual,
  importManual,
} from "./api";
import { sum, money } from "./finance";
import { Panel, Field, Empty, ErrorBox, Form, text } from "./ui";
import type { MasterProps } from "./Settings";
export function ImportPage(
  props: MasterProps & { year: number; onBusy?: (busy: boolean) => void },
) {
  const { uid, year, accounts, aliases, categories, reload, onBusy } = props;
  const [mode, setMode] = useState<"csv" | "manual">("csv");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [manualAssignments, setManualAssignments] = useState<
    Record<string, string>
  >({});
  const [file, setFile] = useState<File | null>(null),
    [encoding, setEncoding] = useState<"utf-8" | "windows-1252">("utf-8"),
    [sourcePreview, setPreview] = useState<ReturnType<typeof parseCsv> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [history, setHistory] = useState<Batch[]>([]),
    [old, setOld] = useState<CsvRow[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [progress, setProgress] = useState(0),
    [confirmed, setConfirmed] = useState(false),
    [hash, setHash] = useState(""),
    [resume, setResume] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    if (mode === "manual") {
      setHistory([]);
      setOld([]);
      setLoading(false);
      return () => {
        live = false;
      };
    }
    Promise.all([list<Batch>("importaciones", uid), annual(uid, year)])
      .then(([h, m]) => {
        if (live) {
          setHistory(h);
          setOld(
            m
              .filter((r) => r.origen === "csv")
              .map((r) => ({
                ...r,
                numero_fila: 0,
                entidad_csv: "",
                nombre_producto_csv: "",
                tipo_producto_csv: "",
              })),
          );
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [uid, year, message, mode]);
  useEffect(() => {
    let live = true;
    setPreview(null);
    setConfirmed(false);
    setResume("");
    setHash("");
    setManualIds([]);
    setManualAssignments({});
    if (file) {
      if (mode === "manual" && file.size > 10 * 1024 * 1024) {
        setError("El CSV manual no puede superar 10 MiB.");
        setBusy(false);
        return () => {
          live = false;
        };
      }
      setBusy(true);
      Promise.all([readCsv(file, encoding), fileHash(file)])
        .then(([t, h]) => {
          if (live) {
            const parsed =
              mode === "manual" ? parseManualCsv(t, year) : parseCsv(t, year);
            if (
              mode === "manual" &&
              parsed.rows.length > MAX_MANUAL_IMPORT_ROWS
            )
              parsed.errors.push(
                `Máximo ${MAX_MANUAL_IMPORT_ROWS} filas por carga manual.`,
              );
            setPreview(parsed);
            setManualIds(
              mode === "manual"
                ? parsed.rows.map(() => crypto.randomUUID())
                : [],
            );
            setHash(h);
            setError("");
          }
        })
        .catch((e) => {
          if (live)
            setError(
              "No se pudo leer el archivo: " +
                e.message +
                ". Prueba Windows-1252 si procede.",
            );
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }
    return () => {
      live = false;
    };
  }, [file, encoding, year, mode]);
  const manualResolution = useMemo(
    () =>
      resolveManualAccounts(
        sourcePreview?.rows || [],
        accounts,
        aliases,
        manualAssignments,
      ),
    [sourcePreview, accounts, aliases, manualAssignments],
  );
  const preview =
    sourcePreview && mode === "manual"
      ? { ...sourcePreview, rows: manualResolution.rows }
      : sourcePreview;
  const importAliases = mode === "manual" ? manualResolution.aliases : aliases;
  const missing = useMemo(
    () => [
      ...new Map(
        (mode === "csv" ? sourcePreview?.rows || [] : [])
          .filter((r) => !aliases.some((a) => aliasKey(a) === aliasKey(r)))
          .map((r) => [aliasKey(r), r]),
      ).values(),
    ],
    [sourcePreview, aliases, mode],
  );
  const accountErrors = preview
    ? validateAccounts(preview.rows, importAliases, accounts).map((error) =>
        mode === "manual"
          ? error.replace(
              "falta alias de cuenta",
              "selecciona una cuenta de destino",
            )
          : error,
      )
    : [];
  const currencies = [
    ...new Set(
      [...(preview?.rows || []), ...old].map((r) => r.moneda).filter(Boolean),
    ),
  ];
  const pending = history.filter(
    (h) =>
      h.estado === "pendiente" &&
      h.ejercicio === year &&
      h.sha256_archivo === hash &&
      h.filas_esperadas === preview?.rows.length,
  );
  async function publish() {
    if (
      !preview ||
      !file ||
      !confirmed ||
      busy ||
      loading ||
      preview.errors.length ||
      accountErrors.length
    )
      return;
    if (mode === "manual") {
      setBusy(true);
      setError("");
      setMessage("");
      try {
        await importManual(
          uid,
          manualImportRows(
            preview.rows,
            accounts,
            importAliases,
            categories,
            manualIds,
          ),
        );
        setMessage(
          `Importación confirmada: ${preview.rows.length} movimientos manuales añadidos.`,
        );
        setPreview(null);
        setFile(null);
        setConfirmed(false);
        setManualIds([]);
        if (fileInput.current) fileInput.current.value = "";
        try {
          await reload();
        } catch {
          setError(
            "Los manuales ya están guardados, pero no se pudo actualizar la vista. No vuelvas a importar el archivo; consulta Movimientos.",
          );
        }
      } catch (e) {
        setError(
          (e as Error).message +
            " Si hubo un fallo de conexión, reintenta esta misma previsualización para comprobar la carga sin duplicarla. No cambies el archivo ni recargues la página antes de comprobar Movimientos.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const id = await prepare(
        uid,
        year,
        file,
        hash,
        preview.rows,
        setProgress,
        resume || undefined,
      );
      setResume(id);
      checked(
        await client().rpc("fintin_publicar_importacion", {
          p_importacion_id: id,
        }),
      );
      setMessage(
        `Importación confirmada: ${preview.rows.length} movimientos CSV de ${year}.`,
      );
      setPreview(null);
      setFile(null);
      setConfirmed(false);
      await reload();
    } catch (e) {
      setError(
        (e as Error).message +
          " Puedes reintentar el mismo lote pendiente; los datos publicados no se modifican si la RPC falla.",
      );
      const h = await list<Batch>("importaciones", uid).catch(() => history);
      setHistory(h);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel
        title={
          mode === "csv"
            ? "Importa un ejercicio completo"
            : "Importar movimientos manuales"
        }
      >
        <Field label="Destino de los movimientos">
          <select
            value={mode}
            disabled={busy || loading}
            onChange={(e) => {
              setMode(e.target.value as typeof mode);
              setFile(null);
              setPreview(null);
              setConfirmed(false);
              setMessage("");
              setError("");
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            <option value="csv">CSV del agregador · sustituir ejercicio</option>
            <option value="manual">Movimientos manuales · añadir</option>
          </select>
        </Field>
        <p className="muted">
          {mode === "csv"
            ? "El agregador es la fuente de verdad. Cada publicación sustituye todos los CSV del ejercicio, conservando manuales y otros años."
            : `CSV de 9 columnas. La moneda se toma de la cuenta de destino. Se añadirán manuales editables, conservando todos los movimientos existentes. Máximo ${MAX_MANUAL_IMPORT_ROWS} filas por carga.`}
        </p>
        {mode === "manual" && (
          <p className="muted">
            Cabecera: <code>{manualHeaders.join(",")}</code>{" "}
            <a
              href={`${import.meta.env.BASE_URL}fixtures/manuales-ficticios.csv`}
              download
            >
              Descargar ejemplo CSV
            </a>
          </p>
        )}
        <p className="muted">
          Fechas: D/M/YYYY o D/M/YY (00–99 corresponden a 2000–2099). La fecha
          valor debe pertenecer al ejercicio seleccionado. Si falta la fecha de
          operación, se usará la fecha valor.
        </p>
        <fieldset disabled={busy || loading}>
          <div className="form-grid">
            <Field label={`CSV del ejercicio ${year}`}>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  setMessage("");
                  setFile(e.target.files?.[0] || null);
                }}
              />
            </Field>
            <Field label="Codificación">
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value as typeof encoding)}
              >
                <option value="utf-8">UTF-8</option>
                <option value="windows-1252">
                  Windows-1252 (conversión explícita)
                </option>
              </select>
            </Field>
          </div>
        </fieldset>
        {encoding === "windows-1252" && (
          <p className="notice">
            Se decodifica el archivo como Windows-1252. Comprueba tildes y
            conceptos en la previsualización.
          </p>
        )}
        <ErrorBox error={error} />
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        {busy && (
          <p role="status">
            {mode === "csv" ? `Procesando… ${progress}%` : "Procesando…"}
          </p>
        )}
      </Panel>
      {preview && (
        <>
          <Panel title="Validación y correspondencias">
            <p>
              {file?.name} · {preview.rows.length} filas válidas ·{" "}
              {preview.errors.length} errores de archivo ·{" "}
              {accountErrors.length} incidencias de cuenta
            </p>
            {[
              ...preview.errors.slice(0, 100),
              ...accountErrors.slice(0, 20),
            ].map((e, i) => (
              <p className="negative" key={i}>
                {e}
              </p>
            ))}
            {preview.errors.length > 100 && (
              <p>
                Se muestran los primeros 100 errores. Corrige el archivo y
                vuelve a cargarlo.
              </p>
            )}
            {preview.warnings.map((w) => (
              <p className="notice" key={w}>
                {w}
              </p>
            ))}
            {mode === "manual" &&
              manualResolution.products.map((p) => (
                <Field
                  key={p.key}
                  label={
                    "Cuenta de destino: " +
                    p.row.entidad_csv +
                    " / " +
                    p.row.nombre_producto_csv
                  }
                >
                  <select
                    disabled={busy}
                    value={p.accountId}
                    onChange={(e) => {
                      setManualAssignments((previous) => ({
                        ...previous,
                        [p.key]: e.target.value,
                      }));
                      setConfirmed(false);
                    }}
                  >
                    <option value="">
                      Selecciona explícitamente una cuenta
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.entidad} · {a.nombre_producto} · {a.moneda}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            {missing.map((r) => (
              <AliasResolver key={aliasKey(r)} row={r} {...props} />
            ))}
            {!!preview.rows.length &&
              !preview.errors.length &&
              !missing.length &&
              !accountErrors.length && (
                <p className="success">
                  {mode === "csv"
                    ? "Todas las cuentas tienen alias, moneda y fecha inicial compatibles."
                    : "Las cuentas de destino y sus fechas de partida son compatibles."}
                </p>
              )}
          </Panel>
          <Panel title="Previsualización">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Fecha valor</th>
                    <th>Concepto</th>
                    <th>Cuenta CSV</th>
                    <th>Tipo / categoría</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((r) => (
                    <tr key={r.numero_fila}>
                      <td>{r.numero_fila}</td>
                      <td>{r.fecha_valor}</td>
                      <td>
                        {r.concepto}
                        <small>{r.nota}</small>
                      </td>
                      <td>
                        {r.entidad_csv} / {r.nombre_producto_csv}
                        {mode === "csv" && ` / ${r.tipo_producto_csv}`}
                      </td>
                      <td>
                        {labels[r.tipo_movimiento]} / {r.categoria_csv}
                      </td>
                      <td>{money(r.importe, r.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              Primeras 50 filas. Los duplicados se conservan como movimientos
              distintos.
            </p>
          </Panel>
          <Panel
            title={
              mode === "csv"
                ? "Confirmar sustitución"
                : "Confirmar incorporación"
            }
          >
            {mode === "csv" ? (
              <p>
                <b>{old.length}</b> movimientos CSV anteriores →{" "}
                <b>{preview.rows.length}</b> filas del nuevo archivo. Esta
                comparación no identifica movimientos nuevos individuales.
              </p>
            ) : (
              <p>
                Se añadirán {preview.rows.length} movimientos manuales de {year}
                . No se borrará ni sustituirá ningún movimiento. Los duplicados
                del archivo se conservan. Seleccionar e importar el mismo
                archivo otra vez creará una carga nueva y añadirá duplicados.
              </p>
            )}
            {mode === "manual" && (
              <p className="notice">
                Las categorías se vinculan por nombre y tipo cuando existe una
                correspondencia única. Las demás conservan su nombre del CSV
                como texto, sin crear categorías automáticamente.
              </p>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Moneda / tipo</th>
                    {mode === "csv" && <th>Anterior</th>}
                    <th>Nuevo archivo</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.flatMap((c) =>
                    kinds.map((k) => (
                      <tr key={c + k}>
                        <td>
                          {c} · {labels[k]}
                        </td>
                        {mode === "csv" && (
                          <td>
                            {money(
                              sum(
                                old
                                  .filter(
                                    (r) =>
                                      r.moneda === c && r.tipo_movimiento === k,
                                  )
                                  .map((r) => r.importe),
                              ),
                              c,
                            )}
                          </td>
                        )}
                        <td>
                          {money(
                            sum(
                              preview.rows
                                .filter(
                                  (r) =>
                                    r.moneda === c && r.tipo_movimiento === k,
                                )
                                .map((r) => r.importe),
                            ),
                            c,
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            <fieldset disabled={busy || loading}>
              {mode === "csv" && (
                <Field label="Lote de preparación">
                  <select
                    value={resume}
                    onChange={(e) => setResume(e.target.value)}
                  >
                    <option value="">Crear lote nuevo</option>
                    {pending.map((h) => (
                      <option key={h.id} value={h.id}>
                        Reanudar {h.creado_en} · {h.id}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {mode === "csv"
                  ? `Confirmo sustituir todos los movimientos CSV de ${year} por este archivo.`
                  : `Confirmo añadir ${preview.rows.length} movimientos manuales sin sustituir los existentes.`}
              </label>
              <button
                className="primary"
                disabled={
                  !confirmed ||
                  !!preview.errors.length ||
                  !!accountErrors.length ||
                  !hash
                }
                onClick={publish}
              >
                {mode === "csv" ? "Publicar importación" : "Importar manuales"}
              </button>
            </fieldset>
            {mode === "csv" && (
              <progress
                max={100}
                value={progress}
                aria-label="Carga del lote"
              />
            )}
          </Panel>
        </>
      )}
      {mode === "csv" && (
        <Panel title={`Historial de ${year}`}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Archivo / hash SHA-256</th>
                  <th>Fecha</th>
                  <th>Filas esperadas / publicadas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {history
                  .filter((h) => h.ejercicio === year)
                  .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
                  .map((h) => (
                    <tr key={h.id}>
                      <td>
                        {h.nombre_archivo}
                        <small className="hash">{h.sha256_archivo}</small>
                      </td>
                      <td>{new Date(h.creado_en).toLocaleString("es-ES")}</td>
                      <td>
                        {h.filas_esperadas} / {h.filas_importadas}
                      </td>
                      <td>
                        <span className="badge">{h.estado}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!history.some((h) => h.ejercicio === year) && (
            <Empty>Aún no hay importaciones en este ejercicio.</Empty>
          )}
        </Panel>
      )}
    </>
  );
}
function AliasResolver({
  row,
  accounts,
  uid,
  reload,
}: MasterProps & { row: CsvRow }) {
  return (
    <div className="alias-resolver">
      <b>
        {row.entidad_csv} / {row.nombre_producto_csv} /{" "}
        {row.tipo_producto_csv || "Sin tipo"}
      </b>
      <Form
        button="Guardar correspondencia"
        onSave={async (d) => {
          await save("cuenta_aliases", uid, {
            cuenta_id: text(d, "cuenta_id"),
            entidad_csv: row.entidad_csv,
            nombre_producto_csv: row.nombre_producto_csv,
            tipo_producto_csv: row.tipo_producto_csv,
          });
          await reload();
        }}
      >
        <Field label="Asignar a cuenta">
          <select name="cuenta_id" required>
            <option value="">Selecciona explícitamente</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.entidad} · {a.nombre_producto} · {a.tipo_producto} ·{" "}
                {a.moneda}
              </option>
            ))}
          </select>
        </Field>
      </Form>
    </div>
  );
}
