import { useEffect, useState, type ReactNode } from "react";
import { list } from "./api";
import { decimalComma } from "./amount-input";
import { formatAmount } from "./finance";
import { Field, Form, Modal } from "./ui";

export function ContractRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <tr
      tabIndex={0}
      aria-current={selected || undefined}
      className="contract-row"
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("button, a, input"))
          onSelect();
      }}
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          !["Enter", " "].includes(event.key)
        )
          return;
        event.preventDefault();
        onSelect();
      }}
    >
      {children}
    </tr>
  );
}

export function useContractRows<T>(uid: string, table: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(0);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    list<T>(table, uid)
      .then((data) => {
        if (live) setRows(data);
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
  }, [uid, table, request]);
  return { rows, busy, error, refresh: () => setRequest((value) => value + 1) };
}

export function ContractEditor({
  title,
  children,
  onSave,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} busy={busy} onClose={onClose}>
      <Form onBusyChange={setBusy} onCancel={onClose} onSave={onSave}>
        <div className="form-grid">{children}</div>
      </Form>
    </Modal>
  );
}

export function DecimalField({
  label,
  name,
  value,
  required = true,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        name={name}
        required={required}
        inputMode="decimal"
        onKeyDown={decimalComma}
        defaultValue={value === undefined ? "" : formatAmount(value)}
      />
    </Field>
  );
}
