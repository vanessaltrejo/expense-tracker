# Pockets: cómo funciona la app y por qué está hecha así

**Para quién es este documento:** para alguien que nunca ha visto la app. Explica qué problema resuelve, cómo piensa el dinero, qué hace cada pantalla, cómo se calcula cada número, cómo se guardan los datos, cómo entra cada persona y, sobre todo, **por qué se tomó cada decisión**.

**Cómo se relaciona con la propuesta original:** la propuesta (`Propuesta app de gastos personal.md`) se escribió cuando todavía no había app. Muchas cosas cambiaron al usarla con datos reales. Este documento describe la app **actual**; la sección 20 lista qué cambió respecto a la propuesta y por qué.

**Índice**

1. El problema y la idea
2. Vocabulario
3. Quién usa la app (resumen)
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
20. Qué cambió respecto a la propuesta
21. Lo que falta o se puede mejorar
22. Las decisiones clave

---

## 1. El problema y la idea

Vanessa tiene su dinero repartido en varios lugares y casi todos sus gastos van a una tarjeta de crédito. Llevaba las cuentas en la cabeza, así que cualquier gasto chico le desacomodaba el plan.

**Pockets responde una pregunta: ¿cuánto debo en la tarjeta y cuánto me falta por juntar para pagarla?**

La idea que lo sostiene todo: **cada lugar donde hay dinero es una "bolsa"**, y la tarjeta es una **deuda**, no dinero. Con eso la app calcula, sin que nadie sume a mano, cuánto se debe, cuánto hay y cuánto falta.

Después se sumó una segunda necesidad: su novio, Francisco, quería ver **en qué gasta** su dinero, con una sola cuenta de banco y algo de efectivo. La misma app se adapta a los dos con dos "layouts" (versiones de pantalla): el completo y el simple.

Pockets es una **PWA**: una página web que se instala en el teléfono y se comporta como app. Usa **Google Sheets como base de datos**: uno por persona, todos guardados en la cuenta de Google de Vanessa, que puede abrirlos y ver o corregir todo.

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
| **Layout** | La versión de pantallas que ve una persona: **completo** (Vanessa y Mami) o **simple** (Francisco). |
| **Rol** | Qué puede hacer: **dueño** (todo) o **solo lectura** (solo mirar). |
| **Dummy** | Dato de relleno marcado visiblemente. No cuenta en saldos ni en el Resumen. |
| **Previo** | Algo real que pasó antes de la app y que ya está dentro de los saldos iniciales (todo lo anterior al 22 de octubre de 2026 y los ingresos del 29 de octubre). Cuenta en los resúmenes y en las vistas del Sheets, pero nunca mueve saldos ni la deuda de la tarjeta. |
| **Sheet gana** | Si algo cambia a la vez en la app y en el Sheets, se queda lo del Sheets. |
| **Cuenta de servicio** | Un "robot" de Google que la app usa para leer y escribir los Sheets compartidos con él. |

---

## 3. Quién usa la app (resumen)

| Usuario | Nombre que se ve | Layout | Rol | Su Sheets |
| --- | --- | --- | --- | --- |
| `vanessa` | Vanessa Trejo | Completo | Todo | "Gastos Vanessa" |
| `mami` | Mami | Completo | **Solo lectura** | El de Vanessa |
| `francisco` | Francisco Amaya | Simple | Todo | "Gastos Francisco" |

Cada persona usa la app **en su propio teléfono**. Los tres Sheets viven en la cuenta de Google de Vanessa. El Sheets de Francisco se comparte además con su correo, para que él también pueda abrirlo.

---

## 4. Entrar: usuario y contraseña

Al abrir la app, si nadie ha entrado, aparece **"Entra a Pockets"** con dos campos: usuario y contraseña. El usuario no distingue mayúsculas ni espacios ("Mami" y " mami " entran igual).

- Con datos correctos, se abre la app con el layout y los permisos de esa persona.
- Con datos incorrectos dice "El usuario o la contraseña no coinciden", y no revela cuál de los dos falló.
- **Cerrar sesión** está en Perfil. Al cerrar, la app borra lo que tenía en memoria de esa persona y vuelve a la pantalla de entrada.
- Las páginas de **Aviso de privacidad** y **Términos de uso** se pueden leer sin entrar.
- Si el Sheets de alguien todavía no está conectado, la app dice **"Tu espacio todavía no está listo"**, y Perfil sigue abierto para sincronizar o cerrar sesión.

