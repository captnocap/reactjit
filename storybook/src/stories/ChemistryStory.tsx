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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, TextInput, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  PeriodicTable, ElementCard, MoleculeCard, ElectronShell, ReactionView,
  ReagentTest, SpectrumView, PhaseDiagram, BohrModel, StructureView,
  ChemFormula, ChemEquation, IsoNotation, ChemFig,
  useElement, useMolecule, useReaction, useChemCompute,
  COMPOUNDS, ELEMENTS, REAGENT_INFO,
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
  PeriodicTable, ElementTile, ElementCard, MoleculeCard,
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

const BOHR_CODE = `<BohrModel element={26} />
<BohrModel element="Fe" animated speed={2} />
<BohrModel element={6} showLabel={false} />

// Renders animated 3D Bohr model:
//   - Tilted orbital ellipses per shell
//   - Orbiting electrons with glow
//   - CPK-colored nucleus
//   - All computation in Lua at 60fps`;

const STRUCTURE_CODE = `<StructureView smiles="c1ccccc1" />
<StructureView smiles="CC(=O)O" showLabels />
<StructureView smiles="CCO" showHydrogens />

// Uses Indigo C library (FFI):
//   - SMILES → 2D coordinate layout
//   - CPK-colored atoms + bond rendering
//   - Double/triple/aromatic bonds
//   - Parsed once, rendered at 60fps`;

const NOTATION_CODE = `// mhchem \\ce{} — proper subscripts, charges, arrows
<ChemFormula formula="H2SO4" />
<ChemFormula formula="Ca(OH)2" />
<ChemFormula formula="SO4^{2-}" fontSize={18} />

// Full equations with balanced notation
<ChemEquation equation="2H2 + O2 -> 2H2O" />
<ChemEquation equation="N2 + 3H2 <=> 2NH3" />
<ChemEquation equation="CH4 + 2O2 -> CO2 + 2H2O(g)" />

// Isotope notation: ²³⁵U₉₂
<IsoNotation symbol="U" mass={235} atomic={92} />
<IsoNotation symbol="C" mass={14} />

// Linear structural formulas via \\chemfig{}
<ChemFig formula="H-O-H" />
<ChemFig formula="H-C#N" />`;

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

