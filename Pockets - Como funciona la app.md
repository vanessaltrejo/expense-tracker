# Pockets: cómo funciona la app y por qué está hecha así

**Para quién es este documento:** para alguien que nunca ha visto la app. Explica qué problema resuelve, cómo piensa el dinero, cómo se calcula cada número, cómo se guardan los datos y, sobre todo, **por qué se tomó cada decisión**.

**Cómo se relaciona con la propuesta original:** la propuesta (`Propuesta app de gastos personal.md`) se escribió cuando todavía no había app. Muchas cosas cambiaron al usarla con datos reales. Este documento describe la app **actual**; la sección 18 lista qué cambió respecto a la propuesta y por qué.

---

## 1. El problema y la idea en una frase

Vanessa tiene su dinero repartido en varios lugares y casi todos sus gastos van a una tarjeta de crédito. Llevaba las cuentas en la cabeza, así que cualquier gasto chico le desacomodaba el plan.

**Pockets responde una pregunta: ¿cuánto debo en la tarjeta y cuánto me falta por juntar para pagarla?**

La idea que lo sostiene todo: **cada lugar donde hay dinero es una "bolsa"**, y la tarjeta es una **deuda**, no dinero. Con eso la app calcula, sin que nadie tenga que sumar a mano, cuánto se debe, cuánto hay y cuánto falta.

Pockets es una **PWA** (una página web que se instala en el teléfono y se comporta como app), y usa **un Google Sheets como base de datos**. La dueña de los datos puede abrir su Sheets y ver o corregir todo.

---

## 2. Vocabulario

| Palabra | Qué significa |
| --- | --- |
| **Bolsa** | Un lugar donde hay dinero (o deuda): Cajita Nu Débito, Banorte, Efectivo, Deuda mami y Tarjeta Nu crédito. |
| **Movimiento** | Cualquier cosa que pasa con el dinero. Es la única "verdad" que se guarda. |
| **Libro (ledger)** | Cada bolsa es un libro: dinero que entró menos dinero que salió. Los saldos **nunca se guardan**, siempre se calculan. |
| **Saldo inicial** | El saldo con el que empieza una bolsa en una fecha. Lo anterior a esa fecha ya no mueve el saldo. |
| **Corte** | El día 22: Nu cierra el estado de cuenta. |
| **Fecha límite** | El día 1: último día para pagar lo del corte anterior. |
| **Periodo** | Del 22 de un mes al 21 del siguiente. Se paga el día 1. La app lee todo en periodos. |
| **Deuda mami** | Lo que la mamá de Vanessa le debe. Es un registro de seguimiento, no dinero real. |
| **Dummy** | Dato de relleno marcado visiblemente. No cuenta en saldos ni en el Resumen. |
| **Sheet gana** | Si algo cambia a la vez en la app y en el Sheets, se queda lo del Sheets. |

---

## 3. Las cinco bolsas

| Bolsa | Qué es | Por qué existe |
| --- | --- | --- |
| **Cajita Nu Débito** | Donde vive casi todo el dinero y donde gana rendimiento. | Es el dinero real principal. De aquí sale **siempre** el pago de la tarjeta. |
| **Banorte** | Cuenta de paso. | Todo lo que llega cae primero aquí (horno³, comedor, mamá) y de aquí se pasa a la cajita. |
| **Efectivo** | Dinero en mano. | Casi no se usa, pero existe: a veces la mamá toma efectivo o lo devuelve así. |
| **Deuda mami** | Lo que la mamá debe. | Es seguimiento, **no dinero real** hasta que lo regresa. |
| **Tarjeta Nu crédito** | La deuda de la tarjeta, límite de 40,000. | Es **deuda**: sube con cada compra y baja con cada pago. |

Dinero real = cajita + Banorte + efectivo. **Deuda mami no se suma como dinero real** porque todavía no está en manos de Vanessa.

