import { useState } from "react";
import { Panel } from "./ui";
const preferenceKey = "fintin.display.showFlows";
export function useShowFlows() {
  const [showFlows, setShowFlows] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey) !== "false";
    } catch {
      return true;
    }
  });
  const update = (value: boolean) => {
    setShowFlows(value);
    // Solo una preferencia visual booleana; sin sesión ni datos financieros.
    try {
      localStorage.setItem(preferenceKey, String(value));
    } catch {
      /* La preferencia sigue funcionando durante esta sesión. */
    }
  };
  return [showFlows, update] as const;
}
export function GeneralSettings({
  showFlows,
  onShowFlows,
}: {
  showFlows: boolean;
  onShowFlows: (value: boolean) => void;
}) {
  return (
    <Panel title="Visualización de Cuentas">
      <label className="check">
        <input
          type="checkbox"
          checked={showFlows}
          onChange={(e) => onShowFlows(e.target.checked)}
        />
        Mostrar entradas y salidas
      </label>
      <p className="muted">
        Muestra el detalle mensual de entradas y salidas en el cuadrante de
        Cuentas. Esta preferencia se recuerda en este navegador.
      </p>
    </Panel>
  );
}
