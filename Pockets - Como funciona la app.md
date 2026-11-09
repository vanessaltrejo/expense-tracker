# Pockets: cómo funciona la app y por qué está hecha así

**Para quién es este documento:** para alguien que nunca ha visto la app. Explica qué problema resuelve, cómo piensa el dinero, qué hace cada pantalla, cómo se calcula cada número, cómo se guardan los datos, cómo entra cada persona y, sobre todo, **por qué las cosas funcionan como funcionan**. Describe la app tal como es hoy, no su historia.

**Índice**

1. El problema y la idea
2. Vocabulario
3. Quién usa la app
4. Entrar: usuario y contraseña
5. La versión de Vanessa: las cinco bolsas
6. Inicio de Vanessa: los números
7. Periodos de tarjeta (del 22 al 21)
8. Movimientos y los cuatro botones
9. Deuda mami
10. Cómo se calculan los saldos
11. Rendimiento de la cajita
12. Cobros esperados (suscripciones)
13. Atajos
14. Historial, Resumen y Perfil
15. La versión de Francisco (simple, por mes)
16. Google Sheets como base de datos
17. Cómo se sincroniza
18. Seguridad y permisos
19. Cómo está construido y cómo operarlo
20. Las decisiones clave
21. Lo que falta o se puede mejorar

---

## 1. El problema y la idea

Vanessa tiene su dinero repartido en varios lugares y casi todos sus gastos van a una tarjeta de crédito. Llevar las cuentas en la cabeza no funciona: cualquier gasto chico desacomoda el plan.

**Pockets responde una pregunta: ¿cuánto debo en la tarjeta y cuánto me falta por juntar para pagarla?**

La idea que lo sostiene todo: **cada lugar donde hay dinero es una "bolsa"**, y la tarjeta es una **deuda**, no dinero. Con eso la app calcula, sin que nadie sume a mano, cuánto se debe, cuánto hay y cuánto falta.

La misma app sirve a más de una persona. Francisco, por ejemplo, no tiene tarjeta: tiene una cuenta de banco y algo de efectivo, y quiere ver **en qué gasta**. Por eso hay dos "layouts" (versiones de pantalla): el completo y el simple. La lógica es la misma; cambia lo que se muestra.

Pockets es una **PWA**: una página web que se instala en el teléfono y se comporta como app. Usa **Google Sheets como base de datos**: uno por persona, todos en la cuenta de Google de Vanessa. Así ella puede abrirlos, ver todo con tablas normales y corregir lo que haga falta sin pasar por la app.

---

## 2. Vocabulario

| Palabra | Qué significa |
| --- | --- |
| **Bolsa** | Un lugar donde hay dinero (o deuda). |
| **Movimiento** | Cualquier cosa que pasa con el dinero. Es la única "verdad" que se guarda. |
| **Libro (ledger)** | Cada bolsa es un libro: dinero que entró menos dinero que salió. Los saldos **nunca se guardan**, siempre se calculan. |
| **Saldo inicial** | El saldo con el que empieza una bolsa en una fecha. Lo anterior a esa fecha ya no mueve el saldo. |
| **Corte** | El día 22: Nu cierra el estado de cuenta de la tarjeta. |
| **Fecha límite** | Normalmente el día 1: último día para pagar lo del corte anterior. Si Nu la mueve un mes, se escribe en la pestaña Cortes y vale solo para ese corte. |
| **Periodo** | Del 22 de un mes al 21 del siguiente. Se paga el día 1. La versión de Vanessa lee todo en periodos. |
| **Deuda mami** | Lo que la mamá de Vanessa le debe. Es un registro de seguimiento, no dinero real. |
| **Dato** | Columna de cada movimiento: **Real** (cuenta en todo) o **Previo** (pasó antes de la app y ya está dentro de los saldos iniciales). |
| **ID** | El nombre único de cada fila: la fecha del movimiento (`AAMMDD`) y cuatro caracteres al azar, por ejemplo `261107-gu96`. |
| **Layout** | La versión de pantallas que ve una persona: **completo** (Vanessa y Mami) o **simple** (Francisco). |
| **Rol** | Qué puede hacer: **dueño** (todo) o **solo lectura** (solo mirar). |
| **Sheet gana** | Si algo cambia a la vez en la app y en el Sheets, se queda lo del Sheets. |
| **Cuenta de servicio** | Un "robot" de Google que la app usa para leer y escribir los Sheets compartidos con él. |

---

## 3. Quién usa la app

| Usuario | Nombre que se ve | Layout | Rol | Su Sheets |
| --- | --- | --- | --- | --- |
| `vanessa` | Vanessa Trejo | Completo | Todo | "Mis gastos" |
| `mami` | Mami | Completo | **Solo lectura** | El de Vanessa |
| `francisco` | Francisco Amaya | Simple | Todo | "Gastos Francisco" |

Cada persona usa la app **en su propio teléfono**. Los Sheets viven en la cuenta de Google de Vanessa. El de Francisco se comparte además con su correo, para que él también pueda abrirlo.

La versión de Mami es **la misma app** que la de Vanessa, solo que sin ningún botón para agregar, editar o borrar, y sin acceso al Sheets ni al respaldo. Como lee el mismo Sheets, ve exactamente lo mismo que Vanessa, al día.

---

## 4. Entrar: usuario y contraseña

Al abrir la app, si nadie ha entrado, aparece **"Entra a Pockets"** con dos campos: usuario y contraseña. El usuario no distingue mayúsculas ni espacios ("Mami" y " mami " entran igual).

- Con datos correctos, se abre la app con el layout y los permisos de esa persona.
- Con datos incorrectos dice "El usuario o la contraseña no coinciden", y no revela cuál de los dos falló.
- **Cerrar sesión** está en Perfil. Al cerrar, la app borra lo que tenía en memoria de esa persona y vuelve a la pantalla de entrada.
- Las páginas de **Aviso de privacidad** y **Términos de uso** se pueden leer sin entrar.
- Si el Sheets de alguien todavía no está conectado, la app dice **"Tu espacio todavía no está listo"**, y Perfil sigue abierto para sincronizar o cerrar sesión.