> **Por qué se cambió el nombre de la cajita:** en la propuesta se llamaba "Cajita Turbo". En la práctica es la cajita de débito de Nu, y el nombre nuevo (Cajita Nu Débito) evita confundirla con la tarjeta (Tarjeta Nu crédito).

---

## 4. Los números de la pantalla Inicio

El número más grande es lo que **debe** en la tarjeta, no lo que le sobra. Eso se decidió al usar la app: lo que de verdad le importa es cuánta deuda tiene y si ya puede pagarla.

La tarjeta azul de arriba muestra:

1. **Debes en la tarjeta** (número grande): todo lo que ha salido de la tarjeta menos lo que ya se pagó.
2. **Te falta juntar:** lo que debe menos su dinero real. Si ya tiene suficiente, es 0. La deuda mami **no** ayuda a pagar la tarjeta porque aún no regresa.
3. **Balance total:** dinero real **más** Deuda mami, menos la deuda de la tarjeta. Es el panorama completo "contando lo que me deben". Puede ser negativo.
4. **Con tus suscripciones, el 1 pagas:** aparece solo si hay cobros esperados antes del corte. Suma la deuda actual más esos cobros y dice cuánto faltaría juntar.

> **Por qué tres números y no uno:** cada uno responde una duda distinta. "¿Cuánto debo?", "¿cuánto me falta para pagar?" y "¿cómo estoy si cuento lo que me deben?" no son la misma cuenta, y mezclarlas era justo lo confuso de llevarlo en la cabeza.

Más abajo, en orden: la tarjeta de **Deuda mami**, los botones rápidos (Agregar gasto, Pagar tarjeta, Mover dinero), los gastos "por revisar", lo que falta pasar de Banorte a la cajita, los próximos cobros, el rendimiento de la cajita y, al final, **Bolsas y crédito** (saldos de cada bolsa y cuánto del límite se usa). Lo que está en 0 no se muestra.

---

## 5. Los periodos de tarjeta (el 22 al 21)

Nu cierra su estado de cuenta el día 22 y se paga el día 1. Entonces:

- Un **periodo** va del 22 de un mes al 21 del siguiente, y se paga el día 1.
- **Regla del día de corte:** una compra hecha **el mismo día 22** ya pertenece al **siguiente** periodo, igual que en Nu.
- La app usa estos periodos en Inicio, Historial y Resumen, **no meses de calendario**. Así lo que ve en la app coincide con lo que ve en Nu.

Qué entra al pago del día 1: lo comprado hasta el día 21 y los cobros esperados que caen antes del corte. Lo demás pasa al siguiente periodo. (Hoy solo se ve el periodo actual; los anteriores se podrán ver cuando tengan su información completa.)

El estado de cuenta de cada corte viene de la pestaña **Cortes** del Sheets. Si un corte no está ahí, la app lo calcula con la deuda del día anterior. Cada pago cuenta aunque sea chico: si el estado es 300 y se pagan 100 un día y 200 el siguiente, queda pagado completo.

---

## 6. Los movimientos y los cuatro botones

Todo lo que pasa es un **movimiento** de uno de estos tipos:

| Tipo | Qué hace | Ejemplo |
| --- | --- | --- |
| **Ingreso** | Suma a una bolsa | Cae horno³ en Banorte |
| **Gasto** | Resta de una bolsa y guarda categoría | Estacionamiento pagado en efectivo |
| **Gasto con tarjeta** | Sube la deuda de la tarjeta y guarda categoría | Chilaquiles, una salida con amigos |
| **Transferencia** | Mueve dinero entre bolsas; **no es un gasto** | De Banorte a la cajita; pagar la tarjeta |
| **Ajuste** | Corrige o inicia un saldo | El **Saldo inicial** de una bolsa |

En la app se crean con cuatro pestañas dentro de **Agregar**:

