--[[
  indigo.lua — LuaJIT FFI bindings for the Indigo cheminformatics library

  Provides SMILES parsing, 2D coordinate generation, and molecular structure
  extraction for rendering. Used by capabilities/structure_view.lua.

  Indigo is a C library (libindigo.so) installed via apt. It handles:
    - SMILES/Molfile parsing → molecule handles
    - 2D coordinate layout (depiction coordinates)
    - Atom/bond iteration with XYZ coordinates
    - Molecular weight, gross formula, canonical SMILES

  Usage:
    local Indigo = require("lua.indigo")
    if Indigo.available then
      local geom = Indigo.parseAndExtract("CCO")
      -- geom.atoms = [{index=0, symbol="C", x=..., y=..., atomicNumber=6}, ...]
      -- geom.bonds = [{source=0, dest=1, order=1}, ...]
    end
]]

local ffi = require("ffi")
local loader = require("lua.lib_loader")

local M = {}

-- Try to load the Indigo shared library
local ok, indigo = pcall(loader.load, "indigo", {"/usr/lib/libindigo.so"})
if not ok then
  M.available = false
  return M
end

M.available = true

-- ============================================================================
-- FFI declarations
-- ============================================================================

ffi.cdef[[
  // Session management
  unsigned long long indigoAllocSessionId(void);
  void indigoSetSessionId(unsigned long long id);
  void indigoReleaseSessionId(unsigned long long id);

  // Error handling
  const char* indigoGetLastError(void);

  // Object management
  int indigoFree(int handle);
  int indigoFreeAllObjects(void);

  // Molecule loading (auto-detects SMILES, Molfile, etc.)
  int indigoLoadMoleculeFromString(const char* string);

  // Layout (compute 2D depiction coordinates)
  int indigoLayout(int object);

  // Atom access
  int indigoCountAtoms(int molecule);
  int indigoIterateAtoms(int molecule);
  int indigoNext(int iter);
  int indigoIndex(int item);
  const char* indigoSymbol(int atom);
  float* indigoXYZ(int atom);
  int indigoAtomicNumber(int atom);

  // Bond access
  int indigoCountBonds(int molecule);
  int indigoIterateBonds(int molecule);
  int indigoBondOrder(int bond);
  int indigoSource(int bond);
  int indigoDestination(int bond);

  // Properties
  float indigoMolecularWeight(int molecule);
  int indigoGrossFormula(int molecule);
  const char* indigoToString(int handle);
  const char* indigoCanonicalSmiles(int molecule);

  // Coordinate check
  int indigoHasCoord(int molecule);

  // Hydrogen handling
  int indigoFoldHydrogens(int item);
  int indigoUnfoldHydrogens(int item);

  // Options
  int indigoSetOption(const char* name, const char* value);
  int indigoSetOptionFloat(const char* name, float value);
  int indigoSetOptionInt(const char* name, int value);

  // Aromaticity
  int indigoAromatize(int item);
  int indigoDearomatize(int item);
]]

-- ============================================================================
-- Session management (one session, initialized on first use)
-- ============================================================================

local sessionActive = false

local function ensureSession()
  if sessionActive then return end
  local sid = indigo.indigoAllocSessionId()
  indigo.indigoSetSessionId(sid)
  sessionActive = true
end

function M.getLastError()
  local err = indigo.indigoGetLastError()
  if err ~= nil then
    return ffi.string(err)
  end
  return "unknown error"
end

-- ============================================================================
-- Main API: parse SMILES and extract geometry as plain Lua tables
-- ============================================================================

--- Parse a SMILES string, compute 2D layout, and extract atom/bond geometry.
--- Returns a table with atoms, bonds, formula, mass — or nil + error string.
--- @param smiles string  SMILES notation (e.g. "CCO", "c1ccccc1", "CC(=O)O")
--- @param foldH boolean  If true (default), fold explicit H atoms into implicit
--- @return table|nil geometry  { atoms={...}, bonds={...}, formula, mass }
--- @return string|nil error
function M.parseAndExtract(smiles, foldH)
  ensureSession()

  -- Load molecule from SMILES
  local mol = indigo.indigoLoadMoleculeFromString(smiles)
  if mol == -1 then
    return nil, M.getLastError()
  end

  -- Fold hydrogens for cleaner display (unless explicitly disabled)
  if foldH ~= false then
    indigo.indigoFoldHydrogens(mol)
  end

  -- Compute 2D depiction coordinates
  indigo.indigoLayout(mol)

  -- Extract atoms
  local atoms = {}
  local atomIter = indigo.indigoIterateAtoms(mol)
  if atomIter ~= -1 then
    while true do
      local atom = indigo.indigoNext(atomIter)
      if atom == 0 or atom == -1 then break end
      local sym = ffi.string(indigo.indigoSymbol(atom))
      local xyz = indigo.indigoXYZ(atom)
      local idx = indigo.indigoIndex(atom)
      local anum = indigo.indigoAtomicNumber(atom)
      atoms[idx] = {
        index = idx,
        symbol = sym,
        x = xyz[0],
        y = xyz[1],
        atomicNumber = anum,
      }
    end
    indigo.indigoFree(atomIter)
  end

  -- Extract bonds
  local bonds = {}
  local bondIter = indigo.indigoIterateBonds(mol)
  if bondIter ~= -1 then
    while true do
      local bond = indigo.indigoNext(bondIter)
      if bond == 0 or bond == -1 then break end
      local order = indigo.indigoBondOrder(bond)
      local src = indigo.indigoSource(bond)
      local dst = indigo.indigoDestination(bond)
      bonds[#bonds + 1] = {
        source = indigo.indigoIndex(src),
        dest = indigo.indigoIndex(dst),
        order = order, -- 1=single, 2=double, 3=triple, 4=aromatic
      }
    end
    indigo.indigoFree(bondIter)
  end

  -- Gross formula
  local formula = ""
  local fo = indigo.indigoGrossFormula(mol)
  if fo ~= -1 then
    local s = indigo.indigoToString(fo)
    if s ~= nil then formula = ffi.string(s) end
    indigo.indigoFree(fo)
  end

  -- Molecular weight
  local mass = indigo.indigoMolecularWeight(mol)
  if mass < 0 then mass = 0 end

  -- Canonical SMILES
  local canonical = ""
  local cs = indigo.indigoCanonicalSmiles(mol)
  if cs ~= nil then canonical = ffi.string(cs) end

  -- Clean up
  indigo.indigoFree(mol)

  return {
    atoms = atoms,
    bonds = bonds,
    formula = formula,
    mass = tonumber(mass) or 0,
    smiles = canonical,
  }
end

return M
