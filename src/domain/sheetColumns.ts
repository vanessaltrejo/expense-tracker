/**
 * Finds the columns of a Sheet tab by the name in its header row, so moving, inserting or
 * deleting columns in the Sheet can never make the app read or write the wrong cell.
 * A column the app needs that can't be found stops the sync with a clear message instead
 * of guessing where it went.
 */

export type Cell = string | number | boolean | null | undefined;
export type SheetRow = Cell[];

export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

export interface ColumnSpec<K extends string> {
  /** The name the app uses for the column. */
  key: K;
  /** The name written in the header row of the Sheet. */
  header: string;
}

/** The 0-based position of each column in the tab. */
export type ColumnMap<K extends string> = Record<K, number>;

/** A column the app needs is missing from the header row of a tab. */
export class SheetLayoutError extends Error {
  readonly tab: string;
  readonly missing: string[];

  constructor(tab: string, missing: string[]) {
    super(
      `En la pestaña ${tab} falta ${missing.length === 1 ? "la columna" : "las columnas"} ${missing
        .map((name) => `"${name}"`)
        .join(", ")}`,
    );
    this.tab = tab;
    this.missing = missing;
  }
}

/** A header matches ignoring case and a note in parentheses, as in "Bolsas (fija)". */
export function normalizeHeader(cell: Cell): string {
  return cellText(cell)
    .toLowerCase()
    .replace(/\s*\(.*\)\s*$/, "");
}

/** The 0-based position of a header, or -1 when the row has no column with that name. */
export function findHeader(header: SheetRow | undefined, name: string): number {
  const wanted = normalizeHeader(name);
  return (header ?? []).findIndex((cell) => normalizeHeader(cell) === wanted);
}

/** Where each column of a tab is. Throws SheetLayoutError listing every column that is missing. */
export function findColumns<K extends string>(
  tab: string,
  header: SheetRow | undefined,
  specs: readonly ColumnSpec<K>[],
): ColumnMap<K> {
  const columns = {} as ColumnMap<K>;
  const missing: string[] = [];
  for (const spec of specs) {
    const index = findHeader(header, spec.header);
    if (index < 0) missing.push(spec.header);
    else columns[spec.key] = index;
  }
  if (missing.length > 0) throw new SheetLayoutError(tab, missing);
  return columns;
}

/** The layout of a brand-new tab, with the columns in the order they are declared. */
export function canonicalColumns<K extends string>(specs: readonly ColumnSpec<K>[]): ColumnMap<K> {
  const columns = {} as ColumnMap<K>;
  specs.forEach((spec, index) => {
    columns[spec.key] = index;
  });
  return columns;
}

/** Column letters for A1 ranges: 0 is A, 25 is Z, 26 is AA. */
export function columnLetter(index: number): string {
  let letters = "";
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
  }
  return letters;
}

/** A whole row to append, with every known column in place and blanks everywhere else. */
export function rowFromRecord<K extends string>(
  columns: ColumnMap<K>,
  record: Record<K, Cell>,
): Cell[] {
  const row: Cell[] = Array.from({ length: Math.max(...Object.values<number>(columns)) + 1 }, () => null);
  for (const key of Object.keys(record) as K[]) row[columns[key]] = record[key];
  return row;
}

/**
 * The cells of a record grouped into runs of neighbouring columns, so updating a row writes
 * only the columns the app owns and never blanks one the person added (a note, a formula).
 */
export function cellRuns<K extends string>(
  columns: ColumnMap<K>,
  record: Record<K, Cell>,
): { first: number; values: Cell[] }[] {
  const entries = (Object.keys(record) as K[])
    .map((key) => ({ index: columns[key], value: record[key] }))
    .sort((a, b) => a.index - b.index);

  const runs: { first: number; values: Cell[] }[] = [];
  for (const { index, value } of entries) {
    const run = runs.at(-1);
    if (run && run.first + run.values.length === index) run.values.push(value);
    else runs.push({ first: index, values: [value] });
  }
  return runs;
}