- **Gasto:** monto, "¿en qué fue?", "¿con qué se pagó?" (viene con la tarjeta ya elegida, porque casi todo va ahí), categoría, fecha y la opción de guardarlo como frecuente. Arriba hay **atajos** para lo que se repite.
- **Ingreso:** monto, a dónde cayó (Banorte o efectivo) y categoría.
- **Mover:** monto, de qué bolsa a cuál (entre Banorte, cajita y efectivo). Viene lista con Banorte → Cajita, lo más común.
- **Pagar tarjeta:** solo el monto. **Siempre sale de la Cajita Nu Débito.**

> **Por qué "Pagar tarjeta" pide solo el monto:** se usa una o dos veces al mes y siempre sale de la cajita. Pedir "de dónde" era un paso que nunca cambiaba. Por dentro es una transferencia de la cajita a la tarjeta con la nota "Pago de tarjeta". Se puede pagar en varias partes: cada parte es un pago.

> **Por qué Mover no tiene la tarjeta ni Deuda mami:** cada una ya tiene su flujo propio (Pagar tarjeta y la tarjeta de Deuda mami). Tenerlas en dos lugares confundía.

Cuando se guarda algo, aparece un aviso de 6 segundos con **Deshacer**.

---

## 7. Deuda mami: cómo se maneja lo de la mamá

Esta fue la parte que más cambió al usar la app, y la regla es simple:

**La mamá nunca "paga" algo directamente. Siempre Vanessa paga y la mamá le regresa después.** Solo hay dos formas en que algo entra a Deuda mami:

1. **Vanessa paga con su Nu de forma normal** (por ejemplo, un viaje o las uñas) y la mamá se lo depositará después en Banorte.
2. **La mamá toma efectivo** (por ejemplo 200 pesos) y luego lo regresa en efectivo o lo deposita en Banorte.

### Cómo se registra

En la tarjeta **Deuda mami** de Inicio hay dos botones:

- **Me debe algo nuevo.** Se elige cómo fue:
  - **Tarjeta:** el gasto lo pagó la tarjeta. Sube la deuda de la tarjeta y sube Deuda mami por lo mismo.
  - **Efectivo:** la mamá se llevó efectivo. Baja el efectivo y sube Deuda mami.
  - **Ya está registrado:** el gasto ya aparece en el historial (o en la deuda inicial). Solo sube Deuda mami, para **no contarlo dos veces**.
- **Ya me regresó.** Se elige cómo lo regresó:
  - **Banorte:** lo depositó. Baja Deuda mami y sube Banorte.
  - **Efectivo:** lo dio en mano. Baja Deuda mami y sube efectivo.

Cada renglón de la lista tiene "Quitar" por si se registró algo mal.

### Lo que la mamá manda de más

Si la mamá deposita **más** de lo que debe, la parte extra es un **Ingreso** con categoría **Mamá**. Esa categoría **siempre cae en Banorte**, así que la app ni pregunta a dónde.

> **Por qué se quitó "Mamá" como forma de pago y como bolsa para mover dinero:** físicamente la mamá no es un lugar donde Vanessa tenga dinero. Tenerla como opción de pago o como origen de una transferencia no tenía sentido y hacía que los saldos y el Resumen dijeran cosas raras.
>
> **Por qué se quitó el "regalo de mamá" al pagar la tarjeta:** la propuesta original tenía un caso en que Vanessa daba 800 en efectivo y la mamá depositaba 1,000, "regalando" la diferencia. En la práctica, lo que la mamá pone de más es un ingreso normal que cae en Banorte, y todo el pago sale de la cajita. Un campo especial de "regalo" solo complicaba el pago.

Estos registros de seguimiento **no aparecen como gasto** en el Historial: la compra ya está listada como gasto con tarjeta, y el renglón de Deuda mami solo mueve el seguimiento.

---

## 8. Cómo se calculan los saldos

**Los saldos no se guardan: se calculan** recorriendo todos los movimientos. Por eso, si alguien cambia un movimiento a mano en el Sheets, todo se actualiza solo.

