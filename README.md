# Pockets

App de gastos personal (Next.js + Google Sheets) para Vanessa, su mamá (solo lectura) y Francisco. Cada persona tiene su propio Google Sheets, que es la fuente de verdad; la app guarda una copia en el teléfono y sincroniza.

**Para entender cómo funciona y por qué está hecha así, lee [Pockets - Como funciona la app.md](<Pockets - Como funciona la app.md>).**

## Correrla

```bash
cp .env.example .env.local   # llena los valores (ver comentarios dentro)
npm install
npm run dev                  # http://localhost:3000
```

Las contraseñas se guardan como hash: `npm run hash-password`.

## Revisar

```bash
npm run typecheck   # tipos
npm run lint        # estilo
npm test            # pruebas
```

## Dónde está cada cosa

- `src/domain`: las reglas del dinero (saldos, periodos, cobros, mapeo con el Sheets). Sin dependencias de pantalla.
- `src/services`: guardado local (IndexedDB) y sincronización.
- `src/server`: lo que habla con Google Sheets.
- `src/components` y `src/app`: las pantallas.
