// Safe handling of console commands attached to products. Pure, no imports.

const BAD_CHARS = /[\r\n;\u0000-\u001f\u007f]/; // newlines, ";" and control characters can chain extra commands
const SAFE_NAME = /^[A-Za-z0-9_.]{1,32}$/;
const SAFE_UUID = /^[0-9a-fA-F-]{32,36}$/;
export const MAX_COMMAND_LENGTH = 256;

/** Checks a command template when a product is saved. Returns an error text or null when fine. */
export function validateCommandTemplate(template: string): string | null {
  const t = template.trim();
  if (!t.replace(/^\/+/, "")) return "Command is empty.";
  if (t.length > MAX_COMMAND_LENGTH) return `Command is longer than ${MAX_COMMAND_LENGTH} characters.`;
  if (BAD_CHARS.test(t)) return `Command contains a newline, ";" or a control character: ${t.slice(0, 40)}`;
  return null;
}

/** Fills {player} / {uuid} and strips a leading slash. Refuses anything unsafe. */
export function renderCommand(template: string, vars: { player: string; uuid: string }): { ok: true; command: string } | { ok: false; error: string } {
  const bad = validateCommandTemplate(template);
  if (bad) return { ok: false, error: bad };
  if (!SAFE_NAME.test(vars.player)) return { ok: false, error: `Player name "${vars.player}" has characters that are not safe in a command.` };
  if (!SAFE_UUID.test(vars.uuid)) return { ok: false, error: "Player UUID looks invalid." };
  const command = template
    .trim()
    .replace(/^\/+/, "")
    .replace(/\{player\}/g, vars.player)
    .replace(/\{uuid\}/g, vars.uuid);
  return { ok: true, command };
}
