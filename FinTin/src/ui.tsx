import { useState, type FormEvent, type ReactNode } from "react";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
export function Form({
  onSave,
  children,
  button = "Guardar",
}: {
  onSave: (data: FormData) => Promise<void>;
  children: ReactNode;
  button?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setBusy(true);
    try {
      await onSave(new FormData(form));
      if (form.isConnected) form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>{children}</fieldset>
      <ErrorBox error={error} />
      <button className="primary" disabled={busy}>
        {busy ? "Guardando…" : button}
      </button>
    </form>
  );
}
export const text = (d: FormData, k: string) => String(d.get(k) || "").trim();
export function ConfirmDelete({ onDelete }: { onDelete: () => Promise<void> }) {
  const [ask, setAsk] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="danger"
        disabled={busy}
        onClick={async () => {
          if (!ask) {
            setAsk(true);
            return;
          }
          setBusy(true);
          try {
            await onDelete();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {ask ? "Confirmar eliminación" : "Eliminar"}
      </button>
      {ask && (
        <button type="button" onClick={() => setAsk(false)}>
          Cancelar
        </button>
      )}
      <ErrorBox error={error} />
    </>
  );
}
