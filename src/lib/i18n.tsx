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
  // Reservations
  filters: { es: "Filtros", en: "Filters", ca: "Filtres" },
  date: { es: "Fecha", en: "Date", ca: "Data" },
  time: { es: "Hora", en: "Time", ca: "Hora" },
  company: { es: "Empresa", en: "Company", ca: "Empresa" },
  plate: { es: "Matrícula", en: "Plate", ca: "Matrícula" },
  all: { es: "Todas", en: "All", ca: "Totes" },
  clear: { es: "Limpiar", en: "Clear", ca: "Neteja" },
  code: { es: "Código", en: "Code", ca: "Codi" },
  pallets: { es: "Palets", en: "Pallets", ca: "Palets" },
  duration: { es: "Duración", en: "Duration", ca: "Durada" },
  minutes: { es: "min", en: "min", ca: "min" },
  driver: { es: "Conductor", en: "Driver", ca: "Conductor" },
  driverDoc: { es: "DNI/NIE conductor", en: "Driver ID", ca: "DNI/NIE conductor" },
  tractorPlate: { es: "Matrícula tractora", en: "Tractor plate", ca: "Matrícula tractora" },
  trailerPlate: { es: "Matrícula remolque (opcional)", en: "Trailer plate (optional)", ca: "Matrícula remolc (opcional)" },
  orders: { es: "Pedidos", en: "Orders", ca: "Comandes" },
  orderNumber: { es: "Nº pedido", en: "Order no.", ca: "Núm. comanda" },
  supplier: { es: "Proveedor", en: "Supplier", ca: "Proveïdor" },
  addOrder: { es: "Añadir pedido", en: "Add order", ca: "Afegeix comanda" },
  total: { es: "Total", en: "Total", ca: "Total" },
  noReservations: { es: "No hay reservas con estos filtros", en: "No reservations match these filters", ca: "No hi ha reserves amb aquests filtres" },
  editReservation: { es: "Editar reserva", en: "Edit reservation", ca: "Edita la reserva" },
  cancelReservation: { es: "Cancelar reserva", en: "Cancel reservation", ca: "Cancel·la la reserva" },
  cancelReason: { es: "Motivo de la cancelación", en: "Cancellation reason", ca: "Motiu de la cancel·lació" },
  confirmCancel: { es: "Confirmar cancelación", en: "Confirm cancellation", ca: "Confirma la cancel·lació" },
  close: { es: "Cerrar", en: "Close", ca: "Tanca" },
  history: { es: "Historial de cambios", en: "Change history", ca: "Historial de canvis" },
  noHistory: { es: "Sin cambios registrados", en: "No changes yet", ca: "Sense canvis registrats" },
  act_update: { es: "Modificación", en: "Change", ca: "Modificació" },
  act_cancel: { es: "Cancelación", en: "Cancellation", ca: "Cancel·lació" },
  qrReissued: { es: "QR anterior invalidado y nuevo QR emitido", en: "Previous QR invalidated, new QR issued", ca: "QR anterior invalidat i nou QR emès" },
  qrNotice: { es: "Cambiar la hora o el conductor invalida el QR anterior y emite uno nuevo.", en: "Changing the time or driver invalidates the previous QR and issues a new one.", ca: "Canviar l'hora o el conductor invalida el QR anterior i n'emet un de nou." },
  rescheduled: { es: "Reprogramada", en: "Rescheduled", ca: "Reprogramada" },
  notEditable: { es: "Esta reserva ya no se puede editar.", en: "This reservation can no longer be edited.", ca: "Aquesta reserva ja no es pot editar." },
  rs_confirmed: { es: "Confirmada", en: "Confirmed", ca: "Confirmada" },
  rs_on_site: { es: "En instalaciones", en: "On site", ca: "A les instal·lacions" },
  rs_unloading: { es: "Descargando", en: "Unloading", ca: "Descarregant" },
  rs_unloaded: { es: "Descarga finalizada", en: "Unloaded", ca: "Descàrrega finalitzada" },
  rs_dock_released: { es: "Muelle liberado", en: "Dock released", ca: "Moll alliberat" },
  rs_departed: { es: "Salida registrada", en: "Departed", ca: "Sortida registrada" },
  rs_no_show: { es: "No presentado", en: "No show", ca: "No presentat" },
  rs_cancelled: { es: "Cancelada", en: "Cancelled", ca: "Cancel·lada" },
  ERR_SLOT: { es: "La hora debe ir en franjas de 15 minutos.", en: "Time must be on 15-minute slots.", ca: "L'hora ha d'anar en franges de 15 minuts." },
  ERR_HOLIDAY: { es: "Ese día es festivo y está cerrado.", en: "That day is a closed holiday.", ca: "Aquell dia és festiu i està tancat." },
  ERR_BLOCKED: { es: "La franja está bloqueada.", en: "That slot is blocked.", ca: "La franja està bloquejada." },
  ERR_SIMULTANEOUS: { es: "Ya hay 2 descargas simultáneas en esa franja.", en: "There are already 2 simultaneous unloadings in that slot.", ca: "Ja hi ha 2 descàrregues simultànies en aquesta franja." },
  ERR_NO_DOCK: { es: "No queda ningún muelle disponible en esa franja.", en: "No dock is available in that slot.", ca: "No queda cap moll disponible en aquesta franja." },
  ERR_SHIFT_FULL: { es: "Se supera el máximo de palets del turno.", en: "Shift pallet limit exceeded.", ca: "Se supera el màxim de palets del torn." },
  ERR_ORDERS_COUNT: { es: "Debe haber entre 1 y 6 pedidos.", en: "There must be 1 to 6 orders.", ca: "Hi ha d'haver entre 1 i 6 comandes." },
  ERR_ORDER_FORMAT: { es: "El nº de pedido debe tener 10 dígitos y empezar por 4500.", en: "Order no. must be 10 digits starting with 4500.", ca: "El núm. de comanda ha de tenir 10 dígits i començar per 4500." },
  ERR_ORDER_DUP: { es: "Hay pedidos repetidos.", en: "Duplicate orders.", ca: "Hi ha comandes repetides." },
  ERR_SUPPLIERS: { es: "Máximo 6 proveedores distintos.", en: "Max 6 different suppliers.", ca: "Màxim 6 proveïdors diferents." },
  ERR_PALLETS: { es: "Cada pedido 1–66 palets y máximo 66 en total.", en: "1–66 pallets per order, 66 total max.", ca: "Cada comanda 1–66 palets i màxim 66 en total." },
  ERR_REQUIRED: { es: "Faltan campos obligatorios.", en: "Required fields are missing.", ca: "Falten camps obligatoris." },
  ERR_REASON: { es: "El motivo es obligatorio.", en: "A reason is required.", ca: "El motiu és obligatori." },
  ERR_RANGE: { es: "El fin debe ser posterior al inicio.", en: "End must be after start.", ca: "El final ha de ser posterior a l'inici." },
  ERR_NOT_EDITABLE: { es: "Esta reserva ya no se puede editar.", en: "This reservation can no longer be edited.", ca: "Aquesta reserva ja no es pot editar." },
  ERR_NOT_FOUND: { es: "No encontrado.", en: "Not found.", ca: "No trobat." },
  ERR_FORBIDDEN: { es: "No tienes permiso.", en: "You don't have permission.", ca: "No tens permís." },
  ERR_UNKNOWN: { es: "Ha ocurrido un error", en: "Something went wrong", ca: "Hi ha hagut un error" },
  // Blocks / capacity / holidays
  tab_blocks: { es: "Bloqueos", en: "Blocks", ca: "Bloquejos" },
  tab_capacity: { es: "Palets por turno", en: "Pallets per shift", ca: "Palets per torn" },
  tab_holidays: { es: "Festivos", en: "Holidays", ca: "Festius" },
  tab_calendar: { es: "Calendario", en: "Calendar", ca: "Calendari" },
  newBlock: { es: "Nuevo bloqueo", en: "New block", ca: "Nou bloqueig" },
  editBlock: { es: "Editar bloqueo", en: "Edit block", ca: "Edita el bloqueig" },
  kind: { es: "Tipo", en: "Type", ca: "Tipus" },
  kind_technical: { es: "Técnico", en: "Technical", ca: "Tècnic" },
  kind_organizational: { es: "Organizativo", en: "Organizational", ca: "Organitzatiu" },
  scope: { es: "Alcance", en: "Scope", ca: "Abast" },
  allDocks: { es: "General (todos los muelles)", en: "General (all docks)", ca: "General (tots els molls)" },
  start: { es: "Inicio", en: "Start", ca: "Inici" },
  end: { es: "Fin", en: "End", ca: "Final" },
  reason: { es: "Motivo", en: "Reason", ca: "Motiu" },
  recurrence: { es: "Repetición", en: "Repeat", ca: "Repetició" },
  rec_none: { es: "No se repite", en: "Does not repeat", ca: "No es repeteix" },
  rec_daily: { es: "Cada día", en: "Daily", ca: "Cada dia" },
  rec_weekly: { es: "Cada semana", en: "Weekly", ca: "Cada setmana" },
  until: { es: "Hasta (opcional)", en: "Until (optional)", ca: "Fins a (opcional)" },
  delete: { es: "Eliminar", en: "Delete", ca: "Elimina" },
  edit: { es: "Editar", en: "Edit", ca: "Edita" },
  noBlocks: { es: "No hay bloqueos", en: "No blocks", ca: "No hi ha bloquejos" },
  affectedTitle: { es: "Este bloqueo afecta a reservas existentes", en: "This block affects existing reservations", ca: "Aquest bloqueig afecta reserves existents" },
  affectedText: { es: "No se cancelan automáticamente. Revísalas y decide qué hacer con cada una.", en: "They are not cancelled automatically. Review each one and decide.", ca: "No es cancel·len automàticament. Revisa-les i decideix què fer amb cada una." },
  saveAnyway: { es: "Guardar igualmente", en: "Save anyway", ca: "Desa igualment" },
  shift: { es: "Turno", en: "Shift", ca: "Torn" },
  sh_morning: { es: "Mañana", en: "Morning", ca: "Matí" },
  sh_afternoon: { es: "Tarde", en: "Afternoon", ca: "Tarda" },
  sh_night: { es: "Noche", en: "Night", ca: "Nit" },
  defaultMax: { es: "Máximo de palets por defecto", en: "Default max pallets", ca: "Màxim de palets per defecte" },
  dateExceptions: { es: "Excepciones por fecha", en: "Date exceptions", ca: "Excepcions per data" },
  maxPallets: { es: "Máx. palets", en: "Max pallets", ca: "Màx. palets" },
  addException: { es: "Añadir excepción", en: "Add exception", ca: "Afegeix excepció" },
  noExceptions: { es: "Sin excepciones", en: "No exceptions", ca: "Sense excepcions" },
  holidayClosed: { es: "Cerrado", en: "Closed", ca: "Tancat" },
  holidayOpen: { es: "Abierto", en: "Open", ca: "Obert" },
  openHoliday: { es: "Abrir este festivo", en: "Open this holiday", ca: "Obre aquest festiu" },
  closeHoliday: { es: "Volver a cerrar", en: "Close again", ca: "Torna a tancar" },
  holidaysHint: { es: "Festivos nacionales de España: cerrados por defecto. Solo el administrador puede abrir uno.", en: "Spanish national holidays: closed by default. Only the administrator can open one.", ca: "Festius nacionals d'Espanya: tancats per defecte. Només l'administrador en pot obrir un." },
  used: { es: "usados", en: "used", ca: "usats" },
  blocksCount: { es: "bloqueos", en: "blocks", ca: "bloquejos" },
  prev: { es: "Anterior", en: "Previous", ca: "Anterior" },
  next: { es: "Siguiente", en: "Next", ca: "Següent" },
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
