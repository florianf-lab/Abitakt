import { failures } from "./harness.mts";
import atomic from "./atomic.test.mts";
import sync from "./sync.test.mts";

await atomic();
await sync();
console.log(failures ? `\n${failures} FEHLER` : "\nAlle Server-Tests bestanden.");
process.exit(failures ? 1 : 0);
