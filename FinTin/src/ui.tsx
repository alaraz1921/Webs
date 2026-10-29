import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="panel">
      {actions ? (
        <div className="panel-heading">
          <h2>{title}</h2>
          {actions}
        </div>
      ) : (
        <h2>{title}</h2>
      )}
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
  onCancel,
  onBusyChange,
}: {
  onSave: (data: FormData) => Promise<void>;
  children: ReactNode;
  button?: string;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setBusy(true);
    onBusyChange?.(true);
    try {
      await onSave(new FormData(form));
      if (form.isConnected) form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>{children}</fieldset>
      <ErrorBox error={error} />
      <button className="primary" disabled={busy}>
        {busy ? "Guardando…" : button}
      </button>
      {onCancel && (
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      )}
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

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const initialInput = dialog.querySelector<HTMLInputElement>(
      "input[data-initial-focus]",
    );
    initialInput?.focus();
    initialInput?.select();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="panel-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          Cerrar
        </button>
      </div>
      {children}
    </dialog>
  );
}
