import Dexie, { type EntityTable, type Transaction } from "dexie";

import { emptyPaymentPlan, seedSettings } from "@/data/seedData";
import { createId } from "@/domain/ids";
import type { SyncOp } from "@/domain/syncOps";
import type {
  AppData,
  ExpectedCharge,
  FixedExpense,
  Movement,
  MovementDraft,
  PaymentPlan,
  Settings,
  Shortcut,
  StatementRecord,
} from "@/domain/types";

/**
 * Everything the app needs from its storage. Every change is saved on the device first
 * and queued in an outbox, so the app works offline and the sync sends it later.
 */
export interface FinanceRepository {
  load(): Promise<AppData>;
  addMovements(drafts: MovementDraft[]): Promise<Movement[]>;
  restoreMovements(movements: Movement[]): Promise<void>;
  deleteMovements(ids: string[]): Promise<void>;
  updateMovement(movement: Movement): Promise<void>;
  saveExpectedCharges(charges: ExpectedCharge[]): Promise<void>;
  /** For charges the app generated: never overwrites one the sheet already has. */
  addGeneratedCharges(charges: ExpectedCharge[]): Promise<void>;
  saveShortcut(shortcut: Omit<Shortcut, "id"> & { id?: string }): Promise<Shortcut>;
  deleteShortcut(id: string): Promise<void>;
  savePaymentPlan(plan: PaymentPlan): Promise<void>;
  pendingOps(): Promise<PendingOp[]>;
  /** Replaces the local copy with the sheet, then re-applies changes not sent yet. */
  replaceWithSheet(data: AppData, sentSeqs: number[]): Promise<void>;
  getSyncInfo(): Promise<SyncInfo>;
}

export interface PendingOp {
  seq: number;
  op: SyncOp;
}

export interface SyncInfo {
  linkedAt: string | null;
  lastSyncedAt: string | null;
}

interface ConfigRow {
  id: "main";
  settings: Settings;
  paymentPlan: PaymentPlan;
  nextMovementId: number;
  nextShortcutId: number;
  linkedAt?: string | null;
  lastSyncedAt?: string | null;
}

interface OutboxRow {
  seq?: number;
  op: SyncOp;
}

/** IndexedDB is the browser's built-in database: data stays on the phone after reloads. */
class FinanceDatabase extends Dexie {
  movements!: EntityTable<Movement, "id">;
  fixedExpenses!: EntityTable<FixedExpense, "id">;
  expectedCharges!: EntityTable<ExpectedCharge, "id">;
  statements!: EntityTable<StatementRecord, "cutDate">;
  shortcuts!: EntityTable<Shortcut, "id">;
  config!: EntityTable<ConfigRow, "id">;
  outbox!: EntityTable<OutboxRow, "seq">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      movements: "id, date",
      fixedExpenses: "id",
      expectedCharges: "id, date",
      statements: "cutDate",
      shortcuts: "id",
      config: "id",
    });
    // Version 2 brought new default categories to a database created earlier.
    this.version(2).upgrade(async (tx) => {
      const config = tx.table<ConfigRow, string>("config");
      await config.toCollection().modify((row) => {
        const missing = seedSettings.expenseCategories.filter(
          (category) => !row.settings.expenseCategories.includes(category),
        );
        row.settings.expenseCategories.push(...missing);
      });
    });
    // Version 3 adds the outbox: changes waiting to be written to the sheet.
    this.version(3).stores({ outbox: "++seq" });
  }
}

const DATA_TABLES = [
  "movements",
  "fixedExpenses",
  "expectedCharges",
  "statements",
  "shortcuts",
  "config",
  "outbox",
] as const;

class DexieFinanceRepository implements FinanceRepository {
  constructor(private readonly db: FinanceDatabase) {}

  private async getConfig(): Promise<ConfigRow> {
    const existing = await this.db.config.get("main");
    if (existing) return existing;

    // First open on this device: default settings only. The real data comes from the Sheet.
    const config: ConfigRow = {
      id: "main",
      settings: seedSettings,
      paymentPlan: emptyPaymentPlan,
      nextMovementId: 1,
      nextShortcutId: 1,
      linkedAt: null,
      lastSyncedAt: null,
    };
    await this.db.config.put(config);
    return config;
  }

  /** Saves a change and queues it for the sheet in one step, so neither is lost. */
  private async change(work: () => Promise<SyncOp>): Promise<void> {
    await this.db.transaction("rw", DATA_TABLES, async () => {
      const op = await work();
      await this.db.outbox.add({ op });
    });
  }

  async load(): Promise<AppData> {
    const config = await this.getConfig();
    const [movements, fixedExpenses, expectedCharges, statements, shortcuts] =
      await Promise.all([
        this.db.movements.toArray(),
        this.db.fixedExpenses.toArray(),
        this.db.expectedCharges.toArray(),
        this.db.statements.toArray(),
        this.db.shortcuts.toArray(),
      ]);

    return {
      movements,
      fixedExpenses,
      expectedCharges,
      statements,
      shortcuts,
      settings: config.settings,
      paymentPlan: config.paymentPlan,
    };
  }

  async addMovements(drafts: MovementDraft[]): Promise<Movement[]> {
    const created = drafts.map((draft) => ({ ...draft, id: createId("m") }));
    await this.change(async () => {
      await this.db.movements.bulkAdd(created);
      return { kind: "upsertMovements", movements: created };
    });
    return created;
  }

  async restoreMovements(movements: Movement[]): Promise<void> {
    await this.change(async () => {
      await this.db.movements.bulkPut(movements);
      return { kind: "upsertMovements", movements };
    });
  }