> **Por qué usuario y contraseña y no Google:** así Mami y Francisco no necesitan una cuenta de Google, y todos los datos quedan en la cuenta de Vanessa. Reemplazó al selector de perfiles anterior ("¿Quién está usando Pockets?"), que servía para elegir un espacio pero no era un candado.

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

> **Por qué la cajita se llama "Cajita Nu Débito":** en la propuesta era "Cajita Turbo". En la práctica es la cajita de débito de Nu, y el nombre nuevo evita confundirla con la tarjeta (Tarjeta Nu crédito).

---

## 6. Inicio de Vanessa: los números

El número más grande es lo que **debe** en la tarjeta, no lo que le sobra. Eso se decidió al usar la app: lo que de verdad le importa es cuánta deuda tiene y si ya puede pagarla.

Arriba, la tarjeta azul muestra:

1. **Debes en la tarjeta** (número grande): lo que ha salido de la tarjeta menos lo que ya se pagó.
2. **Te falta juntar:** lo que debe menos su dinero real. Si ya tiene suficiente, es 0. Deuda mami **no** ayuda a pagar la tarjeta, porque aún no regresa.
3. **Balance total:** dinero real **más** Deuda mami, menos la deuda de la tarjeta. Es el panorama completo "contando lo que me deben". Puede ser negativo.
4. **Con tus suscripciones, el 1 pagas:** aparece solo si hay cobros esperados antes del corte. Suma la deuda actual más esos cobros y dice cuánto faltaría juntar.

> **Por qué tres números y no uno:** cada uno responde una duda distinta. "¿Cuánto debo?", "¿cuánto me falta para pagar?" y "¿cómo estoy si cuento lo que me deben?" no son la misma cuenta, y mezclarlas era justo lo confuso de llevarlo en la cabeza.

Más abajo, en orden: la tarjeta de **Deuda mami**, los botones rápidos (Agregar gasto, Pagar tarjeta, Mover dinero), los gastos "por revisar", lo que falta pasar de Banorte a la cajita, los **Próximos cobros**, el **rendimiento** de la cajita y, al final, **Bolsas y crédito** (saldo de cada bolsa y cuánto del límite se usa). Lo que está en 0 no se muestra.

---

## 7. Periodos de tarjeta (del 22 al 21)

Nu cierra su estado de cuenta el día 22 y se paga el día 1. Entonces:

- Un **periodo** va del 22 de un mes al 21 del siguiente, y se paga el día 1.
- **Regla del día de corte:** una compra hecha **el mismo día 22** pertenece al **siguiente** periodo, igual que en Nu.
- La versión de Vanessa usa estos periodos en Inicio, Historial y Resumen, **no meses de calendario**. Así lo que ve en la app coincide con lo que ve en Nu.

Qué entra al pago del día 1: lo comprado hasta el día 21 y los cobros esperados que caen antes del corte. Lo demás pasa al siguiente periodo. (Hoy solo se ve el periodo actual; los anteriores se podrán ver cuando tengan su información completa.)

El estado de cuenta de cada corte viene de la pestaña **Cortes** del Sheets. Si un corte no está ahí, la app lo calcula con la deuda del día anterior.

**Fecha límite distinta un mes:** normalmente es el día de Ajustes (el 1), pero si Nu la mueve (por ejemplo, el corte del 22 de noviembre se paga el 3 de diciembre), se agrega la fila de ese corte en **Cortes** con su fecha límite y la app la usa solo para ese corte. El estado de cuenta puede quedar vacío mientras no salga: la app sigue calculando la deuda. Cada pago cuenta aunque sea chico: si el estado es 300 y se pagan 100 un día y 200 el siguiente, queda pagado completo.

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

Cada movimiento guarda: un **ID**, la **fecha**, el **tipo**, el **monto** (en centavos), de qué bolsa **sale** ("De"), a cuál **entra** ("A"), la **categoría**, una **nota** y si es dato **Real**, **Previo** o **Dummy**.

En la versión de Vanessa se crean con cuatro pestañas dentro de **Agregar**:

