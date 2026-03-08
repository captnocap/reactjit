--[[
  lua/capabilities/chemistry.lua — Chemistry computation engine

  Non-visual capability. All heavy computation (formula parsing, equation
  balancing, molar mass, molecule building) runs here in LuaJIT — never
  in QuickJS. React reads results via RPC.

  RPC methods:
    chemistry:element   { key: number|string }  → element table
    chemistry:balance   { equation: string }     → { balanced, reactants, products, isBalanced, type, enthalpy }
    chemistry:molecule  { formula: string }      → { formula, name, atoms, molarMass, geometry, polarity, iupac }
    chemistry:formula   { formula: string }      → [{ symbol, count }]
    chemistry:elements  { category?, phase?, search? } → [element, ...]
    chemistry:reagent   { type, compound }       → { color, description, confidence }
]]

local Capabilities = require("lua.capabilities")

local M = {}

-- ============================================================================
-- Element data (118 elements, IUPAC 2024)
-- el(n, sym, name, mass, category, group, period, phase, electronegativity,
--    shells, cpkColor, meltingPoint, boilingPoint, density)
-- ============================================================================

local ELEMENTS = {}
local BY_SYMBOL = {}
local BY_ELEMENT_NAME = {}

local function el(n, sym, name, mass, cat, grp, per, phase, en, shells, cpk, mp, bp, dens)
  local e = {
    number = n, symbol = sym, name = name, mass = mass,
    category = cat, group = grp, period = per, phase = phase,
    electronegativity = en, shells = shells, cpkColor = cpk,
    meltingPoint = mp, boilingPoint = bp, density = dens,
  }
  ELEMENTS[n] = e
  BY_SYMBOL[sym] = e
  BY_ELEMENT_NAME[name:lower()] = e
end