  async deleteMovements(ids: string[]): Promise<void> {
    await this.change(async () => {
      await this.db.movements.bulkDelete(ids);
      return { kind: "deleteMovements", ids };
    });
  }

  async updateMovement(movement: Movement): Promise<void> {
    await this.change(async () => {
      await this.db.movements.put(movement);
      return { kind: "upsertMovements", movements: [movement] };
    });
  }

  async saveExpectedCharges(charges: ExpectedCharge[]): Promise<void> {
    await this.change(async () => {
      await this.db.expectedCharges.bulkPut(charges);
      return { kind: "upsertExpectedCharges", charges };
    });
  }

  async addGeneratedCharges(charges: ExpectedCharge[]): Promise<void> {
    await this.change(async () => {
      await this.db.expectedCharges.bulkPut(charges);
      return { kind: "addExpectedCharges", charges };
    });
  }

  async saveShortcut(
    shortcut: Omit<Shortcut, "id"> & { id?: string },
  ): Promise<Shortcut> {
    const saved: Shortcut = { ...shortcut, id: shortcut.id ?? createId("s") };
    await this.change(async () => {
      await this.db.shortcuts.put(saved);
      return { kind: "upsertShortcut", shortcut: saved };
    });
    return saved;
  }

  async deleteShortcut(id: string): Promise<void> {
    await this.change(async () => {
      await this.db.shortcuts.delete(id);
      return { kind: "deleteShortcut", id };
    });
  }

  async savePaymentPlan(plan: PaymentPlan): Promise<void> {
    await this.getConfig();
    await this.change(async () => {
      await this.db.config.update("main", { paymentPlan: plan });
      return { kind: "savePaymentPlan", plan };
    });
  }

  async pendingOps(): Promise<PendingOp[]> {
    const rows = await this.db.outbox.orderBy("seq").toArray();
    return rows.flatMap((row) => (row.seq === undefined ? [] : [{ seq: row.seq, op: row.op }]));
  }

  async getSyncInfo(): Promise<SyncInfo> {
    const config = await this.getConfig();
    return { linkedAt: config.linkedAt ?? null, lastSyncedAt: config.lastSyncedAt ?? null };
  }

  async replaceWithSheet(data: AppData, sentSeqs: number[]): Promise<void> {
    const now = new Date().toISOString();
    await this.db.transaction("rw", DATA_TABLES, async (tx) => {
      await this.db.outbox.bulkDelete(sentSeqs);

      await Promise.all([
        this.db.movements.clear(),
        this.db.fixedExpenses.clear(),
        this.db.expectedCharges.clear(),
        this.db.statements.clear(),
        this.db.shortcuts.clear(),
      ]);
      await this.db.movements.bulkPut(data.movements);
      await this.db.fixedExpenses.bulkPut(data.fixedExpenses);
      await this.db.expectedCharges.bulkPut(data.expectedCharges);
      await this.db.statements.bulkPut(data.statements);
      await this.db.shortcuts.bulkPut(data.shortcuts);

      const config = await this.getConfig();
      await this.db.config.put({
        ...config,
        settings: data.settings,
        paymentPlan: data.paymentPlan,
        linkedAt: config.linkedAt ?? now,
        lastSyncedAt: now,
      });

      // Changes made while the request was on its way are still in the outbox.
      const remaining = await this.db.outbox.toArray();
      for (const row of remaining) await applyLocally(tx, row.op);
    });
  }
}

/** Re-applies a pending change on top of fresh sheet data, without queueing it again. */
async function applyLocally(tx: Transaction, op: SyncOp): Promise<void> {
  switch (op.kind) {
    case "upsertMovements":
      await tx.table<Movement, string>("movements").bulkPut(op.movements);
      break;
    case "deleteMovements":
      await tx.table<Movement, string>("movements").bulkDelete(op.ids);
      break;
    case "upsertExpectedCharges":
      await tx.table<ExpectedCharge, string>("expectedCharges").bulkPut(op.charges);
      break;
    case "addExpectedCharges": {
      // Same rule as the sheet: only fill in charges that aren't there yet.
      const table = tx.table<ExpectedCharge, string>("expectedCharges");
      const existing = new Set(await table.toCollection().primaryKeys());
      await table.bulkPut(op.charges.filter((charge) => !existing.has(charge.id)));
      break;
    }
    case "upsertShortcut":
      await tx.table<Shortcut, string>("shortcuts").put(op.shortcut);
      break;
    case "deleteShortcut":
      await tx.table<Shortcut, string>("shortcuts").delete(op.id);
      break;
    case "savePaymentPlan":
      await tx.table<ConfigRow, string>("config").update("main", { paymentPlan: op.plan });
      break;
  }
}

/**
 * Each person has their own database on the device, so two people sharing a phone never
 * see each other's copy. Vanessa keeps the name her data already had.
 */
function databaseName(userId: string): string {
  return userId === "vanessa" ? "mis-gastos" : `pockets-${userId}`;
}

const repositories = new Map<string, DexieFinanceRepository>();
let activeUserId: string | null = null;

/** Called when someone signs in: from then on, every read and write uses their database. */
export function switchRepositoryTo(userId: string): void {
  activeUserId = userId;
}

/** Created on first use, because IndexedDB only exists in the browser, not on the server. */
export function getFinanceRepository(): FinanceRepository {
  if (!activeUserId) throw new Error("Nobody is signed in");
  let repository = repositories.get(activeUserId);
  if (!repository) {
    repository = new DexieFinanceRepository(new FinanceDatabase(databaseName(activeUserId)));
    repositories.set(activeUserId, repository);
  }
  return repository;
}
