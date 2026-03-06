/**
 * Chemistry — periodic table, molecules, reactions, reagent tests,
 * spectrometry, phase diagrams, PubChem API, and unit conversions.
 *
 * Pure TS data + hooks + React widgets for static chemistry.
 * Lua capabilities (60fps painters) for reagent tests, spectra, phase diagrams.
 * PubChem REST API for live compound lookups.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, TextInput } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  PeriodicTable, ElementCard, MoleculeCard, ElectronShell, ReactionView,
  ReagentTest, SpectrumView, PhaseDiagram,
  useElement, useMolecule, useReaction,
  molarMass, massComposition,
  COMPOUNDS, ELEMENTS, REAGENT_INFO,
  massToMoles, molesToParticles,
  fetchCompound,
  CONSTANTS,
} from '../../../packages/chemistry/src';
import type { PubChemCompound } from '../../../packages/chemistry/src';
import type { ReagentType } from '../../../packages/chemistry/src';
import { Band, Half, Divider, SectionLabel, CalloutBand } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const P = {
  accent: '#10b981',
  accentDim: 'rgba(16, 185, 129, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#ec4899',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import {
  PeriodicTable, ElementCard, MoleculeCard,
  ElectronShell, ReactionView,
  useElement, useMolecule, useReaction,
  ReagentTest, SpectrumView, PhaseDiagram,
  fetchCompound,
  molarMass, massComposition,
} from '@reactjit/chemistry'`;

const ELEMENT_CODE = `const el = useElement('Fe')
// el.name       → 'Iron'
// el.mass       → 55.845
// el.category   → 'transition-metal'
// el.electronConfig → '[Ar] 3d6 4s2'
// el.cpkColor   → '#E06633'`;

const MOLECULE_CODE = `const mol = useMolecule('C8H10N4O2')
// mol.name      → 'Caffeine'
// mol.molarMass → 194.19
// mol.geometry  → undefined
// mol.iupac     → '1,3,7-Trimethylxanthine'

<MoleculeCard formula="H2O" />`;

const REACTION_CODE = `const rxn = useReaction('CH4 + O2 -> CO2 + H2O')
// rxn.balanced  → 'CH4 + 2O2 -> CO2 + 2H2O'
// rxn.type      → 'combustion'
// rxn.enthalpy  → -890.4
// rxn.isBalanced → true

<ReactionView equation="N2 + H2 -> NH3" />`;

const REAGENT_CODE = `<ReagentTest
  type="marquis"
  sample="MDMA"
  speed={1.5}
  onReactionComplete={(e) => console.log(e)}
  style={{ width: 80, height: 100 }}
/>

// runReagentTest('ehrlich', 'LSD')
// → { reagent, compound, reaction, confidence,
//    functionalGroup, mechanism }`;

const SPECTRA_CODE = `<SpectrumView
  spectrumType="ir"
  compound="C2H5OH"
  style={{ height: 280 }}
/>

<PhaseDiagram
  compound="H2O"
  style={{ height: 260 }}
/>`;

const PUBCHEM_CODE = `// Fetch on demand — imperative, no auto-fetch hooks
const data = await fetchCompound('aspirin')

// data.cid              → 2244
// data.molecularFormula  → 'C9H8O4'
// data.molecularWeight   → 180.16
// data.canonicalSmiles   → 'CC(=O)OC1=CC=...'
// data.inchiKey          → 'BSYNRYMUTXBXSQ-...'`;

const TOOLS_CODE = `molarMass('C6H12O6')     // → 180.156
massComposition('H2O')   // → { H: 11.19, O: 88.81 }
massToMoles(36, 'H2O')   // → 1.998
molesToParticles(1)       // → 6.022e+23

// Equation balancing runs in LuaJIT via RPC:
const rxn = useReaction('Fe2O3 + CO -> Fe + CO2')
// rxn.balanced → 'Fe2O3 + 3CO -> 2Fe + 3CO2'`;

// ── Hoisted data arrays ─────────────────────────────────

const DEMO_FORMULAS = ['H2O', 'CO2', 'C6H12O6', 'C8H10N4O2', 'NaCl', 'CH4', 'NH3', 'C2H5OH', 'H2SO4', 'C6H6'];

const DEMO_REACTIONS = [
  'H2 + O2 -> H2O',
  'CH4 + O2 -> CO2 + H2O',
  'N2 + H2 -> NH3',
  'Fe2O3 + CO -> Fe + CO2',
  'C3H8 + O2 -> CO2 + H2O',
  'CaCO3 -> CaO + CO2',
];

const REAGENT_TYPES: ReagentType[] = ['marquis', 'mecke', 'mandelin', 'simons', 'ehrlich'];
const REAGENT_COMPOUNDS = ['MDMA', 'Amphetamine', 'Methamphetamine', 'LSD', 'Heroin', 'Cocaine', 'Psilocybin', 'DMT', 'Caffeine'];

const FEATURES = [
  { label: 'PeriodicTable', desc: 'Interactive 118-element table with color modes', color: P.blue },
  { label: 'ElementCard', desc: 'Detail card for any element by number or symbol', color: P.teal },
  { label: 'ElectronShell', desc: 'Electron shell diagram visualization', color: P.mauve },
  { label: 'MoleculeCard', desc: 'Compound info card — formula, mass, geometry', color: P.green },
  { label: 'ReactionView', desc: 'Balanced equation display with type + enthalpy', color: P.yellow },
  { label: 'ReagentTest', desc: 'Lua 60fps reagent spot test animation', color: P.pink },
  { label: 'SpectrumView', desc: 'IR / UV-Vis / Mass Spec plot (Lua painter)', color: P.peach },
  { label: 'PhaseDiagram', desc: 'P-T phase diagram with triple/critical points', color: P.red },
  { label: 'fetchCompound', desc: 'Imperative PubChem REST API lookup', color: P.blue },
  { label: 'useElement / useMolecule', desc: 'Element lookup + RPC-backed molecule hook', color: P.teal },
  { label: 'useReaction', desc: 'RPC to Lua balancer — LuaJIT coefficient search', color: P.mauve },
  { label: 'molarMass / massComposition', desc: 'Formula parsing + mass calculations', color: P.green },
  { label: 'massToMoles / molesToParticles', desc: 'Stoichiometry unit conversions', color: P.pink },
  { label: 'electronConfig / valenceElectrons', desc: 'Electron configuration utilities', color: P.peach },
  { label: 'bondCharacter', desc: 'Electronegativity diff → ionic/polar/nonpolar', color: P.red },
  { label: 'Chemistry conversions', desc: 'mol, M, amu, pH, spectroscopy units → @reactjit/convert', color: P.blue },
];

// ── Live Demo: Periodic Table ────────────────────────────

function PeriodicTableDemo() {
  const c = useThemeColors();
  const [selected, setSelected] = useState<number | null>(null);
  const [colorBy, setColorBy] = useState<'category' | 'phase' | 'electronegativity'>('category');
  const el = useElement(selected ?? 1);

  return (
    <Box style={{ gap: 10, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {(['category', 'phase', 'electronegativity'] as const).map(mode => (
          <Pressable
            key={mode}
            onPress={() => setColorBy(mode)}
            style={{
              paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10,
              borderRadius: 4,
              backgroundColor: colorBy === mode ? P.accent : c.surface,
            }}
          >
            <Text style={{ fontSize: 10, color: colorBy === mode ? '#000' : c.text }}>{mode}</Text>
          </Pressable>
        ))}
      </Box>

      <PeriodicTable
        onSelect={(el) => setSelected(el.number)}
        selected={selected}
        colorBy={colorBy}
        compact
      />

      {el && (
        <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <ElementCard element={el.number} style={{ flexGrow: 1 }} />
          <ElectronShell element={el.number} />
        </Box>
      )}
    </Box>
  );
}

// ── Live Demo: Element Lookup ────────────────────────────

function ElementDemo() {
  const c = useThemeColors();
  const [num, setNum] = useState(26);
  const el = useElement(num);

  const elements = useMemo(() => [
    { n: 1, sym: 'H' }, { n: 6, sym: 'C' }, { n: 7, sym: 'N' },
    { n: 8, sym: 'O' }, { n: 26, sym: 'Fe' }, { n: 29, sym: 'Cu' },
    { n: 47, sym: 'Ag' }, { n: 79, sym: 'Au' }, { n: 92, sym: 'U' },
  ], []);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {elements.map(e => (
          <Pressable
            key={e.n}
            onPress={() => setNum(e.n)}
            style={{
              paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8,
              borderRadius: 4,
              backgroundColor: num === e.n ? P.accent : c.surface,
            }}
          >
            <Text style={{ fontSize: 10, color: num === e.n ? '#000' : c.text }}>{e.sym}</Text>
          </Pressable>
        ))}
      </Box>

      {el && (
        <>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: el.cpkColor }} />
            <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>
              {`${el.number} ${el.symbol} — ${el.name}`}
            </Text>
          </Box>
          <Box style={{ gap: 2 }}>
            {[
              { k: 'Mass', v: `${el.mass} u`, color: P.blue },
              { k: 'Category', v: el.category, color: P.teal },
              { k: 'Phase', v: el.phase, color: P.green },
              { k: 'Electron Config', v: el.electronConfig, color: P.mauve },
              { k: 'Electronegativity', v: el.electronegativity !== null ? `${el.electronegativity}` : 'N/A', color: P.yellow },
              { k: 'Melting Point', v: el.meltingPoint !== null ? `${el.meltingPoint} K` : 'N/A', color: P.peach },
            ].map(row => (
              <Box key={row.k} style={{ flexDirection: 'row', gap: 6, alignItems: 'start' }}>
                <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: row.color, marginTop: 3, flexShrink: 0 }} />
                <Text style={{ fontSize: 9, color: c.muted, width: 90, flexShrink: 0 }}>{row.k}</Text>
                <Text style={{ fontSize: 9, color: c.text }}>{row.v}</Text>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Live Demo: Molecules ─────────────────────────────────

function MoleculesDemo() {
  const c = useThemeColors();
  const [formula, setFormula] = useState('H2O');
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return COMPOUNDS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.formula.toLowerCase().includes(q) ||
      (c.iupac && c.iupac.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [search]);

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <TextInput
        placeholder="Search compounds (water, glucose...)"
        value={search}
        onChangeText={setSearch}
        style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
      />

      {results.length > 0 && (
        <Box style={{ gap: 3 }}>
          {results.map(r => (
            <Pressable key={r.formula} onPress={() => { setFormula(r.formula); setSearch(''); }}>
              <Box style={{ flexDirection: 'row', gap: 6, padding: 4, backgroundColor: c.surface, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, color: P.accent, fontWeight: 'bold' }}>{r.formula}</Text>
                <Text style={{ fontSize: 10, color: c.muted }}>{r.name}</Text>
              </Box>
            </Pressable>
          ))}
        </Box>
      )}

      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {DEMO_FORMULAS.map(f => (
          <Pressable
            key={f}
            onPress={() => setFormula(f)}
            style={{
              paddingTop: 3, paddingBottom: 3, paddingLeft: 7, paddingRight: 7,
              borderRadius: 4,
              backgroundColor: formula === f ? P.accent : c.surface,
            }}
          >
            <Text style={{ fontSize: 9, color: formula === f ? '#000' : c.text }}>{f}</Text>
          </Pressable>
        ))}
      </Box>

      <MoleculeCard formula={formula} />
    </Box>
  );
}

// ── Live Demo: Reactions ─────────────────────────────────

function ReactionsDemo() {
  const c = useThemeColors();
  const [customEq, setCustomEq] = useState('');
  const [equations, setEquations] = useState(DEMO_REACTIONS.slice(0, 3));

  const addEquation = useCallback(() => {
    if (customEq.trim()) {
      setEquations(prev => [customEq.trim(), ...prev]);
      setCustomEq('');
    }
  }, [customEq]);

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput
          placeholder="H2 + O2 -> H2O"
          value={customEq}
          onChangeText={setCustomEq}
          onSubmit={addEquation}
          style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
        />
        <Pressable onPress={addEquation}>
          <Box style={{ backgroundColor: P.accent, borderRadius: 6, paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14 }}>
            <Text style={{ fontSize: 11, color: '#000' }}>{'Balance'}</Text>
          </Box>
        </Pressable>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
        {DEMO_REACTIONS.map(eq => (
          <Pressable
            key={eq}
            onPress={() => setEquations(prev => prev.includes(eq) ? prev : [eq, ...prev])}
            style={{ paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 3, backgroundColor: c.surface }}
          >
            <Text style={{ fontSize: 8, color: c.muted }}>{eq}</Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ gap: 6 }}>
        {equations.slice(0, 4).map((eq, i) => (
          <ReactionView key={`${eq}-${i}`} equation={eq} />
        ))}
      </Box>
    </Box>
  );
}

// ── Live Demo: Reagent Tests ─────────────────────────────

function ReagentsDemo() {
  const c = useThemeColors();
  const [compound, setCompound] = useState('MDMA');
  const [lastResult, setLastResult] = useState('');
  const [infoReagent, setInfoReagent] = useState<ReagentType>('marquis');

  return (
    <Box style={{ gap: 10, width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>
        {'Color-change presumptive tests. Stack multiple reagents for higher confidence.'}
      </Text>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: c.muted }}>{'Sample compound'}</Text>
        <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {REAGENT_COMPOUNDS.map(cmp => (
            <Pressable
              key={cmp}
              onPress={() => setCompound(cmp)}
              style={{
                paddingTop: 3, paddingBottom: 3, paddingLeft: 7, paddingRight: 7,
                borderRadius: 4,
                backgroundColor: compound === cmp ? P.accent : c.surface,
              }}
            >
              <Text style={{ fontSize: 10, color: compound === cmp ? '#000' : c.text }}>{cmp}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {REAGENT_TYPES.map(r => (
          <Box key={r} style={{ alignItems: 'center', gap: 4 }}>
            <ReagentTest
              type={r}
              sample={compound}
              speed={1.5}
              onReactionComplete={(e) => setLastResult(`${r}: ${(e as any).description}`)}
              style={{ width: 80, height: 100 }}
            />
          </Box>
        ))}
      </Box>

      {lastResult !== '' && (
        <Box style={{ backgroundColor: c.surface, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 10, color: c.text }}>{lastResult}</Text>
        </Box>
      )}

      <Box style={{ gap: 4 }}>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          {REAGENT_TYPES.map(r => (
            <Pressable key={r} onPress={() => setInfoReagent(r)}>
              <Box style={{
                paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6,
                borderRadius: 3,
                backgroundColor: infoReagent === r ? P.accent : c.surface,
              }}>
                <Text style={{ fontSize: 9, color: infoReagent === r ? '#000' : c.text }}>
                  {REAGENT_INFO[r].name}
                </Text>
              </Box>
            </Pressable>
          ))}
        </Box>
        <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, gap: 3 }}>
          <Text style={{ fontSize: 11, color: c.text, fontWeight: 'bold' }}>{REAGENT_INFO[infoReagent].name}</Text>
          <Text style={{ fontSize: 9, color: P.teal }}>{REAGENT_INFO[infoReagent].formula}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{REAGENT_INFO[infoReagent].description}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ── Live Demo: Spectrometry ──────────────────────────────

const SPEC_COMPOUNDS: Record<string, string[]> = {
  'ir': ['H2O', 'C2H5OH', 'C3H6O'],
  'uv-vis': ['C6H6'],
  'mass-spec': ['C8H10N4O2'],
};

function SpectraDemo() {
  const c = useThemeColors();
  const [specType, setSpecType] = useState<'ir' | 'uv-vis' | 'mass-spec'>('ir');
  const [compound, setCompound] = useState('C2H5OH');

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {(['ir', 'uv-vis', 'mass-spec'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => { setSpecType(t); setCompound(SPEC_COMPOUNDS[t][0] ?? ''); }}
            style={{
              paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10,
              borderRadius: 4,
              backgroundColor: specType === t ? P.accent : c.surface,
            }}
          >
            <Text style={{ fontSize: 10, color: specType === t ? '#000' : c.text }}>
              {t === 'ir' ? 'IR' : t === 'uv-vis' ? 'UV-Vis' : 'Mass Spec'}
            </Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {(SPEC_COMPOUNDS[specType] ?? []).map(cmp => (
          <Pressable
            key={cmp}
            onPress={() => setCompound(cmp)}
            style={{
              paddingTop: 3, paddingBottom: 3, paddingLeft: 7, paddingRight: 7,
              borderRadius: 4,
              backgroundColor: compound === cmp ? P.accent : c.surface,
            }}
          >
            <Text style={{ fontSize: 9, color: compound === cmp ? '#000' : c.text }}>{cmp}</Text>
          </Pressable>
        ))}
      </Box>

      <SpectrumView spectrumType={specType} compound={compound} style={{ height: 260 }} />
    </Box>
  );
}

// ── Live Demo: Phase Diagrams ────────────────────────────

function PhaseDiagramDemo() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>
        {'Pressure-temperature phase diagrams with triple and critical points. Rendered by Lua at 60fps.'}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 12 }}>
        <Box style={{ flexGrow: 1 }}>
          <PhaseDiagram compound="H2O" style={{ height: 240 }} />
        </Box>
        <Box style={{ flexGrow: 1 }}>
          <PhaseDiagram compound="CO2" style={{ height: 240 }} />
        </Box>
      </Box>
    </Box>
  );
}

// ── Live Demo: PubChem API ───────────────────────────────

function PubChemDemo() {
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<PubChemCompound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    fetchCompound(query.trim()).then(result => {
      setData(result);
      setLoading(false);
      if (!result) setError('Compound not found');
    }).catch(err => {
      setError(String(err));
      setLoading(false);
    });
  }, [query]);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput
          placeholder="aspirin, caffeine, CID 2244..."
          value={query}
          onChangeText={setQuery}
          onSubmit={handleSearch}
          style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
        />
        <Pressable onPress={handleSearch}>
          <Box style={{ backgroundColor: P.accent, borderRadius: 6, paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14 }}>
            <Text style={{ fontSize: 11, color: '#000' }}>{'Fetch'}</Text>
          </Box>
        </Pressable>
      </Box>
      {loading && <Text style={{ fontSize: 10, color: c.muted }}>{'Loading from PubChem...'}</Text>}
      {error && <Text style={{ fontSize: 10, color: P.red }}>{error}</Text>}
      {data && (
        <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, gap: 4 }}>
          <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>
            {`CID ${data.cid}: ${data.iupacName ?? query}`}
          </Text>
          <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {data.molecularFormula && (
              <Box style={{ gap: 1 }}>
                <Text style={{ fontSize: 8, color: c.muted }}>{'Formula'}</Text>
                <Text style={{ fontSize: 11, color: P.blue }}>{data.molecularFormula}</Text>
              </Box>
            )}
            {data.molecularWeight && (
              <Box style={{ gap: 1 }}>
                <Text style={{ fontSize: 8, color: c.muted }}>{'MW'}</Text>
                <Text style={{ fontSize: 11, color: P.teal }}>{`${data.molecularWeight} g/mol`}</Text>
              </Box>
            )}
            {data.canonicalSmiles && (
              <Box style={{ gap: 1 }}>
                <Text style={{ fontSize: 8, color: c.muted }}>{'SMILES'}</Text>
                <Text style={{ fontSize: 9, color: c.text }}>{data.canonicalSmiles}</Text>
              </Box>
            )}
            {data.xlogp !== undefined && (
              <Box style={{ gap: 1 }}>
                <Text style={{ fontSize: 8, color: c.muted }}>{'XLogP'}</Text>
                <Text style={{ fontSize: 11, color: P.mauve }}>{`${data.xlogp}`}</Text>
              </Box>
            )}
          </Box>
          {data.inchiKey && (
            <Text style={{ fontSize: 8, color: c.muted }}>{`InChIKey: ${data.inchiKey}`}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Live Demo: Molar Mass Calculator ─────────────────────

function ToolsDemo() {
  const c = useThemeColors();
  const [formula, setFormula] = useState('H2O');
  const [mass, setMass] = useState('18');

  const mm = useMemo(() => molarMass(formula), [formula]);
  const composition = useMemo(() => massComposition(formula), [formula]);
  const massNum = parseFloat(mass) || 0;
  const moles = useMemo(() => massToMoles(massNum, formula), [massNum, formula]);
  const particles = useMemo(() => molesToParticles(moles), [moles]);

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: c.muted }}>{'Formula'}</Text>
        <TextInput
          placeholder="C6H12O6"
          value={formula}
          onChangeText={setFormula}
          style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
        />
        <Text style={{ fontSize: 14, color: P.accent }}>{`${mm} g/mol`}</Text>
        <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(composition).map(([sym, pct]) => (
            <Text key={sym} style={{ fontSize: 10, color: c.muted }}>{`${sym}: ${pct}%`}</Text>
          ))}
        </Box>
      </Box>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: c.muted }}>{`Mass (g) of ${formula}`}</Text>
        <TextInput
          placeholder="18"
          value={mass}
          onChangeText={setMass}
          style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
        />
        <Box style={{ flexDirection: 'row', gap: 16 }}>
          <Box style={{ gap: 1 }}>
            <Text style={{ fontSize: 8, color: c.muted }}>{'Moles'}</Text>
            <Text style={{ fontSize: 12, color: P.blue }}>{moles.toFixed(6)}</Text>
          </Box>
          <Box style={{ gap: 1 }}>
            <Text style={{ fontSize: 8, color: c.muted }}>{'Particles'}</Text>
            <Text style={{ fontSize: 12, color: P.teal }}>{particles.toExponential(4)}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Feature Catalog ──────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {FEATURES.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 150, flexShrink: 0 }}>{f.label}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{f.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Constants Reference ──────────────────────────────────

function ConstantsReference() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {Object.entries(CONSTANTS).map(([name, value]) => (
        <Box key={name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 9, color: c.muted }}>{name.replace(/_/g, ' ')}</Text>
          <Text style={{ fontSize: 9, color: c.text }}>
            {typeof value === 'number' && value < 0.001 ? value.toExponential(6) : `${value}`}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ── ChemistryStory ───────────────────────────────────────

export function ChemistryStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="beaker" style={{ width: 18, height: 18 }} tintColor={P.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>{'Chemistry'}</Text>
        <Box style={{
          backgroundColor: P.accentDim,
          borderRadius: 4,
          paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
        }}>
          <Text style={{ color: P.accent, fontSize: 10 }}>{'@reactjit/chemistry'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>{'118 elements and counting'}</Text>
      </Box>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: P.accent,
          paddingLeft: 25, paddingRight: 28, paddingTop: 24, paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Periodic table, molecules, reactions, spectra, reagent tests — all in one package.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'118 elements with full data, 35+ common compounds, equation balancing via LuaJIT RPC, molar mass, stoichiometry conversions, electron configurations, and bond analysis. Reagent spot tests, IR/UV-Vis/Mass spectra, and phase diagrams render at 60fps via Lua capabilities. PubChem REST API for live compound lookups.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Widgets, hooks, utilities, and Lua capabilities — one import. PeriodicTable, ElementCard, and MoleculeCard are React-rendered. ReagentTest, SpectrumView, and PhaseDiagram are 60fps Lua painters.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width: PERIODIC TABLE ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 10 }}>
          <SectionLabel icon="grid" accentColor={P.blue}>{'PERIODIC TABLE'}</SectionLabel>
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Interactive 118-element table with three color modes. Click any element for its detail card and electron shell diagram. All element data sourced from IUPAC 2024 + PubChem.'}
          </Text>
          <PeriodicTableDemo />
        </Box>

        <Divider />

        {/* ── Band 2: demo | text+code — ELEMENTS ── */}
        <Band>
          <Half>
            <ElementDemo />
          </Half>
          <Half>
            <SectionLabel icon="atom" accentColor={P.teal}>{'ELEMENT LOOKUP'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useElement() returns the full Element record by atomic number or symbol. Mass, category, phase, electron configuration, shells, CPK color, melting/boiling points, density, electronegativity — everything.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={ELEMENT_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: text+code | demo — MOLECULES ── */}
        <Band>
          <Half>
            <SectionLabel icon="hexagon" accentColor={P.green}>{'MOLECULES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'35+ common compounds with name, IUPAC, geometry, polarity, and bond data. MoleculeCard renders a detail view for any formula. searchCompounds() finds compounds by name, formula, or IUPAC name.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={MOLECULE_CODE} />
          </Half>
          <Half>
            <MoleculesDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 4: demo | text+code — REACTIONS ── */}
        <Band>
          <Half>
            <ReactionsDemo />
          </Half>
          <Half>
            <SectionLabel icon="git-merge" accentColor={P.yellow}>{'REACTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Equation balancing runs in LuaJIT via chemistry:balance RPC — zero frame lag on every keystroke. Classifies reactions as combustion, synthesis, decomposition, single/double replacement. Enthalpy lookup for common reactions.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Type any unbalanced equation — use -> or => or = as the arrow. ReactionView renders the balanced equation with coefficients, reaction type, and enthalpy when available.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={REACTION_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: pure TS ── */}
        <CalloutBand borderColor={P.calloutBorder} bgColor={P.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={P.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Element lookups and stoichiometry run in TypeScript. Equation balancing and molecule building are LuaJIT RPCs — no frame lag when users type formulas interactively. The 118-element dataset is 15KB gzipped.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Full-width: REAGENT TESTS ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 10 }}>
          <SectionLabel icon="droplet" accentColor={P.pink}>{'REAGENT SPOT TESTS'}</SectionLabel>
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Animated color-change presumptive tests rendered at 60fps by Lua. 8 reagent types (Marquis, Mecke, Mandelin, Simon\'s, Ehrlich, Liebermann, Froehde, Gallic Acid) across 12+ compounds. Each test includes reaction mechanisms and functional group explanations.'}
          </Text>
          <ReagentsDemo />
        </Box>

        <Divider />

        {/* ── Band 5: text+code | demo — SPECTROMETRY ── */}
        <Band>
          <Half>
            <SectionLabel icon="activity" accentColor={P.peach}>{'SPECTROMETRY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'IR, UV-Vis, and Mass Spec plots rendered at 60fps by Lua. Peak data includes labels and structural assignments. IR absorption reference table for functional group identification.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'SpectrumView renders peaks, axes, and labels. PhaseDiagram renders pressure-temperature plots with solid/liquid/gas regions, triple point, and critical point.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={SPECTRA_CODE} />
          </Half>
          <Half>
            <SpectraDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width: PHASE DIAGRAMS ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 10 }}>
          <SectionLabel icon="thermometer" accentColor={P.red}>{'PHASE DIAGRAMS'}</SectionLabel>
          <PhaseDiagramDemo />
        </Box>

        <Divider />

        {/* ── Callout: Lua capabilities ── */}
        <CalloutBand borderColor={P.calloutBorder} bgColor={P.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={P.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'ReagentTest, SpectrumView, and PhaseDiagram are Lua capabilities — 60fps painters with smooth animations, not React re-renders. The React component is a one-liner declarative wrapper.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Band 6: text+code | demo — PUBCHEM API ── */}
        <Band>
          <Half>
            <SectionLabel icon="globe" accentColor={P.blue}>{'PUBCHEM LIVE API'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Live REST API lookups against PubChem — the world\'s largest free chemistry database. Returns IUPAC name, formula, molecular weight, SMILES, InChI, XLogP, H-bond donors/acceptors, and more. No API key required.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Also includes fetchSynonyms, fetchDescription, and fetchHazards. All are plain async functions — call them on user action, not on render. Rate limit: 5 requests/second.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={PUBCHEM_CODE} />
          </Half>
          <Half>
            <PubChemDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 7: demo | text+code — TOOLS ── */}
        <Band>
          <Half>
            <ToolsDemo />
          </Half>
          <Half>
            <SectionLabel icon="calculator" accentColor={P.mauve}>{'STOICHIOMETRY TOOLS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Molar mass calculator, mass composition, mass/moles/particles conversions, ideal gas law, molarity, and dilution. All functions accept formulas as strings and parse them automatically.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Chemistry-specific unit conversions (mol, M, amu, pH, spectroscopy wavelength/frequency) are auto-registered into @reactjit/convert on import.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={TOOLS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width: PHYSICAL CONSTANTS ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 8 }}>
          <SectionLabel icon="database" accentColor={P.peach}>{'PHYSICAL CONSTANTS'}</SectionLabel>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'CONSTANTS object — all values from CODATA 2018:'}</Text>
          <ConstantsReference />
        </Box>

        <Divider />

        {/* ── Full-width: FEATURE CATALOG ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 8 }}>
          <SectionLabel icon="list" accentColor={P.green}>{'EXPORT CATALOG'}</SectionLabel>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Everything @reactjit/chemistry exposes:'}</Text>
          <FeatureCatalog />
        </Box>

        <Divider />

        {/* ── Callout: one-liner philosophy ── */}
        <CalloutBand borderColor={P.calloutBorder} bgColor={P.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={P.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'One import. One hook. Declare what you need in JSX and the framework does the rest — element data is a lookup, molecules parse from formula strings, equations auto-balance, and Lua renders spectra at 60fps.'}
          </Text>
        </CalloutBand>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="beaker" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Chemistry'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