- **Gasto:** monto, "¿en qué fue?", "¿con qué se pagó?" (viene con la tarjeta ya elegida, porque casi todo va ahí), categoría, fecha y la opción de guardarlo como frecuente. Arriba hay **atajos** para lo que se repite.
- **Ingreso:** monto, nota (opcional), a dónde cayó (Banorte o efectivo), categoría y fecha. Cada ingreso se agrega a mano con su categoría (horno³, comedor, mamá u otros); no hay días fijos de pago.
- **Mover:** monto, de qué bolsa a cuál (entre Banorte, cajita y efectivo) y fecha. Viene lista con Banorte → Cajita, lo más común. También sirve para mandar dinero a una persona.
- **Pagar tarjeta:** el monto y la fecha (hoy por defecto, por si el pago fue otro día). **Siempre sale de la Cajita Nu Débito.**

> **Por qué "Pagar tarjeta" no pregunta de dónde sale:** se usa una o dos veces al mes y siempre sale de la cajita. Pedir "de dónde" era un paso que nunca cambiaba. Por dentro es una transferencia de la cajita a la tarjeta con la nota "Pago de tarjeta". Se puede pagar en varias partes: cada parte es un pago.

> **Por qué Mover no incluye la tarjeta ni Deuda mami:** cada una ya tiene su flujo propio (Pagar tarjeta y la tarjeta de Deuda mami). Tenerlas en dos lugares confundía.

Al guardar algo aparece un aviso de 6 segundos con **Deshacer**. Las pestañas de Agregar caben siempre en una sola fila, sin scroll horizontal, en cualquier ancho de teléfono.

---

## 9. Deuda mami

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

## 10. Cómo se calculan los saldos

**Los saldos no se guardan: se calculan** recorriendo todos los movimientos. Por eso, si alguien cambia un movimiento a mano en el Sheets, todo se actualiza solo.

- Cada bolsa es un libro: lo que **entró** menos lo que **salió**.
- La **tarjeta** al revés: su deuda es lo que salió de ella menos lo que entró (los pagos).
- **Saldo inicial:** las bolsas con dinero real empiezan con una fila de tipo Ajuste, categoría "Saldo inicial", con fecha. Lo que tenga fecha **anterior** a ese saldo ya no mueve el saldo de esa bolsa (pero sí cuenta en el Resumen, porque sigue siendo un gasto de ese periodo). La tarjeta y Deuda mami salen de sus movimientos.
- **Datos Previo:** lo que pasó antes de la app y ya está dentro de los saldos iniciales. Cuenta en el Resumen y en las vistas del Sheets, pero no mueve ningún saldo ni la deuda de la tarjeta. Se marca en la columna Dato.
- **Datos Dummy:** no cuentan en saldos ni en el Resumen. Se ven en gris con la etiqueta "Dummy". Se usan cuando falta un dato real. Los datos de ejemplo del código **nunca** se escriben en el Sheets.
- **Dinero:** siempre se guarda en **centavos** (enteros) y se muestra en pesos. Así nunca hay errores de redondeo con decimales.
- **Fechas:** se guardan como texto `AAAA-MM-DD` y "hoy" es la fecha del teléfono en horario de Ciudad de México, para que un servidor en otra zona horaria no cambie el día.

---

## 11. Rendimiento de la cajita

La cajita de Nu genera rendimiento (hoy 13% anual, editable en Ajustes porque Nu puede cambiarlo). La app lo calcula así:

- **Interés compuesto diario:** cada cantidad que entró a la cajita gana interés desde su fecha hasta hoy: `cantidad × (1 + tasa/365)^días`. Por eso el saldo de la cajita en la app **ya incluye** el rendimiento ganado y coincide con Nu sin tener que ajustar a mano.
- **Rendimiento hasta tu día de pago** (tarjeta en Inicio): estima cuánto va a ganar la cajita hasta el día que Vanessa planea pagar. El **día de pago** se cambia con un selector de fecha (por defecto, el día antes de la fecha límite). Muestra "Hoy tienes X en la cajita. Para el día tal tendrías Y".
- **Ganado en este periodo:** el interés que la cajita ya generó en el periodo actual.

> **Por qué compuesto y no simple:** la propuesta usaba interés simple (`saldo × tasa/365 × días`). Nu capitaliza a diario, así que el compuesto se acerca más al número real. La diferencia son centavos, pero evita que la app y Nu nunca coincidan.
>
> **Por qué se quitó el botón "Ajustar cajita":** como el saldo ya incluye el rendimiento calculado, escribir el saldo real y guardar la diferencia ya no hacía falta. Si Nu cambia la tasa, se edita en Ajustes del Sheets.