el(1,  'H',  'Hydrogen',      1.008,   'nonmetal',              1, 1,'gas',   2.20,{1},              '#FFFFFF', 14.01,  20.28,  0.00008988)
el(2,  'He', 'Helium',        4.0026,  'noble-gas',            18, 1,'gas',   nil, {2},              '#D9FFFF', 0.95,   4.22,   0.0001785)
el(3,  'Li', 'Lithium',       6.941,   'alkali-metal',          1, 2,'solid', 0.98,{2,1},            '#CC80FF', 453.69, 1615,   0.534)
el(4,  'Be', 'Beryllium',     9.0122,  'alkaline-earth',        2, 2,'solid', 1.57,{2,2},            '#C2FF00', 1560,   2742,   1.85)
el(5,  'B',  'Boron',         10.81,   'metalloid',            13, 2,'solid', 2.04,{2,3},            '#FFB5B5', 2349,   4200,   2.34)
el(6,  'C',  'Carbon',        12.011,  'nonmetal',             14, 2,'solid', 2.55,{2,4},            '#909090', 3823,   4098,   2.267)
el(7,  'N',  'Nitrogen',      14.007,  'nonmetal',             15, 2,'gas',   3.04,{2,5},            '#3050F8', 63.15,  77.36,  0.0012506)
el(8,  'O',  'Oxygen',        15.999,  'nonmetal',             16, 2,'gas',   3.44,{2,6},            '#FF0D0D', 54.36,  90.20,  0.001429)
el(9,  'F',  'Fluorine',      18.998,  'halogen',              17, 2,'gas',   3.98,{2,7},            '#90E050', 53.53,  85.03,  0.001696)
el(10, 'Ne', 'Neon',          20.180,  'noble-gas',            18, 2,'gas',   nil, {2,8},            '#B3E3F5', 24.56,  27.07,  0.0008999)
el(11, 'Na', 'Sodium',        22.990,  'alkali-metal',          1, 3,'solid', 0.93,{2,8,1},          '#AB5CF2', 370.87, 1156,   0.971)
el(12, 'Mg', 'Magnesium',     24.305,  'alkaline-earth',        2, 3,'solid', 1.31,{2,8,2},          '#8AFF00', 923,    1363,   1.738)
el(13, 'Al', 'Aluminium',     26.982,  'post-transition-metal',13, 3,'solid', 1.61,{2,8,3},          '#BFA6A6', 933.47, 2792,   2.698)
el(14, 'Si', 'Silicon',       28.086,  'metalloid',            14, 3,'solid', 1.90,{2,8,4},          '#F0C8A0', 1687,   3538,   2.3296)
el(15, 'P',  'Phosphorus',    30.974,  'nonmetal',             15, 3,'solid', 2.19,{2,8,5},          '#FF8000', 317.30, 550,    1.82)
el(16, 'S',  'Sulfur',        32.06,   'nonmetal',             16, 3,'solid', 2.58,{2,8,6},          '#FFFF30', 388.36, 717.87, 2.067)
el(17, 'Cl', 'Chlorine',      35.45,   'halogen',              17, 3,'gas',   3.16,{2,8,7},          '#1FF01F', 171.6,  239.11, 0.003214)
el(18, 'Ar', 'Argon',         39.948,  'noble-gas',            18, 3,'gas',   nil, {2,8,8},          '#80D1E3', 83.80,  87.30,  0.0017837)
el(19, 'K',  'Potassium',     39.098,  'alkali-metal',          1, 4,'solid', 0.82,{2,8,8,1},        '#8F40D4', 336.53, 1032,   0.862)
el(20, 'Ca', 'Calcium',       40.078,  'alkaline-earth',        2, 4,'solid', 1.00,{2,8,8,2},        '#3DFF00', 1115,   1757,   1.54)
el(21, 'Sc', 'Scandium',      44.956,  'transition-metal',      3, 4,'solid', 1.36,{2,8,9,2},        '#E6E6E6', 1814,   3109,   2.989)
el(22, 'Ti', 'Titanium',      47.867,  'transition-metal',      4, 4,'solid', 1.54,{2,8,10,2},       '#BFC2C7', 1941,   3560,   4.54)
el(23, 'V',  'Vanadium',      50.942,  'transition-metal',      5, 4,'solid', 1.63,{2,8,11,2},       '#A6A6AB', 2183,   3680,   6.11)
el(24, 'Cr', 'Chromium',      51.996,  'transition-metal',      6, 4,'solid', 1.66,{2,8,13,1},       '#8A99C7', 2180,   2944,   7.15)
el(25, 'Mn', 'Manganese',     54.938,  'transition-metal',      7, 4,'solid', 1.55,{2,8,13,2},       '#9C7AC7', 1519,   2334,   7.44)
el(26, 'Fe', 'Iron',          55.845,  'transition-metal',      8, 4,'solid', 1.83,{2,8,14,2},       '#E06633', 1811,   3134,   7.874)
el(27, 'Co', 'Cobalt',        58.933,  'transition-metal',      9, 4,'solid', 1.88,{2,8,15,2},       '#F090A0', 1768,   3200,   8.86)
el(28, 'Ni', 'Nickel',        58.693,  'transition-metal',     10, 4,'solid', 1.91,{2,8,16,2},       '#50D050', 1728,   3186,   8.912)
el(29, 'Cu', 'Copper',        63.546,  'transition-metal',     11, 4,'solid', 1.90,{2,8,18,1},       '#C88033', 1357.77,2835,   8.96)
el(30, 'Zn', 'Zinc',          65.38,   'transition-metal',     12, 4,'solid', 1.65,{2,8,18,2},       '#7D80B0', 692.68, 1180,   7.134)
el(31, 'Ga', 'Gallium',       69.723,  'post-transition-metal',13, 4,'solid', 1.81,{2,8,18,3},       '#C28F8F', 302.91, 2477,   5.907)
el(32, 'Ge', 'Germanium',     72.630,  'metalloid',            14, 4,'solid', 2.01,{2,8,18,4},       '#668F8F', 1211.40,3106,   5.323)
el(33, 'As', 'Arsenic',       74.922,  'metalloid',            15, 4,'solid', 2.18,{2,8,18,5},       '#BD80E3', 1090,   887,    5.776)
el(34, 'Se', 'Selenium',      78.971,  'nonmetal',             16, 4,'solid', 2.55,{2,8,18,6},       '#FFA100', 493.65, 958,    4.809)
el(35, 'Br', 'Bromine',       79.904,  'halogen',              17, 4,'liquid',2.96,{2,8,18,7},       '#A62929', 265.8,  332.0,  3.122)
el(36, 'Kr', 'Krypton',       83.798,  'noble-gas',            18, 4,'gas',   3.00,{2,8,18,8},       '#5CB8D1', 115.79, 119.93, 0.003733)
el(37, 'Rb', 'Rubidium',      85.468,  'alkali-metal',          1, 5,'solid', 0.82,{2,8,18,8,1},     '#702EB0', 312.46, 961,    1.532)
el(38, 'Sr', 'Strontium',     87.62,   'alkaline-earth',        2, 5,'solid', 0.95,{2,8,18,8,2},     '#00FF00', 1050,   1655,   2.64)
el(39, 'Y',  'Yttrium',       88.906,  'transition-metal',      3, 5,'solid', 1.22,{2,8,18,9,2},     '#94FFFF', 1799,   3609,   4.469)
el(40, 'Zr', 'Zirconium',     91.224,  'transition-metal',      4, 5,'solid', 1.33,{2,8,18,10,2},    '#94E0E0', 2128,   4682,   6.506)
el(41, 'Nb', 'Niobium',       92.906,  'transition-metal',      5, 5,'solid', 1.60,{2,8,18,12,1},    '#73C2C9', 2750,   5017,   8.57)
el(42, 'Mo', 'Molybdenum',    95.95,   'transition-metal',      6, 5,'solid', 2.16,{2,8,18,13,1},    '#54B5B5', 2896,   4912,   10.22)
el(43, 'Tc', 'Technetium',    98,      'transition-metal',      7, 5,'solid', 1.90,{2,8,18,13,2},    '#3B9E9E', 2430,   4538,   11.5)
el(44, 'Ru', 'Ruthenium',     101.07,  'transition-metal',      8, 5,'solid', 2.20,{2,8,18,15,1},    '#248F8F', 2607,   4423,   12.37)
el(45, 'Rh', 'Rhodium',       102.91,  'transition-metal',      9, 5,'solid', 2.28,{2,8,18,16,1},    '#0A7D8C', 2237,   3968,   12.41)
el(46, 'Pd', 'Palladium',     106.42,  'transition-metal',     10, 5,'solid', 2.20,{2,8,18,18},      '#006985', 1828.05,3236,   12.02)
el(47, 'Ag', 'Silver',        107.87,  'transition-metal',     11, 5,'solid', 1.93,{2,8,18,18,1},    '#C0C0C0', 1234.93,2435,   10.501)
el(48, 'Cd', 'Cadmium',       112.41,  'transition-metal',     12, 5,'solid', 1.69,{2,8,18,18,2},    '#FFD98F', 594.22, 1040,   8.69)
el(49, 'In', 'Indium',        114.82,  'post-transition-metal',13, 5,'solid', 1.78,{2,8,18,18,3},    '#A67573', 429.75, 2345,   7.31)
el(50, 'Sn', 'Tin',           118.71,  'post-transition-metal',14, 5,'solid', 1.96,{2,8,18,18,4},    '#668080', 505.08, 2875,   7.287)
el(51, 'Sb', 'Antimony',      121.76,  'metalloid',            15, 5,'solid', 2.05,{2,8,18,18,5},    '#9E63B5', 903.78, 1860,   6.685)
el(52, 'Te', 'Tellurium',     127.60,  'metalloid',            16, 5,'solid', 2.10,{2,8,18,18,6},    '#D47A00', 722.66, 1261,   6.232)
el(53, 'I',  'Iodine',        126.90,  'halogen',              17, 5,'solid', 2.66,{2,8,18,18,7},    '#940094', 386.85, 457.4,  4.933)
el(54, 'Xe', 'Xenon',         131.29,  'noble-gas',            18, 5,'gas',   2.60,{2,8,18,18,8},    '#429EB0', 161.36, 165.03, 0.005887)
el(55, 'Cs', 'Caesium',       132.91,  'alkali-metal',          1, 6,'solid', 0.79,{2,8,18,18,8,1},  '#57178F', 301.59, 944,    1.879)
el(56, 'Ba', 'Barium',        137.33,  'alkaline-earth',        2, 6,'solid', 0.89,{2,8,18,18,8,2},  '#00C900', 1000,   2143,   3.594)
el(57, 'La', 'Lanthanum',     138.91,  'lanthanide',            3, 6,'solid', 1.10,{2,8,18,18,9,2},  '#70D4FF', 1193,   3737,   6.162)
el(58, 'Ce', 'Cerium',        140.12,  'lanthanide',            3, 6,'solid', 1.12,{2,8,18,19,9,2},  '#FFFFC7', 1068,   3716,   6.770)
el(59, 'Pr', 'Praseodymium',  140.91,  'lanthanide',            3, 6,'solid', 1.13,{2,8,18,21,8,2},  '#D9FFC7', 1208,   3793,   6.773)
el(60, 'Nd', 'Neodymium',     144.24,  'lanthanide',            3, 6,'solid', 1.14,{2,8,18,22,8,2},  '#C7FFC7', 1297,   3347,   7.007)
el(61, 'Pm', 'Promethium',    145,     'lanthanide',            3, 6,'solid', nil, {2,8,18,23,8,2},  '#A3FFC7', 1315,   3273,   7.26)
el(62, 'Sm', 'Samarium',      150.36,  'lanthanide',            3, 6,'solid', 1.17,{2,8,18,24,8,2},  '#8FFFC7', 1345,   2067,   7.52)
el(63, 'Eu', 'Europium',      151.96,  'lanthanide',            3, 6,'solid', nil, {2,8,18,25,8,2},  '#61FFC7', 1099,   1802,   5.243)
el(64, 'Gd', 'Gadolinium',    157.25,  'lanthanide',            3, 6,'solid', 1.20,{2,8,18,25,9,2},  '#45FFC7', 1585,   3546,   7.895)
el(65, 'Tb', 'Terbium',       158.93,  'lanthanide',            3, 6,'solid', nil, {2,8,18,27,8,2},  '#30FFC7', 1629,   3503,   8.229)
el(66, 'Dy', 'Dysprosium',    162.50,  'lanthanide',            3, 6,'solid', 1.22,{2,8,18,28,8,2},  '#1FFFC7', 1680,   2840,   8.550)
el(67, 'Ho', 'Holmium',       164.93,  'lanthanide',            3, 6,'solid', 1.23,{2,8,18,29,8,2},  '#00FF9C', 1734,   2993,   8.795)
el(68, 'Er', 'Erbium',        167.26,  'lanthanide',            3, 6,'solid', 1.24,{2,8,18,30,8,2},  '#00E675', 1802,   3141,   9.066)
el(69, 'Tm', 'Thulium',       168.93,  'lanthanide',            3, 6,'solid', 1.25,{2,8,18,31,8,2},  '#00D452', 1818,   2223,   9.321)
el(70, 'Yb', 'Ytterbium',     173.05,  'lanthanide',            3, 6,'solid', nil, {2,8,18,32,8,2},  '#00BF38', 1097,   1469,   6.965)
el(71, 'Lu', 'Lutetium',      174.97,  'lanthanide',            3, 6,'solid', 1.27,{2,8,18,32,9,2},  '#00AB24', 1925,   3675,   9.840)
el(72, 'Hf', 'Hafnium',       178.49,  'transition-metal',      4, 6,'solid', 1.30,{2,8,18,32,10,2}, '#4DC2FF', 2506,   4876,   13.31)
el(73, 'Ta', 'Tantalum',      180.95,  'transition-metal',      5, 6,'solid', 1.50,{2,8,18,32,11,2}, '#4DA6FF', 3290,   5731,   16.654)
el(74, 'W',  'Tungsten',      183.84,  'transition-metal',      6, 6,'solid', 2.36,{2,8,18,32,12,2}, '#2194D6', 3695,   5828,   19.25)
el(75, 'Re', 'Rhenium',       186.21,  'transition-metal',      7, 6,'solid', 1.90,{2,8,18,32,13,2}, '#267DAB', 3459,   5869,   21.02)
el(76, 'Os', 'Osmium',        190.23,  'transition-metal',      8, 6,'solid', 2.20,{2,8,18,32,14,2}, '#266696', 3306,   5285,   22.59)
el(77, 'Ir', 'Iridium',       192.22,  'transition-metal',      9, 6,'solid', 2.20,{2,8,18,32,15,2}, '#175487', 2719,   4701,   22.56)
el(78, 'Pt', 'Platinum',      195.08,  'transition-metal',     10, 6,'solid', 2.28,{2,8,18,32,17,1}, '#D0D0E0', 2041.4, 4098,   21.45)
el(79, 'Au', 'Gold',          196.97,  'transition-metal',     11, 6,'solid', 2.54,{2,8,18,32,18,1}, '#FFD123', 1337.33,3129,   19.282)
el(80, 'Hg', 'Mercury',       200.59,  'transition-metal',     12, 6,'liquid',2.00,{2,8,18,32,18,2}, '#B8B8D0', 234.43, 629.88, 13.534)
el(81, 'Tl', 'Thallium',      204.38,  'post-transition-metal',13, 6,'solid', 1.62,{2,8,18,32,18,3}, '#A6544D', 577,    1746,   11.85)
el(82, 'Pb', 'Lead',          207.2,   'post-transition-metal',14, 6,'solid', 2.33,{2,8,18,32,18,4}, '#575961', 600.61, 2022,   11.342)
el(83, 'Bi', 'Bismuth',       208.98,  'post-transition-metal',15, 6,'solid', 2.02,{2,8,18,32,18,5}, '#9E4FB5', 544.55, 1837,   9.807)
el(84, 'Po', 'Polonium',      209,     'post-transition-metal',16, 6,'solid', 2.00,{2,8,18,32,18,6}, '#AB5C00', 527,    1235,   9.32)
el(85, 'At', 'Astatine',      210,     'halogen',              17, 6,'solid', 2.20,{2,8,18,32,18,7}, '#754F45', 575,    610,    nil)
el(86, 'Rn', 'Radon',         222,     'noble-gas',            18, 6,'gas',   nil, {2,8,18,32,18,8}, '#428296', 202,    211.3,  0.00973)
el(87, 'Fr', 'Francium',      223,     'alkali-metal',          1, 7,'solid', 0.70,{2,8,18,32,18,8,1},'#420066',300,    950,    nil)
el(88, 'Ra', 'Radium',        226,     'alkaline-earth',        2, 7,'solid', 0.90,{2,8,18,32,18,8,2},'#007D00',973,    2010,   5.5)
el(89, 'Ac', 'Actinium',      227,     'actinide',              3, 7,'solid', 1.10,{2,8,18,32,18,9,2},'#70ABFA',1323,   3471,   10.07)
el(90, 'Th', 'Thorium',       232.04,  'actinide',              3, 7,'solid', 1.30,{2,8,18,32,18,10,2},'#00BAFF',1750,  4788,   11.724)
el(91, 'Pa', 'Protactinium',  231.04,  'actinide',              3, 7,'solid', 1.50,{2,8,18,32,20,9,2},'#00A1FF',1841,   4300,   15.37)
el(92, 'U',  'Uranium',       238.03,  'actinide',              3, 7,'solid', 1.38,{2,8,18,32,21,9,2},'#008FFF',1405.3, 4404,   18.95)
el(93, 'Np', 'Neptunium',     237,     'actinide',              3, 7,'solid', 1.36,{2,8,18,32,22,9,2},'#0080FF',917,    4273,   20.45)
el(94, 'Pu', 'Plutonium',     244,     'actinide',              3, 7,'solid', 1.28,{2,8,18,32,24,8,2},'#006BFF',912.5,  3501,   19.816)
el(95, 'Am', 'Americium',     243,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,25,8,2},'#545CF2',1449,   2880,   13.67)
el(96, 'Cm', 'Curium',        247,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,25,9,2},'#785CE3',1613,   3383,   13.51)
el(97, 'Bk', 'Berkelium',     247,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,27,8,2},'#8A4FE3',1259,   2900,   14.78)
el(98, 'Cf', 'Californium',   251,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,28,8,2},'#A136D4',1173,   nil,    15.1)
el(99, 'Es', 'Einsteinium',   252,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,29,8,2},'#B31FD4',1133,   nil,    nil)
el(100,'Fm', 'Fermium',       257,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,30,8,2},'#B31FBA',1800,   nil,    nil)
el(101,'Md', 'Mendelevium',   258,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,31,8,2},'#B30DA6',1100,   nil,    nil)
el(102,'No', 'Nobelium',      259,     'actinide',              3, 7,'solid', 1.30,{2,8,18,32,32,8,2},'#BD0D87',1100,   nil,    nil)
el(103,'Lr', 'Lawrencium',    262,     'actinide',              3, 7,'solid', nil, {2,8,18,32,32,8,3},'#C70066',1900,   nil,    nil)
el(104,'Rf', 'Rutherfordium', 267,     'transition-metal',      4, 7,'solid', nil, {2,8,18,32,32,10,2},'#CC0059',nil,  nil,    nil)
el(105,'Db', 'Dubnium',       270,     'transition-metal',      5, 7,'solid', nil, {2,8,18,32,32,11,2},'#D1004F',nil,  nil,    nil)
el(106,'Sg', 'Seaborgium',    271,     'transition-metal',      6, 7,'solid', nil, {2,8,18,32,32,12,2},'#D90045',nil,  nil,    nil)
el(107,'Bh', 'Bohrium',       270,     'transition-metal',      7, 7,'solid', nil, {2,8,18,32,32,13,2},'#E00038',nil,  nil,    nil)
el(108,'Hs', 'Hassium',       277,     'transition-metal',      8, 7,'solid', nil, {2,8,18,32,32,14,2},'#E6002E',nil,  nil,    nil)
el(109,'Mt', 'Meitnerium',    278,     'unknown',               9, 7,'solid', nil, {2,8,18,32,32,15,2},'#EB0026',nil,  nil,    nil)
el(110,'Ds', 'Darmstadtium',  281,     'unknown',              10, 7,'solid', nil, {2,8,18,32,32,17,1},'#000000',nil,  nil,    nil)
el(111,'Rg', 'Roentgenium',   282,     'unknown',              11, 7,'solid', nil, {2,8,18,32,32,18,1},'#000000',nil,  nil,    nil)
el(112,'Cn', 'Copernicium',   285,     'transition-metal',     12, 7,'liquid',nil, {2,8,18,32,32,18,2},'#000000',nil,  nil,    nil)
el(113,'Nh', 'Nihonium',      286,     'post-transition-metal',13, 7,'solid', nil, {2,8,18,32,32,18,3},'#000000',nil,  nil,    nil)
el(114,'Fl', 'Flerovium',     289,     'post-transition-metal',14, 7,'solid', nil, {2,8,18,32,32,18,4},'#000000',nil,  nil,    nil)
el(115,'Mc', 'Moscovium',     290,     'post-transition-metal',15, 7,'solid', nil, {2,8,18,32,32,18,5},'#000000',nil,  nil,    nil)
el(116,'Lv', 'Livermorium',   293,     'post-transition-metal',16, 7,'solid', nil, {2,8,18,32,32,18,6},'#000000',nil,  nil,    nil)
el(117,'Ts', 'Tennessine',    294,     'halogen',              17, 7,'solid', nil, {2,8,18,32,32,18,7},'#000000',nil,  nil,    nil)
el(118,'Og', 'Oganesson',     294,     'noble-gas',            18, 7,'gas',   nil, {2,8,18,32,32,18,8},'#000000',nil,  nil,    nil)