- Cada bolsa es un libro: lo que **entró** menos lo que **salió**.
- La **tarjeta** al revés: su deuda es lo que salió de ella menos lo que entró (los pagos).
- **Saldo inicial:** las bolsas con dinero real (cajita, Banorte y efectivo) empiezan con una fila de tipo Ajuste, categoría "Saldo inicial", con fecha. Lo que tenga fecha **anterior** a ese saldo ya no mueve el saldo de esa bolsa (pero sí cuenta en el Resumen, porque sigue siendo un gasto de ese periodo). La tarjeta y Deuda mami salen de sus movimientos.
- **Datos Dummy:** no cuentan en saldos ni en el Resumen. Se ven en gris con la etiqueta "Dummy". Se usan cuando falta un dato real. Los datos de ejemplo del código **nunca** se escriben en el Sheets.
- **Dinero:** siempre se guarda en **centavos** (enteros) y se muestra en pesos. Así nunca hay errores de redondeo con decimales.
- **Fechas:** se guardan como texto `AAAA-MM-DD` y "hoy" es la fecha del teléfono en horario de Ciudad de México, para que un servidor en otra zona horaria no cambie el día.

---

## 9. Rendimiento de la cajita

La cajita de Nu genera rendimiento (hoy 13% anual, editable en Ajustes porque Nu puede cambiarlo). La app lo calcula así:

- **Interés compuesto diario:** cada cantidad que entró a la cajita gana interés desde su fecha hasta hoy: `cantidad × (1 + tasa/365)^días`. Por eso el saldo de la cajita en la app **ya incluye** el rendimiento ganado y coincide con Nu sin tener que ajustar a mano.
- **Rendimiento hasta tu día de pago** (tarjeta en Inicio): estima cuánto va a ganar la cajita hasta el día que Vanessa planea pagar. El **día de pago** se puede cambiar con un selector de fecha (por defecto, el día antes de la fecha límite). Muestra "Hoy tienes X en la cajita. Para el día tal tendrías Y".
- **Ganado en este periodo:** el interés que la cajita ya generó en el periodo actual.

> **Por qué compuesto y no simple:** la propuesta usaba interés simple (`saldo × tasa/365 × días`). Nu capitaliza a diario, así que el compuesto se acerca más al número real. La diferencia son centavos, pero evita que la app y Nu nunca coincidan.
>
> **Por qué se quitó el botón "Ajustar cajita":** como el saldo ya incluye el rendimiento calculado, un botón para escribir el saldo real y guardar la diferencia ya no hacía falta. Si Nu cambia la tasa, se edita en Ajustes del Sheets.

---

## 10. Cobros esperados (suscripciones y gastos fijos)

Las suscripciones se cobran cada mes o cada año a la tarjeta. La app las maneja en dos pasos:

1. **Gastos fijos (pestaña del Sheets):** una fila por suscripción con su monto normal, si es mensual o anual, el día, desde cuándo y hasta cuándo, y si está activa.
2. **Pagos esperados:** de ahí la app genera sola los cobros del **mes actual y el siguiente**. Cada cobro tiene estado: **Esperado, Cobrado u Omitido**.

En Inicio, **Próximos cobros** muestra los que caen antes del siguiente corte (los que caen después aparecen cuando cambia el periodo). Cada cobro tiene dos botones:

- **Ya se cobró:** lo convierte en un gasto con tarjeta (con la fecha del cargo, o la de hoy si llegó antes) y lo marca Cobrado.
- **Omitir:** lo marca Omitido; no cuenta.

Si pasa el día y no se confirma, sigue como esperado y se marca **Atrasado**.

Los cobros esperados se **suman al pago del día 1** (la línea "Con tus suscripciones, el 1 pagas") pero **no** se restan del dinero libre hasta que se cobran de verdad. La app genera cobros con una regla de **solo agregar**: nunca sobreescribe el estado de un cobro que ya existe (por eso un "Cobrado" nunca vuelve a "Esperado" al sincronizar).

