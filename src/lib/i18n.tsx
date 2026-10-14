import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "es" | "en" | "ca";
export const LANGS: Lang[] = ["es", "en", "ca"];

const dict = {
  tagline: { es: "La logística bajo control", en: "La logística bajo control", ca: "La logística bajo control" },
  welcome: { es: "Gestión de citas de descarga", en: "Unloading appointment management", ca: "Gestió de cites de descàrrega" },
  carriers: { es: "Transportistas", en: "Carriers", ca: "Transportistes" },
  carriersHint: { es: "Accede con tu cuenta de Google para reservar descargas.", en: "Sign in with your Google account to book unloadings.", ca: "Accedeix amb el teu compte de Google per reservar descàrregues." },
  google: { es: "Entrar con Google", en: "Sign in with Google", ca: "Entra amb Google" },
  staff: { es: "Personal interno", en: "Internal staff", ca: "Personal intern" },
  username: { es: "Usuario", en: "Username", ca: "Usuari" },
  password: { es: "Contraseña", en: "Password", ca: "Contrasenya" },
  signIn: { es: "Entrar", en: "Sign in", ca: "Entra" },
  signOut: { es: "Salir", en: "Sign out", ca: "Surt" },
  badCredentials: { es: "Usuario o contraseña incorrectos", en: "Wrong username or password", ca: "Usuari o contrasenya incorrectes" },
  contactAdmin: { es: "Contacto de administración", en: "Administration contact", ca: "Contacte d'administració" },
  pendingTitle: { es: "Solicitud pendiente de aprobación", en: "Request pending approval", ca: "Sol·licitud pendent d'aprovació" },
  pendingText: { es: "Administración revisará tus datos. Recibirás acceso en cuanto se apruebe.", en: "Administration will review your details. You'll get access once approved.", ca: "Administració revisarà les teves dades. Tindràs accés quan s'aprovi." },
  rejectedText: { es: "Tu solicitud anterior fue rechazada. Puedes enviar una nueva o contactar con administración.", en: "Your previous request was rejected. You can submit a new one or contact administration.", ca: "La teva sol·licitud anterior va ser rebutjada. Pots enviar-ne una de nova o contactar amb administració." },
  disabledText: { es: "Tu cuenta está desactivada. Contacta con administración.", en: "Your account is disabled. Contact administration.", ca: "El teu compte està desactivat. Contacta amb administració." },
  onboardTitle: { es: "Datos de tu empresa", en: "Your company details", ca: "Dades de la teva empresa" },
  onboardText: { es: "Si tu empresa ya está registrada, introduce su CIF/NIF/VAT y solicitaremos vincularte.", en: "If your company is already registered, enter its tax ID and we'll request to link you.", ca: "Si la teva empresa ja està registrada, introdueix el seu CIF/NIF/VAT i sol·licitarem vincular-t'hi." },
  companyName: { es: "Nombre de la empresa", en: "Company name", ca: "Nom de l'empresa" },
  taxId: { es: "CIF / NIF / VAT", en: "Tax ID (CIF / NIF / VAT)", ca: "CIF / NIF / VAT" },
  phone: { es: "Teléfono", en: "Phone", ca: "Telèfon" },
  email: { es: "Correo", en: "Email", ca: "Correu" },
  send: { es: "Enviar solicitud", en: "Submit request", ca: "Envia la sol·licitud" },
  save: { es: "Guardar", en: "Save", ca: "Desa" },
  saved: { es: "Guardado", en: "Saved", ca: "Desat" },
  error: { es: "Ha ocurrido un error", en: "Something went wrong", ca: "Hi ha hagut un error" },
  changePwdTitle: { es: "Cambia tu contraseña", en: "Change your password", ca: "Canvia la contrasenya" },
  changePwdText: { es: "Es tu primer acceso: elige una contraseña nueva (mínimo 8 caracteres).", en: "First sign-in: choose a new password (at least 8 characters).", ca: "Primer accés: tria una contrasenya nova (mínim 8 caràcters)." },
  currentPwd: { es: "Contraseña actual", en: "Current password", ca: "Contrasenya actual" },
  newPwd: { es: "Nueva contraseña", en: "New password", ca: "Contrasenya nova" },
  hello: { es: "Hola", en: "Hello", ca: "Hola" },
  menu_admin: { es: "Administración", en: "Administration", ca: "Administració" },
  menu_reservations: { es: "Reservas", en: "Reservations", ca: "Reserves" },
  menu_blocks: { es: "Bloqueos y capacidad", en: "Blocks & capacity", ca: "Bloquejos i capacitat" },
  menu_book: { es: "Mis reservas", en: "My bookings", ca: "Les meves reserves" },
  menu_scan: { es: "Escanear QR", en: "Scan QR", ca: "Escaneja QR" },
  comingSoon: { es: "Disponible en la siguiente fase", en: "Available in the next phase", ca: "Disponible a la propera fase" },
  requests: { es: "Solicitudes", en: "Requests", ca: "Sol·licituds" },
  users: { es: "Usuarios", en: "Users", ca: "Usuaris" },
  settings: { es: "Ajustes", en: "Settings", ca: "Ajustos" },
  approve: { es: "Aprobar", en: "Approve", ca: "Aprova" },
  reject: { es: "Rechazar", en: "Reject", ca: "Rebutja" },
  noRequests: { es: "No hay solicitudes pendientes", en: "No pending requests", ca: "No hi ha sol·licituds pendents" },
  newCompany: { es: "Empresa nueva", en: "New company", ca: "Empresa nova" },
  linkCompany: { es: "Vincular a empresa existente", en: "Link to existing company", ca: "Vincular a empresa existent" },
  createInternal: { es: "Crear cuenta interna", en: "Create internal account", ca: "Crea compte intern" },
  fullName: { es: "Nombre completo", en: "Full name", ca: "Nom complet" },
  role: { es: "Rol", en: "Role", ca: "Rol" },
  tempPwd: { es: "Contraseña temporal", en: "Temporary password", ca: "Contrasenya temporal" },
  create: { es: "Crear", en: "Create", ca: "Crea" },
  status: { es: "Estado", en: "Status", ca: "Estat" },
  scanPerm: { es: "Permiso QR", en: "QR permission", ca: "Permís QR" },
  activate: { es: "Activar", en: "Activate", ca: "Activa" },
  deactivate: { es: "Desactivar", en: "Deactivate", ca: "Desactiva" },
  back: { es: "Volver", en: "Back", ca: "Torna" },
  noAccess: { es: "No tienes acceso a esta sección", en: "You don't have access to this section", ca: "No tens accés a aquesta secció" },
  role_admin: { es: "Administrador", en: "Administrator", ca: "Administrador" },
  role_administrativo: { es: "Administrativo", en: "Office staff", ca: "Administratiu" },
  role_transportista: { es: "Transportista", en: "Carrier", ca: "Transportista" },
  st_pending: { es: "Pendiente", en: "Pending", ca: "Pendent" },
  st_active: { es: "Activo", en: "Active", ca: "Actiu" },
  st_rejected: { es: "Rechazado", en: "Rejected", ca: "Rebutjat" },
  st_disabled: { es: "Desactivado", en: "Disabled", ca: "Desactivat" },
} satisfies Record<string, Record<Lang, string>>;

export type TKey = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: "es",
  setLang: () => {},
  t: (k) => dict[k].es,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => {
    const s = localStorage.getItem("logidex-lang") as Lang | null;
    if (s && LANGS.includes(s)) setLangState(s);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("logidex-lang", l);
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[k][lang] }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export function LangSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`inline-flex rounded-md border border-border bg-card p-0.5 text-xs font-semibold ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`rounded px-2 py-1 uppercase transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
