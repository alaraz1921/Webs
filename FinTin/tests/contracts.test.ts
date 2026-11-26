import { describe, expect, it } from "vitest";
import { depositTerms, financingTotals } from "../src/contracts";

describe("Depósitos y financiación", () => {
  it("ajusta el vencimiento al último día del mes y aplica la retención al beneficio", () => {
    const terms = depositTerms({
      id: "a",
      titular: "Titular",
      nombre: "Depósito",
      notas: "",
      fecha_apertura: "2028-01-31",
      duracion_meses: 1,
      interes: "3.00",
      retencion: "19.00",
      aportacion: "12000.00",
    });
    expect(terms.maturity).toBe("2028-02-29");
    expect(terms.net.toFixed(2)).toBe("24.30");
    expect(terms.settlement.toFixed(2)).toBe("12024.30");
  });

  it("calcula importe pagado y pendiente con céntimos y cuenta cada pago como cuota", () => {
    const payment = { financiacion_id: "a", fecha: "2026-11-01", nota: "" };
    const totals = financingTotals(
      {
        id: "a",
        nombre: "Compra",
        notas: "",
        importe_compra: "90.00",
        total_cuotas: 3,
      },
      [
        { ...payment, id: "p1", importe: "30.01" },
        { ...payment, id: "p2", importe: "29.98" },
      ],
    );
    expect(totals.paid.toFixed(2)).toBe("59.99");
    expect(totals.pending.toFixed(2)).toBe("30.01");
    expect(totals.installments).toBe(1);
  });
});
