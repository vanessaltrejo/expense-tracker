import type { Cell, SheetRow } from "@/domain/sheetMapping";

const BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

export class SheetsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ValueRange {
  range: string;
  values: Cell[][];
}

/** Text that starts like a formula is stored as plain text, so nothing typed can run. */
function protectText(cell: Cell): Cell {
  if (typeof cell === "string" && /^[=+\-@]/.test(cell)) return `'${cell}`;
  return cell;
}

function protectRows(values: Cell[][]): Cell[][] {
  return values.map((row) => row.map(protectText));
}

/** A small wrapper over the Google Sheets REST API, using the signed-in user's token. */
export class SheetsClient {
  private sheetIdsByTitle: Map<string, number> | null = null;

  constructor(
    private readonly accessToken: string,
    private readonly spreadsheetId: string,
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/${this.spreadsheetId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new SheetsError(response.status, `Google Sheets respondió ${response.status}`);
    }
    return response.json();
  }

  /** Raw values: numbers stay numbers and dates come as serial numbers. */
  async batchGet(ranges: string[]): Promise<SheetRow[][]> {
    const params = new URLSearchParams({
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    for (const range of ranges) params.append("ranges", range);

    const body = await this.request(`/values:batchGet?${params.toString()}`);
    const valueRanges =
      typeof body === "object" && body !== null && "valueRanges" in body && Array.isArray(body.valueRanges)
        ? body.valueRanges
        : [];

    return ranges.map((_, index) => {
      const entry: unknown = valueRanges[index];
      if (typeof entry === "object" && entry !== null && "values" in entry && Array.isArray(entry.values)) {
        return entry.values as SheetRow[];
      }
      return [];
    });
  }

  /** Writes as if typed in the sheet, so ISO dates become real dates. */
  async updateValues(data: ValueRange[]): Promise<void> {
    if (data.length === 0) return;
    await this.request("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: data.map((item) => ({ range: item.range, values: protectRows(item.values) })),
      }),
    });
  }

  async appendRows(range: string, values: Cell[][]): Promise<void> {
    if (values.length === 0) return;
    const params = new URLSearchParams({
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
    });
    await this.request(`/values/${encodeURIComponent(range)}:append?${params.toString()}`, {
      method: "POST",
      body: JSON.stringify({ values: protectRows(values) }),
    });
  }

  async batchUpdate(requests: object[]): Promise<void> {
    if (requests.length === 0) return;
    await this.request(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  async getSheetId(title: string): Promise<number> {
    if (!this.sheetIdsByTitle) {
      const body = await this.request("?fields=sheets.properties(sheetId,title)");
      const map = new Map<string, number>();
      const sheets =
        typeof body === "object" && body !== null && "sheets" in body && Array.isArray(body.sheets)
          ? body.sheets
          : [];
      for (const sheet of sheets) {
        const properties: unknown = sheet?.properties;
        if (
          typeof properties === "object" &&
          properties !== null &&
          "title" in properties &&
          "sheetId" in properties &&
          typeof properties.title === "string" &&
          typeof properties.sheetId === "number"
        ) {
          map.set(properties.title, properties.sheetId);
        }
      }
      this.sheetIdsByTitle = map;
    }
    const id = this.sheetIdsByTitle.get(title);
    if (id === undefined) throw new SheetsError(404, `No existe la pestaña ${title}`);
    return id;
  }
}