---

## 12. Cobros esperados (suscripciones)

Las suscripciones se cobran cada mes o cada año a la tarjeta. La app las maneja en dos pasos:

1. **Gastos fijos (pestaña del Sheets):** una fila por suscripción con su monto normal, si es mensual o anual, el día, desde cuándo y hasta cuándo, y si está activa.
2. **Pagos esperados:** de ahí la app genera sola los cobros del **mes actual y el siguiente**. Cada cobro tiene estado: **Esperado, Cobrado u Omitido**.

En Inicio, **Próximos cobros** muestra los que caen antes del siguiente corte (los que caen después aparecen cuando cambia el periodo). Cada cobro tiene dos botones:

- **Ya se cobró:** lo convierte en un gasto con tarjeta (con la fecha del cargo, o la de hoy si llegó antes) y lo marca Cobrado.
- **Se cobró otro día:** igual, pero eligiendo la fecha real del cargo. El cobro conserva su identidad y queda con la fecha en que de verdad se cobró.
- **Omitir:** lo marca Omitido; no cuenta.

Si pasa el día y no se confirma, sigue como esperado y se marca **Atrasado**.

**Cambiar el día de una suscripción:** se cambia en **Gastos fijos**. Los cobros futuros que se habían generado con el día anterior (y que nadie movió a mano) se borran solos y se generan con el día nuevo. Un cobro cuya fecha se cambió a mano en **Pagos esperados** nunca se toca.

Los cobros esperados se **suman al pago del día 1** (la línea "Con tus suscripciones, el día límite pagas"), pero **no** se restan del dinero hasta que se cobran de verdad. La app genera cobros con una regla de **solo agregar**: nunca sobreescribe el estado de un cobro que ya existe (por eso un "Cobrado" nunca vuelve a "Esperado" al sincronizar).

> **Por qué se quitó "toca el monto si este mes cambia":** el monto de cada cobro es el de la suscripción. Cambiarlo cobro por cobro era una función poco usada que ocupaba espacio y generaba errores. Si el precio cambia de verdad, se edita en la hoja Gastos fijos.
>
> **Por qué las uñas ya no son gasto recurrente:** en la propuesta eran un gasto "cada 3 semanas" con un recordatorio y botones "las pagué yo / las pagó mamá". En la práctica no tienen día fijo y a veces las paga la mamá, así que el recordatorio sobraba. Ahora son un **atajo** de gasto normal. Si las paga la mamá, se registra en Deuda mami como cualquier otra cosa.

---

## 13. Atajos

Los gastos que se repiten (una dona, unos chilaquiles, las uñas) son **atajos**: se registran con un toque. Cada atajo guarda nombre, monto, categoría y con qué se paga. Se crea uno desde cualquier gasto con "Guardar como frecuente". Un atajo puede quedar **sin precio**: la primera vez pide el precio y lo guarda. Hay modo **Editar** para cambiar un precio o borrar un atajo.

---

## 14. Historial, Resumen y Perfil

La barra de abajo tiene cuatro destinos y un botón central **+** (que no aparece para quien es de solo lectura).

### Historial

Los movimientos **del periodo actual** (o del mes, en la versión simple), agrupados por día ("Viernes 6 nov"), como en Nu.
- Filtros: Todo / Gastos / Ingresos, por **bolsa** y por **categoría** (las categorías cambian según el tipo). En la versión simple también por **lugar**.
- Se puede cambiar la categoría de un gasto directo en la lista, **Editar** un movimiento (monto, nota y fecha) y **Borrar** (solo quien puede editar). Editar actualiza la misma fila del Sheets, no agrega otra. Los ingresos se muestran solo con la bolsa donde cayeron: el signo + ya dice que es un ingreso.
- Lo marcado **Previo** muestra una etiqueta: ya estaba antes de la app y no mueve saldos.
- Lo que es solo seguimiento de Deuda mami no se lista. Los movimientos anteriores a un saldo inicial se ven atenuados, porque solo cuentan en el Resumen.
- Un gasto sin categoría clara se marca **pendiente**; Inicio avisa "N gastos por revisar" para ponérsela después.

### Resumen

