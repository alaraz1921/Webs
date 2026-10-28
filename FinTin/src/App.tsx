import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  WalletCards,
  ArrowLeftRight,
  ListFilter,
  Upload,
  Settings as SettingsIcon,
  LogOut,
  ArrowUpRight,
  Menu,
} from "lucide-react";
import { configured, db, client, list } from "./api";
import type { Account, Alias, Category } from "./types";
import { Summary, AccountsPage, type YearProps } from "./Dashboard";
import { MovementPage, filtersFor } from "./Movements";
import { ImportPage } from "./Import";
import { Settings } from "./Settings";
import { YearPicker } from "./YearPicker";
import { Field, Form, ErrorBox, Empty, text } from "./ui";
import "./style.css";
const pages = [
  {
    id: "resumen",
    name: "Resumen",
    icon: LayoutDashboard,
    description: "Una visión clara de tu dinero.",
  },
  {
    id: "cuentas",
    name: "Cuentas",
    icon: WalletCards,
    description: "La evolución de tus saldos, mes a mes.",
  },
  {
    id: "conciliacion",
    name: "Conciliación",
    icon: ArrowLeftRight,
    description: "Contrasta tus cálculos con el banco.",
  },
  {
    id: "movimientos",
    name: "Movimientos",
    icon: ListFilter,
    description: "Cada movimiento, en su lugar.",
  },
  {
    id: "importacion",
    name: "Importación CSV",
    icon: Upload,
    description: "CSV del agregador y cargas de movimientos manuales.",
  },
  {
    id: "configuracion",
    name: "Configuración",
    icon: SettingsIcon,
    description: "Tus cuentas, categorías y correspondencias.",
  },
];
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(false),
    [authorization, setAuthorization] = useState<{
      uid: string;
      allowed: boolean;
    } | null>(null),
    [authError, setAuthError] = useState("");
  useEffect(() => {
    if (!db) {
      setAuthReady(true);
      return;
    }
    let live = true;
    let receivedAuthEvent = false;
    db.auth.getSession().then(({ data, error }) => {
      if (!live || receivedAuthEvent) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = db.auth.onAuthStateChange((event, s) => {
      if (!live) return;
      receivedAuthEvent = true;
      if (!s || event === "SIGNED_OUT") setAuthorization(null);
      setSession(s);
      setAuthReady(true);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let live = true;
    if (session) {
      const uid = session.user.id;
      // Revalidar la misma sesión no debe desmontar Workspace ni borrar sus filtros.
      // La autorización solo es reutilizable para el mismo UUID; RLS sigue vigente.
      Promise.resolve(client().rpc("fintin_usuario_habilitado"))
        .then((r) => {
          if (!live) return;
          setAuthError(r.error?.message || "");
          setAuthorization({ uid, allowed: !r.error && r.data === true });
        })
        .catch((error: Error) => {
          if (!live) return;
          setAuthError(error.message);
          setAuthorization({ uid, allowed: false });
        });
    }
    return () => {
      live = false;
    };
  }, [session]);
  const allowed =
    session && authorization?.uid === session.user.id
      ? authorization.allowed
      : null;
  if (!configured)
    return (
      <Access>
        <h1>Tu dinero, con claridad.</h1>
        <p>FinTin está listo para conectarse a tu Supabase.</p>
        <div className="notice">
          Configura <code>VITE_SUPABASE_URL</code> y una clave pública en{" "}
          <code>.env.local</code>. Reinicia Vite después de guardar. Consulta
          README.md para preparar la base de datos de pruebas y autorizar tu
          usuario.
        </div>
        <p className="muted">
          No se han cargado datos financieros. No se aceptan claves secretas.
        </p>
      </Access>
    );
  if (!authReady)
    return (
      <Access>
        <Empty>Comprobando sesión…</Empty>
      </Access>
    );
  if (!session)
    return (
      <Access>
        <Form
          button="Entrar en FinTin"
          onSave={async (d) => {
            const r = await client().auth.signInWithPassword({
              email: text(d, "email"),
              password: String(d.get("password") || ""),
            });
            if (r.error) throw r.error;
          }}
        >
          <Field label="Correo electrónico">
            <input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Contraseña">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
        </Form>
        <ErrorBox error={authError} />
      </Access>
    );
  if (allowed === null)
    return (
      <Access>
        <Empty>Verificando autorización de FinTin…</Empty>
      </Access>
    );
  if (!allowed)
    return (
      <Access>
        <h1>Acceso no autorizado</h1>
        <p>
          Tu sesión está iniciada, pero no tienes autorización activa para
          FinTin. El administrador debe añadir tu UUID a la lista de usuarios
          autorizados.
        </p>
        <ErrorBox error={authError} />
        <button
          onClick={() => {
            void client().auth.signOut({ scope: "local" });
          }}
        >
          Cerrar sesión
        </button>
      </Access>
    );
  return <Workspace key={session.user.id} session={session} />;
}
function Access({ children }: { children: React.ReactNode }) {
  return (
    <div className="access">
      <main className="access-form">
        <header className="access-heading">
          <h1>FinTin</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
function Brand() {
  return <div className="brand">FinTin</div>;
}
function Workspace({ session }: { session: Session }) {
  const uid = session.user.id,
    [route, setRoute] = useState(location.hash.slice(1) || "resumen"),
    [year, setYear] = useState(new Date().getFullYear()),
    [currency, setCurrency] = useState("EUR"),
    [account, setAccount] = useState(""),
    [accounts, setAccounts] = useState<Account[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [aliases, setAliases] = useState<Alias[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [filters, setFilters] = useState(filtersFor(year)),
    [menu, setMenu] = useState(() => window.innerWidth > 700),
    [revision, setRevision] = useState(0),
    [importBusy, setImportBusy] = useState(false);
  useEffect(() => {
    const onHash = () => {
      setRoute(location.hash.slice(1) || "resumen");
      if (window.innerWidth <= 700) setMenu(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const reload = useCallback(async () => {
    const [a, c, l] = await Promise.all([
      list<Account>("cuentas", uid),
      list<Category>("categorias", uid),
      list<Alias>("cuenta_aliases", uid),
    ]);
    setAccounts(a);
    setCategories(c);
    setAliases(l);
    setRevision((v) => v + 1);
  }, [uid]);
  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reload]);
  const page = pages.find((p) => p.id === route) || pages[0];
  const base = { uid, accounts, categories, aliases, reload };
  const open: YearProps["open"] = (f) => {
    const selected = accounts.find((a) => a.id === f.account);
    const month = f.month;
    setFilters({
      ...filtersFor(year),
      from: f.through
        ? selected?.fecha_saldo_inicial || `${year}-01-01`
        : month
          ? `${year}-${String(month).padStart(2, "0")}-01`
          : `${year}-01-01`,
      to:
        f.through ||
        (month
          ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
          : `${year}-12-31`),
      account: f.account || account,
      category: f.category || "",
      kind: f.kind || "",
      currency,
    });
    location.hash = "movimientos";
  };
  const yearProps = { ...base, year, currency, account, open };
  return (
    <div className={menu ? "app menu-open" : "app menu-closed"}>
      <aside
        id="navigation-panel"
        hidden={!menu}
        className={menu ? "sidebar open" : "sidebar"}
      >
        <Brand />
        <nav aria-label="Principal">
          {pages.map((p) => (
            <a
              key={p.id}
              href={"#" + p.id}
              className={page.id === p.id ? "active" : ""}
              aria-current={page.id === p.id ? "page" : undefined}
            >
              <p.icon size={19} />
              {p.name}
              {page.id === p.id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user">
            <div className="avatar">
              {session.user.email?.[0].toUpperCase() || "U"}
            </div>
            <div>
              <b>Mi espacio</b>
              <small title={session.user.email}>{session.user.email}</small>
            </div>
            <button
              aria-label="Cerrar sesión"
              onClick={() => {
                void client().auth.signOut({ scope: "local" });
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-toggle"
            aria-label={menu ? "Ocultar menú" : "Mostrar menú"}
            aria-expanded={menu}
            aria-controls="navigation-panel"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <span>
            FinTin <span className="muted">/ {page.name}</span>
          </span>
          <span className="connection">
            <i /> Conexión privada
          </span>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <h1>{page.name}</h1>
              <p>{page.description}</p>
            </div>
            {page.id === "resumen" && (
              <a className="button" href="#importacion">
                Importar CSV <ArrowUpRight size={17} />
              </a>
            )}
          </div>
          {page.id !== "configuracion" && (
            <div className="context-bar">
              <YearPicker
                value={year}
                disabled={importBusy}
                onChange={(y) => {
                  setYear(y);
                  setFilters(filtersFor(y));
                }}
              />
              {["resumen", "cuentas", "conciliacion"].includes(page.id) && (
                <>
                  <Field label="Moneda">
                    <select
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value);
                        setAccount("");
                      }}
                    >
                      {[
                        ...new Set(["EUR", ...accounts.map((a) => a.moneda)]),
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cuenta">
                    <select
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    >
                      <option value="">Todas las cuentas</option>
                      {accounts
                        .filter((a) => a.moneda === currency)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre_producto}
                          </option>
                        ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
          )}
          <ErrorBox error={error} />
          {loading ? (
            <Empty>Cargando tu espacio…</Empty>
          ) : error ? (
            <button
              onClick={() => {
                setError("");
                setLoading(true);
                reload()
                  .catch((e) => setError(e.message))
                  .finally(() => setLoading(false));
              }}
            >
              Reintentar conexión
            </button>
          ) : (
            <>
              {page.id === "resumen" && (
                <Summary key={revision} {...yearProps} />
              )}{" "}
              {page.id === "cuentas" && (
                <AccountsPage key={revision} {...yearProps} />
              )}{" "}
              {page.id === "conciliacion" && (
                <AccountsPage key={revision} {...yearProps} reconcile />
              )}{" "}
              {page.id === "movimientos" && (
                <MovementPage
                  {...base}
                  year={year}
                  filters={filters}
                  setFilters={setFilters}
                />
              )}{" "}
              {page.id === "importacion" && (
                <ImportPage {...base} year={year} onBusy={setImportBusy} />
              )}{" "}
              {page.id === "configuracion" && (
                <>
                  <p className="muted">
                    Usuario actual: {session.user.email} · UUID: {uid}
                  </p>
                  <Settings {...base} />
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