> **Por qué se quitó "toca el monto si este mes cambia":** el monto de cada cobro es el de la suscripción. Cambiarlo cobro por cobro era una función poco usada que ocupaba espacio y generaba errores. Si el precio cambia de verdad, se edita en la hoja Gastos fijos.
>
> **Por qué las uñas ya no son gasto recurrente:** en la propuesta eran un gasto "cada 3 semanas" con un recordatorio y botones "las pagué yo / las pagó mamá". En la práctica no tienen día fijo y a veces las paga la mamá, así que el recordatorio sobraba. Ahora son un **atajo** de gasto normal (555 con tarjeta). Si las paga la mamá, se registra en Deuda mami como cualquier otra cosa.

---

## 11. Atajos

Los gastos que se repiten (una dona, unos chilaquiles, las uñas) son **atajos**: se registran con un toque. Cada atajo guarda nombre, monto, categoría y con qué se paga. Se crea uno desde cualquier gasto con "Guardar como frecuente". Un atajo puede quedar **sin precio**: la primera vez pide el precio y lo guarda. Hay modo **Editar** para cambiar un precio o borrar un atajo.

---

## 12. Las pantallas

La barra de abajo tiene cuatro destinos y un botón central **+**:

- **Inicio:** descrita en la sección 4.
- **Historial:** los movimientos **del periodo actual**, agrupados por día ("Viernes 6 nov"), como en Nu. Tiene filtros: Todo / Gastos / Ingresos, por **bolsa** y por **categoría** (las categorías cambian según el tipo). Se puede cambiar la categoría de un gasto directo en la lista, y "Borrar" un movimiento. Lo que es solo seguimiento de Deuda mami no se lista. Los movimientos anteriores a un saldo inicial se ven atenuados porque solo cuentan en el Resumen.
- **Resumen:** del **periodo actual**: cuánto se gastó y en cuántos gastos, **en qué se gastó** (gráfica por categoría), los **gastos más grandes** y cuánto entró.
- **Perfil:** nombre y correo, conexión con Google y su estado de sincronización ("Sincronizado a las 10:05"), **Sincronizar ahora**, **Abrir el Sheets**, **Respaldo** (descarga un JSON con todo), avisos de privacidad y términos, **Cambiar de perfil** y **Cerrar sesión**.

**Categorías:** comida, salidas, transporte, escuela, antojos, pareja, mamá, suscripciones, otros, pendiente y no sé. La categoría **pendiente** sirve para algo que se registra sin saber qué es: Inicio avisa "N gastos por revisar" para que se le ponga categoría después. En los ingresos: horno³, comedor, mamá y otros. Las listas viven en la pestaña Ajustes.

---

## 13. Perfiles ("¿Quién está usando Pockets?")

Al abrir la app aparece un selector con tres perfiles, como un servicio de streaming:

- **Vanessa** (dueña): ve y edita todo.
- **Mamá** (lectora): pensado para que vea la información en modo solo lectura. **Todavía no está habilitado**; hoy muestra una pantalla vacía.
- **Novio** (propio): pensado como un espacio separado con sus propios datos. **Todavía no está configurado.**

Es un **selector, no un candado**: sirve para elegir qué espacio abrir. Cada persona tendrá sus datos en su propio Google Sheets. La elección vive solo en la pestaña del navegador (sessionStorage), así que al cerrar la app se vuelve a preguntar. Los tres círculos siempre se ven en una sola fila, sin importar el ancho del teléfono.

---

## 14. Google Sheets como base de datos

El Sheets **es la fuente de verdad**: la app escribe ahí cada cambio y lee lo que alguien cambie a mano. No hay otra base de datos.

### Pestañas de datos (la app lee y escribe)