> **Por qué usuario y contraseña y no Google:** Mami y Francisco no necesitan una cuenta de Google, y todos los datos quedan en la cuenta de Vanessa. Es un candado real, no solo un selector de perfiles.

---

## 5. La versión de Vanessa: las cinco bolsas

| Bolsa | Qué es | Por qué existe |
| --- | --- | --- |
| **Cajita Nu Débito** | Donde vive casi todo el dinero y donde gana rendimiento. | Es el dinero real principal. De aquí sale **siempre** el pago de la tarjeta. |
| **Banorte** | Cuenta de paso. | Todo lo que llega cae primero aquí (horno³, comedor, mamá) y de aquí se pasa a la cajita. |
| **Efectivo** | Dinero en mano. | Casi no se usa, pero existe: a veces la mamá toma efectivo o lo devuelve así. |
| **Deuda mami** | Lo que la mamá debe. | Es seguimiento, **no dinero real** hasta que lo regresa. |
| **Tarjeta Nu crédito** | La deuda de la tarjeta, con límite de 40,000. | Es **deuda**: sube con cada compra y baja con cada pago. |

**Dinero real = cajita + Banorte + efectivo.** Deuda mami no se suma como dinero real porque todavía no está en manos de Vanessa.

> **Por qué los nombres "Cajita Nu Débito" y "Tarjeta Nu crédito":** las dos son de Nu y se confunden fácil. El nombre dice cuál es dinero (débito) y cuál es deuda (crédito).

---

## 6. Inicio de Vanessa: los números

El número más grande es lo que **debe** en la tarjeta, no lo que le sobra. Lo que de verdad le importa es cuánta deuda tiene y si ya puede pagarla.

Arriba, la tarjeta azul muestra:

1. **Debes en la tarjeta** (número grande): lo que ha salido de la tarjeta menos lo que ya se pagó.
2. **Te falta juntar:** lo que debe menos su dinero real. Si ya tiene suficiente, es 0. Deuda mami **no** ayuda a pagar la tarjeta, porque aún no regresa.
3. **Balance total:** dinero real **más** Deuda mami, menos la deuda de la tarjeta. Es el panorama completo "contando lo que me deben". Puede ser negativo.
4. **Con tus suscripciones, el día de pago pagas:** aparece solo si hay cobros esperados antes del corte. Suma la deuda actual más esos cobros y dice cuánto faltaría juntar.

> **Por qué tres números y no uno:** cada uno responde una duda distinta. "¿Cuánto debo?", "¿cuánto me falta para pagar?" y "¿cómo estoy si cuento lo que me deben?" no son la misma cuenta, y mezclarlas era justo lo confuso de llevarlo en la cabeza.

Más abajo, en orden: la tarjeta de **Deuda mami**, los botones rápidos (Agregar gasto, Pagar tarjeta, Mover dinero), los gastos "por revisar", lo que falta pasar de Banorte a la cajita, los **Próximos cobros**, el **rendimiento** de la cajita y, al final, **Bolsas y crédito** (saldo de cada bolsa y cuánto del límite se usa). Lo que está en 0 no se muestra.

> **Por qué Inicio siempre muestra hoy:** todo lo de Inicio (deuda, saldos, cobros por venir) describe el momento actual. Un periodo pasado no tiene saldos reales que mostrar, solo gastos, y para eso están Historial y Resumen.

---

## 7. Periodos de tarjeta (del 22 al 21)

Nu cierra su estado de cuenta el día 22 y se paga el día 1. Entonces:

- Un **periodo** va del 22 de un mes al 21 del siguiente, y se paga el día 1.
- **Regla del día de corte:** una compra hecha **el mismo día 22** pertenece al **siguiente** periodo, igual que en Nu.
- La versión de Vanessa usa estos periodos en Inicio, Historial y Resumen, **no meses de calendario**.

> **Por qué periodos y no meses:** así lo que ve en la app coincide con lo que ve en Nu y con lo que realmente paga el día 1.

Qué entra al pago del día 1: lo comprado hasta el día 21 y los cobros esperados que caen antes del corte. Lo demás pasa al siguiente periodo.

**El estado de cuenta de cada corte** viene de la pestaña **Cortes** del Sheets. Si un corte no está ahí, la app lo calcula con la deuda del día anterior.

**Fecha límite distinta un mes:** normalmente es el día de Ajustes (el 1), pero Nu a veces la mueve (por ejemplo, el corte del 22 de noviembre se paga el 3 de diciembre). Entonces se agrega la fila de ese corte en **Cortes** con su fecha límite, y la app la usa solo para ese corte. El estado de cuenta puede quedar vacío mientras no salga: la app sigue calculando la deuda. Cada pago cuenta aunque sea chico: si el estado es 300 y se pagan 100 un día y 200 el siguiente, queda pagado completo.

**Periodos anteriores:** en la versión de Vanessa, Historial y Resumen muestran el periodo actual. Todavía no hay periodos completos con información suficiente que valga la pena ver; cuando los haya, se podrán elegir como ya se hace en la versión de Francisco (sección 15).

---

## 8. Movimientos y los cuatro botones

Todo lo que pasa es un **movimiento** de uno de estos tipos:

| Tipo | Qué hace | Ejemplo |
| --- | --- | --- |
| **Ingreso** | Suma a una bolsa | Cae horno³ en Banorte |
| **Gasto** | Resta de una bolsa y guarda categoría | Estacionamiento pagado en efectivo |
| **Gasto con tarjeta** | Sube la deuda de la tarjeta y guarda categoría | Chilaquiles, una salida con amigos |
| **Transferencia** | Mueve dinero entre bolsas, o lo manda a otra persona; **no es un gasto** | De Banorte a la cajita; pagar la tarjeta |
| **Ajuste** | Corrige o inicia un saldo | El **Saldo inicial** de una bolsa |

Cada movimiento guarda: un **ID**, la **fecha**, el **tipo**, el **monto** (en centavos), de qué bolsa **sale** ("De"), a cuál **entra** ("A"), la **categoría**, una **nota** y si el **Dato** es Real o Previo.

