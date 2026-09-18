// The sync endpoint: readable codes, optimistic concurrency, size and format limits.
// The real handler is loaded with the blob store swapped for the stub.
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ok, head } from "./harness.mts";

const here = dirname(fileURLToPath(import.meta.url));

export default async function () {
  head("sync.mts – verschlüsselte Profil-Sicherung");
  const src = await readFile(join(here, "..", "..", "netlify", "functions", "sync.mts"), "utf8");
  const tmp = join(here, "__sync.copy.mts");
  await writeFile(tmp, src.replace('"@netlify/blobs"', '"./store-stub.mts"'));
  const handler = (await import(pathToFileURL(tmp).href + "?t=" + Date.now())).default;

  const call = async (method: string, body?: any, qs = "") => {
    const req = new Request("https://x/api/sync" + qs, method === "GET" ? { method }
      : { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    const res = await handler(req);
    return { status: res.status, body: await res.json() };
  };

  const c = await call("POST", { action: "create" });
  ok(c.status === 200 && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c.body.id), "create liefert einen lesbaren Code");
  ok(!/[IO01]/.test(c.body.id), "der Code enthält keine verwechselbaren Zeichen");
  const id = c.body.id;
  ok((await call("GET", null, "?id=" + id)).body.rev === 0, "ein neuer Code ist leer");
  ok((await call("POST", { action: "put", id, blob: "QUJD", rev: 0 })).body.rev === 1, "der erste Upload ergibt rev 1");
  const stale = await call("POST", { action: "put", id, blob: "WFla", rev: 0 });
  ok(stale.status === 409 && stale.body.blob === "QUJD", "ein veralteter Upload wird abgelehnt und liefert den Serverstand");
  ok((await call("POST", { action: "put", id, blob: "WFla", rev: 1 })).body.rev === 2, "mit der richtigen Version geht der Upload durch");
  ok((await call("GET", null, "?id=" + id.toLowerCase().replace(/-/g, ""))).body.blob === "WFla", "Kleinschreibung und fehlende Bindestriche sind egal");
  ok((await call("GET", null, "?id=AAAA-BBBB-CCCC")).status === 404, "ein unbekannter Code ergibt 404");
  ok((await call("GET", null, "?id=ABC")).status === 400, "ein unsinniger Code ergibt 400");
  ok((await call("POST", { action: "put", id, blob: "<script>", rev: 2 })).status === 400, "nur Base64 wird angenommen");
  ok((await call("POST", { action: "put", id, blob: "A".repeat(800000), rev: 2 })).status === 413, "zu große Profile werden abgelehnt");
  ok((await call("POST", { action: "nonsense", id })).status === 400, "unbekannte Aktionen werden abgelehnt");
  ok((await call("POST", { action: "delete", id })).status === 200 && (await call("GET", null, "?id=" + id)).status === 404, "Löschen entfernt die Sicherung");

  const ids = new Set<string>();
  for (let i = 0; i < 60; i++) ids.add((await call("POST", { action: "create" })).body.id);
  ok(ids.size === 60, "60 Codes ohne Kollision");
  await unlink(tmp);
}