| Pestaña | Columnas | Para qué |
| --- | --- | --- |
| **Movimientos** | ID, Fecha, Tipo, Monto, De, A, Categoría, Nota, Dato | Una fila por movimiento. Montos en pesos, sin signo. |
| **Gastos fijos** | ID, Nombre, Monto normal, Frecuencia, Día, Mes, Categoría, Desde, Hasta, Activo | Las suscripciones. **La app solo las lee.** Frecuencia: Mensual o Anual. |
| **Pagos esperados** | ID, Gasto fijo, Nombre, Fecha, Monto, Categoría, Estado (+ "Se paga el", calculada) | Los cobros que genera la app. |
| **Cortes** | Fecha de corte, Fecha límite, Estado de cuenta (+ columnas calculadas) | El monto de cada estado de cuenta. **La app solo lo lee.** |
| **Atajos** | ID, Nombre, Monto, Categoría, Se paga con | Gastos frecuentes. |
| **Ajustes** | Límite de la tarjeta, Día de corte, Día límite de pago, Tasa anual de la cajita, Día de pago + listas de categorías, bolsas, tipos, estados y datos | Configuración y las listas de los menús desplegables. |

### Pestañas de vista (solo para mirar)

**Resumen del mes**, **Gastos fijos por mes** e **Ingresos por quincena**: se calculan solas con fórmulas y la app **nunca** escribe en ellas. Están protegidas contra edición accidental.

> **Nota honesta:** estas vistas del Sheets agrupan por **mes de calendario**, mientras que la app agrupa por **periodo de tarjeta** (22 al 21). Los saldos de bolsas en esas vistas sí coinciden con la app; los totales "del mes" pueden diferir de los "del periodo". Adaptar esas vistas a periodos es una mejora pendiente.

### Reglas para editar a mano

- No cambies los nombres ni el orden de las columnas.
- Si agregas una fila, deja el ID vacío: la app se lo pone.
- Los menús desplegables evitan equivocarse en tipo, bolsa, categoría, estado y dato.
- Una fila con error (monto con letras, tipo inexistente, bolsa que no existe) **se marca y no se cuenta** hasta corregirla. La app no se rompe: muestra cuántas filas tienen problema.
- Un dato de relleno se marca **Dummy** en la columna Dato.

Las tablas se ven bien a propósito: encabezados oscuros, el mes actual resaltado, montos con formato de pesos, primera fila y columna fijas, estados con color (Esperado amarillo, Cobrado verde, Omitido gris, atrasado rojo).

---

## 15. Cómo se sincroniza (sin perder nada)

La app es **offline-first**: funciona sin internet y sincroniza cuando puede.

1. Toda la información se guarda también en el teléfono (**IndexedDB**, con la librería **Dexie**). Por eso abre rápido y se puede usar sin conexión.
2. Cada cambio que Vanessa hace se anota en una **bandeja de salida (outbox)** con el cambio concreto: "agrega este movimiento", "borra estos", "agrega estos cobros", etc.
3. **Sincronizar** = mandar la bandeja de salida a una función del servidor (`/api/sync`), que la escribe en el Sheets, y **leer todo el Sheets** de vuelta.
4. La app sincroniza al abrirse, cada vez que se vuelve a ella, al recuperar internet y después de cada cambio.
5. **El Sheets gana**: lo que vuelve del Sheets reemplaza la copia del teléfono, pero los cambios que todavía no se habían subido se vuelven a aplicar encima (así nada se pierde si se hizo algo sin internet).
6. Un cambio pendiente solo se descarta de la bandeja cuando el servidor confirmó que lo escribió.

El servidor **valida cada cambio** que llega del navegador campo por campo antes de tocar el Sheets (nunca confía en lo que mande el teléfono). Un aviso delgado arriba indica cuando algo necesita atención: "Sin internet · 2 cambios por subir", "Conecta tu Google…" o "No se pudo sincronizar".

---

## 16. Cuentas, permisos y seguridad