const DEMO_SMILES = [
  { label: 'Benzene', smiles: 'c1ccccc1' },
  { label: 'Ethanol', smiles: 'CCO' },
  { label: 'Acetic acid', smiles: 'CC(=O)O' },
  { label: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  { label: 'Caffeine', smiles: 'Cn1c(=O)c2c(ncn2C)n(C)c1=O' },
  { label: 'Glucose', smiles: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O' },
  { label: 'Dopamine', smiles: 'NCCc1ccc(O)c(O)c1' },
  { label: 'TNT', smiles: 'Cc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]' },
];

const BOHR_ELEMENTS = [
  { n: 1, sym: 'H' }, { n: 2, sym: 'He' }, { n: 6, sym: 'C' },
  { n: 8, sym: 'O' }, { n: 11, sym: 'Na' }, { n: 17, sym: 'Cl' },
  { n: 26, sym: 'Fe' }, { n: 29, sym: 'Cu' }, { n: 47, sym: 'Ag' },
  { n: 79, sym: 'Au' }, { n: 92, sym: 'U' },
];

const FEATURES = [
  { label: 'PeriodicTable', desc: 'Grid of 118 ElementTiles in standard periodic table layout', color: P.blue },
  { label: 'ElementTile', desc: 'Periodic table tile with click-to-flip properties', color: P.teal },
  { label: 'ElementCard', desc: 'Full element detail card — all properties at a glance', color: P.green },
  { label: 'ElectronShell', desc: 'Electron shell diagram visualization', color: P.mauve },
  { label: 'MoleculeCard', desc: 'Compound info card — formula, mass, geometry', color: P.green },
  { label: 'ReactionView', desc: 'Balanced equation display with type + enthalpy', color: P.yellow },
  { label: 'ReagentTest', desc: 'Lua 60fps reagent spot test animation', color: P.pink },
  { label: 'SpectrumView', desc: 'IR / UV-Vis / Mass Spec plot (Lua painter)', color: P.peach },
  { label: 'PhaseDiagram', desc: 'P-T phase diagram with triple/critical points', color: P.red },
  { label: 'BohrModel', desc: 'Animated 3D Bohr model — tilted orbits, electron animation', color: P.mauve },
  { label: 'StructureView', desc: '2D molecular structure from SMILES via Indigo FFI', color: P.peach },
  { label: 'fetchCompound', desc: 'Imperative PubChem REST API lookup', color: P.blue },
  { label: 'useElement / useMolecule', desc: 'Element lookup + RPC-backed molecule hook', color: P.teal },
  { label: 'useReaction', desc: 'RPC to Lua balancer — LuaJIT coefficient search', color: P.mauve },
  { label: 'molarMass / massComposition', desc: 'Formula parsing + mass calculations', color: P.green },
  { label: 'massToMoles / molesToParticles', desc: 'Stoichiometry unit conversions', color: P.pink },
  { label: 'electronConfig / valenceElectrons', desc: 'Electron configuration utilities', color: P.peach },
  { label: 'bondCharacter', desc: 'Electronegativity diff → ionic/polar/nonpolar', color: P.red },
  { label: 'Chemistry conversions', desc: 'mol, M, amu, pH, spectroscopy units → @reactjit/convert', color: P.blue },
  { label: 'ChemFormula', desc: 'mhchem \\ce{} — subscripts, ionic charges, state symbols', color: P.teal },
  { label: 'ChemEquation', desc: 'Balanced equations with →, ⇌, ↔ arrows via \\ce{}', color: P.teal },
  { label: 'IsoNotation', desc: 'Nuclear isotope notation: ²³⁵₉₂U', color: P.teal },
  { label: 'ChemFig', desc: 'Linear structural formulas with bond symbols (-, =, ≡)', color: P.teal },
];

// ── Live Demo: Periodic Table ────────────────────────────

function PeriodicTableDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const el = useElement(selected ?? 1);

  return (
    <Box style={{ gap: 10, width: '100%' }}>
      <PeriodicTable
        onSelect={(el) => setSelected(el.number)}
        selected={selected}
        tileSize={32}
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
                <S.StoryBreadcrumbActive>{row.v}</S.StoryBreadcrumbActive>
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
                <ChemFormula formula={r.formula} fontSize={10} color={P.accent} />
                <S.StoryMuted>{r.name}</S.StoryMuted>
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
            <ChemFormula formula={f} fontSize={9} color={formula === f ? '#000' : c.text} />
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
            <ChemEquation equation={eq} fontSize={8} color={c.muted} />
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
      <S.StoryCap>
        {'Color-change presumptive tests. Stack multiple reagents for higher confidence.'}
      </S.StoryCap>

      <Box style={{ gap: 4 }}>
        <S.StoryCap>{'Sample compound'}</S.StoryCap>
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

      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
        {REAGENT_TYPES.map(r => (
          <Box key={r} style={{ alignItems: 'center', gap: 4 }}>
            <ReagentTest
              type={r}
              sample={compound}
              onReactionComplete={(e) => setLastResult(`${r}: ${(e as any).description}`)}
              style={{ width: 104, height: 148 }}
            />
          </Box>
        ))}
      </Box>

      {lastResult !== '' && (
        <S.StoryInputWell>
          <Text style={{ fontSize: 10, color: c.text }}>{lastResult}</Text>
        </S.StoryInputWell>
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
          <ChemFormula formula={REAGENT_INFO[infoReagent].formula} fontSize={9} color={P.teal} />
          <S.StoryCap>{REAGENT_INFO[infoReagent].description}</S.StoryCap>
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
            <ChemFormula formula={cmp} fontSize={9} color={compound === cmp ? '#000' : c.text} />
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
      <S.StoryCap>
        {'Pressure-temperature phase diagrams with triple and critical points. Rendered by Lua at 60fps.'}
      </S.StoryCap>
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
      {loading && <S.StoryMuted>{'Loading from PubChem...'}</S.StoryMuted>}
      {error && <Text style={{ fontSize: 10, color: P.red }}>{error}</Text>}
      {data && (
        <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, gap: 4 }}>
          <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>
            {`CID ${data.cid}: ${data.iupacName ?? query}`}
          </Text>
          <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {data.molecularFormula && (
              <Box style={{ gap: 1 }}>
                <S.StoryTiny>{'Formula'}</S.StoryTiny>
                <ChemFormula formula={data.molecularFormula} fontSize={11} color={P.blue} />
              </Box>
            )}
            {data.molecularWeight && (
              <Box style={{ gap: 1 }}>
                <S.StoryTiny>{'MW'}</S.StoryTiny>
                <Text style={{ fontSize: 11, color: P.teal }}>{`${data.molecularWeight} g/mol`}</Text>
              </Box>
            )}
            {data.canonicalSmiles && (
              <Box style={{ gap: 1 }}>
                <S.StoryTiny>{'SMILES'}</S.StoryTiny>
                <S.StoryBreadcrumbActive>{data.canonicalSmiles}</S.StoryBreadcrumbActive>
              </Box>
            )}
            {data.xlogp !== undefined && (
              <Box style={{ gap: 1 }}>
                <S.StoryTiny>{'XLogP'}</S.StoryTiny>
                <Text style={{ fontSize: 11, color: P.mauve }}>{`${data.xlogp}`}</Text>
              </Box>
            )}
          </Box>
          {data.inchiKey && (
            <S.StoryTiny>{`InChIKey: ${data.inchiKey}`}</S.StoryTiny>
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
  const compute = useChemCompute();

  const [mm, setMm] = useState(0);
  const [composition, setComposition] = useState<Record<string, number>>({});
  const [moles, setMoles] = useState(0);
  const [particles, setParticles] = useState(0);

  const massNum = parseFloat(mass) || 0;

  useEffect(() => {
    compute({ method: 'molarMass', formula }).then(setMm).catch(() => {});
    compute({ method: 'massComposition', formula }).then(setComposition).catch(() => {});
  }, [formula]);

  useEffect(() => {
    compute({ method: 'massToMoles', mass: massNum, formula }).then(setMoles).catch(() => {});
  }, [massNum, formula]);

  useEffect(() => {
    compute({ method: 'molesToParticles', moles }).then(setParticles).catch(() => {});
  }, [moles]);

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Box style={{ gap: 4 }}>
        <S.StoryCap>{'Formula'}</S.StoryCap>
        <TextInput
          placeholder="C6H12O6"
          value={formula}
          onChangeText={setFormula}
          style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
        />
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <ChemFormula formula={formula} fontSize={14} color={P.accent} />
          <Text style={{ fontSize: 14, color: P.accent }}>{`= ${mm} g/mol`}</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(composition).map(([sym, pct]) => (
            <S.StoryMuted key={sym}>{`${sym}: ${pct}%`}</S.StoryMuted>
          ))}
        </Box>
      </Box>

      <Box style={{ gap: 4 }}>
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <S.StoryCap>{'Mass (g) of'}</S.StoryCap>
          <ChemFormula formula={formula} fontSize={9} color={c.muted} />
        </Box>
        <TextInput
          placeholder="18"
          value={mass}
          onChangeText={setMass}
          style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
        />
        <Box style={{ flexDirection: 'row', gap: 16 }}>
          <Box style={{ gap: 1 }}>
            <S.StoryTiny>{'Moles'}</S.StoryTiny>
            <Text style={{ fontSize: 12, color: P.blue }}>{moles.toFixed(6)}</Text>
          </Box>
          <Box style={{ gap: 1 }}>
            <S.StoryTiny>{'Particles'}</S.StoryTiny>
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
          <S.StoryCap>{f.desc}</S.StoryCap>
        </Box>
      ))}
    </Box>
  );
}

// ── Notation Demo ────────────────────────────────────────

const NOTATION_FORMULAS = [
  { label: 'Water', f: 'H2O' },
  { label: 'Sulfuric acid', f: 'H2SO4' },
  { label: 'Calcium hydroxide', f: 'Ca(OH)2' },
  { label: 'Sulfate ion', f: 'SO4^{2-}' },
  { label: 'Ammonium ion', f: 'NH4^+' },
  { label: 'Permanganate', f: 'KMnO4' },
  { label: 'Glucose', f: 'C6H12O6' },
  { label: 'Carbonate', f: 'CO3^{2-}' },
];

const NOTATION_EQUATIONS = [
  '2H2 + O2 -> 2H2O(g)',
  'CH4 + 2O2 -> CO2 + 2H2O',
  'N2 + 3H2 <=> 2NH3',
  'CaCO3 -> CaO + CO2',
  'CO2 + H2O <-> H2CO3',
  'Fe2O3 + 3CO -> 2Fe + 3CO2',
];

const NOTATION_ISOTOPES: Array<{ symbol: string; mass: number; atomic?: number; label: string }> = [
  { symbol: 'C', mass: 14, label: 'Carbon-14' },
  { symbol: 'U', mass: 235, atomic: 92, label: 'Uranium-235' },
  { symbol: 'H', mass: 3, atomic: 1, label: 'Tritium' },
  { symbol: 'Co', mass: 60, label: 'Cobalt-60' },
];

const NOTATION_STRUCTURES = [
  { label: 'Water', f: 'H-O-H' },
  { label: 'HCN', f: 'H-C#N' },
  { label: 'Ethane', f: 'H3C-CH3' },
  { label: 'Ethylene', f: 'H2C=CH2' },
  { label: 'CO2', f: 'O=C=O' },
];

function NotationDemo() {
  const c = useThemeColors();

  return (
    <Box style={{ gap: 20, width: '100%' }}>

      {/* Formulas */}
      <Box style={{ gap: 8 }}>
        <S.StoryMuted>{'Formulas — \\ce{...}'}</S.StoryMuted>
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {NOTATION_FORMULAS.map(({ label, f }) => (
            <Box key={f} style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
              gap: 4,
              alignItems: 'center',
            }}>
              <ChemFormula formula={f} fontSize={15} color={c.text} />
              <S.StoryTiny>{label}</S.StoryTiny>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Equations */}
      <Box style={{ gap: 8 }}>
        <S.StoryMuted>{'Equations — arrows, state symbols, equilibrium'}</S.StoryMuted>
        <Box style={{ gap: 6 }}>
          {NOTATION_EQUATIONS.map(eq => (
            <Box key={eq} style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12,
            }}>
              <ChemEquation equation={eq} fontSize={14} color={c.text} />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Isotopes */}
      <Box style={{ gap: 8 }}>
        <S.StoryMuted>{'Isotope notation — mass/atomic number'}</S.StoryMuted>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {NOTATION_ISOTOPES.map(({ symbol, mass, atomic, label }) => (
            <Box key={label} style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
              gap: 4,
              alignItems: 'center',
            }}>
              <IsoNotation symbol={symbol} mass={mass} atomic={atomic} fontSize={15} color={c.text} />
              <S.StoryTiny>{label}</S.StoryTiny>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ChemFig linear */}
      <Box style={{ gap: 8 }}>
        <S.StoryMuted>{'Structural formulas — \\chemfig{...} (linear chains)'}</S.StoryMuted>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {NOTATION_STRUCTURES.map(({ label, f }) => (
            <Box key={f} style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
              gap: 4,
              alignItems: 'center',
            }}>
              <ChemFig formula={f} fontSize={14} color={c.text} />
              <S.StoryTiny>{label}</S.StoryTiny>
            </Box>
          ))}
        </Box>
      </Box>

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
          <S.StoryCap>{name.replace(/_/g, ' ')}</S.StoryCap>
          <S.StoryBreadcrumbActive>
            {typeof value === 'number' && value < 0.001 ? value.toExponential(6) : `${value}`}
          </S.StoryBreadcrumbActive>
        </Box>
      ))}
    </Box>
  );
}

