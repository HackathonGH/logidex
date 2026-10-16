# Campana reutilizable + nuevo orden del menú lateral

## 1. Avisos de la campana siempre pinchables
- Problema: al pinchar un aviso de una entrega que ya está en pantalla, la dirección no cambia y la entrega no se vuelve a abrir. Además, los avisos ya leídos se ven atenuados y parecen desactivados.
- Solución: cada pinchazo envía una señal nueva, así que la agenda abre la entrega y se desplaza hasta ella aunque ya estuvieras ahí (o la hubieras cerrado).
- Los avisos leídos se muestran con un color algo más suave pero sin aspecto de desactivado. El punto rojo sigue indicando los avisos sin leer.

## 2. Orden del menú lateral
Admin: Administración, Agenda operativa, Reservas, Indicadores, Conciliación de mercancía, Incidencias, Bloqueos y capacidad, Escanear QR.
Administrativo: lo mismo sin Administración.

## Detalles técnicos
- NotificationBell: navegar con `search: { open, date, t: Date.now() }`; quitar `opacity-60` (usar texto muted en su lugar).
- operaciones.tsx: añadir `t?: number` a validateSearch e incluir `search.t` en las dependencias del useEffect.
- roles.ts `menuForRoles`: nuevo orden operations, reservations, indicators, reconcile, incidents, blocks, scan; actualizar la prueba de roles.test.ts.