El **ID** lleva la fecha del movimiento al principio (`261107-gu96` es del 7 de noviembre de 2026) y cuatro caracteres al azar. La fecha hace que, al ver el Sheets, cada ID diga de cuándo es; el azar evita que dos teléfonos creen el mismo ID aunque estén sin internet.

En la versión de Vanessa se crean con cuatro pestañas dentro de **Agregar**:

- **Gasto:** monto, "¿en qué fue?", "¿con qué se pagó?" (viene con la tarjeta ya elegida, porque casi todo va ahí), categoría, fecha y la opción de guardarlo como frecuente. Arriba hay **atajos** para lo que se repite.
- **Ingreso:** monto, nota (opcional), a dónde cayó (Banorte o efectivo), categoría y fecha. Cada ingreso se agrega a mano con su categoría (horno³, comedor, mamá u otros).
- **Mover:** monto, de qué bolsa a cuál (entre Banorte, cajita y efectivo) y fecha. Viene lista con Banorte → Cajita, lo más común. También sirve para mandar dinero a una persona.
- **Pagar tarjeta:** el monto y la fecha (hoy por defecto, por si el pago fue otro día). **Siempre sale de la Cajita Nu Débito.**

Todas tienen **fecha**: hoy por defecto, y cualquier día anterior cuando algo se registra tarde. No se puede poner una fecha futura.

> **Por qué ningún ingreso tiene día fijo:** los ingresos de Vanessa (horno³, comedor) no llegan en días regulares, así que no hay nada contra qué compararlos. Ella apunta cada uno cuando llega, y las pestañas de vista del Sheets los agrupan.

> **Por qué "Pagar tarjeta" no pregunta de dónde sale:** se usa una o dos veces al mes y siempre sale de la cajita. Pedir "de dónde" era un paso que nunca cambiaba. Por dentro es una transferencia de la cajita a la tarjeta con la nota "Pago de tarjeta". Se puede pagar en varias partes: cada parte es un pago.

> **Por qué Mover no incluye la tarjeta ni Deuda mami:** cada una tiene su flujo propio (Pagar tarjeta y la tarjeta de Deuda mami). Tenerlas en dos lugares confunde.

Al guardar algo aparece un aviso de 6 segundos con **Deshacer**. Las pestañas de Agregar caben siempre en una sola fila, sin scroll horizontal, en cualquier ancho de teléfono.

---

## 9. Deuda mami

La regla es simple:

**La mamá nunca "paga" algo directamente. Siempre Vanessa paga y la mamá le regresa después.** Solo hay dos formas en que algo entra a Deuda mami:

1. **Vanessa paga con su Nu de forma normal** (por ejemplo, un viaje o las uñas) y la mamá se lo depositará después en Banorte.
2. **La mamá toma efectivo** (por ejemplo 200 pesos) y luego lo regresa en efectivo o lo deposita en Banorte.

> **Por qué la mamá no es una bolsa ni una forma de pago:** físicamente no es un lugar donde Vanessa tenga dinero. Tratarla como bolsa haría que los saldos y el Resumen dijeran cosas raras. Es una deuda que se anota y se cobra.

### Cómo se registra

En la tarjeta **Deuda mami** de Inicio hay dos botones, y los dos piden una **fecha** (hoy por defecto):

- **Me debe algo nuevo.** Se elige cómo fue:
  - **Tarjeta:** el gasto lo pagó la tarjeta. Sube la deuda de la tarjeta y sube Deuda mami por lo mismo.
  - **Efectivo:** la mamá se llevó efectivo. Baja el efectivo y sube Deuda mami.
  - **Ya está registrado:** el gasto ya aparece en el historial (o en la deuda inicial). Solo sube Deuda mami, para **no contarlo dos veces**. Aquí la fecha conviene que sea la del gasto original, para que en la lista de Deuda mami diga cuándo fue de verdad.
- **Ya me regresó.** Se elige cómo lo regresó:
  - **Banorte:** lo depositó. Baja Deuda mami y sube Banorte.
  - **Efectivo:** lo dio en mano. Baja Deuda mami y sube efectivo.

Cada renglón de la lista tiene "Quitar" por si se registró algo mal.

### Lo que la mamá manda de más

Si la mamá deposita **más** de lo que debe, la parte extra es un **Ingreso** con categoría **Mamá**. Esa categoría **siempre cae en Banorte**, así que la app ni pregunta a dónde.

> **Por qué lo extra es un ingreso normal y no un "regalo" dentro del pago:** lo que la mamá pone de más es dinero que llegó a Banorte, igual que cualquier otro ingreso. Un campo especial de "regalo" al pagar la tarjeta solo complicaría el pago.

Estos registros de seguimiento **no aparecen como gasto** en el Historial: la compra ya está listada como gasto con tarjeta, y el renglón de Deuda mami solo mueve el seguimiento.

---

## 10. Cómo se calculan los saldos

**Los saldos no se guardan: se calculan** recorriendo todos los movimientos. Por eso, si alguien cambia un movimiento a mano en el Sheets, todo se actualiza solo y nunca hay un número que quede desincronizado.

- Cada bolsa es un libro: lo que **entró** menos lo que **salió**.
- La **tarjeta** al revés: su deuda es lo que salió de ella menos lo que entró (los pagos).
- **Saldo inicial:** las bolsas con dinero real empiezan con una fila de tipo Ajuste, categoría "Saldo inicial", con fecha. Lo que tenga fecha **anterior** a ese saldo ya no mueve el saldo de esa bolsa (pero sí cuenta en el Resumen, porque sigue siendo un gasto de ese periodo). La tarjeta y Deuda mami salen de sus movimientos.
- **Datos Previo:** lo que pasó antes de la app y que ya está dentro de los saldos iniciales: todo lo anterior al 22 de octubre de 2026 y los ingresos del 29 de octubre. Cuenta en el Resumen y en las vistas del Sheets, pero no mueve ningún saldo ni la deuda de la tarjeta. Se marca en la columna Dato.
- **Dinero:** siempre se guarda en **centavos** (enteros) y se muestra en pesos. Así nunca hay errores de redondeo con decimales.
- **Fechas:** se guardan como texto `AAAA-MM-DD` y "hoy" es la fecha del teléfono en horario de Ciudad de México, para que un servidor en otra zona horaria no cambie el día.

