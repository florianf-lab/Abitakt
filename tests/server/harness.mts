export let failures = 0;
export function ok(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log((cond ? "  \u2713 " : "  \u2717 ") + msg);
}
export function head(name: string) { console.log("\n[server] " + name); }