-- ============================================================================
-- Common compounds library
-- ============================================================================

local COMPOUNDS = {
  H2O     = { name="Water",                 iupac="Dihydrogen monoxide",        geometry="bent",               polarity="polar"    },
  CO2     = { name="Carbon Dioxide",        iupac="Carbon dioxide",             geometry="linear",             polarity="nonpolar" },
  NaCl    = { name="Sodium Chloride",       iupac="Sodium chloride" },
  CH4     = { name="Methane",               iupac="Methane",                    geometry="tetrahedral",        polarity="nonpolar" },
  NH3     = { name="Ammonia",               iupac="Ammonia",                    geometry="trigonal-pyramidal", polarity="polar"    },
  HCl     = { name="Hydrochloric Acid",     iupac="Hydrogen chloride",          geometry="linear",             polarity="polar"    },
  H2SO4   = { name="Sulfuric Acid",         iupac="Sulfuric acid",                                             polarity="polar"    },
  HNO3    = { name="Nitric Acid",           iupac="Nitric acid",                                               polarity="polar"    },
  NaOH    = { name="Sodium Hydroxide",      iupac="Sodium hydroxide" },
  C6H12O6 = { name="Glucose",              iupac="D-Glucose",                                                  polarity="polar"    },
  C2H5OH  = { name="Ethanol",              iupac="Ethanol",                                                    polarity="polar"    },
  C8H10N4O2={ name="Caffeine",             iupac="1,3,7-Trimethylxanthine" },
  C9H8O4  = { name="Aspirin",             iupac="Acetylsalicylic acid" },
  C6H8O7  = { name="Citric Acid",         iupac="Citric acid",                                                polarity="polar"    },
  C2H4O2  = { name="Acetic Acid",         iupac="Acetic acid",                                                polarity="polar"    },
  H2O2    = { name="Hydrogen Peroxide",   iupac="Hydrogen peroxide",                                          polarity="polar"    },
  O3      = { name="Ozone",               iupac="Ozone",                       geometry="bent",               polarity="polar"    },
  C12H22O11={ name="Sucrose",             iupac="Sucrose",                                                    polarity="polar"    },
  CO      = { name="Carbon Monoxide",     iupac="Carbon monoxide",             geometry="linear",             polarity="polar"    },
  NO2     = { name="Nitrogen Dioxide",    iupac="Nitrogen dioxide",            geometry="bent",               polarity="polar"    },
  SO2     = { name="Sulfur Dioxide",      iupac="Sulfur dioxide",              geometry="bent",               polarity="polar"    },
  PCl5    = { name="Phosphorus Pentachloride", iupac="Phosphorus pentachloride", geometry="trigonal-bipyramidal", polarity="nonpolar" },
  SF6     = { name="Sulfur Hexafluoride", iupac="Sulfur hexafluoride",         geometry="octahedral",         polarity="nonpolar" },
  BF3     = { name="Boron Trifluoride",   iupac="Boron trifluoride",           geometry="trigonal-planar",    polarity="nonpolar" },
  CCl4    = { name="Carbon Tetrachloride",iupac="Tetrachloromethane",          geometry="tetrahedral",        polarity="nonpolar" },
  N2      = { name="Nitrogen",            geometry="linear",                                                  polarity="nonpolar" },
  O2      = { name="Oxygen",              geometry="linear",                                                  polarity="nonpolar" },
  H2      = { name="Hydrogen",            geometry="linear",                                                  polarity="nonpolar" },
  Cl2     = { name="Chlorine",            geometry="linear",                                                  polarity="nonpolar" },
  Fe2O3   = { name="Iron(III) Oxide",     iupac="Iron(III) oxide" },
  CaCO3   = { name="Calcium Carbonate",   iupac="Calcium carbonate" },
  KMnO4   = { name="Potassium Permanganate", iupac="Potassium permanganate" },
  C6H6    = { name="Benzene",             iupac="Benzene",                                                   polarity="nonpolar" },
  C3H8    = { name="Propane",             iupac="Propane",                                                   polarity="nonpolar" },
  C2H2    = { name="Acetylene",           iupac="Ethyne",                      geometry="linear",            polarity="nonpolar" },
  C2H4    = { name="Ethylene",            iupac="Ethene",                                                    polarity="nonpolar" },
}