Del **periodo actual** (o mes): cuánto se gastó y en cuántos gastos, **en qué se gastó** (barras por categoría con monto y porcentaje), **lo más grande** (los cuatro gastos mayores). La versión simple suma "Dónde más gastaste" y "Enviaste a otras personas".

### Perfil

- Nombre, avatar y, si aplica, la etiqueta **"Solo lectura"**.
- Estado de sincronización ("Sincronizado a las 10:05") y **Sincronizar ahora**.
- Si hay filas del Sheets con error, un aviso rojo dice cuántas y cuáles.
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

**Inicio:** "Tienes en total", con BBVA y efectivo por separado; cuánto gastó y cuánto le entró este mes; en qué gastó (barras por categoría); y "Dónde más gastas" (sus tres lugares principales). Sus saldos iniciales ya están en su Sheets (BBVA y efectivo); si faltara alguno, la app lo pide en un recuadro.

**Agregar:** cuatro pestañas.
- **Gasto** e **Ingreso** ("Me depositaron").
- **Mover**: entre BBVA y efectivo.
- **Transferí**: dinero que le manda a otra persona (Vanessa, Mamá, Papá u otra que escriba). Sale de su BBVA pero **no cuenta como gasto**; en el Resumen aparece aparte como "Enviaste a otras personas". Las personas a las que ya mandó salen después como botones.
- Atajos con un toque: bread de pan de chocolate, snacks de 7-Eleven, gym day pass, corte de pelo y gasolina (la primera vez piden el precio).

**Categorías de gasto:** dates, salidas, antojos de Vane, antojos míos, snacks, bread, gym, higiene, gasolina, cortes de pelo, shopping y otros. **Ingresos:** mamá, papá y otros. Se muestran como **cuadritos con ícono**, cuatro por fila: primero las **7 más usadas** y el resto queda detrás de "Más". "Pendiente" ya no se ofrece al agregar (los gastos viejos que la tengan siguen avisando en Inicio).

> **Por qué "salidas" y "dates" son distintas:** "dates" es salir los dos; "salidas" es con amigos, incluso si él paga por los dos. Y "antojos de Vane" separa lo que él le compra a ella de sus propios antojos.

**Lugares.** Debajo de la categoría, en las que lo piden (dates, salidas, antojos y snacks, bread), aparece una fila de botones con lugares frecuentes: Shake Shack, Galleta Moonwalk, Carl's Jr, Wingstop, Super Salads, Elite Cinema y Cinépolis.
- Los más usados salen primero, en **una sola fila que se desliza de lado** (solo se ven 8), para no alargar el formulario.
- Puede **escribir otro lugar** ahí mismo; si lo escribe dos veces, se vuelve botón.
- El lugar se guarda en la **Nota** del movimiento. La lista y las categorías que piden lugar viven en las columnas L y M de Ajustes.
- Con eso, el Resumen e Inicio muestran **dónde más gasta**, y el Historial se filtra por lugar.

> **Por qué lugares como botones y no texto libre:** si escribiera "Shake Shack" de tres formas distintas, no se podría sumar. Los botones mantienen el nombre igual y ahorran escribir.

**Préstamos a familiares.** En **Transferí** hay dos opciones: **Le di dinero** y **Me regresaron**. Al dar dinero se elige el **motivo** (*Préstamo*, que me lo van a regresar, o *Sin regreso*, regalo o apoyo) y **cómo** se dio (transferencia desde BBVA o efectivo). Un préstamo se guarda como una transferencia con categoría **préstamo**; cuando lo regresan, se anota con "Me regresaron" y baja lo que esa persona debe. Nada de esto cuenta como gasto ni como ingreso. Inicio muestra **Te deben**, con el total y lo que debe cada persona.

**Meses anteriores.** En Historial y Resumen, el selector de mes de Francisco lista el mes actual y cada mes anterior que tenga movimientos. Un saldo inicial solo no abre un mes. Inicio siempre muestra el mes actual. En la versión completa (tarjeta) sigue siendo solo el periodo actual.

**Desglose (el "ticket").** Un movimiento del banco, como un retiro de efectivo o una transferencia sin regreso, puede traer debajo lo que pagó: cada parte tiene monto, categoría y lugar o detalle. Se crea desde **Mover** (de BBVA a efectivo) y **Transferí** (sin regreso). Las partes cuentan como gasto en el Resumen y la fila del banco no, para no duplicar; además la fila no aparece en "Enviaste a otras personas". No tienen que sumar el total. En el Sheets las partes llevan el ID del movimiento más un punto y un número (`P3.1`, `P3.2`).

