import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { withSheetLock } from "./sheetLock.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("one sync at a time per Sheet", () => {
  test("a second request waits until the first one is done", async () => {
    const log: string[] = [];
    const first = withSheetLock("a", async () => {
      log.push("first starts");
      await wait(20);
      log.push("first ends");
    });
    const second = withSheetLock("a", async () => {
      log.push("second starts");
    });
    await Promise.all([first, second]);
    assert.deepEqual(log, ["first starts", "first ends", "second starts"]);
  });

  test("another Sheet is not held back, and a failure doesn't block the next request", async () => {
    const failing = withSheetLock("b", async () => {
      throw new Error("Google no respondió");
    });
    await assert.rejects(failing);
    assert.equal(await withSheetLock("b", async () => "listo"), "listo");

    const log: string[] = [];
    const slow = withSheetLock("c", async () => {
      await wait(20);
      log.push("c");
    });
    await withSheetLock("d", async () => log.push("d"));
    await slow;
    assert.deepEqual(log, ["d", "c"]);
  });
});