-- Name → formula reverse lookup
local BY_NAME = {}
for formula, info in pairs(COMPOUNDS) do
  if info.name then BY_NAME[info.name:lower()] = formula end
  if info.iupac then BY_NAME[info.iupac:lower()] = formula end
end

-- ============================================================================
-- Known reaction enthalpies (kJ/mol)
-- ============================================================================

local ENTHALPIES = {
  ["2H2 + O2 -> 2H2O"]             = -571.6,
  ["C + O2 -> CO2"]                = -393.5,
  ["CH4 + 2O2 -> CO2 + 2H2O"]     = -890.4,
  ["N2 + 3H2 -> 2NH3"]            = -92.2,
  ["C3H8 + 5O2 -> 3CO2 + 4H2O"]   = -2220,
  ["2C2H6 + 7O2 -> 4CO2 + 6H2O"]  = -3120,
  ["CaCO3 -> CaO + CO2"]          = 178.1,
  ["2H2O -> 2H2 + O2"]            = 571.6,
  ["Fe2O3 + 3CO -> 2Fe + 3CO2"]   = -24.8,
  ["2Na + Cl2 -> 2NaCl"]          = -822.2,
  ["C6H12O6 + 6O2 -> 6CO2 + 6H2O"]= -2803,
}

-- ============================================================================
-- Formula parser
-- Handles: H2O, CO2, C6H12O6, Fe2O3, NaCl, etc.
-- Does NOT handle nested parentheses (e.g., Ca(OH)2) — extend if needed.
-- ============================================================================