**Lugares por categoría.** La columna N de Ajustes dice en qué categorías sale cada lugar (separadas por comas; vacía = en todas las que piden lugar). El lugar y el detalle comparten la nota: `HEB · Higiene personal` cuenta para HEB.

**Su Sheets** muestra solo **Movimientos, Atajos, Ajustes y Resumen del mes**. Gastos fijos, Pagos esperados y Cortes existen pero están escondidos, porque la app los usa por dentro. Su Resumen del mes trae: gasto por categoría (este mes contra el pasado), lo que entró, lo que gastó, lo que envió a otras personas y su saldo en BBVA, en efectivo y en total.

---

## 16. Google Sheets como base de datos

El Sheets **es la fuente de verdad**: la app escribe ahí cada cambio y lee lo que alguien cambie a mano. No hay otra base de datos. Cada persona tiene el suyo, con **la misma estructura de pestañas**.

### Pestañas de datos (la app lee y escribe)

| Pestaña | Columnas | Para qué |
| --- | --- | --- |
| **Movimientos** | ID, Fecha, Tipo, Monto, De, A, Categoría, Nota, Dato | Una fila por movimiento. Montos en pesos, sin signo. |
| **Gastos fijos** | ID, Nombre, Monto normal, Frecuencia, Día, Mes, Categoría, Desde, Hasta, Activo | Las suscripciones. **La app solo las lee.** Frecuencia: Mensual o Anual. |
| **Pagos esperados** | ID, Gasto fijo, Nombre, Fecha, Monto, Categoría, Estado (+ "Se paga el", calculada) | Los cobros que genera la app. |
| **Cortes** | Fecha de corte, Fecha límite, Estado de cuenta (+ columnas calculadas) | El monto y la fecha límite de cada estado de cuenta. El monto puede quedar vacío mientras no salga. **La app solo lo lee.** |
| **Atajos** | ID, Nombre, Monto, Categoría, Se paga con | Gastos frecuentes. |
| **Ajustes** | Valores en B2:B6 (límite de tarjeta, día de corte, día límite de pago, tasa, día de pago) y listas en E (gasto), F (ingreso), G (bolsas), H (tipos), I (estados), J (dato), K (todas las categorías, se calcula sola a partir de E y F), L (lugares) y M (categorías con lugar) | Configuración y las listas de los menús desplegables. |

### Pestañas de vista (solo para mirar)

- **Vanessa:** **Resumen del periodo**, **Gastos fijos por periodo** e **Ingresos por quincena**.
- **Francisco:** **Resumen del mes**.

Se calculan solas con fórmulas, la app **nunca** escribe en ellas, y están protegidas contra edición accidental. Las de Vanessa usan los mismos periodos de tarjeta (del 22 al 21) que la app, así que los totales coinciden con la pantalla Resumen. "Gastos fijos por periodo" se recorre sola cada mes: siempre muestra los últimos once periodos y el siguiente. El día de corte sale de Ajustes: si cambia, las vistas se acomodan solas. "Ingresos por quincena" no agrupa por periodo, sino por día de pago (14 y 29).

### Reglas para editar a mano

- No cambies los nombres ni el orden de las columnas.
- Si agregas una fila, deja el ID vacío: la app se lo pone.
- Los menús desplegables evitan equivocarse en tipo, bolsa, categoría, estado y dato.
- Una fila con error (monto con letras, tipo inexistente, bolsa que no existe) **se marca y no se cuenta** hasta corregirla. La app no se rompe: muestra cuántas filas tienen problema.
- Una fila con una casilla "Activo" marcada pero sin nombre, monto ni ID se toma como un gasto fijo incompleto y se reporta como error. Si no es gasto, desmarca la casilla.
- Un dato de relleno se marca **Dummy** en la columna Dato. Lo real que pasó antes de la app (ya incluido en los saldos iniciales) se marca **Previo**.

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
7. **Cambios al mismo tiempo:** varios cambios a un mismo movimiento se juntan en uno antes de mandarse (un gasto agregado y borrado antes de sincronizar ni llega al Sheets), lo que se cambia mientras una sincronización está en camino se manda enseguida, y el servidor quita las filas repetidas que dos sincronizaciones simultáneas pudieran crear. Al borrar, se borran todas las filas con ese ID.
8. **Solo lectura:** la cuenta de Mami nunca manda cambios; solo recibe el Sheets. Si algún cambio llegara a su sesión, el servidor lo rechaza.

