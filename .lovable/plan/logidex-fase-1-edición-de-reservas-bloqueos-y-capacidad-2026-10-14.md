# LOGIDEX — Fase 1 + Edición de reservas + Bloqueos y capacidad

Se construye en tres bloques, en este orden. Al terminar cada bloque se pide validación antes de seguir.

## Bloque A — Fase 1: cimientos

1. Identidad visual: colores de marca (navy #102C4A, turquesa #39B8C8, blanco, gris claro #F1F5F8; verde/ámbar/rojo solo para estados), logo, eslogan "La logística bajo control".
2. Idiomas: español por defecto, inglés y catalán, con selector visible.
3. Pantalla de bienvenida pública con dos accesos:
   - Transportistas: "Entrar con Google".
   - Personal interno: usuario + contraseña.
4. Alta de transportista: tras Google, formulario de empresa (nombre, CIF/NIF/VAT, teléfono). Si el CIF ya existe, se envía solicitud de vinculación. En ambos casos queda pendiente de aprobación.
5. Pantalla "pendiente de aprobación" con el contacto de administración (93 325 25 25, Incidexsolutions@gmail.com).
6. Panel de administrador:
   - Aprobar/rechazar solicitudes de transportistas.
   - Crear cuentas internas (usuario, contraseña temporal, rol); cambio obligatorio de contraseña en el primer acceso.
   - Activar/desactivar usuarios, conceder/retirar permiso de escaneo QR.
   - Editar datos de contacto de administración.
7. Roles: administrador, administrativo, transportista, báscula, almacén. Cada rol ve solo su menú.
8. Cuentas demo ADMIN y user1 solo en vista previa.

## Bloque B — Edición de reservas (administrador y administrativo)

Como las reservas de transportista llegan en Fase 2, se crea ya la estructura de reservas y una lista de reservas de ejemplo para poder probar.

- Listado con filtros (fecha, empresa, estado, matrícula).
- Ficha de reserva editable: fecha/hora (franjas de 15 min), pedidos y palets, conductor, matrícula tractora, matrícula remolque (opcional).
- Cancelar con motivo obligatorio.
- Cada cambio revalida capacidad (máx. 2 descargas simultáneas, muelles activos no bloqueados, palets del turno, festivos) y se guarda en el historial con autor y hora.
- Cambio de hora → etiqueta "Reprogramada"; cambio de hora o conductor invalida el QR anterior.

## Bloque C — Bloqueos, capacidad por turno y festivos

- Bloqueos técnicos u organizativos: generales o por muelle, inicio/fin en franjas de 15 min, motivo, recurrencia opcional (diaria/semanal). Crear, editar, eliminar.
- Máximo de palets por turno: valor por defecto (250 / 150 / 100) editable, y excepciones por fecha concreta.
- Festivos nacionales de España cargados y cerrados por defecto; el administrador puede abrir un festivo concreto.
- Vista de calendario que muestra festivos, bloqueos y capacidad usada/disponible por turno.

## Fuera de alcance ahora
Reserva por transportista, QR, operaciones de báscula/almacén, avisos push, textos legales/RGPD.

## Detalles técnicos
- Tablas: profiles, companies, company_link_requests, user_roles (enum app_role + has_role security definer), app_settings (contacto), docks, shift_capacity_defaults, shift_capacity_overrides, holidays (+ holiday_openings), blocks, reservations, reservation_audit. Todas con GRANT + RLS.
- Validación de capacidad en función SQL transaccional (bloqueo de fila) usada tanto al editar como en Fase 2.
- Horarios en Europe/Madrid, almacenados en UTC; turno de noche 22:00–06:00 pertenece a la fecha de inicio.
- Cuentas internas: email sintético a partir del usuario, creadas por función de servidor con verificación de rol administrador; confirmación automática solo para esas cuentas.
- Google con el acceso gestionado de Lovable Cloud; rutas protegidas bajo el área autenticada.
- Pruebas automáticas de: límite 2 descargas simultáneas, máximo de palets por turno, festivo cerrado/abierto, bloqueo impide reserva, solo admin/administrativo pueden editar.