// ── Live Demo: Bohr Model ─────────────────────────────────

function BohrModelDemo() {
  const c = useThemeColors();
  const [element, setElement] = useState(26);

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {BOHR_ELEMENTS.map(e => (
          <Pressable
            key={e.n}
            onPress={() => setElement(e.n)}
            style={{
              paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8,
              borderRadius: 4,
              backgroundColor: element === e.n ? P.accent : c.surface,
            }}
          >
            <Text style={{ fontSize: 10, color: element === e.n ? '#000' : c.text }}>{e.sym}</Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ flexDirection: 'row', gap: 12 }}>
        <BohrModel element={element} speed={1.2} style={{ width: 200, height: 200 }} />
        <BohrModel element={element} speed={0.5} style={{ width: 140, height: 140 }} />
      </Box>
    </Box>
  );
}

// ── Live Demo: Structure View ─────────────────────────────

function StructureDemo() {
  const c = useThemeColors();
  const [smiles, setSmiles] = useState('c1ccccc1');
  const [custom, setCustom] = useState('');

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {DEMO_SMILES.map(s => (
          <Pressable
            key={s.smiles}
            onPress={() => setSmiles(s.smiles)}
            style={{
              paddingTop: 3, paddingBottom: 3, paddingLeft: 7, paddingRight: 7,
              borderRadius: 4,
              backgroundColor: smiles === s.smiles ? P.accent : c.surface,
            }}
          >
            <Text style={{ fontSize: 9, color: smiles === s.smiles ? '#000' : c.text }}>{s.label}</Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput
          placeholder="Enter SMILES..."
          value={custom}
          onChangeText={setCustom}
          onSubmit={() => { if (custom.trim()) setSmiles(custom.trim()); }}
          style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 6, padding: 8, fontSize: 11, color: c.text }}
        />
        <Pressable onPress={() => { if (custom.trim()) setSmiles(custom.trim()); }}>
          <Box style={{ backgroundColor: P.accent, borderRadius: 6, paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14 }}>
            <Text style={{ fontSize: 11, color: '#000' }}>{'Render'}</Text>
          </Box>
        </Pressable>
      </Box>

      <StructureView smiles={smiles} showLabels style={{ height: 260 }} />
    </Box>
  );
}