El servidor **valida cada cambio** que llega del navegador, campo por campo, antes de tocar el Sheets (nunca confía en lo que mande el teléfono). Un aviso delgado arriba indica cuando algo necesita atención: "Sin internet · 2 cambios por subir", "Tu sesión terminó, vuelve a entrar", "Tu Sheets todavía no está listo" o "No se pudo sincronizar".

---

## 18. Seguridad y permisos

- **Usuario y contraseña** con **Auth.js**. Las contraseñas **nunca se guardan**: solo un hash con `scrypt` y una "sal" aleatoria, que no se puede revertir. Se crean con `npm run hash-password`, que pide la contraseña sin mostrarla y solo imprime el hash. La comparación se hace en tiempo constante.
- **La sesión** es una cookie cifrada que solo guarda el id de la persona; el navegador no la puede leer (httpOnly). Quitar el hash de alguien de las variables de entorno cierra sus sesiones.
- **Acceso al Sheets con una cuenta de servicio de Google:** un "robot" que solo ve los Sheets que se le comparten. Su llave privada vive **solo** en las variables de entorno del servidor (Vercel y `.env.local`), nunca en el código, en Git ni en el navegador. El servidor pide con ella permisos de una hora y los renueva solo.
- **El navegador solo conoce** el nombre, el id, el rol, el layout y el color de quien entró; nunca llaves ni contraseñas.
- **Cada pedido al servidor** revisa quién es y qué puede hacer.
- **El modo de solo lectura se aplica en el servidor**, no solo escondiendo botones.
- **Lo que no está en el código:** contraseñas, llaves, IDs de Sheets ni datos personales de ejemplo. Antes de cada commit se revisa que no se cuele ningún secreto, y `.env.local` está excluido de Git.
- La conexión vieja con Google (inicio de sesión con la cuenta de Google) se **eliminó por completo**, junto con sus credenciales.

---

## 19. Cómo está construido y cómo operarlo

**Stack:** Next.js (App Router), React, TypeScript y Tailwind. Despliegue en Vercel (cada push a `main` publica). Reglas del proyecto: nada de `any`, componentes con una sola responsabilidad, código y comentarios en inglés, interfaz en español.

La separación por capas es la decisión de arquitectura más importante:

| Carpeta | Qué contiene | Por qué |
| --- | --- | --- |
| `src/domain` | **Lógica pura**: libro de saldos, periodos, estado de la tarjeta, rendimiento, cobros esperados, lugares, usuarios y roles, mapeo de filas del Sheets, validación de cambios. Sin React ni red. | Es lo que más importa y lo más fácil de equivocarse. Al ser funciones puras se prueba rápido y con certeza. |
| `src/services` | Repositorio (Dexie + bandeja de salida, uno por persona), acciones de la app, sincronización, sesión del navegador. | Separa "qué hace la app" de "dónde se guarda". |
| `src/server` | Todo lo que corre solo en el servidor: contraseñas, sesión, cuenta de servicio, cliente de Sheets, lectura y escritura por pestaña. | Las llaves y permisos nunca llegan al navegador. |
| `src/components` | Pantallas y piezas visuales, por área (`home`, `add`, `history`, `summary`, `profile`, `sync`, `ui`). | Interfaz sin lógica de negocio. |
| `src/data` | Valores por defecto (categorías, ajustes) para un teléfono que aún no sincroniza. | Los datos reales solo salen del Sheets de cada persona. |
| `src/app` | Rutas (Inicio, Agregar, Historial, Resumen, Perfil, privacidad, términos), API de sesión, de quién eres (`/api/me`) y de sincronización, manifiesto e íconos. | Estructura estándar de Next.js. |
| `scripts` | `hash-password`, para cifrar contraseñas. | Para que la contraseña real nunca pase por el código. |

**Pruebas:** hay pruebas automáticas sobre la lógica de dominio y el mapeo del Sheets (saldos, periodos, tarjeta, rendimiento, cobros, lugares, usuarios, contraseñas, lectura de filas, validación de cambios). Se corren con `npm test`.

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
- *Filas con error en Perfil:* corregir esas filas en el Sheets (el aviso dice pestaña y número de fila).

