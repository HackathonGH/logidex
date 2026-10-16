# Ordenar tablas por columna

## Qué cambia
En todas las tablas de la app se podrá pinchar en el título de cada columna:
- 1er clic: orden ascendente (A→Z, menor→mayor, fecha más antigua primero).
- 2º clic: orden descendente. Los siguientes clics alternan.
- Una flecha junto al título indica la columna y el sentido del orden.

Tablas afectadas:
- **Reservas** (/reservas): Código, Fecha, Empresa, Palets, Conductor, Matrícula, Estado. Al entrar, ordenada por **Fecha descendente** (la más reciente primero).
- **Administración › Usuarios**: Nombre, Usuario/Email, Rol, Estado.
- **Indicadores › Por proveedor** y **Por transportista**: todas las columnas (nombre y cifras).

## Detalles técnicos
- Nuevo hook `useSort(defaultKey, defaultDir)` + componente `SortableHead` (cabecera con botón e icono ArrowUp/ArrowDown/ArrowUpDown, `aria-sort`) en `src/components/SortableHead.tsx`.
- Función pura `sortRows(rows, getter, dir)` en `src/lib/sort.ts`: números, fechas ISO y textos (localeCompare con idioma), vacíos al final; test en `src/lib/sort.test.ts`.
- Reservas: la consulta pasa a `order("starts_at", { ascending: false })` para que el límite de 200 traiga las más recientes; el ordenado se aplica en pantalla. Estado ordena por su texto traducido.
- Indicadores: se mantiene el estilo actual de las tablas, solo se convierten los `<th>` en cabeceras clicables.