local function parseFormula(formula)
  local atoms = {}
  local seen  = {}
  local i = 1
  local len = #formula
  while i <= len do
    local c = formula:sub(i, i)
    if c:match('%u') then
      local sym = c
      i = i + 1
      -- Optional lowercase
      if i <= len and formula:sub(i, i):match('%l') then
        sym = sym .. formula:sub(i, i)
        i = i + 1
      end
      -- Count digits
      local countStr = ''
      while i <= len and formula:sub(i, i):match('%d') do
        countStr = countStr .. formula:sub(i, i)
        i = i + 1
      end
      local count = countStr ~= '' and tonumber(countStr) or 1
      if seen[sym] then
        atoms[seen[sym]].count = atoms[seen[sym]].count + count
      else
        seen[sym] = #atoms + 1
        atoms[#atoms + 1] = { symbol = sym, count = count }
      end
    else
      i = i + 1
    end
  end
  return atoms
end

-- ============================================================================
-- Molar mass
-- ============================================================================

local function molarMass(formula)
  local atoms = parseFormula(formula)
  local mass = 0
  for _, a in ipairs(atoms) do
    local e = BY_SYMBOL[a.symbol]
    if e then mass = mass + e.mass * a.count end
  end
  return math.floor(mass * 1000 + 0.5) / 1000
end

-- ============================================================================
-- Equation balancer — brute-force coefficient search in LuaJIT
-- Handles equations with up to ~5 compounds at maxCoeff=10 (~100k iters).
-- LuaJIT executes this in microseconds; QuickJS would take milliseconds.
-- ============================================================================

local function parseSide(side)
  local terms = {}
  for term in side:gmatch('[^+]+') do
    term = term:match('^%s*(.-)%s*$') -- trim
    local coeff_str, formula = term:match('^(%d+)%s*(.+)$')
    if not formula then
      coeff_str = '1'
      formula = term
    end
    terms[#terms + 1] = { coefficient = tonumber(coeff_str) or 1, formula = formula }
  end
  return terms
end

local function atomCounts(sides, coeffs, offset)
  local counts = {}
  for i, s in ipairs(sides) do
    local coef = coeffs[offset + i]
    for _, a in ipairs(parseFormula(s.formula)) do
      counts[a.symbol] = (counts[a.symbol] or 0) + a.count * coef
    end
  end
  return counts
end

local function countsMatch(r, p)
  for k, v in pairs(r) do
    if (p[k] or 0) ~= v then return false end
  end
  for k, v in pairs(p) do
    if (r[k] or 0) ~= v then return false end
  end
  return true
end

local function classifyReaction(reactants, products)
  local rn = #reactants
  local pn = #products
  local hasO2  = false
  local hasCO2 = false
  local hasH2O = false
  for _, s in ipairs(reactants) do if s.formula == 'O2'  then hasO2  = true end end
  for _, s in ipairs(products)  do if s.formula == 'CO2' then hasCO2 = true end end
  for _, s in ipairs(products)  do if s.formula == 'H2O' then hasH2O = true end end
  if hasO2 and hasCO2 and hasH2O then return 'combustion' end
  if rn >= 2 and pn == 1 then return 'synthesis' end
  if rn == 1 and pn >= 2 then return 'decomposition' end
  if rn == 2 and pn == 2 then
    local r1 = parseFormula(reactants[1].formula)
    local r2 = parseFormula(reactants[2].formula)
    if #r1 == 1 or #r2 == 1 then return 'single-replacement' end
    return 'double-replacement'
  end
  return nil
end

local function formatEquation(reactants, products)
  local function fmtSide(sides)
    local parts = {}
    for _, s in ipairs(sides) do
      parts[#parts + 1] = (s.coefficient > 1 and tostring(s.coefficient) or '') .. s.formula
    end
    return table.concat(parts, ' + ')
  end
  return fmtSide(reactants) .. ' -> ' .. fmtSide(products)
end

local function balanceEquation(equation)
  -- Normalize arrow
  local eq = equation:gsub('%s+', ' ')
  eq = eq:match('^%s*(.-)%s*$')
  eq = eq:gsub('→', ' -> ')
  eq = eq:gsub('%s*[=%-]+>%s*', ' -> ')
  eq = eq:gsub('%s+', ' ')
  -- Split on ->
  local lhs, rhs = eq:match('^(.+)->(.+)$')
  if not lhs or not rhs then
    return { equation=equation, balanced=equation, reactants={}, products={}, isBalanced=false }
  end
  local reactants = parseSide(lhs)
  local products  = parseSide(rhs)
  -- Check if already balanced
  local r0 = atomCounts(reactants, (function() local t={}; for i=1,#reactants do t[i]=reactants[i].coefficient end; return t end)(), 0)
  local p0 = atomCounts(products,  (function() local t={}; for i=1,#products  do t[i]=products[i].coefficient  end; return t end)(), 0)
  if countsMatch(r0, p0) then
    local balanced = formatEquation(reactants, products)
    return {
      equation = equation,
      balanced = balanced,
      reactants = reactants,
      products = products,
      type = classifyReaction(reactants, products),
      isBalanced = true,
      enthalpy = ENTHALPIES[balanced],
    }
  end
  -- Brute-force search
  local n = #reactants + #products
  local maxCoeff = 10
  local coeffs = {}
  for i = 1, n do coeffs[i] = 1 end
  local found = false
  local function search(idx)
    if idx > n then
      local r = atomCounts(reactants, coeffs, 0)
      local p = atomCounts(products,  coeffs, #reactants)
      if countsMatch(r, p) then found = true; return true end
      return false
    end
    for c = 1, maxCoeff do
      coeffs[idx] = c
      if search(idx + 1) then return true end
    end
    return false
  end
  search(1)
  if found then
    local bReactants = {}
    local bProducts  = {}
    for i, s in ipairs(reactants) do
      bReactants[i] = { coefficient = coeffs[i], formula = s.formula }
    end
    for i, s in ipairs(products) do
      bProducts[i] = { coefficient = coeffs[#reactants + i], formula = s.formula }
    end
    local balanced = formatEquation(bReactants, bProducts)
    return {
      equation = equation,
      balanced = balanced,
      reactants = bReactants,
      products  = bProducts,
      type = classifyReaction(bReactants, bProducts),
      isBalanced = true,
      enthalpy = ENTHALPIES[balanced],
    }
  end
  return { equation=equation, balanced=equation, reactants=reactants, products=products, isBalanced=false }
end

-- ============================================================================
-- Molecule builder
-- ============================================================================

local function buildMolecule(formulaOrName)
  -- Try formula lookup first, then name
  local formula = formulaOrName
  local info = COMPOUNDS[formula]
  if not info then
    local byName = BY_NAME[formulaOrName:lower()]
    if byName then
      formula = byName
      info = COMPOUNDS[formula]
    end
  end
  local atoms = parseFormula(formula)
  local mm = molarMass(formula)
  return {
    formula   = formula,
    name      = info and info.name or nil,
    iupac     = info and info.iupac or nil,
    atoms     = atoms,
    molarMass = mm,
    geometry  = info and info.geometry or nil,
    polarity  = info and info.polarity or nil,
  }
end

-- ============================================================================
-- Spectra data + helpers
-- ============================================================================

local IR_ABSORPTIONS = {
  { group='Alcohol',         bond='O-H stretch',     rangeMin=3200, rangeMax=3550, intensity='strong',   description='Broad peak, hydrogen bonding' },
  { group='Carboxylic Acid', bond='O-H stretch',     rangeMin=2500, rangeMax=3300, intensity='strong',   description='Very broad, overlaps C-H' },
  { group='Amine',           bond='N-H stretch',     rangeMin=3300, rangeMax=3500, intensity='medium',   description='Primary: two peaks; secondary: one peak' },
  { group='Alkane',          bond='C-H stretch',     rangeMin=2850, rangeMax=2960, intensity='strong',   description='sp3 C-H' },
  { group='Alkene',          bond='C-H stretch',     rangeMin=3020, rangeMax=3100, intensity='medium',   description='sp2 C-H' },
  { group='Alkyne',          bond='C-H stretch',     rangeMin=3300, rangeMax=3320, intensity='strong',   description='sp C-H, sharp' },
  { group='Aldehyde',        bond='C-H stretch',     rangeMin=2700, rangeMax=2850, intensity='medium',   description='Two peaks (Fermi resonance)' },
  { group='Nitrile',         bond='C≡N stretch',     rangeMin=2210, rangeMax=2260, intensity='medium',   description='Sharp, characteristic' },
  { group='Alkyne',          bond='C≡C stretch',     rangeMin=2100, rangeMax=2260, intensity='weak',     description='May be absent if symmetric' },
  { group='Carbonyl',        bond='C=O stretch',     rangeMin=1680, rangeMax=1750, intensity='strong',   description='Very characteristic, exact position varies' },
  { group='Ketone',          bond='C=O stretch',     rangeMin=1705, rangeMax=1725, intensity='strong',   description='Conjugation lowers frequency' },
  { group='Aldehyde',        bond='C=O stretch',     rangeMin=1720, rangeMax=1740, intensity='strong',   description='Higher than ketone' },
  { group='Ester',           bond='C=O stretch',     rangeMin=1735, rangeMax=1750, intensity='strong',   description='Highest carbonyl frequency' },
  { group='Amide',           bond='C=O stretch',     rangeMin=1630, rangeMax=1690, intensity='strong',   description='Amide I band' },
  { group='Carboxylic Acid', bond='C=O stretch',     rangeMin=1700, rangeMax=1725, intensity='strong',   description='Dimeric form' },
  { group='Alkene',          bond='C=C stretch',     rangeMin=1620, rangeMax=1680, intensity='variable', description='Weak if symmetric' },
  { group='Aromatic',        bond='C=C stretch',     rangeMin=1450, rangeMax=1600, intensity='variable', description='Ring stretching, multiple peaks' },
  { group='Nitro',           bond='N=O stretch',     rangeMin=1515, rangeMax=1560, intensity='strong',   description='Asymmetric stretch' },
  { group='Ether',           bond='C-O stretch',     rangeMin=1000, rangeMax=1300, intensity='strong',   description='Broad region' },
  { group='Alcohol',         bond='C-O stretch',     rangeMin=1000, rangeMax=1260, intensity='strong',   description='Primary/secondary/tertiary differ' },
  { group='Aromatic',        bond='C-H bend (OOP)',  rangeMin=675,  rangeMax=900,  intensity='strong',   description='Substitution pattern diagnostic' },
}

local function identifyIRPeaks(wavenumber, tolerance)
  tolerance = tolerance or 50
  local result = {}
  for _, a in ipairs(IR_ABSORPTIONS) do
    if wavenumber >= a.rangeMin - tolerance and wavenumber <= a.rangeMax + tolerance then
      result[#result + 1] = a
    end
  end
  return result
end

local function wavelengthToColor(nm)
  if nm < 380 then return '#7F00FF' end
  if nm < 440 then
    local t = (nm - 380) / 60
    return string.format('rgb(%d, 0, 255)', math.floor(255 * (1 - t) + 0.5))
  end
  if nm < 490 then
    local t = (nm - 440) / 50
    return string.format('rgb(0, %d, 255)', math.floor(255 * t + 0.5))
  end
  if nm < 510 then
    local t = (nm - 490) / 20
    return string.format('rgb(0, 255, %d)', math.floor(255 * (1 - t) + 0.5))
  end
  if nm < 580 then
    local t = (nm - 510) / 70
    return string.format('rgb(%d, 255, 0)', math.floor(255 * t + 0.5))
  end
  if nm < 645 then
    local t = (nm - 580) / 65
    return string.format('rgb(255, %d, 0)', math.floor(255 * (1 - t) + 0.5))
  end
  if nm < 780 then return '#FF0000' end
  return '#7F0000'
end

local function absorptionToObservedColor(absorbedNm)
  local COMPLEMENTARY = {
    {380, 430, '#FFFF00'},
    {430, 480, '#FF8C00'},
    {480, 500, '#FF0000'},
    {500, 530, '#FF00FF'},
    {530, 560, '#8B00FF'},
    {560, 580, '#0000FF'},
    {580, 620, '#00BFFF'},
    {620, 780, '#00FF00'},
  }
  for _, c in ipairs(COMPLEMENTARY) do
    if absorbedNm >= c[1] and absorbedNm < c[2] then return c[3] end
  end
  return '#FFFFFF'
end

-- ============================================================================
-- Reagent test compute (full databases + correlation logic)
-- ============================================================================

local REAGENT_INFO = {
  marquis    = { name='Marquis',    formula='H2SO4 + HCHO',                 color='#8B4513', description='Formaldehyde + sulfuric acid. Primary test for alkaloids and phenethylamines.' },
  mecke      = { name='Mecke',      formula='H2SeO3 + H2SO4',               color='#556B2F', description='Selenious acid + sulfuric acid. Distinguishes between opioids and phenethylamines.' },
  mandelin   = { name='Mandelin',   formula='NH4VO3 + H2SO4',               color='#B8860B', description='Ammonium vanadate + sulfuric acid. Broad spectrum alkaloid detection.' },
  simons     = { name="Simon's",    formula='NaHCO3 + Na2[Fe(CN)5NO] + CH3CHO', color='#4682B4', description='Sodium nitroprusside + acetaldehyde. Detects secondary amines.' },
  ehrlich    = { name='Ehrlich',    formula='DMAB + HCl',                   color='#DAA520', description='p-Dimethylaminobenzaldehyde + HCl. Detects indole-containing compounds.' },
  liebermann = { name='Liebermann', formula='NaNO2 + H2SO4',                color='#2F4F4F', description='Sodium nitrite + sulfuric acid. Detects phenols and aromatic amines.' },
  froehde    = { name='Froehde',    formula='Na2MoO4 + H2SO4',              color='#696969', description='Sodium molybdate + sulfuric acid. Alkaloid differentiation.' },
  ['gallic-acid'] = { name='Gallic Acid', formula='C7H6O5 + H2SO4',        color='#8B0000', description='Gallic acid + sulfuric acid. Tests for alkaloids and glycosides.' },
}

local REAGENT_DATABASES = {
  marquis = {
    MDMA            = { color='#1a0a2e', description='Deep purple to black',    timeMs=13000, intermediates={'#f5f5dc','#9370DB','#4B0082','#1a0a2e'} },
    MDA             = { color='#1a0a2e', description='Black/dark purple',        timeMs=11500, intermediates={'#f5f5dc','#8B008B','#2d0047','#1a0a2e'} },
    Amphetamine     = { color='#FF8C00', description='Orange to dark reddish-brown', timeMs=16000, intermediates={'#f5f5dc','#FFA500','#FF6347','#8B4513'} },
    Methamphetamine = { color='#FF4500', description='Orange to dark orange',    timeMs=14500, intermediates={'#f5f5dc','#FFD700','#FF8C00','#FF4500'} },
    Heroin          = { color='#800080', description='Purple',                   timeMs=10000, intermediates={'#f5f5dc','#DDA0DD','#9932CC','#800080'} },
    Morphine        = { color='#800080', description='Deep purple',              timeMs=11500, intermediates={'#f5f5dc','#DA70D6','#9400D3','#800080'} },
    Codeine         = { color='#800080', description='Deep purple',              timeMs=13000, intermediates={'#f5f5dc','#EE82EE','#9932CC','#800080'} },
    Cocaine         = { color='#f5f5dc', description='No reaction (remains clear)', timeMs=7000, intermediates={'#f5f5dc'} },
    LSD             = { color='#808000', description='Olive to black',           timeMs=19000, intermediates={'#f5f5dc','#BDB76B','#808000','#2F4F4F'} },
    Aspirin         = { color='#FF6347', description='Reddish',                  timeMs=10000, intermediates={'#f5f5dc','#FFA07A','#FF6347'} },
    Sugar           = { color='#f5f5dc', description='No significant reaction',  timeMs=7000,  intermediates={'#f5f5dc'} },
    Caffeine        = { color='#f5f5dc', description='No significant reaction',  timeMs=7000,  intermediates={'#f5f5dc'} },
  },
  mecke = {
    MDMA            = { color='#006400', description='Blue-green to dark green', timeMs=13000, intermediates={'#f5f5dc','#20B2AA','#008080','#006400'} },
    MDA             = { color='#006400', description='Green to blue-green',      timeMs=11500, intermediates={'#f5f5dc','#3CB371','#2E8B57','#006400'} },
    Heroin          = { color='#006400', description='Deep blue-green',          timeMs=10000, intermediates={'#f5f5dc','#66CDAA','#2E8B57','#006400'} },
    Morphine        = { color='#006400', description='Deep green',               timeMs=11500, intermediates={'#f5f5dc','#90EE90','#228B22','#006400'} },
    Cocaine         = { color='#808000', description='Slow olive green',         timeMs=28000, intermediates={'#f5f5dc','#BDB76B','#808000'} },
    Amphetamine     = { color='#f5f5dc', description='No reaction',              timeMs=7000,  intermediates={'#f5f5dc'} },
    Methamphetamine = { color='#f5f5dc', description='No reaction',              timeMs=7000,  intermediates={'#f5f5dc'} },
    LSD             = { color='#8B4513', description='Brownish-black',           timeMs=16000, intermediates={'#f5f5dc','#D2B48C','#A0522D','#8B4513'} },
  },
  mandelin = {
    MDMA            = { color='#1a0a2e', description='Black',                    timeMs=10000, intermediates={'#f5f5dc','#696969','#2F2F2F','#1a0a2e'} },
    MDA             = { color='#1a0a2e', description='Black to dark green',      timeMs=11500, intermediates={'#f5f5dc','#556B2F','#2F4F4F','#1a0a2e'} },
    Amphetamine     = { color='#006400', description='Dark green',               timeMs=13000, intermediates={'#f5f5dc','#8FBC8F','#2E8B57','#006400'} },
    Methamphetamine = { color='#006400', description='Green',                    timeMs=14500, intermediates={'#f5f5dc','#90EE90','#32CD32','#006400'} },
    Cocaine         = { color='#FF8C00', description='Orange',                   timeMs=10000, intermediates={'#f5f5dc','#FFD700','#FF8C00'} },
    Heroin          = { color='#808080', description='Brownish gray',            timeMs=13000, intermediates={'#f5f5dc','#D2B48C','#808080'} },
    Ketamine        = { color='#FF4500', description='Orange',                   timeMs=10000, intermediates={'#f5f5dc','#FFA500','#FF4500'} },
  },
  simons = {
    MDMA            = { color='#00008B', description='Blue (secondary amine)',   timeMs=8500,  intermediates={'#f5f5dc','#87CEEB','#4169E1','#00008B'} },
    Methamphetamine = { color='#00008B', description='Blue (secondary amine)',   timeMs=8500,  intermediates={'#f5f5dc','#87CEEB','#4169E1','#00008B'} },
    MDA             = { color='#f5f5dc', description='No reaction (primary amine)', timeMs=7000, intermediates={'#f5f5dc'} },
    Amphetamine     = { color='#f5f5dc', description='No reaction (primary amine)', timeMs=7000, intermediates={'#f5f5dc'} },
  },
  ehrlich = {
    LSD             = { color='#800080', description='Purple (indole ring)',     timeMs=19000, intermediates={'#f5f5dc','#DDA0DD','#BA55D3','#800080'} },
    Psilocybin      = { color='#800080', description='Purple (indole ring)',     timeMs=28000, intermediates={'#f5f5dc','#EE82EE','#9932CC','#800080'} },
    DMT             = { color='#800080', description='Purple to pink-purple',    timeMs=13000, intermediates={'#f5f5dc','#FF69B4','#C71585','#800080'} },
    Tryptophan      = { color='#DDA0DD', description='Light purple (indole)',    timeMs=22000, intermediates={'#f5f5dc','#E6E6FA','#DDA0DD'} },
    MDMA            = { color='#f5f5dc', description='No reaction (no indole ring)', timeMs=7000, intermediates={'#f5f5dc'} },
    Cocaine         = { color='#f5f5dc', description='No reaction',              timeMs=7000,  intermediates={'#f5f5dc'} },
  },
  liebermann = {
    MDMA            = { color='#1a0a2e', description='Black',                    timeMs=10000, intermediates={'#f5f5dc','#696969','#1a0a2e'} },
    MDA             = { color='#1a0a2e', description='Black',                    timeMs=10000, intermediates={'#f5f5dc','#696969','#1a0a2e'} },
    Cocaine         = { color='#FFD700', description='Yellow to orange',         timeMs=13000, intermediates={'#f5f5dc','#FFFACD','#FFD700'} },
    Morphine        = { color='#1a0a2e', description='Black',                    timeMs=11500, intermediates={'#f5f5dc','#556B2F','#1a0a2e'} },
  },
  froehde = {
    MDMA            = { color='#1a0a2e', description='Purple to black',          timeMs=13000, intermediates={'#f5f5dc','#9370DB','#4B0082','#1a0a2e'} },
    Heroin          = { color='#006400', description='Green to blue-green',      timeMs=11500, intermediates={'#f5f5dc','#3CB371','#008080','#006400'} },
    Morphine        = { color='#800080', description='Purple',                   timeMs=10000, intermediates={'#f5f5dc','#DDA0DD','#800080'} },
    Codeine         = { color='#006400', description='Green',                    timeMs=13000, intermediates={'#f5f5dc','#90EE90','#006400'} },
    Cocaine         = { color='#f5f5dc', description='No reaction',              timeMs=7000,  intermediates={'#f5f5dc'} },
  },
  ['gallic-acid'] = {},
}

local MECHANISMS = {
  marquis = {
    MDMA = 'Formaldehyde attacks the methylenedioxy ring via electrophilic aromatic substitution. The electron-rich aromatic system donates electrons to the aldehyde, forming a carbocation intermediate that absorbs in the visible spectrum (purple). The 3,4-methylenedioxy group is the chromophore.',
    Amphetamine = 'The primary amine undergoes condensation with formaldehyde forming a Schiff base. Sulfuric acid catalyzes further oxidation, producing orange quinone-like chromophores.',
    Heroin = 'The phenolic hydroxyl group (exposed after ester hydrolysis by H2SO4) reacts with formaldehyde. The resulting conjugated system absorbs yellow-green light, appearing purple.',
    Cocaine = 'No reactive functional groups accessible to formaldehyde under these conditions. The tropane nitrogen is tertiary and sterically hindered; the benzoyl ester is stable in concentrated H2SO4.',
  },
  ehrlich = {
    LSD = 'DMAB attacks position 2 of the indole ring via electrophilic substitution. The resulting azomethine dye has extended conjugation spanning the indole + DMAB systems, absorbing in the yellow-green range (appearing purple). This is specific to the indole NH.',
    Psilocybin = 'Same indole ring mechanism as LSD. The 4-phosphoryloxy group does not interfere with position 2 substitution. Slower reaction due to the electron-withdrawing phosphate.',
    DMT = 'Fastest Ehrlich reaction — unsubstituted indole with electron-donating dimethylamine. DMAB attacks C-2 readily.',
  },
  simons = {
    MDMA = 'Sodium nitroprusside forms a colored complex specifically with secondary amines. The nitrogen lone pair coordinates to iron in the [Fe(CN)5NO]2- complex. MDMA has a secondary amine (N-methyl); MDA has a primary amine and does not react.',
    Methamphetamine = 'Same mechanism — secondary amine (N-methyl) coordinates to the nitroprusside iron center.',
    MDA = "Primary amines do not form the colored nitroprusside complex. This is the key distinction: Marquis alone cannot distinguish MDA from MDMA; adding Simon's resolves the ambiguity.",
  },
}

local FUNCTIONAL_GROUPS = {'indole','methylenedioxy','phenol','primary amine','secondary amine','tertiary amine','hydroxyl','ester','tropane'}

local function extractFunctionalGroup(mechanism)
  local mech_lower = mechanism:lower()
  local best_group = nil
  local best_index = nil
  for _, g in ipairs(FUNCTIONAL_GROUPS) do
    local start_index = mech_lower:find(g, 1, true)
    if start_index and (not best_index or start_index < best_index) then
      best_group = g
      best_index = start_index
    end
  end
  return best_group
end

local function runReagentTest(reagent, compound)
  local db = REAGENT_DATABASES[reagent]
  local reaction = db and db[compound] or nil
  local mechanism = MECHANISMS[reagent] and MECHANISMS[reagent][compound] or nil
  local confidence = 0
  if reaction then
    confidence = reaction.color == '#f5f5dc' and 0 or 0.65
  end
  return {
    reagent = reagent,
    compound = compound,
    reaction = reaction,
    confidence = confidence,
    functionalGroup = mechanism and extractFunctionalGroup(mechanism) or nil,
    mechanism = mechanism,
  }
end

local function runMultiReagentTest(reagents, compound)
  local results = {}
  for _, r in ipairs(reagents) do
    results[#results + 1] = runReagentTest(r, compound)
  end
  local reacting = {}
  for _, r in ipairs(results) do
    if r.reaction and r.reaction.color ~= '#f5f5dc' then
      reacting[#reacting + 1] = r
    end
  end
  local confidence = math.min(1, #reacting * 0.3 + (#reacting >= 3 and 0.15 or 0))
  local identification = nil
  local reasoning = ''
  if #reacting == 0 then
    reasoning = 'No color change observed with any reagent. Compound is either inert to these tests or not in the database.'
  elseif #reacting == 1 then
    identification = compound
    reasoning = string.format('Single reagent match (%s). Presumptive identification only — additional tests recommended.', REAGENT_INFO[reacting[1].reagent].name)
  elseif #reacting >= 2 then
    identification = compound
    local names = {}
    for _, r in ipairs(reacting) do names[#names + 1] = REAGENT_INFO[r.reagent].name end
    reasoning = string.format('Corroborated by %d reagents (%s). %s confidence identification.', #reacting, table.concat(names, ', '), confidence >= 0.8 and 'High' or 'Moderate')
  end
  return { results = results, identification = identification, confidence = confidence, reasoning = reasoning }
end

local function getAvailableCompounds(reagent)
  local db = REAGENT_DATABASES[reagent]
  if not db then return {} end
  local result = {}
  for k in pairs(db) do result[#result + 1] = k end
  table.sort(result)
  return result
end

local function getAllTestedCompounds()
  local seen = {}
  local result = {}
  for _, db in pairs(REAGENT_DATABASES) do
    for k in pairs(db) do
      if not seen[k] then seen[k] = true; result[#result + 1] = k end
    end
  end
  table.sort(result)
  return result
end

-- ============================================================================
-- Capability registration (non-visual — no render)
-- ============================================================================

Capabilities.register("Chemistry", {
  visual = false,
  schema = {},
  create  = function() return {} end,
  update  = function() end,
  destroy = function() end,
})

-- ============================================================================
-- RPC handler table
-- ============================================================================

function M.getHandlers()
  return {
    ["chemistry:element"] = function(args)
      if not args or not args.key then return nil end
      return M.getElement(args.key)
    end,

    ["chemistry:elements"] = function(args)
      local filter = args or {}
      local result = {}
      for i = 1, 118 do
        local e = ELEMENTS[i]
        if e then
          local ok = true
          if filter.category and e.category ~= filter.category then ok = false end
          if filter.phase    and e.phase    ~= filter.phase    then ok = false end
          if filter.search then
            local q = filter.search:lower()
            if not e.name:lower():find(q, 1, true) and
               not e.symbol:lower():find(q, 1, true) then
              ok = false
            end
          end
          if ok then result[#result + 1] = e end
        end
      end
      return result
    end,

    ["chemistry:balance"] = function(args)
      if not args or not args.equation then return nil end
      return balanceEquation(args.equation)
    end,

    ["chemistry:molecule"] = function(args)
      if not args or not args.formula then return nil end
      return buildMolecule(args.formula)
    end,

    ["chemistry:formula"] = function(args)
      if not args or not args.formula then return {} end
      return parseFormula(args.formula)
    end,

    ["chemistry:molarmass"] = function(args)
      if not args or not args.formula then return 0 end
      return molarMass(args.formula)
    end,

    ["chemistry:reagent"] = function(args)
      if not args or not args.type or not args.compound then return nil end
      local db = REAGENT_DATABASES[args.type]
      if not db then return nil end
      return db[args.compound]
    end,

    -- ── Spectra ──────────────────────────────────────────────────────────────
    ["chemistry:identifyIR"] = function(args)
      if not args or not args.wavenumber then return {} end
      return identifyIRPeaks(args.wavenumber, args.tolerance)
    end,

    ["chemistry:wavelengthToColor"] = function(args)
      if not args or not args.nm then return '#000000' end
      return wavelengthToColor(args.nm)
    end,

    ["chemistry:absorptionColor"] = function(args)
      if not args or not args.nm then return '#FFFFFF' end
      return absorptionToObservedColor(args.nm)
    end,

    ["chemistry:irAbsorptions"] = function()
      return IR_ABSORPTIONS
    end,

    -- ── Reagent tests ─────────────────────────────────────────────────────────
    ["chemistry:reagentTest"] = function(args)
      if not args or not args.type or not args.compound then return nil end
      return runReagentTest(args.type, args.compound)
    end,

    ["chemistry:reagentTestMulti"] = function(args)
      if not args or not args.reagents or not args.compound then return nil end
      return runMultiReagentTest(args.reagents, args.compound)
    end,

    ["chemistry:reagentInfo"] = function(args)
      if args and args.type then return REAGENT_INFO[args.type] end
      return REAGENT_INFO
    end,

    ["chemistry:availableCompounds"] = function(args)
      if not args or not args.type then return getAllTestedCompounds() end
      return getAvailableCompounds(args.type)
    end,

    ["chemistry:compounds"] = function(args)
      local query = args and args.search and args.search:lower() or nil
      local result = {}
      for formula, info in pairs(COMPOUNDS) do
        if not query or
           formula:lower():find(query, 1, true) or
           (info.name  and info.name:lower():find(query, 1, true)) or
           (info.iupac and info.iupac:lower():find(query, 1, true)) then
          result[#result + 1] = {
            formula = formula,
            name    = info.name,
            iupac   = info.iupac,
          }
        end
      end
      return result
    end,

    -- ── chemistry:compute — all stoichiometry / util math in LuaJIT ───────────
    ["chemistry:compute"] = function(args)
      if not args or not args.method then return nil end
      local method = args.method
      local AVOGADRO = 6.02214076e23
      local R_GAS    = 8.314

      local function gcd(a, b)
        a, b = math.abs(a), math.abs(b)
        while b ~= 0 do a, b = b, a % b end
        return a
      end

      if method == 'molarMass' then
        return molarMass(args.formula or '')

      elseif method == 'atomCount' then
        local atoms = parseFormula(args.formula or '')
        local n = 0
        for _, a in ipairs(atoms) do n = n + a.count end
        return n

      elseif method == 'massComposition' then
        local formula = args.formula or ''
        local atoms = parseFormula(formula)
        local total = molarMass(formula)
        if total == 0 then return {} end
        local result = {}
        for _, a in ipairs(atoms) do
          local e = BY_SYMBOL[a.symbol]
          if e then
            result[a.symbol] = math.floor((e.mass * a.count / total) * 10000 + 0.5) / 100
          end
        end
        return result

      elseif method == 'empiricalFormula' then
        local formula = args.formula or ''
        local atoms = parseFormula(formula)
        if #atoms == 0 then return '' end
        local d = atoms[1].count
        for i = 2, #atoms do d = gcd(d, atoms[i].count) end
        local parts = {}
        for _, a in ipairs(atoms) do
          local n = a.count / d
          parts[#parts + 1] = a.symbol .. (n > 1 and tostring(math.floor(n)) or '')
        end
        return table.concat(parts)

      elseif method == 'valenceElectrons' then
        local e = type(args.key) == 'number' and ELEMENTS[args.key] or BY_SYMBOL[args.key or '']
        if not e then return 0 end
        return e.shells[#e.shells]

      elseif method == 'electronegativityDiff' then
        local e1 = BY_SYMBOL[args.symbol1 or '']
        local e2 = BY_SYMBOL[args.symbol2 or '']
        if not e1 or not e2 or not e1.electronegativity or not e2.electronegativity then return nil end
        return math.abs(e1.electronegativity - e2.electronegativity)

      elseif method == 'bondCharacter' then
        local e1 = BY_SYMBOL[args.symbol1 or '']
        local e2 = BY_SYMBOL[args.symbol2 or '']
        if not e1 or not e2 or not e1.electronegativity or not e2.electronegativity then return nil end
        local diff = math.abs(e1.electronegativity - e2.electronegativity)
        if diff < 0.5 then return 'nonpolar-covalent'
        elseif diff < 1.7 then return 'polar-covalent'
        else return 'ionic' end

      elseif method == 'oxidationStates' then
        local OXIDATION = {
          H={1,-1}, He={0}, Li={1}, Be={2}, B={3},
          C={-4,-3,-2,-1,0,1,2,3,4}, N={-3,-2,-1,0,1,2,3,4,5},
          O={-2,-1}, F={-1}, Ne={0}, Na={1}, Mg={2}, Al={3},
          Si={-4,4}, P={-3,3,5}, S={-2,2,4,6}, Cl={-1,1,3,5,7}, Ar={0},
          K={1}, Ca={2}, Fe={2,3}, Cu={1,2}, Zn={2}, Ag={1}, Au={1,3}, Pt={2,4},
          Mn={2,3,4,7}, Cr={2,3,6}, Co={2,3}, Ni={2}, Ti={2,3,4}, V={2,3,4,5},
          Sn={2,4}, Pb={2,4}, Hg={1,2}, Br={-1,1,3,5}, I={-1,1,3,5,7},
        }
        return OXIDATION[args.symbol or ''] or {}

      elseif method == 'isotopeNotation' then
        local e = BY_SYMBOL[args.symbol or '']
        local sym = e and e.symbol or (args.symbol or '')
        return tostring(args.massNumber or 0) .. sym

      elseif method == 'massToMoles' then
        local mm = molarMass(args.formula or '')
        return mm > 0 and (args.mass or 0) / mm or 0

      elseif method == 'molesToMass' then
        return (args.moles or 0) * molarMass(args.formula or '')

      elseif method == 'molesToParticles' then
        return (args.moles or 0) * AVOGADRO

      elseif method == 'particlesToMoles' then
        return (args.particles or 0) / AVOGADRO

      elseif method == 'massToParticles' then
        local mm = molarMass(args.formula or '')
        local moles_val = mm > 0 and (args.mass or 0) / mm or 0
        return moles_val * AVOGADRO

      elseif method == 'idealGasPressure' then
        return (args.n or 0) * R_GAS * (args.T or 0) / (args.V or 1)

      elseif method == 'idealGasVolume' then
        return (args.n or 0) * R_GAS * (args.T or 0) / (args.P or 1)

      elseif method == 'idealGasMoles' then
        return (args.P or 0) * (args.V or 0) / (R_GAS * (args.T or 1))

      elseif method == 'molarity' then
        local liters = args.liters or 0
        return liters > 0 and (args.moles or 0) / liters or 0

      elseif method == 'dilution' then
        local M2 = args.M2 or 0
        return M2 > 0 and (args.M1 or 0) * (args.V1 or 0) / M2 or 0

      elseif method == 'equilibrium' then
        local kEq = args.kEq or 1
        local shift = 'none'
        local direction = 'equilibrium'
        if args.changeTemp and args.deltaH then
          shift = args.changeTemp > 0
            and (args.deltaH > 0 and 'right' or 'left')
            or  (args.deltaH > 0 and 'left'  or 'right')
        end
        if args.changePressure then
          shift = args.changePressure > 0 and 'left' or 'right'
        end
        if kEq > 1 then direction = 'forward'
        elseif kEq < 1 then direction = 'reverse' end
        return {
          kEq         = kEq,
          direction   = direction,
          shift       = shift,
          temperature = (args.temperature or 298) + (args.changeTemp or 0),
          pressure    = (args.pressure or 1) + (args.changePressure or 0),
        }
      end

      return nil
    end,
  }
end

-- ── Public accessors (for other Lua modules) ─────────────────────────────────

function M.getElement(key)
  if type(key) == "number" then
    return ELEMENTS[key]
  elseif type(key) == "string" then
    local trimmed = key:match("^%s*(.-)%s*$")
    if trimmed == "" then return nil end
    return BY_SYMBOL[trimmed]
      or BY_SYMBOL[trimmed:sub(1,1):upper() .. trimmed:sub(2):lower()]
      or BY_ELEMENT_NAME[trimmed:lower()]
  end
  return nil
end

function M.getShells(key)
  local e = M.getElement(key)
  return e and e.shells or nil
end

return M
