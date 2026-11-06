/**
 * Turns a password into the hash that goes in PASSWORD_HASH_* (in .env.local and Vercel).
 * Run it with: npm run hash-password
 *
 * The password is typed without showing on screen, is never saved anywhere, and only the
 * hash is printed. The password itself never leaves this terminal.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { hashPassword } from "../src/server/passwords.ts";

let muted = false;
const output = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const reader = createInterface({
  input: process.stdin,
  output,
  terminal: Boolean(process.stdin.isTTY),
});

// Lines are queued as they arrive, so none is lost if they come faster than the questions.
const lines: string[] = [];
const waiting: ((line: string) => void)[] = [];
reader.on("line", (line) => {
  const next = waiting.shift();
  if (next) next(line);
  else lines.push(line);
});

function askHidden(question: string): Promise<string> {
  muted = false;
  output.write(question);
  muted = true;
  return new Promise((resolve) => {
    const ready = lines.shift();
    const finish = (line: string) => {
      muted = false;
      output.write("\n");
      resolve(line);
    };
    if (ready !== undefined) finish(ready);
    else waiting.push(finish);
  });
}

const password = await askHidden("Escribe la contraseña (no se verá): ");
const repeated = await askHidden("Escríbela otra vez: ");
reader.close();

if (!password) {
  console.error("No escribiste nada.");
  process.exit(1);
}
if (password !== repeated) {
  console.error("No coinciden. Intenta de nuevo.");
  process.exit(1);
}

console.log("\nCopia esta línea completa (es el hash, no la contraseña):\n");
console.log(hashPassword(password));
