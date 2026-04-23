import { requestAsync } from '../../../../runtime/hooks/http';

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

export type PubChemSearchResult = {
  cid: number;
  name: string;
  formula: string;
  weight: number;
};

export type PubChemCompound = {
  cid: number;
  name?: string;
  iupacName?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  canonicalSmiles?: string;
  inchi?: string;
  inchiKey?: string;
  exactMass?: number;
  monoisotopicMass?: number;
  topologicalPolarSurfaceArea?: number;
  structureSvg?: string | null;
};

type HttpResponse = { status: number; body: string; error?: string };

function hostHttpAvailable(): boolean {
  const host: any = globalThis as any;
  return typeof host.__http_request_async === 'function' || typeof host.__http_request_sync === 'function';
}

export function isPubChemAvailable(): boolean {
  return hostHttpAvailable();
}

async function httpGet(url: string): Promise<HttpResponse | null> {
  if (!hostHttpAvailable()) return null;
  try {
    return await requestAsync({ method: 'GET', url, timeoutMs: 20000 });
  } catch {
    return null;
  }
}

async function httpJson<T>(url: string): Promise<T | null> {
  const res = await httpGet(url);
  if (!res || res.status < 200 || res.status >= 300) return null;
  try {
    return JSON.parse(res.body) as T;
  } catch {
    return null;
  }
}

export async function searchPubChemCompounds(query: string, maxResults = 10): Promise<PubChemSearchResult[]> {
  const q = String(query || '').trim();
  if (!q) return [];
  const json: any = await httpJson(`${BASE}/compound/name/${encodeURIComponent(q)}/property/MolecularFormula,MolecularWeight/JSON`);
  const rows = json?.PropertyTable?.Properties || [];
  return rows.slice(0, maxResults).map((row: any) => ({
    cid: Number(row.CID || 0),
    name: q,
    formula: String(row.MolecularFormula || ''),
    weight: Number(row.MolecularWeight || 0),
  })).filter((row: PubChemSearchResult) => row.cid > 0);
}

export async function fetchPubChemCompound(nameOrCid: string | number): Promise<PubChemCompound | null> {
  const ns = typeof nameOrCid === 'number' ? 'cid' : 'name';
  const identifier = encodeURIComponent(String(nameOrCid));
  const json: any = await httpJson(`${BASE}/compound/${ns}/${identifier}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChI,InChIKey,ExactMass,MonoisotopicMass,TPSA/JSON`);
  const row = json?.PropertyTable?.Properties?.[0];
  if (!row) return null;
  const cid = Number(row.CID || (typeof nameOrCid === 'number' ? nameOrCid : 0));
  return {
    cid,
    name: typeof nameOrCid === 'string' ? nameOrCid : undefined,
    iupacName: row.IUPACName || undefined,
    molecularFormula: row.MolecularFormula || undefined,
    molecularWeight: row.MolecularWeight || undefined,
    canonicalSmiles: row.CanonicalSMILES || undefined,
    inchi: row.InChI || undefined,
    inchiKey: row.InChIKey || undefined,
    exactMass: row.ExactMass || undefined,
    monoisotopicMass: row.MonoisotopicMass || undefined,
    topologicalPolarSurfaceArea: row.TPSA || undefined,
  };
}

export async function fetchPubChemStructureSvg(cid: number): Promise<string | null> {
  const res = await httpGet(`${BASE}/compound/cid/${encodeURIComponent(String(cid))}/record/SVG`);
  if (!res || res.status < 200 || res.status >= 300) return null;
  return res.body || null;
}