**Instalarla en iPhone:** abrir la dirección de Vercel en Safari → Compartir → "Agregar a pantalla de inicio". El manifiesto le da nombre, íconos y colores, y la abre a pantalla completa. Cada persona ve **solo su espacio**.

---

## 20. Qué cambió respecto a la propuesta original (y por qué)

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
| Meses de calendario ("este mes y el pasado") | **Periodos de tarjeta** (22 al 21) para Vanessa; mes de calendario para Francisco | Coincide con Nu y con lo que se paga el día 1; Francisco no tiene tarjeta. |
| Uñas como gasto recurrente cada 3 semanas | **Atajo de gasto normal** | No tienen día fijo; el recordatorio sobraba. |
| Cambiar el monto de un cobro "solo este mes" | **Eliminado** | Poco usado; si cambia el precio, se edita el gasto fijo. |
| "Cajita Turbo" y "Tarjeta Nu" | **Cajita Nu Débito** y **Tarjeta Nu crédito** | Nombres más claros. |
| 4 pantallas | 4 pantallas + **Perfil**, y una **versión simple** para otra persona | Sincronización, respaldo, cerrar sesión y un segundo usuario con otras necesidades. |
| Entrar con Google | **Usuario y contraseña** por persona, un Sheets por persona, Mami en solo lectura | Que la familia la use sin cuentas de Google y con todo en la cuenta de Vanessa. |
| Un solo Sheets para una sola persona | **Un Sheets por persona**, con la misma estructura | Cada quien ve solo lo suyo. |
| Gasto fijo "cada N días" en el Sheets | **Solo Mensual o Anual** | Sin uñas recurrentes ya no se usaba. |
| Atajos enlazados a un gasto fijo | **Atajos simples** | Estaban ligados a las uñas recurrentes. |
| Días de quincena y plan de pago con montos en Ajustes | **Quitados**; solo queda el **Día de pago** | Ya no se usaban. |
| Avisos (push, quincena, pagar tarjeta) | **No construidos todavía** | Quedan como mejora futura; hoy hay un aviso de sincronización y el de "gastos por revisar". |
| Service worker para uso sin internet | **No construido todavía**; los datos sí funcionan sin internet gracias a Dexie | Pendiente: guardar también la app en sí. |

---

## 21. Lo que falta o se puede mejorar

- **Ver periodos anteriores** en Inicio, Historial y Resumen, cuando ya haya periodos completos con su información.
- **Service worker** para que la app abra aunque no haya internet, y **avisos** (pagar la tarjeta, quincena, próximos cobros) con notificaciones push.
- **Francisco:** gastos fijos propios (por ejemplo el gym mensual), un total de "gastado en Vane" (dates más antojos de ella) y lo que él vaya pidiendo al usarla.
- **Revisar el 22 de noviembre** (primer corte con la app): capturar el estado de cuenta real en la pestaña Cortes y comparar con Nu.
- Un **PIN** adicional para quien lo quiera.

---

## 22. Las decisiones clave

1. **El Sheets es la verdad**, la app es una ventana rápida con copia local.
2. **Los saldos se calculan, no se guardan.** Una sola fuente (los movimientos) y cero números desincronizados.
3. **La tarjeta es deuda, no dinero.** Y Deuda mami no es dinero real hasta que regresa.
4. **Todo se lee en periodos de tarjeta** para quien tiene tarjeta, y por mes para quien no.
5. **Cada acción tiene un solo lugar:** pagar la tarjeta, mover dinero, apuntar lo de mamá, ingresos, transferir. Menos pasos, menos confusión.
6. **La mamá nunca paga directo:** Vanessa paga y ella regresa; lo extra es un ingreso a Banorte.
7. **Un layout por necesidad:** la misma app se adapta a cada persona sin mostrar lo que no usa.
8. **Offline-first con "el Sheets gana":** nada se pierde sin internet y los conflictos tienen una regla clara.
9. **Seguridad en el servidor:** contraseñas solo como hash, llaves solo en el servidor, permisos revisados en cada pedido y cada cambio validado.
10. **Lógica pura y probada**, separada de la interfaz y de dónde se guardan los datos.
11. **Si no se usa, no se deja:** la app y los Sheets se mantienen limpios y con los mismos nombres y la misma estructura.