- **Inicio de sesión con Google** usando **Auth.js**. Se pide el permiso de Google Sheets y se entra con redirección completa (en iPhone las ventanas emergentes de inicio de sesión fallan dentro de una app instalada).
- **Los tokens de Google viven solo en el servidor**, dentro de una cookie de sesión cifrada. El navegador nunca los ve. Se pide un **refresh token** para que el acceso se renueve solo y no haya que reconectar cada hora.
- **Un solo correo autorizado:** una variable de entorno (`ALLOWED_EMAIL`) define quién puede entrar; cualquier otra cuenta de Google se rechaza.
- El ID del Sheets y los secretos de Google van en **variables de entorno** (en Vercel), nunca en el código. El archivo `.env.example` lista las variables sin valores secretos.
- Google muestra una pantalla de aviso al conectar porque es una app personal sin verificar; es normal.

---

## 17. Cómo está construido el código

**Stack:** Next.js (App Router), React, TypeScript y Tailwind. Despliegue en Vercel (cada push a `main` publica). Reglas del proyecto: nada de `any`, componentes con una sola responsabilidad, código y comentarios en inglés, interfaz en español.

La separación por capas es la decisión de arquitectura más importante:

| Carpeta | Qué contiene | Por qué |
| --- | --- | --- |
| `src/domain` | **Lógica pura**: libro de saldos, periodos, estado de la tarjeta, rendimiento, cobros esperados, mapeo de filas del Sheets, validación de cambios. Sin React ni red. | Es lo que más importa y lo más fácil de equivocarse. Al ser funciones puras se prueba rápido y con certeza. |
| `src/services` | Repositorio (Dexie + bandeja de salida), acciones de la app, sincronización. | Separa "qué hace la app" de "dónde se guarda". |
| `src/server` | Todo lo que corre solo en el servidor: acceso a Google, cliente de Sheets, lectura/escritura por pestaña. | Los permisos de Google nunca llegan al navegador. |
| `src/components` | Pantallas y piezas visuales, por pantalla (`home`, `add`, `history`, `summary`, `profile`, `sync`, `ui`). | Interfaz sin lógica de negocio. |
| `src/data` | Datos iniciales de ejemplo (categorías, atajos, gastos fijos). | Solo se usan la primera vez; nunca se escriben en el Sheets. |
| `src/app` | Rutas (Inicio, Agregar, Historial, Resumen, Perfil, privacidad, términos), API de sesión y de sincronización, manifiesto e íconos. | Estructura estándar de Next.js. |

**Pruebas:** hay pruebas automáticas sobre la lógica de dominio y el mapeo del Sheets (saldos, periodos, tarjeta, rendimiento, cobros, lectura de filas, validación de cambios). Se corren con `npm test`.

**Cómo correrlo:**

```bash
npm install
npm run dev        # servidor local en http://localhost:3000
npm test           # pruebas
npm run typecheck  # revisión de tipos
npm run lint       # estilo
npm run build      # versión de producción
```

Para conectar con Google en local hace falta un archivo `.env.local` con las variables de `.env.example` (el ID del Sheets, el correo autorizado, `AUTH_SECRET` y las credenciales de Google Cloud).

**Instalarla en iPhone:** abrir la dirección de Vercel en Safari → Compartir → "Agregar a pantalla de inicio". El manifiesto (`manifest.ts`) le da nombre, íconos y colores, y la abre a pantalla completa.

---

## 18. Qué cambió respecto a la propuesta original (y por qué)

