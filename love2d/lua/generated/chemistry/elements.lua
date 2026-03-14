-- chemistry/elements.tsl — Element data (118 elements, IUPAC 2024)
--
-- Compiles to Lua. This is the periodic table data store.
local ELEMENTS = {}
local BY_SYMBOL = {}
local BY_ELEMENT_NAME = {}
local function el(n, sym, name, mass, cat, grp, per, phase, en, shells, cpk, mp, bp, dens)
  local e = {
    number = n,
    symbol = sym,
    name = name,
    mass = mass,
    category = cat,
    group = grp,
    period = per,
    phase = phase,
    electronegativity = en,
    shells = shells,
    cpkColor = cpk,
    meltingPoint = mp,
    boilingPoint = bp,
    density = dens,
  }
  ELEMENTS[n] = e
  BY_SYMBOL[sym] = e
  BY_ELEMENT_NAME[string.lower(name)] = e
end
el(1, "H", "Hydrogen", 1.008, "nonmetal", 1, 1, "gas", 2.2, {1}, "#FFFFFF", 14.01, 20.28, 0.00008988)
el(2, "He", "Helium", 4.0026, "noble-gas", 18, 1, "gas", nil, {2}, "#D9FFFF", 0.95, 4.22, 0.0001785)
el(3, "Li", "Lithium", 6.941, "alkali-metal", 1, 2, "solid", 0.98, {2, 1}, "#CC80FF", 453.69, 1615, 0.534)
el(4, "Be", "Beryllium", 9.0122, "alkaline-earth", 2, 2, "solid", 1.57, {2, 2}, "#C2FF00", 1560, 2742, 1.85)
el(5, "B", "Boron", 10.81, "metalloid", 13, 2, "solid", 2.04, {2, 3}, "#FFB5B5", 2349, 4200, 2.34)
el(6, "C", "Carbon", 12.011, "nonmetal", 14, 2, "solid", 2.55, {2, 4}, "#909090", 3823, 4098, 2.267)
el(7, "N", "Nitrogen", 14.007, "nonmetal", 15, 2, "gas", 3.04, {2, 5}, "#3050F8", 63.15, 77.36, 0.0012506)
el(8, "O", "Oxygen", 15.999, "nonmetal", 16, 2, "gas", 3.44, {2, 6}, "#FF0D0D", 54.36, 90.2, 0.001429)
el(9, "F", "Fluorine", 18.998, "halogen", 17, 2, "gas", 3.98, {2, 7}, "#90E050", 53.53, 85.03, 0.001696)
el(10, "Ne", "Neon", 20.18, "noble-gas", 18, 2, "gas", nil, {2, 8}, "#B3E3F5", 24.56, 27.07, 0.0008999)
el(11, "Na", "Sodium", 22.99, "alkali-metal", 1, 3, "solid", 0.93, {2, 8, 1}, "#AB5CF2", 370.87, 1156, 0.971)
el(12, "Mg", "Magnesium", 24.305, "alkaline-earth", 2, 3, "solid", 1.31, {2, 8, 2}, "#8AFF00", 923, 1363, 1.738)
el(13, "Al", "Aluminium", 26.982, "post-transition-metal", 13, 3, "solid", 1.61, {2, 8, 3}, "#BFA6A6", 933.47, 2792, 2.698)
el(14, "Si", "Silicon", 28.086, "metalloid", 14, 3, "solid", 1.9, {2, 8, 4}, "#F0C8A0", 1687, 3538, 2.3296)
el(15, "P", "Phosphorus", 30.974, "nonmetal", 15, 3, "solid", 2.19, {2, 8, 5}, "#FF8000", 317.3, 550, 1.82)
el(16, "S", "Sulfur", 32.06, "nonmetal", 16, 3, "solid", 2.58, {2, 8, 6}, "#FFFF30", 388.36, 717.87, 2.067)
el(17, "Cl", "Chlorine", 35.45, "halogen", 17, 3, "gas", 3.16, {2, 8, 7}, "#1FF01F", 171.6, 239.11, 0.003214)
el(18, "Ar", "Argon", 39.948, "noble-gas", 18, 3, "gas", nil, {2, 8, 8}, "#80D1E3", 83.8, 87.3, 0.0017837)
el(19, "K",  "Potassium",     39.098,  "alkali-metal",          1, 4,"solid", 0.82,{2,8,8,1},        "#8F40D4", 336.53, 1032,   0.862)
el(20, "Ca", "Calcium",       40.078,  "alkaline-earth",        2, 4,"solid", 1.00,{2,8,8,2},        "#3DFF00", 1115,   1757,   1.54)
el(21, "Sc", "Scandium",      44.956,  "transition-metal",      3, 4,"solid", 1.36,{2,8,9,2},        "#E6E6E6", 1814,   3109,   2.989)
el(22, "Ti", "Titanium",      47.867,  "transition-metal",      4, 4,"solid", 1.54,{2,8,10,2},       "#BFC2C7", 1941,   3560,   4.54)
el(23, "V",  "Vanadium",      50.942,  "transition-metal",      5, 4,"solid", 1.63,{2,8,11,2},       "#A6A6AB", 2183,   3680,   6.11)
el(24, "Cr", "Chromium",      51.996,  "transition-metal",      6, 4,"solid", 1.66,{2,8,13,1},       "#8A99C7", 2180,   2944,   7.15)
el(25, "Mn", "Manganese",     54.938,  "transition-metal",      7, 4,"solid", 1.55,{2,8,13,2},       "#9C7AC7", 1519,   2334,   7.44)
el(26, "Fe", "Iron",          55.845,  "transition-metal",      8, 4,"solid", 1.83,{2,8,14,2},       "#E06633", 1811,   3134,   7.874)
el(27, "Co", "Cobalt",        58.933,  "transition-metal",      9, 4,"solid", 1.88,{2,8,15,2},       "#F090A0", 1768,   3200,   8.86)
el(28, "Ni", "Nickel",        58.693,  "transition-metal",     10, 4,"solid", 1.91,{2,8,16,2},       "#50D050", 1728,   3186,   8.912)
el(29, "Cu", "Copper",        63.546,  "transition-metal",     11, 4,"solid", 1.90,{2,8,18,1},       "#C88033", 1357.77,2835,   8.96)
el(30, "Zn", "Zinc",          65.38,   "transition-metal",     12, 4,"solid", 1.65,{2,8,18,2},       "#7D80B0", 692.68, 1180,   7.134)
el(31, "Ga", "Gallium",       69.723,  "post-transition-metal",13, 4,"solid", 1.81,{2,8,18,3},       "#C28F8F", 302.91, 2477,   5.907)
el(32, "Ge", "Germanium",     72.630,  "metalloid",            14, 4,"solid", 2.01,{2,8,18,4},       "#668F8F", 1211.40,3106,   5.323)
el(33, "As", "Arsenic",       74.922,  "metalloid",            15, 4,"solid", 2.18,{2,8,18,5},       "#BD80E3", 1090,   887,    5.776)
el(34, "Se", "Selenium",      78.971,  "nonmetal",             16, 4,"solid", 2.55,{2,8,18,6},       "#FFA100", 493.65, 958,    4.809)
el(35, "Br", "Bromine",       79.904,  "halogen",              17, 4,"liquid",2.96,{2,8,18,7},       "#A62929", 265.8,  332.0,  3.122)
el(36, "Kr", "Krypton",       83.798,  "noble-gas",            18, 4,"gas",   3.00,{2,8,18,8},       "#5CB8D1", 115.79, 119.93, 0.003733)
el(37, "Rb", "Rubidium",      85.468,  "alkali-metal",          1, 5,"solid", 0.82,{2,8,18,8,1},     "#702EB0", 312.46, 961,    1.532)
el(38, "Sr", "Strontium",     87.62,   "alkaline-earth",        2, 5,"solid", 0.95,{2,8,18,8,2},     "#00FF00", 1050,   1655,   2.64)
el(39, "Y",  "Yttrium",       88.906,  "transition-metal",      3, 5,"solid", 1.22,{2,8,18,9,2},     "#94FFFF", 1799,   3609,   4.469)
el(40, "Zr", "Zirconium",     91.224,  "transition-metal",      4, 5,"solid", 1.33,{2,8,18,10,2},    "#94E0E0", 2128,   4682,   6.506)
el(41, "Nb", "Niobium",       92.906,  "transition-metal",      5, 5,"solid", 1.60,{2,8,18,12,1},    "#73C2C9", 2750,   5017,   8.57)
el(42, "Mo", "Molybdenum",    95.95,   "transition-metal",      6, 5,"solid", 2.16,{2,8,18,13,1},    "#54B5B5", 2896,   4912,   10.22)
el(43, "Tc", "Technetium",    98,      "transition-metal",      7, 5,"solid", 1.90,{2,8,18,13,2},    "#3B9E9E", 2430,   4538,   11.5)
el(44, "Ru", "Ruthenium",     101.07,  "transition-metal",      8, 5,"solid", 2.20,{2,8,18,15,1},    "#248F8F", 2607,   4423,   12.37)
el(45, "Rh", "Rhodium",       102.91,  "transition-metal",      9, 5,"solid", 2.28,{2,8,18,16,1},    "#0A7D8C", 2237,   3968,   12.41)
el(46, "Pd", "Palladium",     106.42,  "transition-metal",     10, 5,"solid", 2.20,{2,8,18,18},      "#006985", 1828.05,3236,   12.02)
el(47, "Ag", "Silver",        107.87,  "transition-metal",     11, 5,"solid", 1.93,{2,8,18,18,1},    "#C0C0C0", 1234.93,2435,   10.501)
el(48, "Cd", "Cadmium",       112.41,  "transition-metal",     12, 5,"solid", 1.69,{2,8,18,18,2},    "#FFD98F", 594.22, 1040,   8.69)
el(49, "In", "Indium",        114.82,  "post-transition-metal",13, 5,"solid", 1.78,{2,8,18,18,3},    "#A67573", 429.75, 2345,   7.31)
el(50, "Sn", "Tin",           118.71,  "post-transition-metal",14, 5,"solid", 1.96,{2,8,18,18,4},    "#668080", 505.08, 2875,   7.287)
el(51, "Sb", "Antimony",      121.76,  "metalloid",            15, 5,"solid", 2.05,{2,8,18,18,5},    "#9E63B5", 903.78, 1860,   6.685)
el(52, "Te", "Tellurium",     127.60,  "metalloid",            16, 5,"solid", 2.10,{2,8,18,18,6},    "#D47A00", 722.66, 1261,   6.232)
el(53, "I",  "Iodine",        126.90,  "halogen",              17, 5,"solid", 2.66,{2,8,18,18,7},    "#940094", 386.85, 457.4,  4.933)
el(54, "Xe", "Xenon",         131.29,  "noble-gas",            18, 5,"gas",   2.60,{2,8,18,18,8},    "#429EB0", 161.36, 165.03, 0.005887)
el(55, "Cs", "Caesium",       132.91,  "alkali-metal",          1, 6,"solid", 0.79,{2,8,18,18,8,1},  "#57178F", 301.59, 944,    1.879)
el(56, "Ba", "Barium",        137.33,  "alkaline-earth",        2, 6,"solid", 0.89,{2,8,18,18,8,2},  "#00C900", 1000,   2143,   3.594)
el(57, "La", "Lanthanum",     138.91,  "lanthanide",            3, 6,"solid", 1.10,{2,8,18,18,9,2},  "#70D4FF", 1193,   3737,   6.162)
el(58, "Ce", "Cerium",        140.12,  "lanthanide",            3, 6,"solid", 1.12,{2,8,18,19,9,2},  "#FFFFC7", 1068,   3716,   6.770)
el(59, "Pr", "Praseodymium",  140.91,  "lanthanide",            3, 6,"solid", 1.13,{2,8,18,21,8,2},  "#D9FFC7", 1208,   3793,   6.773)
el(60, "Nd", "Neodymium",     144.24,  "lanthanide",            3, 6,"solid", 1.14,{2,8,18,22,8,2},  "#C7FFC7", 1297,   3347,   7.007)
el(61, "Pm", "Promethium",    145,     "lanthanide",            3, 6,"solid", nil, {2,8,18,23,8,2},  "#A3FFC7", 1315,   3273,   7.26)
el(62, "Sm", "Samarium",      150.36,  "lanthanide",            3, 6,"solid", 1.17,{2,8,18,24,8,2},  "#8FFFC7", 1345,   2067,   7.52)
el(63, "Eu", "Europium",      151.96,  "lanthanide",            3, 6,"solid", nil, {2,8,18,25,8,2},  "#61FFC7", 1099,   1802,   5.243)
el(64, "Gd", "Gadolinium",    157.25,  "lanthanide",            3, 6,"solid", 1.20,{2,8,18,25,9,2},  "#45FFC7", 1585,   3546,   7.895)
el(65, "Tb", "Terbium",       158.93,  "lanthanide",            3, 6,"solid", nil, {2,8,18,27,8,2},  "#30FFC7", 1629,   3503,   8.229)
el(66, "Dy", "Dysprosium",    162.50,  "lanthanide",            3, 6,"solid", 1.22,{2,8,18,28,8,2},  "#1FFFC7", 1680,   2840,   8.550)
el(67, "Ho", "Holmium",       164.93,  "lanthanide",            3, 6,"solid", 1.23,{2,8,18,29,8,2},  "#00FF9C", 1734,   2993,   8.795)
el(68, "Er", "Erbium",        167.26,  "lanthanide",            3, 6,"solid", 1.24,{2,8,18,30,8,2},  "#00E675", 1802,   3141,   9.066)
el(69, "Tm", "Thulium",       168.93,  "lanthanide",            3, 6,"solid", 1.25,{2,8,18,31,8,2},  "#00D452", 1818,   2223,   9.321)
el(70, "Yb", "Ytterbium",     173.05,  "lanthanide",            3, 6,"solid", nil, {2,8,18,32,8,2},  "#00BF38", 1097,   1469,   6.965)
el(71, "Lu", "Lutetium",      174.97,  "lanthanide",            3, 6,"solid", 1.27,{2,8,18,32,9,2},  "#00AB24", 1925,   3675,   9.840)
el(72, "Hf", "Hafnium",       178.49,  "transition-metal",      4, 6,"solid", 1.30,{2,8,18,32,10,2}, "#4DC2FF", 2506,   4876,   13.31)
el(73, "Ta", "Tantalum",      180.95,  "transition-metal",      5, 6,"solid", 1.50,{2,8,18,32,11,2}, "#4DA6FF", 3290,   5731,   16.654)
el(74, "W",  "Tungsten",      183.84,  "transition-metal",      6, 6,"solid", 2.36,{2,8,18,32,12,2}, "#2194D6", 3695,   5828,   19.25)
el(75, "Re", "Rhenium",       186.21,  "transition-metal",      7, 6,"solid", 1.90,{2,8,18,32,13,2}, "#267DAB", 3459,   5869,   21.02)
el(76, "Os", "Osmium",        190.23,  "transition-metal",      8, 6,"solid", 2.20,{2,8,18,32,14,2}, "#266696", 3306,   5285,   22.59)
el(77, "Ir", "Iridium",       192.22,  "transition-metal",      9, 6,"solid", 2.20,{2,8,18,32,15,2}, "#175487", 2719,   4701,   22.56)
el(78, "Pt", "Platinum",      195.08,  "transition-metal",     10, 6,"solid", 2.28,{2,8,18,32,17,1}, "#D0D0E0", 2041.4, 4098,   21.45)
el(79, "Au", "Gold",          196.97,  "transition-metal",     11, 6,"solid", 2.54,{2,8,18,32,18,1}, "#FFD123", 1337.33,3129,   19.282)
el(80, "Hg", "Mercury",       200.59,  "transition-metal",     12, 6,"liquid",2.00,{2,8,18,32,18,2}, "#B8B8D0", 234.43, 629.88, 13.534)
el(81, "Tl", "Thallium",      204.38,  "post-transition-metal",13, 6,"solid", 1.62,{2,8,18,32,18,3}, "#A6544D", 577,    1746,   11.85)
el(82, "Pb", "Lead",          207.2,   "post-transition-metal",14, 6,"solid", 2.33,{2,8,18,32,18,4}, "#575961", 600.61, 2022,   11.342)
el(83, "Bi", "Bismuth",       208.98,  "post-transition-metal",15, 6,"solid", 2.02,{2,8,18,32,18,5}, "#9E4FB5", 544.55, 1837,   9.807)
el(84, "Po", "Polonium",      209,     "post-transition-metal",16, 6,"solid", 2.00,{2,8,18,32,18,6}, "#AB5C00", 527,    1235,   9.32)
el(85, "At", "Astatine",      210,     "halogen",              17, 6,"solid", 2.20,{2,8,18,32,18,7}, "#754F45", 575,    610,    nil)
el(86, "Rn", "Radon",         222,     "noble-gas",            18, 6,"gas",   nil, {2,8,18,32,18,8}, "#428296", 202,    211.3,  0.00973)
el(87, "Fr", "Francium",      223,     "alkali-metal",          1, 7,"solid", 0.70,{2,8,18,32,18,8,1},"#420066",300,    950,    nil)
el(88, "Ra", "Radium",        226,     "alkaline-earth",        2, 7,"solid", 0.90,{2,8,18,32,18,8,2},"#007D00",973,    2010,   5.5)
el(89, "Ac", "Actinium",      227,     "actinide",              3, 7,"solid", 1.10,{2,8,18,32,18,9,2},"#70ABFA",1323,   3471,   10.07)
el(90, "Th", "Thorium",       232.04,  "actinide",              3, 7,"solid", 1.30,{2,8,18,32,18,10,2},"#00BAFF",1750,  4788,   11.724)
el(91, "Pa", "Protactinium",  231.04,  "actinide",              3, 7,"solid", 1.50,{2,8,18,32,20,9,2},"#00A1FF",1841,   4300,   15.37)
el(92, "U",  "Uranium",       238.03,  "actinide",              3, 7,"solid", 1.38,{2,8,18,32,21,9,2},"#008FFF",1405.3, 4404,   18.95)
el(93, "Np", "Neptunium",     237,     "actinide",              3, 7,"solid", 1.36,{2,8,18,32,22,9,2},"#0080FF",917,    4273,   20.45)
el(94, "Pu", "Plutonium",     244,     "actinide",              3, 7,"solid", 1.28,{2,8,18,32,24,8,2},"#006BFF",912.5,  3501,   19.816)
el(95, "Am", "Americium",     243,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,25,8,2},"#545CF2",1449,   2880,   13.67)
el(96, "Cm", "Curium",        247,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,25,9,2},"#785CE3",1613,   3383,   13.51)
el(97, "Bk", "Berkelium",     247,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,27,8,2},"#8A4FE3",1259,   2900,   14.78)
el(98, "Cf", "Californium",   251,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,28,8,2},"#A136D4",1173,   nil,    15.1)
el(99, "Es", "Einsteinium",   252,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,29,8,2},"#B31FD4",1133,   nil,    nil)
el(100,"Fm", "Fermium",       257,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,30,8,2},"#B31FBA",1800,   nil,    nil)
el(101,"Md", "Mendelevium",   258,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,31,8,2},"#B30DA6",1100,   nil,    nil)
el(102,"No", "Nobelium",      259,     "actinide",              3, 7,"solid", 1.30,{2,8,18,32,32,8,2},"#BD0D87",1100,   nil,    nil)
el(103,"Lr", "Lawrencium",    262,     "actinide",              3, 7,"solid", nil, {2,8,18,32,32,8,3},"#C70066",1900,   nil,    nil)
el(104,"Rf", "Rutherfordium", 267,     "transition-metal",      4, 7,"solid", nil, {2,8,18,32,32,10,2},"#CC0059",nil,  nil,    nil)
el(105,"Db", "Dubnium",       270,     "transition-metal",      5, 7,"solid", nil, {2,8,18,32,32,11,2},"#D1004F",nil,  nil,    nil)
el(106,"Sg", "Seaborgium",    271,     "transition-metal",      6, 7,"solid", nil, {2,8,18,32,32,12,2},"#D90045",nil,  nil,    nil)
el(107,"Bh", "Bohrium",       270,     "transition-metal",      7, 7,"solid", nil, {2,8,18,32,32,13,2},"#E00038",nil,  nil,    nil)
el(108,"Hs", "Hassium",       277,     "transition-metal",      8, 7,"solid", nil, {2,8,18,32,32,14,2},"#E6002E",nil,  nil,    nil)
el(109,"Mt", "Meitnerium",    278,     "unknown",               9, 7,"solid", nil, {2,8,18,32,32,15,2},"#EB0026",nil,  nil,    nil)
el(110,"Ds", "Darmstadtium",  281,     "unknown",              10, 7,"solid", nil, {2,8,18,32,32,17,1},"#000000",nil,  nil,    nil)
el(111,"Rg", "Roentgenium",   282,     "unknown",              11, 7,"solid", nil, {2,8,18,32,32,18,1},"#000000",nil,  nil,    nil)
el(112,"Cn", "Copernicium",   285,     "transition-metal",     12, 7,"liquid",nil, {2,8,18,32,32,18,2},"#000000",nil,  nil,    nil)
el(113,"Nh", "Nihonium",      286,     "post-transition-metal",13, 7,"solid", nil, {2,8,18,32,32,18,3},"#000000",nil,  nil,    nil)
el(114,"Fl", "Flerovium",     289,     "post-transition-metal",14, 7,"solid", nil, {2,8,18,32,32,18,4},"#000000",nil,  nil,    nil)
el(115,"Mc", "Moscovium",     290,     "post-transition-metal",15, 7,"solid", nil, {2,8,18,32,32,18,5},"#000000",nil,  nil,    nil)
el(116,"Lv", "Livermorium",   293,     "post-transition-metal",16, 7,"solid", nil, {2,8,18,32,32,18,6},"#000000",nil,  nil,    nil)
el(117,"Ts", "Tennessine",    294,     "halogen",              17, 7,"solid", nil, {2,8,18,32,32,18,7},"#000000",nil,  nil,    nil)
el(118,"Og", "Oganesson",     294,     "noble-gas",            18, 7,"gas",   nil, {2,8,18,32,32,18,8},"#000000",nil,  nil,    nil)
local function getElement(key)
  if type(key) == "number" then
    return ELEMENTS[key]
  end
  if type(key) == "string" then
    local trimmed = key:match("^%s*(.-)%s*$")
    if trimmed == "" then
      return nil
    end
    local normalizedSymbol = string.upper(string.sub(trimmed, 1, 1)) .. string.lower(string.sub(trimmed, 2))
    return BY_SYMBOL[trimmed] or BY_SYMBOL[normalizedSymbol] or BY_ELEMENT_NAME[string.lower(trimmed)]
  end
  return nil
end
local function getShells(key)
  local e = getElement(key)
  return (e and e.shells or nil)
end
local function valenceElectrons(z)
  local e = ELEMENTS[z]
  if not e or not e.shells or #e.shells == 0 then
    return 0
  end
  return e.shells[#e.shells - 1]
end

return {
  getElement = getElement,
  getShells = getShells,
  valenceElectrons = valenceElectrons,
  ELEMENTS = ELEMENTS,
  BY_SYMBOL = BY_SYMBOL,
  BY_ELEMENT_NAME = BY_ELEMENT_NAME,
}
