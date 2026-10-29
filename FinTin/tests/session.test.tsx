// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  unsubscribe: vi.fn(),
  listener: null as
    ((event: AuthChangeEvent, session: Session | null) => void) | null,
}));
const api = vi.hoisted(() => ({
  rpc: vi.fn(),
  list: vi.fn(),
  annual: vi.fn(),
  movements: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  prepare: vi.fn(),
  importManual: vi.fn(),
}));
vi.mock("../src/api", () => {
  const db = {
    auth: {
      ...auth,
      onAuthStateChange: (listener: typeof auth.listener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
      },
    },
    rpc: api.rpc,
  };
  return {
    ...api,
    configured: true,
    db,
    client: () => db,
    checked: (r: { data: unknown }) => r.data,
  };
});
import App from "../src/App";
const session: Session = {
  access_token: "synthetic-access",
  refresh_token: "synthetic-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user: {
    id: "owner",
    email: "ejemplo@example.invalid",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  },
};
const account = {
  id: "account",
  user_id: "owner",
  entidad: "Banco ficticio",
  nombre_producto: "Cuenta ficticia",
  tipo_producto: "Cuenta",
  moneda: "EUR",
  saldo_inicial: "100.00",
  fecha_saldo_inicial: "2025-12-31",
  activo: true,
};
const movement = {
  id: "movement",
  user_id: "owner",
  cuenta_id: "account",
  fecha_valor: "2026-03-10",
  fecha_operacion: "2026-03-10",
  importe: "12.00",
  moneda: "EUR",
  concepto: "Ingreso ficticio",
  tipo_movimiento: "ingreso",
  categoria_id: "category",
  categoria_csv: "",
  nota: "",
  origen: "csv",
  entidad_csv: "Entidad original ficticia",
  nombre_producto_csv: "Producto original del CSV",
  tipo_producto_csv: "Cuenta corriente",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function emit(
  event: AuthChangeEvent,
  value: Session | null = { ...session },
) {
  await act(async () => {
    auth.listener!(event, value);
  });
}
async function chooseYear(u: ReturnType<typeof userEvent.setup>, year: string) {
  await u.click(await screen.findByRole("combobox", { name: /^Ejercicio \d/ }));
  await u.click(screen.getByRole("option", { name: year }));
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  history.replaceState(null, "", "#resumen");
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  api.rpc.mockResolvedValue({ data: true, error: null });
  api.list.mockImplementation(async (table) =>
    table === "cuentas"
      ? [account]
      : table === "categorias"
        ? [
            {
              id: "category",
              user_id: "owner",
              nombre: "Ingreso ficticio",
              tipo_movimiento: "ingreso",
            },
          ]
        : [],
  );
  api.annual.mockResolvedValue([movement]);
  api.movements.mockResolvedValue({ rows: [movement], count: 100 });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Continuidad de sesión y autorización", () => {
  it("sustituye moneda por mes solo en Resumen y conserva la elección al renovar sesión", async () => {
    render(<App />);
    const u = userEvent.setup();
    await screen.findByRole("button", { name: "12,00 EUR" });
    expect(screen.queryByLabelText("Moneda")).toBeNull();
    await u.selectOptions(screen.getByLabelText("Mes", { exact: true }), "03");
    expect(
      (screen.getByLabelText("Mes de categorías") as HTMLSelectElement).value,
    ).toBe("03");
    expect(
      (screen.getByLabelText("Mes de evolución") as HTMLSelectElement).value,
    ).toBe("03");
    await emit("SIGNED_IN");
    expect(
      (screen.getByLabelText("Mes", { exact: true }) as HTMLSelectElement)
        .value,
    ).toBe("03");
    await u.click(
      screen
        .getAllByRole("link", { name: "Cuentas" })
        .find((a) => a.getAttribute("href") === "#cuentas")!,
    );
    expect(screen.getByLabelText("Moneda")).toBeTruthy();
    expect(screen.queryByLabelText("Mes", { exact: true })).toBeNull();
  });
  it("muestra todas las monedas por separado y abre movimientos en la moneda del bloque", async () => {
    api.list.mockImplementation(async (table) =>
      table === "cuentas"
        ? [
            account,
            {
              ...account,
              id: "usd",
              nombre_producto: "Cuenta USD ficticia",
              moneda: "USD",
            },
          ]
        : [],
    );
    api.annual.mockResolvedValue([
      movement,
      {
        ...movement,
        id: "usd-move",
        cuenta_id: "usd",
        moneda: "USD",
        importe: "1000.00",
      },
    ]);
    render(<App />);
    const u = userEvent.setup();
    const usd = await screen.findByRole("region", { name: "Resumen en USD" });
    await u.click(
      await within(usd).findByRole("button", { name: "1.000,00 USD" }),
    );
    expect(
      ((await screen.findByLabelText("Moneda")) as HTMLSelectElement).value,
    ).toBe("USD");
    expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe(
      "2026-03-01",
    );
  });
  it("deduce la moneda al elegir una cuenta de Resumen y mantiene Cuentas coherente", async () => {
    api.list.mockImplementation(async (table) =>
      table === "cuentas"
        ? [
            account,
            {
              ...account,
              id: "usd",
              nombre_producto: "Cuenta USD ficticia",
              moneda: "USD",
            },
          ]
        : [],
    );
    render(<App />);
    const u = userEvent.setup();
    await screen.findByRole("region", { name: "Resumen en USD" });
    await u.selectOptions(screen.getByLabelText("Cuenta"), "usd");
    expect(screen.queryByRole("region", { name: "Resumen en EUR" })).toBeNull();
    await u.click(
      screen
        .getAllByRole("link", { name: "Cuentas" })
        .find((a) => a.getAttribute("href") === "#cuentas")!,
    );
    expect((screen.getByLabelText("Moneda") as HTMLSelectElement).value).toBe(
      "USD",
    );
    expect((screen.getByLabelText("Cuenta") as HTMLSelectElement).value).toBe(
      "usd",
    );
  });
  it("recuerda la preferencia General y muestra entradas y salidas sin moneda", async () => {
    history.replaceState(null, "", "#configuracion/general");
    api.list.mockImplementation(async (t) =>
      t === "cuentas"
        ? [account]
        : t === "v_conciliacion_mensual"
          ? [
              {
                cuenta_id: "account",
                fecha_cierre: "2026-03-31",
                moneda: "EUR",
                saldo_calculado: "112.00",
                saldo_real: null,
                diferencia: null,
              },
            ]
          : [],
    );
    const app = render(<App />),
      u = userEvent.setup();
    const toggle = await screen.findByRole("checkbox", {
      name: "Ocultar entradas y salidas",
    });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Ocultar saldo y fecha inicial",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    const accountLink = () =>
      screen
        .getAllByRole("link", { name: "Cuentas" })
        .find((a) => a.getAttribute("href") === "#cuentas")!;
    await u.click(accountLink());
    await chooseYear(u, "2026");
    let t = await screen.findByRole("table", {
      name: "Saldos mensuales por cuenta",
    });
    expect(t.textContent).not.toContain("Entradas");
    expect(t.textContent).not.toContain("Saldo inicial");
    expect(t.textContent).not.toContain("Inicio");
    expect(t.classList.contains("accounts-condensed")).toBe(true);
    expect(t.textContent).toContain("112,00");
    expect(t.textContent).not.toContain("112,00 EUR");
    await u.click(screen.getByRole("link", { name: "General" }));
    await u.click(
      await screen.findByRole("checkbox", {
        name: "Ocultar entradas y salidas",
      }),
    );
    await u.click(
      screen.getByRole("checkbox", { name: "Ocultar saldo y fecha inicial" }),
    );
    await u.click(accountLink());
    t = await screen.findByRole("table", {
      name: "Saldos mensuales por cuenta",
    });
    expect(within(t).getByText("Entradas 12,00")).toBeTruthy();
    expect(within(t).getByText("Salidas 0,00")).toBeTruthy();
    expect(t.textContent).toContain("Saldo inicial 100,00 EUR");
    expect(t.textContent).toContain("Inicio 31-12-2025");
    expect(t.classList.contains("accounts-condensed")).toBe(false);
    await u.click(screen.getByRole("link", { name: "General" }));
    await u.click(
      await screen.findByRole("checkbox", {
        name: "Ocultar entradas y salidas",
      }),
    );
    app.unmount();
    render(<App />);
    expect(
      (
        (await screen.findByRole("checkbox", {
          name: "Ocultar entradas y salidas",
        })) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Ocultar saldo y fecha inicial",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });
  it("navega a páginas independientes de configuración en el orden solicitado", async () => {
    render(<App />);
    const u = userEvent.setup();
    const group = await screen.findByRole("group", { name: "Configuración" });
    expect(
      within(group)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Cuentas", "Alias de cuentas", "Categorías", "General"]);
    for (const [name, heading, hash] of [
      ["Cuentas", "Cuentas y saldo de partida", "cuentas"],
      ["Alias de cuentas", "Alias de cuentas", "aliases"],
      ["Categorías", "Categorías", "categorias"],
    ]) {
      await u.click(within(group).getByRole("link", { name }));
      await screen.findByRole("heading", { name: heading, level: 2 });
      expect(location.hash).toBe("#configuracion/" + hash);
      expect(screen.getAllByRole("button", { name: "Nueva" })).toHaveLength(1);
      expect(
        screen.queryByRole("combobox", { name: /^Ejercicio \d/ }),
      ).toBeNull();
      for (const other of [
        "Cuentas y saldo de partida",
        "Alias de cuentas",
        "Categorías",
      ].filter((h) => h !== heading))
        expect(
          screen.queryByRole("heading", { name: other, level: 2 }),
        ).toBeNull();
      expect(
        within(group).getByRole("link", { name }).getAttribute("aria-current"),
      ).toBe("page");
    }
  });
  it("abre directamente la página de categorías desde su URL", async () => {
    history.replaceState(null, "", "#configuracion/categorias");
    render(<App />);
    await screen.findByRole("table", { name: "Categorías" });
    expect(
      screen.queryByRole("table", { name: "Cuentas y saldos" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Alias de cuentas", level: 2 }),
    ).toBeNull();
  });
  it("muestra la cuenta de destino en una columna independiente del concepto", async () => {
    history.replaceState(null, "", "#movimientos");
    render(<App />);
    await screen.findByRole("columnheader", {
      name: "Cuenta de destino",
    });
    const concept = await screen.findByRole("cell", {
      name: "Ingreso ficticio",
    });
    const row = concept.closest("tr")!;
    expect(row.children[1].textContent).toBe("Ingreso ficticio");
    expect(row.children[2].textContent).toBe(
      "Producto original del CSVEntidad original ficticia",
    );
    expect(row.children[3].textContent).toBe("Cuenta ficticiaBanco ficticio");
  });
  it("muestra únicamente el acceso discreto con campos y mantiene el inicio de sesión", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    render(<App />);
    const u = userEvent.setup();
    await screen.findByRole("button", { name: "Entrar en FinTin" });
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "FinTin",
    ]);
    expect(
      screen.queryByText(
        /Haz espacio|Todo en orden|MENOS RUIDO|Acceso exclusivo/,
      ),
    ).toBeNull();
    await u.type(
      screen.getByLabelText("Correo electrónico"),
      "prueba@example.invalid",
    );
    await u.type(screen.getByLabelText("Contraseña"), "clave-ficticia");
    await u.click(screen.getByRole("button", { name: "Entrar en FinTin" }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "prueba@example.invalid",
      password: "clave-ficticia",
    });
  });
  it("oculta y despliega el menú de escritorio sin perder filtros ni navegación", async () => {
    render(<App />);
    const u = userEvent.setup();
    await screen.findByRole("button", { name: "12,00 EUR" });
    await u.click(screen.getByRole("link", { name: "Movimientos" }));
    const search = await screen.findByLabelText("Buscar concepto");
    await u.type(search, "Filtro ficticio");
    await u.click(screen.getByRole("button", { name: "Ocultar menú" }));
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Mostrar menú" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.getByLabelText("Buscar concepto")).toBe(search);
    await u.click(screen.getByRole("button", { name: "Mostrar menú" }));
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeTruthy();
    expect((search as HTMLInputElement).value).toBe("Filtro ficticio");
    await u.click(screen.getByRole("link", { name: "Configuración" }));
    await screen.findByRole("heading", { name: "Cuentas y saldo de partida" });
    expect(
      screen
        .getByRole("button", { name: "Ocultar menú" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
  it("inicia el menú plegado en móvil y lo cierra después de navegar", async () => {
    vi.stubGlobal("innerWidth", 390);
    render(<App />);
    const u = userEvent.setup();
    await screen.findByRole("button", { name: "12,00 EUR" });
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    await u.click(screen.getByRole("button", { name: "Mostrar menú" }));
    await u.click(screen.getByRole("link", { name: "Movimientos" }));
    await screen.findByLabelText("Buscar concepto");
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
  });
  it("conserva filtros, paginación y nodos al repetir SIGNED_IN por recuperar foco", async () => {
    render(<App />);
    const u = userEvent.setup();
    await screen.findByRole("button", { name: "12,00 EUR" });
    await u.click(screen.getByRole("link", { name: "Movimientos" }));
    const search = await screen.findByLabelText("Buscar concepto");
    await u.type(search, "filtro ficticio");
    await screen.findByText(/100 movimientos · página 1/);
    await u.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText(/100 movimientos · página 2/);
    const pending = deferred<{ data: boolean; error: null }>();
    api.rpc.mockReturnValueOnce(pending.promise);
    const listCalls = api.list.mock.calls.length;
    await emit("SIGNED_IN");
    expect(screen.getByLabelText("Buscar concepto")).toBe(search);
    expect((search as HTMLInputElement).value).toBe("filtro ficticio");
    expect(screen.getByText(/100 movimientos · página 2/)).toBeTruthy();
    expect(
      screen.queryByText("Verificando autorización de FinTin…"),
    ).toBeNull();
    await act(async () => {
      pending.resolve({ data: true, error: null });
    });
    expect(screen.getByLabelText("Buscar concepto")).toBe(search);
    expect(api.list).toHaveBeenCalledTimes(listCalls);
  });
  it("borra todos los filtros y reinicia la paginación conservando el ejercicio", async () => {
    render(<App />);
    const u = userEvent.setup();
    await chooseYear(u, "2025");
    await u.click(await screen.findByRole("button", { name: "12,00 EUR" }));
    await u.type(
      await screen.findByLabelText("Buscar concepto"),
      "texto ficticio",
    );
    await screen.findByText(/100 movimientos · página 1/);
    await u.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText(/100 movimientos · página 2/);
    await u.click(screen.getByRole("button", { name: "Borrar filtros" }));
    expect(
      (screen.getByLabelText("Buscar concepto") as HTMLInputElement).value,
    ).toBe("");
    expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe(
      "2025-01-01",
    );
    expect((screen.getByLabelText("Hasta") as HTMLInputElement).value).toBe(
      "2025-12-31",
    );
    for (const label of [
      "Cuenta",
      "Moneda",
      "Entidad",
      "Categoría",
      "Tipo",
      "Origen",
    ])
      expect((screen.getByLabelText(label) as HTMLSelectElement).value).toBe(
        "",
      );
    expect(
      screen.getByRole("combobox", { name: /^Ejercicio \d/ }).textContent,
    ).toBe("2025");
    await screen.findByText(/100 movimientos · página 1/);
  });
  it.each(["Resumen", "Cuentas", "Conciliación", "Movimientos"])(
    "usa el desplegable compacto con todos los años en %s",
    async (page) => {
      render(<App />);
      const u = userEvent.setup();
      await screen.findByRole("button", { name: "12,00 EUR" });
      await u.click(
        screen
          .getAllByRole("link", { name: page })
          .find(
            (a) =>
              a.getAttribute("href") ===
              (page === "Cuentas" ? "#cuentas" : a.getAttribute("href")),
          )!,
      );
      await screen.findByRole("heading", { name: page, level: 1 });
      await u.click(screen.getByRole("combobox", { name: /^Ejercicio \d/ }));
      expect(
        within(screen.getByRole("listbox")).getAllByRole("option"),
      ).toHaveLength(101);
      await u.click(screen.getByRole("option", { name: "2012" }));
      expect(
        screen.getByRole("combobox", { name: /^Ejercicio \d/ }).textContent,
      ).toBe("2012");
      expect(screen.queryByRole("listbox")).toBeNull();
    },
  );
  it("conserva todos los ejercicios en el desplegable compacto de importación", async () => {
    render(<App />);
    const u = userEvent.setup();
    await screen.findByRole("button", { name: "12,00 EUR" });
    await chooseYear(u, "2026");
    await u.click(screen.getByRole("link", { name: "Importación CSV" }));
    await screen.findByRole("heading", {
      name: "Importa un ejercicio completo",
    });
    const combo = screen.getByRole("combobox", { name: /^Ejercicio \d/ });
    await u.click(combo);
    expect(
      within(screen.getByRole("listbox")).getAllByRole("option"),
    ).toHaveLength(101);
    await u.click(screen.getByRole("option", { name: "2010" }));
    expect(combo.textContent).toBe("2010");
    expect(screen.queryByRole("listbox")).toBeNull();
    await u.click(combo);
    expect(screen.getByRole("option", { name: "2000" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "2100" })).toBeTruthy();
  });
  it("mantiene el desglose de categoría, ingreso y mes después de TOKEN_REFRESHED", async () => {
    render(<App />);
    const u = userEvent.setup();
    await chooseYear(u, "2026");
    await u.click(await screen.findByRole("button", { name: "12,00 EUR" }));
    const from = await screen.findByLabelText("Desde");
    expect((from as HTMLInputElement).value).toBe("2026-03-01");
    expect((screen.getByLabelText("Hasta") as HTMLInputElement).value).toBe(
      "2026-03-31",
    );
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe(
      "ingreso",
    );
    expect(
      (screen.getByLabelText("Categoría") as HTMLSelectElement).value,
    ).toBe("category");
    await emit("TOKEN_REFRESHED", {
      ...session,
      access_token: "synthetic-refreshed",
    });
    expect(screen.getByLabelText("Desde")).toBe(from);
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe(
      "ingreso",
    );
    expect(
      (screen.getByLabelText("Categoría") as HTMLSelectElement).value,
    ).toBe("category");
  });
  it("retira Workspace si se revoca la autorización en una revalidación", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "12,00 EUR" });
    api.rpc.mockResolvedValueOnce({ data: false, error: null });
    await emit("SIGNED_IN");
    await screen.findByRole("heading", { name: "Acceso no autorizado" });
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
  });
  it("no reutiliza la autorización de otro UUID y descarta respuestas obsoletas", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "12,00 EUR" });
    const previous = deferred<{ data: boolean; error: null }>();
    api.rpc.mockReturnValueOnce(previous.promise);
    await emit("TOKEN_REFRESHED");
    const next = deferred<{ data: boolean; error: null }>();
    api.rpc.mockReturnValueOnce(next.promise);
    await emit("SIGNED_IN", {
      ...session,
      user: { ...session.user, id: "other" },
    });
    expect(
      screen.getByText("Verificando autorización de FinTin…"),
    ).toBeTruthy();
    await act(async () => {
      previous.resolve({ data: true, error: null });
    });
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    await act(async () => {
      next.resolve({ data: false, error: null });
    });
    await screen.findByRole("heading", { name: "Acceso no autorizado" });
  });
  it("limpia la autorización al cerrar sesión y exige revalidación al volver", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "12,00 EUR" });
    await emit("SIGNED_OUT", null);
    await screen.findByRole("button", { name: "Entrar en FinTin" });
    const pending = deferred<{ data: boolean; error: null }>();
    api.rpc.mockReturnValueOnce(pending.promise);
    await emit("SIGNED_IN");
    expect(
      screen.getByText("Verificando autorización de FinTin…"),
    ).toBeTruthy();
    await act(async () => {
      pending.resolve({ data: true, error: null });
    });
    await screen.findByRole("navigation", { name: "Principal" });
  });
  it("un getSession antiguo no restaura la sesión después de SIGNED_OUT", async () => {
    const pending = deferred<{ data: { session: Session }; error: null }>();
    auth.getSession.mockReturnValueOnce(pending.promise);
    render(<App />);
    await emit("SIGNED_OUT", null);
    await act(async () => {
      pending.resolve({ data: { session }, error: null });
    });
    expect(
      screen.getByRole("button", { name: "Entrar en FinTin" }),
    ).toBeTruthy();
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("un fallo de red al revalidar retira el acceso", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "12,00 EUR" });
    api.rpc.mockRejectedValueOnce(new Error("Error de comprobación ficticio"));
    await emit("TOKEN_REFRESHED");
    await screen.findByRole("heading", { name: "Acceso no autorizado" });
    expect(screen.getByRole("alert").textContent).toContain(
      "Error de comprobación ficticio",
    );
  });
});
