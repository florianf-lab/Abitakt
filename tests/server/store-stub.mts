// Blob store with etags and conditional writes, plus an artificial delay so
// concurrent callers really do interleave.
const mem: Record<string, Record<string, { v: any; etag: string }>> = {};
let seq = 0;
const tick = () => new Promise(r => setTimeout(r, 1 + Math.floor(Math.random() * 6)));
export function getStore(name: string) {
  mem[name] = mem[name] || {};
  const s = mem[name];
  return {
    async getWithMetadata(k: string, _o?: any) { await tick(); const e = s[k]; return e ? { data: JSON.parse(JSON.stringify(e.v)), etag: e.etag } : null; },
    async get(k: string, _o?: any) { await tick(); return s[k] ? JSON.parse(JSON.stringify(s[k].v)) : null; },
    async setJSON(k: string, v: any, o?: any) {
      await tick();
      const cur = s[k];
      if (o?.onlyIfNew && cur) return { modified: false };
      if (o?.onlyIfMatch && (!cur || cur.etag !== o.onlyIfMatch)) return { modified: false };
      const etag = "e" + (++seq);
      s[k] = { v: JSON.parse(JSON.stringify(v)), etag };
      return { modified: true, etag };
    },
    async delete(k: string) { await tick(); delete s[k]; },
    _raw: s,
  };
}
