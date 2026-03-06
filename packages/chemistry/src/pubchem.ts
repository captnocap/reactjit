// PubChem REST API — pure async utilities only.
// React hooks removed: auto-fetching hooks (usePubChemCompound, usePubChemSearch, etc.)
// caused React to own network I/O with setState/useEffect/setTimeout in QuickJS.
// Callers should fetch imperatively (e.g., on button press) and store results in
// useHotState or pass data down as props.
// https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
// Free, no API key. Rate limit: 5 req/s.

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const BASE_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';

// -- Types --------------------------------------------------------------------

export interface PubChemCompound {
  cid: number;
  iupacName?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  canonicalSmiles?: string;
  inchi?: string;
  inchiKey?: string;
  charge?: number;
  xlogp?: number;
  hbondDonorCount?: number;
  hbondAcceptorCount?: number;
  rotatableBondCount?: number;
  exactMass?: number;
  monoisotopicMass?: number;
  topologicalPolarSurfaceArea?: number;
}

export interface PubChemSearchResult {
  cid: number;
  name: string;
  formula: string;
  weight: number;
}

// -- URL builders -------------------------------------------------------------

function compoundUrl(identifier: string | number, namespace: string, operation: string, output: string = 'JSON'): string {
  return `${BASE}/compound/${namespace}/${encodeURIComponent(identifier)}/${operation}/${output}`;
}

function propertyUrl(identifier: string | number, namespace: string, properties: string): string {
  return `${BASE}/compound/${namespace}/${encodeURIComponent(identifier)}/property/${properties}/JSON`;
}

// -- Pure async fetch functions -----------------------------------------------

export async function fetchCompound(nameOrCid: string | number): Promise<PubChemCompound | null> {
  const ns = typeof nameOrCid === 'number' ? 'cid' : 'name';
  const props = 'IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChI,InChIKey,Charge,XLogP,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,ExactMass,MonoisotopicMass,TPSA';
  const url = propertyUrl(nameOrCid, ns, props);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const row = json?.PropertyTable?.Properties?.[0];
    if (!row) return null;
    return {
      cid: row.CID,
      iupacName: row.IUPACName,
      molecularFormula: row.MolecularFormula,
      molecularWeight: row.MolecularWeight,
      canonicalSmiles: row.CanonicalSMILES,
      inchi: row.InChI,
      inchiKey: row.InChIKey,
      charge: row.Charge,
      xlogp: row.XLogP,
      hbondDonorCount: row.HBondDonorCount,
      hbondAcceptorCount: row.HBondAcceptorCount,
      rotatableBondCount: row.RotatableBondCount,
      exactMass: row.ExactMass,
      monoisotopicMass: row.MonoisotopicMass,
      topologicalPolarSurfaceArea: row.TPSA,
    };
  } catch {
    return null;
  }
}

export async function searchCompoundsPubChem(query: string, maxResults: number = 10): Promise<PubChemSearchResult[]> {
  const url = `${BASE}/compound/name/${encodeURIComponent(query)}/property/MolecularFormula,MolecularWeight/JSON`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const rows = json?.PropertyTable?.Properties ?? [];
    return rows.slice(0, maxResults).map((r: any) => ({
      cid: r.CID,
      name: query,
      formula: r.MolecularFormula ?? '',
      weight: r.MolecularWeight ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchSynonyms(cid: number, max: number = 20): Promise<string[]> {
  const url = compoundUrl(cid, 'cid', 'synonyms');
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const names = json?.InformationList?.Information?.[0]?.Synonym ?? [];
    return names.slice(0, max);
  } catch {
    return [];
  }
}

export async function fetchDescription(cid: number): Promise<string> {
  const url = `${BASE_VIEW}/data/compound/${cid}/JSON?heading=Record+Description`;
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const json = await res.json();
    const sections = json?.Record?.Section ?? [];
    for (const sec of sections) {
      for (const sub of (sec.Section ?? [])) {
        for (const info of (sub.Information ?? [])) {
          if (info.Value?.StringWithMarkup?.[0]?.String) {
            return info.Value.StringWithMarkup[0].String;
          }
        }
      }
    }
    return '';
  } catch {
    return '';
  }
}

export async function fetchHazards(cid: number): Promise<string[]> {
  const url = `${BASE_VIEW}/data/compound/${cid}/JSON?heading=GHS+Classification`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const hazards: string[] = [];
    const walk = (obj: any) => {
      if (!obj) return;
      if (typeof obj === 'string' && obj.length > 5 && obj.length < 200) hazards.push(obj);
      if (Array.isArray(obj)) obj.forEach(walk);
      else if (typeof obj === 'object') Object.values(obj).forEach(walk);
    };
    walk(json?.Record?.Section);
    return [...new Set(hazards)].slice(0, 20);
  } catch {
    return [];
  }
}