> **Por qué existe "Previo":** Vanessa quiso tener en el Sheets su historia de antes de la app (por ejemplo sus ingresos de julio a octubre) para ver tendencias, pero esos movimientos ya están dentro de los saldos iniciales. Si contaran como movimientos normales, el dinero se contaría dos veces. "Previo" los deja visibles sin que muevan nada.

---

## 11. Rendimiento de la cajita

La cajita de Nu genera rendimiento (hoy 13% anual, editable en Ajustes porque Nu puede cambiarlo). La app lo calcula así:

- **Interés compuesto diario:** cada cantidad que entró a la cajita gana interés desde su fecha hasta hoy: `cantidad × (1 + tasa/365)^días`. Por eso el saldo de la cajita en la app **ya incluye** el rendimiento ganado y coincide con Nu sin tener que ajustar a mano.
- **Rendimiento hasta tu día de pago** (tarjeta en Inicio): estima cuánto va a ganar la cajita hasta el día que Vanessa planea pagar. El **día de pago** se cambia con un selector de fecha (por defecto, el día antes de la fecha límite). Muestra "Hoy tienes X en la cajita. Para el día tal tendrías Y".
- **Ganado en este periodo:** el interés que la cajita ya generó en el periodo actual.

> **Por qué compuesto:** Nu capitaliza a diario, así que el compuesto se acerca más al número real. La diferencia con el simple son centavos, pero evita que la app y Nu nunca coincidan.
>
> **Por qué no hay que ajustar el saldo de la cajita a mano:** como el saldo ya incluye el rendimiento calculado, no hace falta capturar el saldo real y guardar la diferencia. Si Nu cambia la tasa, se edita en Ajustes del Sheets.

---

## 12. Cobros esperados (suscripciones)

Las suscripciones se cobran cada mes o cada año a la tarjeta. La app las maneja en dos pasos:

1. **Gastos fijos (pestaña del Sheets):** una fila por suscripción con su monto normal, si es mensual o anual, el día, desde cuándo y hasta cuándo, y si está activa.
2. **Pagos esperados:** de ahí la app genera sola los cobros del **mes actual y el siguiente**. Cada cobro tiene estado: **Esperado, Cobrado u Omitido**.

En Inicio, **Próximos cobros** muestra los que caen antes del siguiente corte (los que caen después aparecen cuando cambia el periodo). Cada cobro tiene tres opciones:

- **Ya se cobró:** lo convierte en un gasto con tarjeta (con la fecha del cargo, o la de hoy si llegó antes) y lo marca Cobrado.
- **Se cobró otro día:** igual, pero eligiendo la fecha real del cargo. El cobro conserva su identidad y queda con la fecha en que de verdad se cobró.
- **Omitir:** lo marca Omitido; no cuenta.

Si pasa el día y no se confirma, sigue como esperado y se marca **Atrasado**.

**Cambiar el día de una suscripción:** se cambia en **Gastos fijos**. Los cobros futuros que se habían generado con el día anterior (y que nadie movió a mano) se borran solos y se generan con el día nuevo. Un cobro cuya fecha se cambió a mano en **Pagos esperados** nunca se toca.

Los cobros esperados se **suman al pago del día de pago** (la línea "Con tus suscripciones… pagas"), pero **no** se restan del dinero hasta que se cobran de verdad.

> **Por qué la app solo agrega cobros y nunca reescribe los que ya existen:** así un "Cobrado" nunca vuelve a "Esperado" al sincronizar, y un cobro que alguien marcó Omitido en el Sheets sigue omitido.
>
> **Por qué el monto de cada cobro es el de la suscripción:** si el precio cambia de verdad, se edita una vez en Gastos fijos. Cambiarlo cobro por cobro era más trabajo y más fuente de errores.
>
> **Por qué las uñas y lo parecido no son gasto recurrente:** no tienen día fijo y a veces las paga la mamá. Son un **atajo** de gasto normal (y, si las paga la mamá, se anotan en Deuda mami). Los gastos fijos son solo lo que cae cada mes o cada año en una fecha.

---

## 13. Atajos

Los gastos que se repiten (una dona, unos chilaquiles, las uñas) son **atajos**: se registran con un toque. Cada atajo guarda nombre, monto, categoría y con qué se paga. Se crea uno desde cualquier gasto con "Guardar como frecuente". Un atajo puede quedar **sin precio**: la primera vez pide el precio y lo guarda. Hay modo **Editar** para cambiar un precio o borrar un atajo.

---

## 14. Historial, Resumen y Perfil

La barra de abajo tiene cuatro destinos y un botón central **+** (que no aparece para quien es de solo lectura).

### Historial

Los movimientos **del periodo actual** (o del mes, en la versión simple), agrupados por día ("Viernes 6 nov"), como en Nu.

- Filtros: Todo / Gastos / Ingresos, por **bolsa** y por **categoría** (las categorías cambian según el tipo). En la versión simple también por **lugar**.
- **Cambiar la categoría** de un gasto se hace directo en la lista. **Editar** cambia el monto, la nota y la fecha de un movimiento, y **Borrar** lo quita; los dos solo para quien puede editar. Editar actualiza **la misma fila** del Sheets, no agrega otra. Si el movimiento trae un desglose (sección 15), sus partes se mueven o se borran con él para que nunca queden sueltas.
- Los ingresos se muestran solo con la bolsa donde cayeron: el signo + ya dice que es un ingreso.
- Lo marcado **Previo** muestra una etiqueta: ya estaba antes de la app y no mueve saldos.
- Lo que es solo seguimiento de Deuda mami no se lista. Los movimientos anteriores a un saldo inicial se ven atenuados, porque solo cuentan en el Resumen.
- Un gasto sin categoría clara se marca **pendiente**; Inicio avisa "N gastos por revisar" para ponérsela después. La categoría **no sé** significa que de verdad no se sabe y así se queda.