// ── ChemistryStory ───────────────────────────────────────

export function ChemistryStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

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
              {'Widgets, hooks, utilities, and Lua capabilities — one import. PeriodicTable, ElementTile, ElementCard, and MoleculeCard are React-rendered. ReagentTest, SpectrumView, and PhaseDiagram are 60fps Lua painters.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} style={{ width: '100%' }} />
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
            <CodeBlock language="tsx" fontSize={9} code={ELEMENT_CODE} style={{ width: '100%' }} />
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
            <CodeBlock language="tsx" fontSize={9} code={MOLECULE_CODE} style={{ width: '100%' }} />
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
            <CodeBlock language="tsx" fontSize={9} code={REACTION_CODE} style={{ width: '100%' }} />
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
            <CodeBlock language="tsx" fontSize={9} code={SPECTRA_CODE} style={{ width: '100%' }} />
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
            {'ReagentTest, SpectrumView, PhaseDiagram, BohrModel, and StructureView are Lua capabilities — 60fps painters with smooth animations, not React re-renders. The React component is a one-liner declarative wrapper.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Band: demo | text+code — BOHR MODEL ── */}
        <Band>
          <Half>
            <BohrModelDemo />
          </Half>
          <Half>
            <SectionLabel icon="atom" accentColor={P.mauve}>{'BOHR MODEL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Animated 3D Bohr model for any element (Z=1-118). Tilted orbital ellipses with orbiting electrons, CPK-colored nucleus, and element label. All animation runs in Lua — zero frame delay.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Each shell has a different tilt and rotation for the 3D perspective effect. Inner shells orbit faster. Electron count per shell uses actual shell occupancy data from IUPAC.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={BOHR_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width: STRUCTURE VIEW ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 10 }}>
          <SectionLabel icon="hexagon" accentColor={P.peach}>{'MOLECULAR STRUCTURE'}</SectionLabel>
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'2D structural formula rendering from SMILES strings. Uses the Indigo C library via LuaJIT FFI for SMILES parsing and 2D coordinate generation. Atoms are CPK-colored, bonds show single/double/triple/aromatic. Type any valid SMILES to see the structure.'}
          </Text>
          <StructureDemo />
          <CodeBlock language="tsx" fontSize={9} code={STRUCTURE_CODE} />
        </Box>

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
            <CodeBlock language="tsx" fontSize={9} code={PUBCHEM_CODE} style={{ width: '100%' }} />
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
            <CodeBlock language="tsx" fontSize={9} code={TOOLS_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width: CHEMISTRY NOTATION ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 10 }}>
          <SectionLabel icon="type" accentColor={P.teal}>{'CHEMISTRY NOTATION'}</SectionLabel>
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Proper chemical typesetting via the LaTeX renderer. Uses mhchem \\ce{} for formulas and equations: element subscripts, ionic charges, state symbols, and reaction arrows. \\chemfig{} for inline structural chain formulas with bond symbols.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 9 }}>
            {'The parser runs in Lua (latex_parser.lua) and extends the existing LaTeX math typesetter. No external library — same Love2D glyph renderer, same Latin Modern font.'}
          </Text>
          <NotationDemo />
          <CodeBlock language="tsx" fontSize={9} code={NOTATION_CODE} />
        </Box>

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

    </S.StoryRoot>
  );
}