| En la propuesta | Hoy | Por qué |
| --- | --- | --- |
| Número grande: "libre de verdad" | Número grande: **"Debes en la tarjeta"**, más "Te falta juntar" y "Balance total" | Lo que más importa es la deuda y si ya puede pagarla; "libre" mezclaba cosas. |
| Bolsa "Por cobrar (mamá)" | **Deuda mami**, solo seguimiento, con solo dos formas de entrada | Más claro y refleja cómo pasa de verdad. |
| La mamá como forma de pago ("las pagó mamá") | **No existe.** Vanessa paga y la mamá regresa | Físicamente la mamá no es una bolsa. |
| Regalo de la mamá al pagar la tarjeta | **Ingreso de mamá** a Banorte (lo extra) | Un campo especial complicaba el pago sin aportar. |
| Plan para apartar dinero antes de pagar la tarjeta | **Eliminado** | Era complejo y no se usaba; "Te falta juntar" ya dice lo necesario. |
| Pagar la tarjeta con varias fuentes | **Un solo monto, siempre desde la cajita** | Se usa 1–2 veces al mes y siempre sale de ahí. |
| Ajuste de saldo de la cajita | **Eliminado**; el rendimiento compuesto ya está en el saldo | Evita capturar saldos a mano. |
| Rendimiento simple | **Interés compuesto diario** | Se parece más al número real de Nu. |
| Meses de calendario ("este mes y el pasado") | **Periodos de tarjeta** (22 al 21) | Coincide con Nu y con lo que se paga el día 1. |
| Uñas como gasto recurrente cada 3 semanas | **Atajo de gasto normal** | No tienen día fijo; el recordatorio sobraba. |
| Cambiar el monto de un cobro "solo este mes" | **Eliminado** | Poco usado; si cambia el precio, se edita el gasto fijo. |
| "Cajita Turbo" y "Tarjeta Nu" | **Cajita Nu Débito** y **Tarjeta Nu crédito** | Nombres más claros. |
| 4 pantallas | 4 pantallas + **Perfil** y selector de perfiles | Conexión con Google, respaldo y cambio de perfil. |
| Gasto fijo "cada N días" en el Sheets | **Solo Mensual o Anual** | Sin uñas recurrentes ya no se usaba. |
| Atajos enlazados a un gasto fijo | **Atajos simples** | Estaban ligados a las uñas recurrentes. |
| Avisos (push, quincena, pagar tarjeta) | **No construidos todavía** | Quedan como mejora futura; hoy hay un aviso de sincronización y el de "gastos por revisar". |
| Service worker para uso sin internet | **No construido todavía**; los datos sí funcionan sin internet gracias a Dexie | Pendiente: guardar también la app en sí. |
| Días de quincena y plan de pago con montos en Ajustes | **Quitados**; solo queda el **Día de pago** | Ya no se usaban. |

---

## 19. Lo que falta o se puede mejorar

- **Perfil de Mamá** en solo lectura y **espacio propio del Novio**, con nombres reales. Hoy son pantallas vacías.
- Un **PIN** opcional para el perfil de la dueña.
- **Ver periodos anteriores** en Inicio, Historial y Resumen.
- **Service worker** para que la app abra aunque no haya internet, y **avisos** (pagar la tarjeta, quincena, próximos cobros) con notificaciones push.
- Que las vistas del Sheets (Resumen del mes, etc.) usen **periodos de tarjeta** en lugar de meses de calendario.
- Un botón "Ver todo en Google Sheets" más visible desde el Historial para movimientos muy viejos.

---

## 20. Las decisiones clave, en una lista

1. **El Sheets es la verdad**, la app es una ventana rápida con copia local.
2. **Los saldos se calculan, no se guardan.** Una sola fuente (los movimientos) y cero números desincronizados.
3. **La tarjeta es deuda, no dinero.** Y la deuda mami no es dinero real hasta que regresa.
4. **Todo se lee en periodos de tarjeta**, igual que Nu.
5. **Cada acción tiene un solo lugar:** pagar la tarjeta, mover dinero, apuntar lo de mamá, ingresos. Menos pasos, menos confusión.
6. **La mamá nunca paga directo:** Vanessa paga y ella regresa; lo extra es un ingreso a Banorte.
7. **Offline-first con "el Sheets gana":** nada se pierde sin internet y los conflictos tienen una regla clara.
8. **Seguridad en el servidor:** los tokens de Google nunca llegan al navegador y cada cambio se valida.
9. **Lógica pura y probada**, separada de la interfaz y de dónde se guardan los datos.
10. **Si no se usa, no se deja:** la app y el Sheets se mantienen limpios y con los mismos nombres y la misma estructura.