### Resumen

Del **periodo actual** (o mes): cuánto se gastó y en cuántos gastos, **en qué se gastó** (barras por categoría con monto y porcentaje) y **lo más grande** (los cuatro gastos mayores). La versión simple suma "Dónde más gastaste" y "Enviaste a otras personas".

### Perfil

- Nombre, avatar y, si aplica, la etiqueta **"Solo lectura"**.
- Estado de sincronización ("Sincronizado a las 10:05") y **Sincronizar ahora**.
- Si hay filas del Sheets con error, un aviso dice cuántas y cuáles.
- **Abrir el Sheets** y **Respaldo** (descarga un JSON con todo): **solo** para quien puede editar. Mami no los ve.
- Aviso de privacidad, términos de uso y **Cerrar sesión**.

**Categorías de Vanessa:** comida, salidas, transporte, escuela, antojos, pareja, mamá, suscripciones, otros, pendiente y no sé. En los ingresos: horno³, comedor, mamá y otros. Las listas viven en la pestaña Ajustes y se editan ahí.

---

## 15. La versión de Francisco (simple, por mes)

Francisco no usa tarjeta de crédito, cajita ni Deuda mami. Tiene **una cuenta de BBVA y algo de efectivo**, donde le depositan su mamá y su papá, y quiere ver **en qué gasta**. Por eso su app tiene un **layout simple**: la misma app con menos piezas, que se activa por usuario.

**Lo que cambia respecto a la de Vanessa**

- **Dos lugares para el dinero: su BBVA y el efectivo.** Los gastos e ingresos preguntan cuál (BBVA ya viene elegido), y **Mover** pasa dinero entre ellos, por ejemplo al sacar del cajero.
- **Por mes de calendario**, no por periodos de tarjeta. Por dentro es el mismo cálculo de periodos con el día de corte en 1. No aparece "Se paga el".
- **Sin** tarjeta, cajita, Deuda mami, Pagar tarjeta ni rendimiento.

**Inicio:** "Tienes en total", con BBVA y efectivo por separado; cuánto gastó y cuánto le entró este mes; en qué gastó (barras por categoría); y "Dónde más gastas" (sus tres lugares principales). Sus saldos iniciales están en su Sheets; si faltara alguno, la app lo pide en un recuadro.

**Agregar:** cuatro pestañas.

- **Gasto** e **Ingreso** ("Me depositaron").
- **Mover**: entre BBVA y efectivo.
- **Transferí**: dinero que le manda a otra persona (Vanessa, Mamá, Papá u otra que escriba). Sale de su BBVA pero **no cuenta como gasto**; en el Resumen aparece aparte como "Enviaste a otras personas". Las personas a las que ya mandó salen después como botones.
- Atajos con un toque para lo que repite (bread de pan de chocolate, snacks de 7-Eleven, gym day pass, corte de pelo, gasolina; la primera vez piden el precio).

**Categorías de gasto:** dates, salidas, antojos de Vane, antojos míos, snacks, bread, gym, higiene, gasolina, cortes de pelo, shopping y otros. **Ingresos:** mamá, papá y otros. Se muestran como **cuadritos con ícono**, cuatro por fila: primero las **7 más usadas** y el resto queda detrás de "Más". "Pendiente" no se ofrece al agregar (los gastos que ya la tengan siguen avisando en Inicio).

> **Por qué "salidas" y "dates" son distintas:** "dates" es salir los dos; "salidas" es con amigos, incluso si él paga por los dos. Y "antojos de Vane" separa lo que él le compra a ella de sus propios antojos.

