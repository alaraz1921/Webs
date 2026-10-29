import { useState } from "react";
import { Panel } from "./ui";
function useDisplayPreference(preferenceKey: string) {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey) === "true";
    } catch {
      return false;
    }
  });
  const update = (value: boolean) => {
    setVisible(value);
    // Solo una preferencia visual booleana; sin sesión ni datos financieros.
    try {
      localStorage.setItem(preferenceKey, String(value));
    } catch {
      /* La preferencia sigue funcionando durante esta sesión. */
    }
  };
  return [visible, update] as const;
}
export const useShowFlows = () =>
  useDisplayPreference("fintin.display.showFlows");
export const useShowInitial = () =>
  useDisplayPreference("fintin.display.showInitial");
export function GeneralSettings({
  showFlows,
  onShowFlows,
  showInitial,
  onShowInitial,
}: {
  showFlows: boolean;
  onShowFlows: (value: boolean) => void;
  showInitial: boolean;
  onShowInitial: (value: boolean) => void;
}) {
  return (
    <Panel title="Visualización de Cuentas">
      <label className="check">
        <input
          type="checkbox"
          checked={!showFlows}
          onChange={(e) => onShowFlows(!e.target.checked)}
        />
        Ocultar entradas y salidas
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={!showInitial}
          onChange={(e) => onShowInitial(!e.target.checked)}
        />
        Ocultar saldo y fecha inicial
      </label>
      <p className="muted">
        Por defecto se ocultan ambos detalles. Si las dos opciones están
        marcadas, las filas del cuadrante de Cuentas se muestran más compactas.
        Las preferencias se recuerdan en este navegador.
      </p>
    </Panel>
  );
}
