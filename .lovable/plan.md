# Nueva reserva: campo «Nº pedido» con 4500 fijo y ayuda

## Qué cambia
1. **Campo de número de pedido**: «4500» aparece fijo al inicio y no se puede borrar. A continuación se ve «XXXXXX» en gris como guía; el transportista solo escribe los 6 dígitos (solo números, siempre exactamente 6; si faltan, se avisa y no se puede reservar). Ejemplo: 4500XXXXXX → 4500100012.
2. **Icono de información**: junto a la etiqueta «Nº pedido», una «i» dentro de un círculo. Al pasar el ratón (o tocarla en móvil) aparece el consejo: «Todos los números de pedido empiezan por 4500 seguido de 6 dígitos.» Traducido a español, inglés y catalán.

## Detalles técnicos
- En `mis-reservas.nueva.tsx`: el campo muestra un prefijo fijo «4500» (span delante del input, mismo estilo de borde) y un input con `placeholder="XXXXXX"`, `maxLength={6}`, `inputMode="numeric"`. Se guarda `order_number = "4500" + dígitos`, así la validación y el envío actuales no cambian.
- Icono `Info` de lucide con el `Tooltip` de shadcn; nueva clave i18n `orderHint` (es/en/ca).