**Lugares.** Debajo de la categoría, en las que lo piden (dates, salidas, antojos y snacks, bread), aparece una fila de botones con lugares frecuentes (Shake Shack, Galleta Moonwalk, Carl's Jr, Wingstop, Super Salads y otros).

- Los más usados salen primero, en **una sola fila que se desliza de lado**, para no alargar el formulario.
- Puede **escribir otro lugar** ahí mismo; si lo escribe dos veces, se vuelve botón.
- El lugar se guarda en la **Nota** del movimiento. Con eso, el Resumen e Inicio muestran **dónde más gasta**, y el Historial se filtra por lugar.
- La lista de lugares, las categorías que piden lugar y en cuáles categorías sale cada lugar (separadas por comas; vacío = en todas las que piden lugar) viven en Ajustes. El lugar y el detalle comparten la nota: `HEB · Higiene personal` cuenta para HEB.

> **Por qué lugares como botones y no texto libre:** si escribiera "Shake Shack" de tres formas distintas, no se podría sumar. Los botones mantienen el nombre igual y ahorran escribir.

**Préstamos a familiares.** En **Transferí** hay dos opciones: **Le di dinero** y **Me regresaron**. Al dar dinero se elige el **motivo** (*Préstamo*, que me lo van a regresar, o *Sin regreso*, regalo o apoyo) y **cómo** se dio (transferencia desde BBVA o efectivo). Un préstamo se guarda como una transferencia con categoría **préstamo**; cuando lo regresan, se anota con "Me regresaron" y baja lo que esa persona debe. Nada de esto cuenta como gasto ni como ingreso. Inicio muestra **Te deben**, con el total y lo que debe cada persona.

**Meses anteriores.** En Historial y Resumen, el selector de mes lista el mes actual y cada mes anterior que tenga movimientos. Un saldo inicial solo no abre un mes. Inicio siempre muestra el mes actual.

**Desglose (el "ticket").** Un movimiento del banco, como un retiro de efectivo o una transferencia sin regreso, puede traer debajo lo que pagó: cada parte tiene monto, categoría y lugar o detalle. Se crea desde **Mover** (de BBVA a efectivo) y **Transferí** (sin regreso). Las partes cuentan como gasto en el Resumen y la fila del banco no, para no duplicar; además la fila no aparece en "Enviaste a otras personas". No tienen que sumar el total.

> **Por qué las partes no tienen una columna que las una con su movimiento:** el ID de una parte es el ID del movimiento más un punto y un número (`261030-b3vi.1`, `261030-b3vi.2`). Así el vínculo se ve en el Sheets sin columnas extra y no se puede perder.

**Su Sheets** muestra solo **Movimientos, Atajos, Ajustes y Resumen del mes**. Gastos fijos, Pagos esperados y Cortes existen pero están escondidos, porque la app los usa por dentro. Su Resumen del mes trae: gasto por categoría (este mes contra el pasado), lo que entró, lo que gastó, lo que envió a otras personas y su saldo en BBVA, en efectivo y en total.

---

## 16. Google Sheets como base de datos

El Sheets **es la fuente de verdad**: la app escribe ahí cada cambio y lee lo que alguien cambie a mano. No hay otra base de datos. Cada persona tiene el suyo, con **la misma estructura de pestañas**.

### Las columnas se buscan por su nombre, no por su posición

La app encuentra cada columna por lo que dice su **encabezado** (la fila 1), no por el lugar donde está. Eso significa que se pueden **mover, insertar o borrar columnas** sin que la app lea o escriba en la equivocada, y que las columnas propias (una nota, una fórmula) se respetan: la app nunca escribe en ellas ni las borra. Un texto entre paréntesis en el encabezado se ignora ("Bolsas (fija)" es "Bolsas"), y no importan mayúsculas.

> **Por qué así:** el Sheets lo edita una persona a mano, y una columna que se mueve por accidente es lo más fácil que pasa. Si la app dependiera de posiciones, escribiría un monto en la columna de la fecha sin que nadie se enterara.

**Si falta una columna que la app necesita** (alguien la borró o le cambió el nombre), la app **no adivina**: detiene la sincronización **antes de escribir nada** y avisa cuál falta ("En la pestaña Movimientos falta la columna "Monto""). Los datos siguen guardados en el teléfono y se suben solos en cuanto se devuelve el nombre.

> **Por qué se detiene y no sigue sin esa columna:** leer una pestaña sin una columna se vería como una pestaña vacía, y como el Sheets gana, la app borraría lo que tenía en el teléfono. Detenerse es lo único seguro.

### Pestañas de datos (la app lee y escribe)

| Pestaña | Columnas | Para qué |
| --- | --- | --- |
| **Movimientos** | ID, Fecha, Tipo, Monto, De, A, Categoría, Nota, Dato | Una fila por movimiento. Montos en pesos, sin signo. Siempre en orden de fecha: lo más antiguo arriba, lo más reciente abajo. |
| **Gastos fijos** | ID, Nombre, Monto normal, Frecuencia, Día, Mes, Categoría, Desde, Hasta, Activo | Las suscripciones. **La app solo las lee.** Frecuencia: Mensual o Anual. |
| **Pagos esperados** | ID, Gasto fijo, Nombre, Fecha, Monto, Categoría, Estado (+ "Se paga el", calculada) | Los cobros que genera la app. |
| **Cortes** | Fecha de corte, Fecha límite, Estado de cuenta (+ columnas calculadas) | El monto y la fecha límite de cada estado de cuenta. El monto puede quedar vacío mientras no salga. **La app solo lo lee.** |
| **Atajos** | ID, Nombre, Monto, Categoría, Se paga con | Gastos frecuentes. |
| **Ajustes** | Ver abajo | Configuración y las listas de los menús. |

**Orden de Movimientos.** Cuando la app agrega una fila con una fecha anterior a la última (algo que se registró tarde, o una fecha que se editó), vuelve a ordenar la pestaña por fecha, moviendo cada fila completa. Solo toca el Sheets si el orden realmente se rompió.

**Ajustes.** Tiene una tabla de configuración (columnas **Ajuste**, **Valor**, **Nota**) y varias listas, cada una con su encabezado:

- Los valores se encuentran por el nombre que tienen en la columna Ajuste: Límite de la tarjeta, Día de corte, Día límite de pago, Tasa anual y Día de pago. El orden de las filas no importa.
- **Categorías de gasto** y **Categorías de ingreso** son lo que se edita: agregar o quitar categorías ahí cambia los menús de la app.
- **Bolsas, Tipos, Estados y Dato** son listas **fijas**: la app las reconoce por nombre, así que están en gris, con "(fija)" en el encabezado y un aviso si alguien intenta editarlas.
- **Todas las categorías** se calcula sola con una fórmula (gasto + ingreso + Saldo inicial, Rendimiento y Deuda mami). Alimenta el menú de categoría de Movimientos.
- En el Sheets de Francisco hay además **Lugares frecuentes**, **Categorías con lugar** y **Dónde sale cada lugar**.
- Lo que no está en Ajustes no se inventa: la app usa sus valores por defecto.

### Pestañas de vista (solo para mirar)

- **Vanessa:** **Resumen del periodo**, **Gastos fijos por periodo** e **Ingresos por quincena**.
- **Francisco:** **Resumen del mes**.

Se calculan solas con fórmulas, la app **nunca** escribe en ellas, y están protegidas contra edición accidental. Las de Vanessa usan los mismos periodos de tarjeta (del 22 al 21) que la app, así que los totales coinciden con la pantalla Resumen. "Gastos fijos por periodo" se recorre sola cada mes: siempre muestra los últimos once periodos y el siguiente. El día de corte sale de Ajustes: si cambia, las vistas se acomodan solas. "Ingresos por quincena" no agrupa por periodo, sino por día de pago (14 y 29).

### Reglas para editar a mano

- El **nombre** de cada encabezado importa; su **posición** no.
- Si agregas una fila, deja el ID vacío: la app se lo pone (con la fecha de esa fila).
- Los menús desplegables evitan equivocarse en tipo, bolsa, categoría y dato.
- Una fila con error (monto con letras, tipo inexistente, bolsa que no existe, una fecha inválida, un ID repetido) **se marca y no se cuenta** hasta corregirla. La app no se rompe: muestra cuántas filas tienen problema y en qué pestaña y fila.
- Una fila con una casilla "Activo" marcada pero sin nombre, monto ni ID se toma como un gasto fijo incompleto y se reporta como error. Si no es gasto, desmarca la casilla.
- Un valor del Dato distinto de **Real** o **Previo** se marca como error.

Las tablas se ven bien a propósito: encabezados oscuros, el periodo (o mes) actual resaltado en amarillo y los anteriores en verde, montos con formato de pesos, primera fila y columna fijas, y estados con color (Esperado amarillo, Cobrado verde, Omitido gris, atrasado rojo).

---

## 17. Cómo se sincroniza

La app es **offline-first**: funciona sin internet y sincroniza cuando puede.

1. Toda la información se guarda también en el teléfono (**IndexedDB**, con la librería **Dexie**), **una base de datos por persona**. Por eso abre rápido, se puede usar sin conexión, y si dos personas comparten un teléfono sus datos no se mezclan.
2. Cada cambio se anota en una **bandeja de salida (outbox)** con el cambio concreto: "agrega este movimiento", "borra estos", "agrega estos cobros", etc.
3. **Sincronizar** = mandar la bandeja a una función del servidor (`/api/sync`), que la escribe en el Sheets de esa persona, y **leer todo el Sheets** de vuelta.
4. Se sincroniza al abrirse la app, cada vez que se vuelve a ella, al recuperar internet y después de cada cambio.
5. **El Sheets gana**: lo que vuelve del Sheets reemplaza la copia del teléfono, pero los cambios que todavía no se habían subido se vuelven a aplicar encima (así nada se pierde si se hizo algo sin internet).
6. Un cambio pendiente solo se descarta de la bandeja cuando el servidor confirmó que lo escribió.

> **Por qué "el Sheets gana":** como una persona puede corregir el Sheets a mano, no puede haber dos verdades. La regla es una sola y clara.

### Que nada se duplique ni se pierda

Un teléfono puede mandar el mismo cambio dos veces (por ejemplo, si la página se recarga mientras se guardaba). Por eso cada pieza está pensada para poder repetirse sin daño:

- **Un cambio se puede repetir:** guardar dos veces el mismo movimiento actualiza su fila, no agrega otra.
- **Cambios que se juntan:** varios cambios a un mismo movimiento se reducen a uno antes de mandarse; un gasto agregado y borrado antes de sincronizar ni llega al Sheets. Lo que se cambia mientras una sincronización está en camino se manda enseguida en otra pasada, no espera a la próxima vez que se abra la app.
- **Una sincronización a la vez por Sheets:** el servidor pone en fila las sincronizaciones que llegan al mismo tiempo, porque ordenar o borrar filas mueve las demás. Después de agregar, quita las filas repetidas que dos sincronizaciones simultáneas pudieran haber creado.
- **Borrar es completo:** se borran todas las filas con ese ID, así una copia no se queda y vuelve en la siguiente lectura.
- **Escritura por columna:** al actualizar una fila solo se escriben las columnas que la app maneja (sección 16).

**Solo lectura:** la cuenta de Mami nunca manda cambios; solo recibe el Sheets. Si algún cambio llegara a su sesión, el servidor lo rechaza.

El servidor **valida cada cambio** que llega del navegador, campo por campo, antes de tocar el Sheets (nunca confía en lo que mande el teléfono). Un aviso delgado arriba indica cuando algo necesita atención: "Sin internet · 2 cambios por subir", "Tu sesión terminó, vuelve a entrar", "Tu Sheets todavía no está listo", "Falta una columna en tu Sheets" (con cuál, en Perfil) o "No se pudo sincronizar".

---

## 18. Seguridad y permisos

- **Usuario y contraseña** con **Auth.js**. Las contraseñas **nunca se guardan**: solo un hash con `scrypt` y una "sal" aleatoria, que no se puede revertir. Se crean con `npm run hash-password`, que pide la contraseña sin mostrarla y solo imprime el hash. La comparación se hace en tiempo constante.
- **La sesión** es una cookie cifrada que solo guarda el id de la persona; el navegador no la puede leer (httpOnly). Quitar el hash de alguien de las variables de entorno cierra sus sesiones.
- **Acceso al Sheets con una cuenta de servicio de Google:** un "robot" que solo ve los Sheets que se le comparten. Su llave privada vive **solo** en las variables de entorno del servidor (Vercel y `.env.local`), nunca en el código, en Git ni en el navegador. El servidor pide con ella permisos de una hora y los renueva solo.
- **El navegador solo conoce** el nombre, el id, el rol, el layout y el color de quien entró; nunca llaves ni contraseñas.
- **Cada pedido al servidor** revisa quién es y qué puede hacer.
- **El modo de solo lectura se aplica en el servidor**, no solo escondiendo botones.
- **Lo que no está en el código:** contraseñas, llaves, IDs de Sheets ni datos personales de ejemplo. Antes de cada commit se revisa que no se cuele ningún secreto, y `.env.local` está excluido de Git.
- **Texto que parece fórmula:** lo que se escribe a mano en la app y empieza con `=`, `+`, `-` o `@` se guarda como texto, para que nunca se ejecute como fórmula en el Sheets.

---

## 19. Cómo está construido y cómo operarlo

**Stack:** Next.js (App Router), React, TypeScript y Tailwind. Despliegue en Vercel (cada push a `main` publica). Reglas del proyecto: nada de `any`, componentes con una sola responsabilidad, código y comentarios en inglés, interfaz en español.

La separación por capas es la decisión de arquitectura más importante:

| Carpeta | Qué contiene | Por qué |
| --- | --- | --- |
| `src/domain` | **Lógica pura**: libro de saldos, periodos, estado de la tarjeta, rendimiento, cobros esperados, lugares, IDs, usuarios y roles, búsqueda de columnas y mapeo de filas del Sheets, validación de cambios. Sin React ni red. | Es lo que más importa y lo más fácil de equivocarse. Al ser funciones puras se prueba rápido y con certeza. |
| `src/services` | Repositorio (Dexie + bandeja de salida, uno por persona), acciones de la app, sincronización, sesión del navegador. | Separa "qué hace la app" de "dónde se guarda". |
| `src/server` | Todo lo que corre solo en el servidor: contraseñas, sesión, cuenta de servicio, cliente de Sheets, el candado de una sincronización a la vez, lectura y escritura por pestaña. | Las llaves y permisos nunca llegan al navegador. |
| `src/components` | Pantallas y piezas visuales, por área (`home`, `add`, `history`, `summary`, `profile`, `sync`, `ui`). | Interfaz sin lógica de negocio. |
| `src/data` | Valores por defecto (categorías, ajustes) para un teléfono que aún no sincroniza. | Los datos reales solo salen del Sheets de cada persona. |
| `src/app` | Rutas (Inicio, Agregar, Historial, Resumen, Perfil, privacidad, términos), API de sesión, de quién eres (`/api/me`) y de sincronización, manifiesto e íconos. | Estructura estándar de Next.js. |
| `scripts` | `hash-password`, para cifrar contraseñas. | Para que la contraseña real nunca pase por el código. |

**Pruebas:** hay pruebas automáticas sobre la lógica de dominio y el mapeo del Sheets (saldos, periodos, tarjeta, rendimiento, cobros, lugares, IDs, usuarios, contraseñas, búsqueda de columnas, lectura de filas, validación de cambios, candado de sincronización). Se corren con `npm test`.

**Cómo correrlo:**

```bash
npm install
npm run dev            # servidor local en http://localhost:3000
npm test               # pruebas
npm run typecheck      # revisión de tipos
npm run lint           # estilo
npm run build          # versión de producción
npm run hash-password  # cifra una contraseña (no se muestra al escribirla)
```

**Variables de entorno** (solo los nombres; los valores van en `.env.local` y en Vercel, nunca en Git):

| Variable | Para qué |
| --- | --- |
| `AUTH_SECRET` | Cifrar la cookie de sesión |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Correo del "robot" de Google |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Llave privada del robot (la más delicada) |
| `GOOGLE_SHEETS_ID` | Sheets de Vanessa (que también lee Mami) |
| `GOOGLE_SHEETS_ID_FRANCISCO` | Sheets de Francisco |
| `PASSWORD_HASH_VANESSA`, `PASSWORD_HASH_MAMI`, `PASSWORD_HASH_FRANCISCO` | Contraseñas cifradas |

**Para agregar a una persona nueva:**

1. Darle una entrada en `src/domain/users.ts` (usuario, nombre, rol, layout, color y los nombres de sus variables).
2. Crear su Sheets (copia limpia de la estructura) y compartirlo con el robot como Editor.
3. Cifrar su contraseña con `npm run hash-password` y guardar el hash.
4. Agregar el hash y el ID de su Sheets como variables en `.env.local` y en Vercel.
5. Subir el cambio y probar que entra.

**Si algo falla:**

- *"El usuario o la contraseña no coinciden":* el hash de esa persona falta o está mal copiado en las variables.
- *"Tu espacio todavía no está listo":* falta la variable del Sheets, o el Sheets no está compartido con el robot.
- *"Tu sesión terminó":* cerrar sesión y volver a entrar.
- *"Falta una columna en tu Sheets":* alguien borró o renombró un encabezado; ponerlo de nuevo con ese nombre en la fila 1.
- *Filas con error en Perfil:* corregir esas filas en el Sheets (el aviso dice pestaña y número de fila).

**Instalarla en iPhone:** abrir la dirección de Vercel en Safari → Compartir → "Agregar a pantalla de inicio". El manifiesto le da nombre, íconos y colores, y la abre a pantalla completa. Cada persona ve **solo su espacio**.

---

## 20. Las decisiones clave

1. **El Sheets es la verdad**, la app es una ventana rápida con copia local.
2. **Los saldos se calculan, no se guardan.** Una sola fuente (los movimientos) y cero números desincronizados.
3. **La tarjeta es deuda, no dinero.** Y Deuda mami no es dinero real hasta que regresa.
4. **Todo se lee en periodos de tarjeta** para quien tiene tarjeta, y por mes para quien no.
5. **Cada acción tiene un solo lugar:** pagar la tarjeta, mover dinero, apuntar lo de mamá, ingresos, transferir. Menos pasos, menos confusión.
6. **La mamá nunca paga directo:** Vanessa paga y ella regresa; lo extra es un ingreso a Banorte.
7. **Un layout por necesidad:** la misma app se adapta a cada persona sin mostrar lo que no usa.
8. **Offline-first con "el Sheets gana":** nada se pierde sin internet y los conflictos tienen una regla clara.
9. **La app nunca adivina dónde está algo en el Sheets:** busca las columnas y los ajustes por su nombre, y si algo falta se detiene y lo dice, en vez de escribir en un lugar equivocado.
10. **Todo cambio se puede repetir sin daño:** por eso un reintento, una recarga o dos sincronizaciones a la vez no duplican ni pierden nada.
11. **Seguridad en el servidor:** contraseñas solo como hash, llaves solo en el servidor, permisos revisados en cada pedido y cada cambio validado.
12. **Lógica pura y probada**, separada de la interfaz y de dónde se guardan los datos.
13. **Si no se usa, no se deja:** la app y los Sheets se mantienen limpios, con los mismos nombres y la misma estructura.
14. **El Sheets también se lee bien por sí solo:** IDs con fecha, filas en orden, listas fijas marcadas en gris y vistas con fórmulas, porque quien lo abre debe entenderlo sin la app.

---

## 21. Lo que falta o se puede mejorar

- **Ver periodos anteriores** en la versión de Vanessa (Historial y Resumen), cuando ya haya periodos completos con su información.
- **Service worker** para que la app abra aunque no haya internet, y **avisos** (pagar la tarjeta, quincena, próximos cobros) con notificaciones push. Hoy los datos sí funcionan sin internet gracias a Dexie, pero la app en sí necesita conexión para abrirse por primera vez.
- **Francisco:** gastos fijos propios (por ejemplo el gym mensual), un total de "gastado en Vane" (dates más antojos de ella) y lo que él vaya pidiendo al usarla.
- **Revisar el 22 de noviembre** (primer corte con la app): capturar el estado de cuenta real en la pestaña Cortes y comparar con Nu.
- **Un solo estilo visual:** unificar los redondeos y los tipos de botón para que todo se vea de la misma familia.
- Un **PIN** adicional para quien lo quiera.
