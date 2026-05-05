(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // framework/ambient_primitives.ts
  var init_ambient_primitives = __esm({
    "framework/ambient_primitives.ts"() {
    }
  });

  // runtime/cart_externs/react.cjs
  var require_react = __commonJS({
    "runtime/cart_externs/react.cjs"(exports, module) {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      module.exports = globalThis.__hostModules.react;
    }
  });

  // framework/ambient.ts
  function r() {
    return require_react();
  }
  function lazyProp(name) {
    return new Proxy(function() {
    }, {
      get(_t, prop) {
        return r()[name][prop];
      },
      apply(_t, _self, a) {
        return r()[name](...a);
      },
      construct(_t, a) {
        return new (r())[name](...a);
      },
      has(_t, prop) {
        return prop in r()[name];
      },
      ownKeys(_t) {
        return Reflect.ownKeys(r()[name]);
      },
      getOwnPropertyDescriptor(_t, prop) {
        return Object.getOwnPropertyDescriptor(r()[name], prop);
      }
    });
  }
  var Suspense, Children;
  var init_ambient = __esm({
    "framework/ambient.ts"() {
      Suspense = lazyProp("Suspense");
      Children = lazyProp("Children");
    }
  });

  // runtime/theme_presets.ts
  function findTheme(name) {
    const lower = name.toLowerCase();
    for (const t of themes) {
      if (t.name.toLowerCase() === lower) return t;
    }
    return null;
  }
  var rgb, rounded_airy, catppuccin_mocha_styles, dracula_styles, tokyo_night_styles, nord_styles, solarized_dark_styles, gruvbox_dark_styles, bios_styles, win95_styles, winamp_styles, glass_styles, catppuccin_mocha, catppuccin_macchiato, catppuccin_frappe, catppuccin_latte, dracula, dracula_soft, gruvbox_dark, gruvbox_light, nord, nord_light, one_dark, rose_pine, rose_pine_dawn, solarized_dark, solarized_light, tokyo_night, tokyo_night_storm, bios, win95, winamp, glass, themes;
  var init_theme_presets = __esm({
    "runtime/theme_presets.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      rgb = (r2, g2, b) => "#" + [r2, g2, b].map((n) => n.toString(16).padStart(2, "0")).join("");
      rounded_airy = {
        radiusSm: 4,
        radiusMd: 8,
        radiusLg: 16,
        spacingSm: 8,
        spacingMd: 16,
        spacingLg: 24,
        borderThin: 1,
        borderMedium: 2,
        fontSm: 11,
        fontMd: 13,
        fontLg: 18
      };
      catppuccin_mocha_styles = {
        radiusSm: 6,
        radiusMd: 8,
        radiusLg: 12,
        spacingSm: 6,
        spacingMd: 10,
        spacingLg: 14,
        borderThin: 1,
        borderMedium: 1,
        fontSm: 12,
        fontMd: 14,
        fontLg: 17
      };
      dracula_styles = {
        radiusSm: 4,
        radiusMd: 6,
        radiusLg: 10,
        spacingSm: 6,
        spacingMd: 10,
        spacingLg: 16,
        borderThin: 1,
        borderMedium: 2,
        fontSm: 12,
        fontMd: 14,
        fontLg: 18
      };
      tokyo_night_styles = {
        radiusSm: 3,
        radiusMd: 5,
        radiusLg: 8,
        spacingSm: 4,
        spacingMd: 8,
        spacingLg: 12,
        borderThin: 1,
        borderMedium: 1,
        fontSm: 12,
        fontMd: 14,
        fontLg: 16
      };
      nord_styles = {
        radiusSm: 4,
        radiusMd: 6,
        radiusLg: 10,
        spacingSm: 6,
        spacingMd: 10,
        spacingLg: 14,
        borderThin: 1,
        borderMedium: 1,
        fontSm: 12,
        fontMd: 14,
        fontLg: 17
      };
      solarized_dark_styles = {
        radiusSm: 3,
        radiusMd: 5,
        radiusLg: 8,
        spacingSm: 6,
        spacingMd: 10,
        spacingLg: 16,
        borderThin: 1,
        borderMedium: 2,
        fontSm: 12,
        fontMd: 14,
        fontLg: 18
      };
      gruvbox_dark_styles = {
        radiusSm: 4,
        radiusMd: 6,
        radiusLg: 10,
        spacingSm: 6,
        spacingMd: 10,
        spacingLg: 16,
        borderThin: 1,
        borderMedium: 2,
        fontSm: 12,
        fontMd: 14,
        fontLg: 18
      };
      bios_styles = {
        radiusSm: 0,
        radiusMd: 0,
        radiusLg: 0,
        spacingSm: 4,
        spacingMd: 8,
        spacingLg: 12,
        borderThin: 1,
        borderMedium: 1,
        fontSm: 12,
        fontMd: 14,
        fontLg: 16
      };
      win95_styles = {
        radiusSm: 0,
        radiusMd: 0,
        radiusLg: 0,
        spacingSm: 4,
        spacingMd: 6,
        spacingLg: 10,
        borderThin: 2,
        borderMedium: 3,
        fontSm: 11,
        fontMd: 13,
        fontLg: 16
      };
      winamp_styles = {
        radiusSm: 1,
        radiusMd: 2,
        radiusLg: 3,
        spacingSm: 2,
        spacingMd: 4,
        spacingLg: 8,
        borderThin: 1,
        borderMedium: 1,
        fontSm: 10,
        fontMd: 12,
        fontLg: 14
      };
      glass_styles = {
        radiusSm: 8,
        radiusMd: 12,
        radiusLg: 16,
        spacingSm: 6,
        spacingMd: 10,
        spacingLg: 16,
        borderThin: 1,
        borderMedium: 1,
        fontSm: 12,
        fontMd: 14,
        fontLg: 18
      };
      catppuccin_mocha = {
        bg: rgb(30, 30, 46),
        bgAlt: rgb(24, 24, 37),
        bgElevated: rgb(49, 50, 68),
        surface: rgb(49, 50, 68),
        surfaceHover: rgb(69, 71, 90),
        border: rgb(69, 71, 90),
        borderFocus: rgb(137, 180, 250),
        text: rgb(205, 214, 244),
        textSecondary: rgb(186, 194, 222),
        textDim: rgb(166, 173, 200),
        primary: rgb(137, 180, 250),
        primaryHover: rgb(116, 199, 236),
        primaryPressed: rgb(137, 220, 235),
        accent: rgb(203, 166, 247),
        error: rgb(243, 139, 168),
        warning: rgb(250, 179, 135),
        success: rgb(166, 227, 161),
        info: rgb(137, 220, 235)
      };
      catppuccin_macchiato = {
        bg: rgb(36, 39, 58),
        bgAlt: rgb(30, 32, 48),
        bgElevated: rgb(54, 58, 79),
        surface: rgb(54, 58, 79),
        surfaceHover: rgb(73, 77, 100),
        border: rgb(73, 77, 100),
        borderFocus: rgb(138, 173, 244),
        text: rgb(202, 211, 245),
        textSecondary: rgb(184, 192, 224),
        textDim: rgb(165, 173, 203),
        primary: rgb(138, 173, 244),
        primaryHover: rgb(125, 196, 228),
        primaryPressed: rgb(145, 215, 227),
        accent: rgb(198, 160, 246),
        error: rgb(237, 135, 150),
        warning: rgb(245, 169, 127),
        success: rgb(166, 218, 149),
        info: rgb(145, 215, 227)
      };
      catppuccin_frappe = {
        bg: rgb(48, 52, 70),
        bgAlt: rgb(41, 44, 60),
        bgElevated: rgb(65, 69, 89),
        surface: rgb(65, 69, 89),
        surfaceHover: rgb(81, 87, 109),
        border: rgb(81, 87, 109),
        borderFocus: rgb(140, 170, 238),
        text: rgb(198, 208, 245),
        textSecondary: rgb(181, 191, 226),
        textDim: rgb(165, 173, 206),
        primary: rgb(140, 170, 238),
        primaryHover: rgb(133, 193, 220),
        primaryPressed: rgb(153, 209, 219),
        accent: rgb(202, 158, 230),
        error: rgb(231, 130, 132),
        warning: rgb(239, 159, 118),
        success: rgb(166, 209, 137),
        info: rgb(153, 209, 219)
      };
      catppuccin_latte = {
        bg: rgb(239, 241, 245),
        bgAlt: rgb(230, 233, 239),
        bgElevated: rgb(204, 208, 218),
        surface: rgb(204, 208, 218),
        surfaceHover: rgb(188, 192, 204),
        border: rgb(188, 192, 204),
        borderFocus: rgb(30, 102, 245),
        text: rgb(76, 79, 105),
        textSecondary: rgb(92, 95, 119),
        textDim: rgb(108, 111, 133),
        primary: rgb(30, 102, 245),
        primaryHover: rgb(32, 159, 181),
        primaryPressed: rgb(4, 165, 229),
        accent: rgb(136, 57, 239),
        error: rgb(210, 15, 57),
        warning: rgb(254, 100, 11),
        success: rgb(64, 160, 43),
        info: rgb(4, 165, 229)
      };
      dracula = {
        bg: rgb(40, 42, 54),
        bgAlt: rgb(33, 34, 44),
        bgElevated: rgb(68, 71, 90),
        surface: rgb(68, 71, 90),
        surfaceHover: rgb(77, 80, 94),
        border: rgb(68, 71, 90),
        borderFocus: rgb(189, 147, 249),
        text: rgb(248, 248, 242),
        textSecondary: rgb(191, 191, 191),
        textDim: rgb(98, 114, 164),
        primary: rgb(189, 147, 249),
        primaryHover: rgb(202, 164, 250),
        primaryPressed: rgb(212, 181, 251),
        accent: rgb(255, 121, 198),
        error: rgb(255, 85, 85),
        warning: rgb(255, 184, 108),
        success: rgb(80, 250, 123),
        info: rgb(139, 233, 253)
      };
      dracula_soft = {
        bg: rgb(45, 47, 63),
        bgAlt: rgb(37, 39, 55),
        bgElevated: rgb(68, 71, 90),
        surface: rgb(68, 71, 90),
        surfaceHover: rgb(77, 80, 94),
        border: rgb(68, 71, 90),
        borderFocus: rgb(189, 147, 249),
        text: rgb(242, 242, 232),
        textSecondary: rgb(184, 184, 176),
        textDim: rgb(98, 114, 164),
        primary: rgb(189, 147, 249),
        primaryHover: rgb(202, 164, 250),
        primaryPressed: rgb(212, 181, 251),
        accent: rgb(255, 121, 198),
        error: rgb(255, 85, 85),
        warning: rgb(255, 184, 108),
        success: rgb(80, 250, 123),
        info: rgb(139, 233, 253)
      };
      gruvbox_dark = {
        bg: rgb(40, 40, 40),
        bgAlt: rgb(60, 56, 54),
        bgElevated: rgb(80, 73, 69),
        surface: rgb(60, 56, 54),
        surfaceHover: rgb(80, 73, 69),
        border: rgb(80, 73, 69),
        borderFocus: rgb(131, 165, 152),
        text: rgb(235, 219, 178),
        textSecondary: rgb(213, 196, 161),
        textDim: rgb(146, 131, 116),
        primary: rgb(131, 165, 152),
        primaryHover: rgb(142, 192, 124),
        primaryPressed: rgb(184, 187, 38),
        accent: rgb(211, 134, 155),
        error: rgb(251, 73, 52),
        warning: rgb(254, 128, 25),
        success: rgb(184, 187, 38),
        info: rgb(131, 165, 152)
      };
      gruvbox_light = {
        bg: rgb(251, 241, 199),
        bgAlt: rgb(235, 219, 178),
        bgElevated: rgb(213, 196, 161),
        surface: rgb(235, 219, 178),
        surfaceHover: rgb(213, 196, 161),
        border: rgb(213, 196, 161),
        borderFocus: rgb(7, 102, 120),
        text: rgb(60, 56, 54),
        textSecondary: rgb(80, 73, 69),
        textDim: rgb(146, 131, 116),
        primary: rgb(7, 102, 120),
        primaryHover: rgb(66, 123, 88),
        primaryPressed: rgb(121, 116, 14),
        accent: rgb(143, 63, 113),
        error: rgb(157, 0, 6),
        warning: rgb(175, 58, 3),
        success: rgb(121, 116, 14),
        info: rgb(7, 102, 120)
      };
      nord = {
        bg: rgb(46, 52, 64),
        bgAlt: rgb(59, 66, 82),
        bgElevated: rgb(67, 76, 94),
        surface: rgb(59, 66, 82),
        surfaceHover: rgb(67, 76, 94),
        border: rgb(67, 76, 94),
        borderFocus: rgb(136, 192, 208),
        text: rgb(236, 239, 244),
        textSecondary: rgb(216, 222, 233),
        textDim: rgb(76, 86, 106),
        primary: rgb(136, 192, 208),
        primaryHover: rgb(143, 188, 187),
        primaryPressed: rgb(129, 161, 193),
        accent: rgb(180, 142, 173),
        error: rgb(191, 97, 106),
        warning: rgb(208, 135, 112),
        success: rgb(163, 190, 140),
        info: rgb(94, 129, 172)
      };
      nord_light = {
        bg: rgb(236, 239, 244),
        bgAlt: rgb(229, 233, 240),
        bgElevated: rgb(216, 222, 233),
        surface: rgb(216, 222, 233),
        surfaceHover: rgb(229, 233, 240),
        border: rgb(216, 222, 233),
        borderFocus: rgb(94, 129, 172),
        text: rgb(46, 52, 64),
        textSecondary: rgb(59, 66, 82),
        textDim: rgb(76, 86, 106),
        primary: rgb(94, 129, 172),
        primaryHover: rgb(129, 161, 193),
        primaryPressed: rgb(136, 192, 208),
        accent: rgb(180, 142, 173),
        error: rgb(191, 97, 106),
        warning: rgb(208, 135, 112),
        success: rgb(163, 190, 140),
        info: rgb(94, 129, 172)
      };
      one_dark = {
        bg: rgb(40, 44, 52),
        bgAlt: rgb(33, 37, 43),
        bgElevated: rgb(44, 49, 58),
        surface: rgb(44, 49, 58),
        surfaceHover: rgb(51, 56, 66),
        border: rgb(62, 68, 82),
        borderFocus: rgb(97, 175, 239),
        text: rgb(171, 178, 191),
        textSecondary: rgb(157, 165, 180),
        textDim: rgb(92, 99, 112),
        primary: rgb(97, 175, 239),
        primaryHover: rgb(86, 182, 194),
        primaryPressed: rgb(152, 195, 121),
        accent: rgb(198, 120, 221),
        error: rgb(224, 108, 117),
        warning: rgb(209, 154, 102),
        success: rgb(152, 195, 121),
        info: rgb(86, 182, 194)
      };
      rose_pine = {
        bg: rgb(25, 23, 36),
        bgAlt: rgb(31, 29, 46),
        bgElevated: rgb(38, 35, 58),
        surface: rgb(31, 29, 46),
        surfaceHover: rgb(38, 35, 58),
        border: rgb(38, 35, 58),
        borderFocus: rgb(49, 116, 143),
        text: rgb(224, 222, 244),
        textSecondary: rgb(144, 140, 170),
        textDim: rgb(110, 106, 134),
        primary: rgb(49, 116, 143),
        primaryHover: rgb(156, 207, 216),
        primaryPressed: rgb(235, 188, 186),
        accent: rgb(196, 167, 231),
        error: rgb(235, 111, 146),
        warning: rgb(246, 193, 119),
        success: rgb(49, 116, 143),
        info: rgb(156, 207, 216)
      };
      rose_pine_dawn = {
        bg: rgb(250, 244, 237),
        bgAlt: rgb(255, 250, 243),
        bgElevated: rgb(242, 233, 225),
        surface: rgb(255, 250, 243),
        surfaceHover: rgb(242, 233, 225),
        border: rgb(223, 218, 217),
        borderFocus: rgb(40, 105, 131),
        text: rgb(87, 82, 121),
        textSecondary: rgb(121, 117, 147),
        textDim: rgb(152, 147, 165),
        primary: rgb(40, 105, 131),
        primaryHover: rgb(86, 148, 159),
        primaryPressed: rgb(215, 130, 126),
        accent: rgb(144, 122, 169),
        error: rgb(180, 99, 122),
        warning: rgb(234, 157, 52),
        success: rgb(40, 105, 131),
        info: rgb(86, 148, 159)
      };
      solarized_dark = {
        bg: rgb(0, 43, 54),
        bgAlt: rgb(7, 54, 66),
        bgElevated: rgb(7, 54, 66),
        surface: rgb(7, 54, 66),
        surfaceHover: rgb(7, 54, 66),
        border: rgb(88, 110, 117),
        borderFocus: rgb(38, 139, 210),
        text: rgb(131, 148, 150),
        textSecondary: rgb(147, 161, 161),
        textDim: rgb(88, 110, 117),
        primary: rgb(38, 139, 210),
        primaryHover: rgb(42, 161, 152),
        primaryPressed: rgb(133, 153, 0),
        accent: rgb(108, 113, 196),
        error: rgb(220, 50, 47),
        warning: rgb(203, 75, 22),
        success: rgb(133, 153, 0),
        info: rgb(42, 161, 152)
      };
      solarized_light = {
        bg: rgb(253, 246, 227),
        bgAlt: rgb(238, 232, 213),
        bgElevated: rgb(238, 232, 213),
        surface: rgb(238, 232, 213),
        surfaceHover: rgb(238, 232, 213),
        border: rgb(147, 161, 161),
        borderFocus: rgb(38, 139, 210),
        text: rgb(101, 123, 131),
        textSecondary: rgb(88, 110, 117),
        textDim: rgb(147, 161, 161),
        primary: rgb(38, 139, 210),
        primaryHover: rgb(42, 161, 152),
        primaryPressed: rgb(133, 153, 0),
        accent: rgb(108, 113, 196),
        error: rgb(220, 50, 47),
        warning: rgb(203, 75, 22),
        success: rgb(133, 153, 0),
        info: rgb(42, 161, 152)
      };
      tokyo_night = {
        bg: rgb(26, 27, 38),
        bgAlt: rgb(22, 22, 30),
        bgElevated: rgb(36, 40, 59),
        surface: rgb(36, 40, 59),
        surfaceHover: rgb(41, 46, 66),
        border: rgb(41, 46, 66),
        borderFocus: rgb(122, 162, 247),
        text: rgb(192, 202, 245),
        textSecondary: rgb(169, 177, 214),
        textDim: rgb(86, 95, 137),
        primary: rgb(122, 162, 247),
        primaryHover: rgb(125, 207, 255),
        primaryPressed: rgb(42, 195, 222),
        accent: rgb(187, 154, 247),
        error: rgb(247, 118, 142),
        warning: rgb(224, 175, 104),
        success: rgb(158, 206, 106),
        info: rgb(125, 207, 255)
      };
      tokyo_night_storm = {
        bg: rgb(36, 40, 59),
        bgAlt: rgb(31, 35, 53),
        bgElevated: rgb(41, 46, 66),
        surface: rgb(41, 46, 66),
        surfaceHover: rgb(52, 59, 88),
        border: rgb(52, 59, 88),
        borderFocus: rgb(122, 162, 247),
        text: rgb(192, 202, 245),
        textSecondary: rgb(169, 177, 214),
        textDim: rgb(86, 95, 137),
        primary: rgb(122, 162, 247),
        primaryHover: rgb(125, 207, 255),
        primaryPressed: rgb(42, 195, 222),
        accent: rgb(187, 154, 247),
        error: rgb(247, 118, 142),
        warning: rgb(224, 175, 104),
        success: rgb(158, 206, 106),
        info: rgb(125, 207, 255)
      };
      bios = {
        bg: rgb(0, 0, 170),
        bgAlt: rgb(0, 0, 136),
        bgElevated: rgb(17, 17, 187),
        surface: rgb(0, 0, 136),
        surfaceHover: rgb(0, 0, 170),
        border: rgb(85, 85, 85),
        borderFocus: rgb(0, 170, 170),
        text: rgb(170, 170, 170),
        textSecondary: rgb(136, 136, 136),
        textDim: rgb(85, 85, 85),
        primary: rgb(0, 170, 170),
        primaryHover: rgb(85, 255, 255),
        primaryPressed: rgb(255, 255, 255),
        accent: rgb(255, 255, 85),
        error: rgb(255, 85, 85),
        warning: rgb(255, 170, 0),
        success: rgb(85, 255, 85),
        info: rgb(85, 255, 255)
      };
      win95 = {
        bg: rgb(192, 192, 192),
        bgAlt: rgb(160, 160, 160),
        bgElevated: rgb(223, 223, 223),
        surface: rgb(255, 255, 255),
        surfaceHover: rgb(232, 232, 232),
        border: rgb(128, 128, 128),
        borderFocus: rgb(0, 0, 128),
        text: rgb(0, 0, 0),
        textSecondary: rgb(64, 64, 64),
        textDim: rgb(128, 128, 128),
        primary: rgb(0, 0, 128),
        primaryHover: rgb(128, 0, 176),
        primaryPressed: rgb(160, 32, 240),
        accent: rgb(153, 0, 204),
        error: rgb(255, 0, 0),
        warning: rgb(255, 136, 0),
        success: rgb(0, 128, 0),
        info: rgb(0, 0, 255)
      };
      winamp = {
        bg: rgb(18, 18, 18),
        bgAlt: rgb(28, 28, 28),
        bgElevated: rgb(40, 40, 40),
        surface: rgb(32, 32, 32),
        surfaceHover: rgb(48, 48, 48),
        border: rgb(64, 64, 64),
        borderFocus: rgb(0, 255, 0),
        text: rgb(0, 255, 0),
        textSecondary: rgb(0, 204, 0),
        textDim: rgb(0, 128, 0),
        primary: rgb(0, 255, 0),
        primaryHover: rgb(102, 255, 102),
        primaryPressed: rgb(204, 255, 0),
        accent: rgb(255, 153, 0),
        error: rgb(255, 51, 51),
        warning: rgb(255, 204, 0),
        success: rgb(0, 255, 0),
        info: rgb(51, 204, 255)
      };
      glass = {
        bg: rgb(15, 20, 30),
        bgAlt: rgb(25, 32, 45),
        bgElevated: rgb(40, 50, 68),
        surface: rgb(35, 45, 60),
        surfaceHover: rgb(50, 62, 80),
        border: rgb(80, 110, 150),
        borderFocus: rgb(100, 180, 255),
        text: rgb(235, 240, 255),
        textSecondary: rgb(180, 195, 220),
        textDim: rgb(120, 140, 170),
        primary: rgb(100, 180, 255),
        primaryHover: rgb(140, 200, 255),
        primaryPressed: rgb(180, 220, 255),
        accent: rgb(160, 140, 255),
        error: rgb(255, 100, 120),
        warning: rgb(255, 200, 100),
        success: rgb(100, 230, 180),
        info: rgb(120, 200, 255)
      };
      themes = [
        { name: "Catppuccin Mocha", colors: catppuccin_mocha, styles: catppuccin_mocha_styles },
        { name: "Catppuccin Macchiato", colors: catppuccin_macchiato },
        { name: "Catppuccin Frappe", colors: catppuccin_frappe },
        { name: "Catppuccin Latte", colors: catppuccin_latte },
        { name: "Dracula", colors: dracula, styles: dracula_styles },
        { name: "Dracula Soft", colors: dracula_soft },
        { name: "Gruvbox Dark", colors: gruvbox_dark, styles: gruvbox_dark_styles },
        { name: "Gruvbox Light", colors: gruvbox_light },
        { name: "Nord", colors: nord, styles: nord_styles },
        { name: "Nord Light", colors: nord_light },
        { name: "One Dark", colors: one_dark },
        { name: "Rose Pine", colors: rose_pine },
        { name: "Rose Pine Dawn", colors: rose_pine_dawn },
        { name: "Solarized Dark", colors: solarized_dark, styles: solarized_dark_styles },
        { name: "Solarized Light", colors: solarized_light },
        { name: "Tokyo Night", colors: tokyo_night, styles: tokyo_night_styles },
        { name: "Tokyo Night Storm", colors: tokyo_night_storm },
        { name: "BIOS", colors: bios, styles: bios_styles },
        { name: "Win95 Vaporwave", colors: win95, styles: win95_styles },
        { name: "Winamp", colors: winamp, styles: winamp_styles },
        { name: "Glass", colors: glass, styles: glass_styles }
      ];
    }
  });

  // runtime/theme.tsx
  var theme_exports = {};
  __export(theme_exports, {
    ThemeProvider: () => ThemeProvider,
    __useClassifierSnapshot: () => __useClassifierSnapshot,
    applyPreset: () => applyPreset,
    breakpointAtLeast: () => breakpointAtLeast,
    findTheme: () => findTheme,
    getBreakpoint: () => getBreakpoint,
    getColors: () => getColors,
    getStylePalette: () => getStylePalette,
    getVariant: () => getVariant,
    getViewportWidth: () => getViewportWidth,
    hasTokens: () => hasTokens,
    isThemeToken: () => isThemeToken,
    resolveToken: () => resolveToken,
    resolveTokens: () => resolveTokens,
    setBreakpointThresholds: () => setBreakpointThresholds,
    setPalette: () => setPalette,
    setStylePalette: () => setStylePalette,
    setStyleTokens: () => setStyleTokens,
    setTokens: () => setTokens,
    setVariant: () => setVariant,
    setViewportWidth: () => setViewportWidth,
    themes: () => themes,
    useActiveVariant: () => useActiveVariant,
    useBreakpoint: () => useBreakpoint,
    useStylePalette: () => useStylePalette,
    useThemeColors: () => useThemeColors,
    useThemeColorsOptional: () => useThemeColorsOptional,
    useThemeStore: () => useThemeStore,
    useViewportWidth: () => useViewportWidth
  });
  function bpFromWidth(w, md, lg, xl) {
    if (w >= xl) return "xl";
    if (w >= lg) return "lg";
    if (w >= md) return "md";
    return "sm";
  }
  function notify() {
    for (const l of listeners) l();
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }
  function snapshot() {
    return store;
  }
  function setPalette(colors) {
    store = { ...store, colors };
    notify();
  }
  function setTokens(partial) {
    store = { ...store, colors: { ...store.colors, ...partial } };
    notify();
  }
  function setStylePalette(styles) {
    store = { ...store, styles };
    notify();
  }
  function setStyleTokens(partial) {
    store = { ...store, styles: { ...store.styles, ...partial } };
    notify();
  }
  function setVariant(variant) {
    if (store.variant === variant) return;
    store = { ...store, variant };
    notify();
  }
  function applyPreset(preset) {
    store = {
      ...store,
      colors: preset.colors,
      styles: preset.styles,
      variant: preset.variant ?? store.variant
    };
    notify();
  }
  function setViewportWidth(width) {
    const bp = bpFromWidth(width, store.thresholdMd, store.thresholdLg, store.thresholdXl);
    if (width === store.viewportWidth && bp === store.breakpoint) return;
    store = { ...store, viewportWidth: width, breakpoint: bp };
    notify();
  }
  function setBreakpointThresholds(md, lg, xl) {
    const bp = bpFromWidth(store.viewportWidth, md, lg, xl);
    store = { ...store, thresholdMd: md, thresholdLg: lg, thresholdXl: xl, breakpoint: bp };
    notify();
  }
  function getColors() {
    return store.colors;
  }
  function getStylePalette() {
    return store.styles;
  }
  function getVariant() {
    return store.variant;
  }
  function getBreakpoint() {
    return store.breakpoint;
  }
  function getViewportWidth() {
    return store.viewportWidth;
  }
  function breakpointAtLeast(bp) {
    return BP_ORDER.indexOf(store.breakpoint) >= BP_ORDER.indexOf(bp);
  }
  function isThemeToken(v) {
    return typeof v === "string" && v.startsWith(THEME_PREFIX);
  }
  function resolveToken(token, colors, styles) {
    const name = token.slice(THEME_PREFIX.length);
    if (name in colors) return colors[name];
    if (name in styles) return styles[name];
    return token;
  }
  function resolveTokens(obj, colors, styles) {
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (isThemeToken(v)) {
        out[k] = resolveToken(v, colors, styles);
      } else if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Function)) {
        out[k] = resolveTokens(v, colors, styles);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  function hasTokens(obj) {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (isThemeToken(v)) return true;
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Function)) {
        if (hasTokens(v)) return true;
      }
    }
    return false;
  }
  function ThemeProvider({ colors, styles, initialVariant, children }) {
    React.useLayoutEffect(() => {
      if (initialVariant !== void 0) setVariant(initialVariant);
    }, []);
    React.useLayoutEffect(() => {
      if (colors) setTokens(colors);
    }, [colors]);
    React.useLayoutEffect(() => {
      if (styles) setStyleTokens(styles);
    }, [styles]);
    const current = useThemeColors();
    return React.createElement(ThemeContext.Provider, { value: current }, children);
  }
  function useThemeColors() {
    return React.useSyncExternalStore(subscribe, () => snapshot().colors);
  }
  function useThemeColorsOptional() {
    return useThemeColors();
  }
  function useStylePalette() {
    return React.useSyncExternalStore(subscribe, () => snapshot().styles);
  }
  function useActiveVariant() {
    return React.useSyncExternalStore(subscribe, () => snapshot().variant);
  }
  function useBreakpoint() {
    return React.useSyncExternalStore(subscribe, () => snapshot().breakpoint);
  }
  function useViewportWidth() {
    return React.useSyncExternalStore(subscribe, () => snapshot().viewportWidth);
  }
  function useThemeStore() {
    return React.useSyncExternalStore(subscribe, () => {
      const s = snapshot();
      return { colors: s.colors, styles: s.styles, variant: s.variant, breakpoint: s.breakpoint };
    });
  }
  function __useClassifierSnapshot() {
    return React.useSyncExternalStore(subscribe, snapshot);
  }
  var React, BP_ORDER, store, listeners, THEME_PREFIX, ThemeContext;
  var init_theme = __esm({
    "runtime/theme.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      React = __toESM(require_react(), 1);
      init_theme_presets();
      init_theme_presets();
      BP_ORDER = ["sm", "md", "lg", "xl"];
      store = {
        colors: catppuccin_mocha,
        styles: rounded_airy,
        variant: null,
        viewportWidth: 1280,
        breakpoint: "lg",
        thresholdMd: 640,
        thresholdLg: 1024,
        thresholdXl: 1440
      };
      listeners = /* @__PURE__ */ new Set();
      THEME_PREFIX = "theme:";
      ThemeContext = React.createContext(null);
    }
  });

  // runtime/ffi.ts
  function callHost(name, fallback, ...args) {
    const fn = host[name];
    if (typeof fn !== "function") return fallback;
    try {
      return fn(...args);
    } catch {
      return fallback;
    }
  }
  function callHostJson(name, fallback, ...args) {
    const raw = callHost(name, null, ...args);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function subscribe2(channel, fn) {
    let set = _listeners.get(channel);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      _listeners.set(channel, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }
  function dispatchListeners(channel, payload) {
    const set = _listeners.get(channel);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[ffi] ${channel} listener error:`, e?.message || e);
      }
    }
  }
  var host, _listeners;
  var init_ffi = __esm({
    "runtime/ffi.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      host = globalThis;
      _listeners = /* @__PURE__ */ new Map();
      host.__ffiEmit = (channel, payload) => {
        setTimeout(() => dispatchListeners(channel, payload), 0);
      };
    }
  });

  // runtime/hooks/fs.ts
  function readFile(path) {
    return callHost("__fs_read", null, path);
  }
  function writeFile(path, content) {
    return callHost("__fs_write", false, path, content);
  }
  function exists(path) {
    return callHost("__fs_exists", false, path);
  }
  function mkdir(path) {
    return callHost("__fs_mkdir", false, path);
  }
  function stat(path) {
    return callHostJson("__fs_stat_json", null, path);
  }
  var init_fs = __esm({
    "runtime/hooks/fs.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ffi();
    }
  });

  // runtime/cartridge_loader.ts
  var cartridge_loader_exports = {};
  __export(cartridge_loader_exports, {
    cacheSize: () => cacheSize,
    evictCartridge: () => evictCartridge,
    loadCartridge: () => loadCartridge
  });
  function loadCartridge(path) {
    const st = stat(path);
    if (!st) {
      console.error("[cartridge] not found:", path);
      return null;
    }
    const hit = cache.get(path);
    if (hit && hit.mtimeMs === st.mtimeMs) return hit.Component;
    const src = readFile(path);
    if (!src) {
      console.error("[cartridge] read failed:", path);
      return null;
    }
    const slot2 = { App: null };
    const g2 = globalThis;
    const prev = g2.__cartridgeLoadSlot;
    g2.__cartridgeLoadSlot = slot2;
    try {
      (0, eval)(src);
    } catch (e) {
      console.error("[cartridge] eval failed:", path, e?.message || e, e?.stack || "");
      g2.__cartridgeLoadSlot = prev;
      return null;
    }
    g2.__cartridgeLoadSlot = prev;
    if (!slot2.App) {
      console.error("[cartridge] bundle did not register a component:", path);
      return null;
    }
    const loaded = { path, mtimeMs: st.mtimeMs, Component: slot2.App };
    cache.set(path, loaded);
    return slot2.App;
  }
  function evictCartridge(path) {
    cache.delete(path);
  }
  function cacheSize() {
    return cache.size;
  }
  var cache;
  var init_cartridge_loader = __esm({
    "runtime/cartridge_loader.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_fs();
      cache = /* @__PURE__ */ new Map();
    }
  });

  // runtime/audio.tsx
  var audio_exports = {};
  __export(audio_exports, {
    AUDIO_MODULE_TYPE: () => AUDIO_MODULE_TYPE,
    Audio: () => Audio,
    useAudio: () => useAudio
  });
  function useAudio() {
    const ctx = React2.useContext(AudioContext);
    const resolve = (t) => typeof t === "number" ? t : ctx?.getId(t) ?? -1;
    return {
      getId: (n) => ctx?.getId(n),
      noteOn: (t, midi) => {
        const id = resolve(t);
        if (id >= 0) hostNoteOn(id, midi);
      },
      noteOff: (t) => {
        const id = resolve(t);
        if (id >= 0) hostNoteOff(id);
      },
      setParam: (t, name, v) => {
        const id = resolve(t);
        if (id < 0) return;
        const type = ctx?.getType(t);
        if (!type) return;
        const idx = AUDIO_PARAM_INDEX[type]?.[name];
        if (idx === void 0) return;
        hostSetParam(id, idx, v);
      },
      setParamIndex: (t, idx, v) => {
        const id = resolve(t);
        if (id >= 0) hostSetParam(id, idx, v);
      }
    };
  }
  function AudioRoot({ gain, children }) {
    const namesRef = React2.useRef(/* @__PURE__ */ new Map());
    const typesRef = React2.useRef(/* @__PURE__ */ new Map());
    const nextIdRef = React2.useRef({ current: 1 });
    React2.useEffect(() => {
      if (typeof gain === "number") hostMasterGain(gain);
    }, [gain]);
    const ctx = {
      names: namesRef.current,
      types: typesRef.current,
      nextId: nextIdRef.current,
      getId: (name) => namesRef.current.get(name),
      getType: (idOrName) => {
        const id = typeof idOrName === "number" ? idOrName : namesRef.current.get(idOrName);
        return id !== void 0 ? typesRef.current.get(id) : void 0;
      }
    };
    return React2.createElement(AudioContext.Provider, { value: ctx }, children);
  }
  function AudioModule(props) {
    const { id: name, type, children: _, ...paramProps } = props;
    const ctx = React2.useContext(AudioContext);
    const numIdRef = React2.useRef(-1);
    if (numIdRef.current === -1 && ctx) {
      numIdRef.current = ctx.nextId.current++;
      if (name) {
        ctx.names.set(name, numIdRef.current);
        ctx.types.set(numIdRef.current, type);
      }
    }
    const numId = numIdRef.current;
    React2.useEffect(() => {
      if (numId < 0) return;
      hostAdd(numId, AUDIO_MODULE_TYPE[type]);
      return () => {
        hostRemove(numId);
        if (name && ctx) {
          ctx.names.delete(name);
          ctx.types.delete(numId);
        }
      };
    }, []);
    React2.useEffect(() => {
      if (numId < 0) return;
      const schema = AUDIO_PARAM_INDEX[type];
      if (!schema) return;
      for (const key of Object.keys(paramProps)) {
        const idx = schema[key];
        if (idx === void 0) continue;
        const v = paramProps[key];
        if (typeof v === "number") hostSetParam(numId, idx, v);
      }
    });
    return null;
  }
  function AudioConnection({ from, to, fromPort = 0, toPort = 0 }) {
    const ctx = React2.useContext(AudioContext);
    const resolve = (t) => typeof t === "number" ? t : ctx?.getId(t) ?? -1;
    React2.useEffect(() => {
      let connected = false;
      let aId = -1, bId = -1, aPort = fromPort, bPort = toPort;
      const t = setTimeout(() => {
        aId = resolve(from);
        bId = resolve(to);
        if (aId < 0 || bId < 0) return;
        hostConnect(aId, aPort, bId, bPort);
        connected = true;
      }, 0);
      return () => {
        clearTimeout(t);
        if (connected) hostDisconnect(aId, aPort, bId, bPort);
      };
    }, [from, to, fromPort, toPort]);
    return null;
  }
  var React2, AUDIO_MODULE_TYPE, AUDIO_PARAM_INDEX, host2, hostAdd, hostRemove, hostConnect, hostDisconnect, hostSetParam, hostNoteOn, hostNoteOff, hostMasterGain, AudioContext, AudioBase, Audio;
  var init_audio = __esm({
    "runtime/audio.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      React2 = require_react();
      AUDIO_MODULE_TYPE = {
        oscillator: 0,
        filter: 1,
        amplifier: 2,
        mixer: 3,
        delay: 4,
        envelope: 5,
        lfo: 6,
        sequencer: 7,
        sampler: 8,
        custom: 9,
        pocket_voice: 10
      };
      AUDIO_PARAM_INDEX = {
        oscillator: { waveform: 0, frequency: 1, detune: 2, gain: 3, fm_amount: 4 },
        filter: { cutoff: 0, resonance: 1, mode: 2 },
        amplifier: { gain: 0 },
        mixer: { gain_1: 0, gain_2: 1, gain_3: 2, gain_4: 3 },
        delay: { time: 0, feedback: 1, mix: 2 },
        envelope: { attack: 0, decay: 1, sustain: 2, release: 3 },
        lfo: { rate: 0, depth: 1, waveform: 2 },
        sequencer: { bpm: 0, steps: 1 },
        sampler: { gain: 0, loop: 1 },
        custom: {},
        pocket_voice: { voice: 0, tone: 1, decay: 2, color: 3, drive: 4, gain: 5 }
      };
      host2 = () => globalThis;
      hostAdd = (id, mt) => host2().__audioAddModule?.(id, mt);
      hostRemove = (id) => host2().__audioRemoveModule?.(id);
      hostConnect = (a, ap, b, bp) => host2().__audioConnect?.(a, ap, b, bp);
      hostDisconnect = (a, ap, b, bp) => host2().__audioDisconnect?.(a, ap, b, bp);
      hostSetParam = (id, p, v) => host2().__audioSetParam?.(id, p, v);
      hostNoteOn = (id, midi) => host2().__audioNoteOn?.(id, midi);
      hostNoteOff = (id) => host2().__audioNoteOff?.(id);
      hostMasterGain = (g2) => host2().__audioMasterGain?.(g2);
      AudioContext = React2.createContext(null);
      AudioBase = AudioRoot;
      AudioBase.Module = AudioModule;
      AudioBase.Connection = AudioConnection;
      Audio = AudioBase;
    }
  });

  // runtime/primitives.tsx
  var primitives_exports = {};
  __export(primitives_exports, {
    Audio: () => Audio3,
    Box: () => Box,
    Canvas: () => Canvas,
    Cartridge: () => Cartridge,
    Col: () => Col,
    Effect: () => Effect,
    Filter: () => Filter,
    GLYPH_SLOT: () => GLYPH_SLOT,
    Graph: () => Graph,
    Image: () => Image,
    Native: () => Native,
    Notification: () => Notification,
    Physics: () => Physics,
    Pressable: () => Pressable,
    Render: () => Render,
    RenderTarget: () => RenderTarget,
    Row: () => Row,
    Scene3D: () => Scene3D,
    ScrollView: () => ScrollView,
    StaticSurface: () => StaticSurface,
    Terminal: () => Terminal,
    Text: () => Text,
    TextArea: () => TextArea,
    TextEditor: () => TextEditor,
    TextInput: () => TextInput,
    Video: () => Video,
    Window: () => Window,
    notification: () => notification,
    terminal: () => terminal,
    window: () => window
  });
  function isThemeTokenValue(v) {
    return typeof v === "string" && v.startsWith(THEME_PREFIX2);
  }
  function hasThemeTokenValue(v) {
    if (isThemeTokenValue(v)) return true;
    if (!v || typeof v !== "object" || v instanceof Function) return false;
    if (v.$$typeof) return false;
    if (Array.isArray(v)) return v.some(hasThemeTokenValue);
    for (const key of Object.keys(v)) {
      if (key === "children" || key === "key" || key === "ref") continue;
      if (hasThemeTokenValue(v[key])) return true;
    }
    return false;
  }
  function resolveThemeValue(v, colors, styles, resolveToken2) {
    if (isThemeTokenValue(v)) return resolveToken2(v, colors, styles);
    if (!v || typeof v !== "object" || v instanceof Function) return v;
    if (v.$$typeof) return v;
    if (Array.isArray(v)) return v.map((item) => resolveThemeValue(item, colors, styles, resolveToken2));
    const out = {};
    for (const key of Object.keys(v)) {
      out[key] = key === "children" ? v[key] : resolveThemeValue(v[key], colors, styles, resolveToken2);
    }
    return out;
  }
  function useResolvedPrimitiveProps(props) {
    const theme = (init_theme(), __toCommonJS(theme_exports));
    const snap = theme.__useClassifierSnapshot();
    if (!props || !hasThemeTokenValue(props)) return props;
    return resolveThemeValue(props, snap.colors, snap.styles, theme.resolveToken);
  }
  function h(type, props, ...children) {
    return require_react().createElement(type, useResolvedPrimitiveProps(props), ...children);
  }
  function isInlineTextLike(el) {
    if (!el || typeof el !== "object") return false;
    const t = el.type;
    if (t == null) return false;
    if (t === Text) return true;
    if (typeof t === "function" && t.__isClassifier && t.__def?.type === "Text") return true;
    return false;
  }
  function flattenTextChildren(children) {
    if (children == null) return children;
    const list = Array.isArray(children) ? children : [children];
    const out = [];
    let buf = "";
    let bufHas = false;
    const flush = () => {
      if (bufHas) {
        out.push(buf);
        buf = "";
        bufHas = false;
      }
    };
    const visit = (c) => {
      if (c == null || c === false || c === true) return;
      const t = typeof c;
      if (t === "string" || t === "number") {
        buf += String(c);
        bufHas = true;
        return;
      }
      if (Array.isArray(c)) {
        for (const ci of c) visit(ci);
        return;
      }
      if (isInlineTextLike(c)) {
        const inner = c.props?.children;
        if (inner != null) visit(inner);
        return;
      }
      flush();
      out.push(c);
    };
    for (const c of list) visit(c);
    flush();
    if (out.length === 0) return void 0;
    if (out.length === 1) return out[0];
    return out;
  }
  function _hexToRgb(hex, fallback = [0.8, 0.8, 0.8]) {
    if (!hex || typeof hex !== "string") return fallback;
    const s = hex.startsWith("#") ? hex.slice(1) : hex;
    const expanded = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    if (expanded.length !== 6) return fallback;
    const n = parseInt(expanded, 16);
    if (Number.isNaN(n)) return fallback;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function _vec3(v, dx = 0, dy = 0, dz = 0) {
    if (Array.isArray(v) && v.length === 3) return [v[0] ?? dx, v[1] ?? dy, v[2] ?? dz];
    return [dx, dy, dz];
  }
  function _scaleVec3(v) {
    if (typeof v === "number") return [v, v, v];
    if (Array.isArray(v) && v.length === 3) return [v[0] ?? 1, v[1] ?? 1, v[2] ?? 1];
    return [1, 1, 1];
  }
  function nativePropsEqual(prev, next) {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of nextKeys) {
      if (key === "children") continue;
      if (key.startsWith("on") && key.length > 2 && key[2] === key[2].toUpperCase()) {
        if (key in prev !== key in next) return false;
        continue;
      }
      if (prev[key] !== next[key]) return false;
    }
    return true;
  }
  function getNativeMemoized() {
    if (_NativeMemoized) return _NativeMemoized;
    const R = require_react();
    _NativeMemoized = R.memo(function NativeInner({ type, ...props }) {
      return R.createElement(type, props);
    }, nativePropsEqual);
    return _NativeMemoized;
  }
  var THEME_PREFIX2, Box, Row, Col, Text, GLYPH_SLOT, Image, Pressable, ScrollView, TextInput, TextArea, TextEditor, Terminal, terminal, Window, window, Notification, notification, Video, Cartridge, RenderTarget, StaticSurface, Filter, PhysicsBase, Physics, Scene3DBase, Scene3D, AudioBase2, Audio3, CanvasBase, Canvas, GraphBase, Graph, Render, Effect, _NativeMemoized, Native;
  var init_primitives = __esm({
    "runtime/primitives.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      THEME_PREFIX2 = "theme:";
      Box = (props) => h("View", props, props.children);
      Row = (props) => {
        const style = { flexDirection: "row", ...props.style ?? {} };
        return h("View", { ...props, style }, props.children);
      };
      Col = (props) => {
        const style = { flexDirection: "column", ...props.style ?? {} };
        return h("View", { ...props, style }, props.children);
      };
      Text = (props) => {
        const { size, bold, style, children, ...rest } = props;
        const flat = flattenTextChildren(children);
        if (size == null && !bold) return h("Text", { ...rest, style }, flat);
        const shorthand = {};
        if (size != null) shorthand.fontSize = size;
        if (bold) shorthand.fontWeight = "bold";
        return h("Text", { ...rest, style: { ...shorthand, ...style ?? {} } }, flat);
      };
      GLYPH_SLOT = "";
      Image = (props) => h("Image", props, props.children);
      Pressable = (props) => h("Pressable", props, props.children);
      ScrollView = (props) => {
        const React5 = require_react();
        const hotId = React5.useId();
        const hotKey = "scroll:" + hotId;
        const host4 = globalThis;
        let initialY = 0;
        if (typeof host4.__hot_get === "function") {
          try {
            const raw = host4.__hot_get(hotKey);
            if (raw != null) {
              const n = parseFloat(raw);
              if (Number.isFinite(n)) initialY = n;
            }
          } catch {
          }
        }
        const userOnScroll = props.onScroll;
        const onScroll = (payload) => {
          try {
            if (typeof host4.__hot_set === "function" && Number.isFinite(payload?.scrollY)) {
              host4.__hot_set(hotKey, String(payload.scrollY));
            }
          } catch {
          }
          if (typeof userOnScroll === "function") userOnScroll(payload);
        };
        const forwardedProps = {
          ...props,
          onScroll,
          initialScrollY: props.initialScrollY ?? initialY
        };
        return h("ScrollView", forwardedProps, props.children);
      };
      TextInput = (props) => h("TextInput", props, props.children);
      TextArea = (props) => h("TextArea", props, props.children);
      TextEditor = (props) => h("TextEditor", props, props.children);
      Terminal = (props) => h("Terminal", props, props.children);
      terminal = Terminal;
      Window = (props) => h("Window", props, props.children);
      window = Window;
      Notification = (props) => h("Notification", props, props.children);
      notification = Notification;
      Video = ({ src, videoSrc, ...rest }) => h("Image", { ...rest, videoSrc: videoSrc ?? src }, rest.children);
      Cartridge = ({ src, ...rest }) => {
        if (!src) return null;
        const { loadCartridge: loadCartridge2 } = (init_cartridge_loader(), __toCommonJS(cartridge_loader_exports));
        const Comp = loadCartridge2(src);
        if (!Comp) {
          return h("Text", { color: "red" }, `[cartridge load failed: ${src}]`);
        }
        return h(Comp, rest);
      };
      RenderTarget = ({ src, renderSrc, ...rest }) => h("View", { ...rest, renderSrc: renderSrc ?? src }, rest.children);
      StaticSurface = ({
        staticKey,
        staticSurfaceKey,
        scale,
        staticSurfaceScale,
        warmupFrames,
        staticSurfaceWarmupFrames,
        introFrames,
        staticSurfaceIntroFrames,
        ...rest
      }) => {
        const React5 = require_react();
        const id = React5.useId();
        return h("View", {
          ...rest,
          staticSurface: true,
          staticSurfaceKey: staticSurfaceKey ?? staticKey ?? id,
          staticSurfaceScale: staticSurfaceScale ?? scale ?? 1,
          staticSurfaceWarmupFrames: staticSurfaceWarmupFrames ?? warmupFrames ?? 0,
          staticSurfaceIntroFrames: staticSurfaceIntroFrames ?? introFrames ?? 0
        }, rest.children);
      };
      Filter = ({ shader, intensity, ...rest }) => h("View", {
        ...rest,
        filterName: shader,
        filterIntensity: intensity ?? 1
      }, rest.children);
      PhysicsBase = ({ gravityX, gravityY, ...rest }) => h("View", {
        ...rest,
        physicsWorld: true,
        physicsGravityX: gravityX ?? 0,
        physicsGravityY: gravityY ?? 980
      }, rest.children);
      PhysicsBase.World = PhysicsBase;
      PhysicsBase.Body = ({ type, x, y, angle, fixedRotation, bullet, gravityScale, ...rest }) => h("View", {
        ...rest,
        physicsBody: true,
        physicsBodyType: type ?? "dynamic",
        physicsX: x ?? 0,
        physicsY: y ?? 0,
        physicsAngle: angle ?? 0,
        physicsFixedRotation: fixedRotation ?? false,
        physicsBullet: bullet ?? false,
        physicsGravityScale: gravityScale ?? 1
      }, rest.children);
      PhysicsBase.Collider = ({ shape, radius, density, friction, restitution, ...rest }) => h("View", {
        ...rest,
        physicsCollider: true,
        physicsShape: shape ?? "box",
        physicsRadius: radius ?? 0,
        physicsDensity: density ?? 1,
        physicsFriction: friction ?? 0.3,
        physicsRestitution: restitution ?? 0.1
      }, rest.children);
      Physics = PhysicsBase;
      Scene3DBase = ({ showGrid, showAxes, ...rest }) => h("View", {
        ...rest,
        scene3d: true,
        scene3dShowGrid: !!showGrid,
        scene3dShowAxes: !!showAxes
      }, rest.children);
      Scene3DBase.Camera = ({ position, target, fov, ...rest }) => {
        const [px, py, pz] = _vec3(position, 3, 2, 4);
        const [lx, ly, lz] = _vec3(target, 0, 0, 0);
        return h("View", {
          ...rest,
          scene3dCamera: true,
          scene3dPosX: px,
          scene3dPosY: py,
          scene3dPosZ: pz,
          scene3dLookX: lx,
          scene3dLookY: ly,
          scene3dLookZ: lz,
          scene3dFov: fov ?? 60
        });
      };
      Scene3DBase.Mesh = ({ geometry, material, color, position, rotation, scale, radius, tubeRadius, sizeX, sizeY, sizeZ, ...rest }) => {
        const matColor = typeof material === "string" ? material : material?.color ?? color;
        const [r2, g2, b] = _hexToRgb(matColor, [0.8, 0.8, 0.8]);
        const [px, py, pz] = _vec3(position, 0, 0, 0);
        const [rx, ry, rz] = _vec3(rotation, 0, 0, 0);
        const [sx, sy, sz] = _scaleVec3(scale);
        return h("View", {
          ...rest,
          scene3dMesh: true,
          scene3dGeometry: typeof geometry === "string" ? geometry : geometry?.kind ?? "box",
          scene3dPosX: px,
          scene3dPosY: py,
          scene3dPosZ: pz,
          scene3dRotX: rx,
          scene3dRotY: ry,
          scene3dRotZ: rz,
          scene3dScaleX: sx,
          scene3dScaleY: sy,
          scene3dScaleZ: sz,
          scene3dColorR: r2,
          scene3dColorG: g2,
          scene3dColorB: b,
          scene3dRadius: radius ?? geometry?.radius ?? 0.5,
          scene3dTubeRadius: tubeRadius ?? geometry?.tube ?? 0.25,
          scene3dSizeX: sizeX ?? geometry?.width ?? 1,
          scene3dSizeY: sizeY ?? geometry?.height ?? 1,
          scene3dSizeZ: sizeZ ?? geometry?.depth ?? 1
        });
      };
      Scene3DBase.AmbientLight = ({ color, intensity, ...rest }) => {
        const [r2, g2, b] = _hexToRgb(color, [1, 1, 1]);
        return h("View", {
          ...rest,
          scene3dLight: true,
          scene3dLightType: "ambient",
          scene3dColorR: r2,
          scene3dColorG: g2,
          scene3dColorB: b,
          scene3dIntensity: intensity ?? 0.3
        });
      };
      Scene3DBase.DirectionalLight = ({ direction, color, intensity, ...rest }) => {
        const [dx, dy, dz] = _vec3(direction, 0, -1, 0);
        const [r2, g2, b] = _hexToRgb(color, [1, 1, 1]);
        return h("View", {
          ...rest,
          scene3dLight: true,
          scene3dLightType: "directional",
          scene3dDirX: dx,
          scene3dDirY: dy,
          scene3dDirZ: dz,
          scene3dColorR: r2,
          scene3dColorG: g2,
          scene3dColorB: b,
          scene3dIntensity: intensity ?? 1
        });
      };
      Scene3DBase.PointLight = ({ position, color, intensity, ...rest }) => {
        const [px, py, pz] = _vec3(position, 0, 0, 0);
        const [r2, g2, b] = _hexToRgb(color, [1, 1, 1]);
        return h("View", {
          ...rest,
          scene3dLight: true,
          scene3dLightType: "point",
          scene3dPosX: px,
          scene3dPosY: py,
          scene3dPosZ: pz,
          scene3dColorR: r2,
          scene3dColorG: g2,
          scene3dColorB: b,
          scene3dIntensity: intensity ?? 1
        });
      };
      Scene3DBase.OrbitControls = (_props) => null;
      Scene3D = Scene3DBase;
      AudioBase2 = function Audio2(props) {
        return (init_audio(), __toCommonJS(audio_exports)).Audio(props);
      };
      AudioBase2.Module = function Module(props) {
        return (init_audio(), __toCommonJS(audio_exports)).Audio.Module(props);
      };
      AudioBase2.Connection = function Connection(props) {
        return (init_audio(), __toCommonJS(audio_exports)).Audio.Connection(props);
      };
      Audio3 = AudioBase2;
      CanvasBase = (props) => h("Canvas", props, props.children);
      CanvasBase.Node = (props) => h("Canvas.Node", props, props.children);
      CanvasBase.Path = (props) => h("Canvas.Path", props, props.children);
      CanvasBase.Clamp = (props) => h("Canvas.Clamp", props, props.children);
      Canvas = CanvasBase;
      GraphBase = (props) => h("Graph", props, props.children);
      GraphBase.Path = (props) => h("Graph.Path", props, props.children);
      GraphBase.Node = (props) => h("Graph.Node", props, props.children);
      Graph = GraphBase;
      Render = (props) => h("Render", props, props.children);
      Effect = (props) => h("Effect", props, props.children);
      _NativeMemoized = null;
      Native = function Native2(props) {
        return h(getNativeMemoized(), props);
      };
    }
  });

  // runtime/router.tsx
  var router_exports = {};
  __export(router_exports, {
    Link: () => Link,
    Route: () => Route,
    Router: () => Router,
    matchRoute: () => matchRoute,
    useNavigate: () => useNavigate,
    useRoute: () => useRoute
  });
  function subscribeRouter(listener) {
    routerListeners.add(listener);
    return () => {
      routerListeners.delete(listener);
    };
  }
  function notifyRouterListeners() {
    for (const listener of Array.from(routerListeners)) {
      try {
        listener();
      } catch (e) {
        console.error("[router] listener error:", e?.message || e);
      }
    }
  }
  function hostInit(path) {
    host3().__routerInit?.(path);
  }
  function hostPush(path, hotKey) {
    host3().__routerPush?.(normalizePath(path));
    persistCurrentPath(hotKey);
    notifyRouterListeners();
  }
  function hostReplace(path, hotKey) {
    host3().__routerReplace?.(normalizePath(path));
    persistCurrentPath(hotKey);
    notifyRouterListeners();
  }
  function hostBack(hotKey) {
    host3().__routerBack?.();
    persistCurrentPath(hotKey);
    notifyRouterListeners();
  }
  function hostForward(hotKey) {
    host3().__routerForward?.();
    persistCurrentPath(hotKey);
    notifyRouterListeners();
  }
  function hostCurrentPath() {
    return host3().__routerCurrentPath?.() ?? "/";
  }
  function normalizePath(path, fallback = "/") {
    if (typeof path !== "string" || path.length === 0) return fallback;
    return path.startsWith("/") ? path : `/${path}`;
  }
  function readHotPath(hotKey) {
    try {
      const raw = host3().__hot_get?.(hotKey);
      if (raw == null) return null;
      if (typeof raw !== "string" || raw.length === 0) return null;
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "string" && parsed.length > 0 ? normalizePath(parsed) : null;
      } catch {
        return raw.startsWith("/") ? raw : null;
      }
    } catch {
      return null;
    }
  }
  function writeHotPath(hotKey, path) {
    if (!hotKey) return;
    try {
      host3().__hot_set?.(hotKey, JSON.stringify(normalizePath(path)));
    } catch {
    }
  }
  function persistCurrentPath(hotKey) {
    writeHotPath(hotKey, hostCurrentPath());
  }
  function matchRoute(pattern, pathname) {
    const pat = stripTrailingSlash(pattern);
    const path = stripTrailingSlash(pathname);
    if (pat === path) return { matched: true, params: {} };
    const patSegs = pat.split("/").filter(Boolean);
    const pathSegs = path.split("/").filter(Boolean);
    const wildcard = patSegs[patSegs.length - 1] === "*";
    if (wildcard) {
      if (pathSegs.length < patSegs.length - 1) return NO_MATCH;
    } else {
      if (patSegs.length !== pathSegs.length) return NO_MATCH;
    }
    const params = {};
    for (let i = 0; i < patSegs.length; i++) {
      const ps = patSegs[i];
      if (ps === "*") break;
      const seg = pathSegs[i];
      if (ps.startsWith(":")) {
        params[ps.slice(1)] = decodeSegment(seg);
      } else if (ps !== seg) {
        return NO_MATCH;
      }
    }
    return { matched: true, params };
  }
  function stripTrailingSlash(s) {
    return s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s;
  }
  function decodeSegment(s) {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }
  function Router({
    initialPath = "/",
    hotKey = DEFAULT_ROUTER_HOT_KEY,
    children
  }) {
    const routerHotKey = hotKey || DEFAULT_ROUTER_HOT_KEY;
    const [, forceRender] = React3.useState(0);
    const initRef = React3.useRef(null);
    if (initRef.current !== routerHotKey) {
      const restoredPath = readHotPath(routerHotKey);
      const path2 = restoredPath ?? normalizePath(initialPath);
      hostInit(path2);
      writeHotPath(routerHotKey, path2);
      initRef.current = routerHotKey;
    }
    React3.useEffect(() => subscribeRouter(() => forceRender((n) => n + 1)), []);
    const path = hostCurrentPath();
    return React3.createElement(
      RouterContext.Provider,
      { value: { path, params: {}, hotKey: routerHotKey } },
      children
    );
  }
  function Route({
    path,
    fallback,
    children
  }) {
    const ctx = React3.useContext(RouterContext);
    if (fallback) {
      const matched = ctx.__matched;
      if (matched) return null;
      return typeof children === "function" ? children({}) : children;
    }
    if (!path) return null;
    const m = matchRoute(path, ctx.path);
    if (!m.matched) return null;
    ctx.__matched = true;
    if (typeof children === "function") return children(m.params);
    if (React3.isValidElement(children)) {
      return React3.cloneElement(children, { params: m.params });
    }
    return children;
  }
  function Link({
    to,
    replace,
    children,
    style,
    ...rest
  }) {
    const nav = useNavigate();
    const onPress = () => replace ? nav.replace(to) : nav.push(to);
    return React3.createElement(
      "Pressable",
      { ...rest, style, onPress },
      children
    );
  }
  function useRoute() {
    return React3.useContext(RouterContext);
  }
  function useNavigate() {
    const ctx = React3.useContext(RouterContext);
    const hotKey = ctx.hotKey || DEFAULT_ROUTER_HOT_KEY;
    return {
      push: (path) => hostPush(path, hotKey),
      replace: (path) => hostReplace(path, hotKey),
      back: () => hostBack(hotKey),
      forward: () => hostForward(hotKey)
    };
  }
  var React3, host3, DEFAULT_ROUTER_HOT_KEY, routerListeners, NO_MATCH, RouterContext;
  var init_router = __esm({
    "runtime/router.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      React3 = require_react();
      host3 = () => globalThis;
      DEFAULT_ROUTER_HOT_KEY = "router:path";
      routerListeners = /* @__PURE__ */ new Set();
      NO_MATCH = { matched: false, params: {} };
      RouterContext = React3.createContext({
        path: "/",
        params: {},
        hotKey: DEFAULT_ROUTER_HOT_KEY
      });
    }
  });

  // runtime/jsx_shim.ts
  function resolveIntrinsic(type) {
    if (type === "box") return (init_primitives(), __toCommonJS(primitives_exports)).Box;
    if (type === "text") return (init_primitives(), __toCommonJS(primitives_exports)).Text;
    if (type === "video") return (init_primitives(), __toCommonJS(primitives_exports)).Video;
    if (type === "canvas") return (init_primitives(), __toCommonJS(primitives_exports)).Canvas;
    if (type === "graph") return (init_primitives(), __toCommonJS(primitives_exports)).Graph;
    if (type === "router") return (init_router(), __toCommonJS(router_exports)).Router;
    if (type === "route") return (init_router(), __toCommonJS(router_exports)).Route;
    return type;
  }
  var __jsx;
  var init_jsx_shim = __esm({
    "runtime/jsx_shim.ts"() {
      __jsx = function __jsx2(...a) {
        a[0] = resolveIntrinsic(a[0]);
        return require_react().createElement(...a);
      };
    }
  });

  // runtime/cartridge_entry.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/isolated_tests/chat-loom.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react3 = __toESM(require_react());
  init_primitives();

  // runtime/hooks/http.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_ffi();
  var _reqIdSeq = 1;
  function requestAsync(req) {
    const reqId = `req${_reqIdSeq++}`;
    return new Promise((resolve) => {
      const unsub = subscribe2(`http:${reqId}`, (payload) => {
        unsub();
        resolve(typeof payload === "string" ? JSON.parse(payload) : payload);
      });
      callHost("__http_request_async", void 0, JSON.stringify(req), reqId);
    });
  }

  // runtime/intent/parser.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var ALLOWED = /* @__PURE__ */ new Set([
    "Row",
    "Col",
    "Card",
    "Title",
    "Text",
    "List",
    "Btn",
    "Form",
    "Field",
    "Submit",
    "Badge",
    "Code",
    "Divider",
    "Kbd",
    "Spacer"
  ]);
  function parseIntent(input) {
    let src = input.trim();
    const openBracket = src.indexOf("[");
    const closeBracket = src.lastIndexOf("]");
    if (openBracket !== -1 && closeBracket > openBracket) {
      src = src.slice(openBracket + 1, closeBracket).trim();
    }
    if (src.startsWith("<>") && src.endsWith("</>")) {
      src = src.slice(2, -3).trim();
    }
    const p = new Parser(src);
    return p.parseChildren(null);
  }
  var Parser = class {
    constructor(src) {
      this.src = src;
    }
    src;
    pos = 0;
    parseChildren(closer) {
      const out = [];
      while (this.pos < this.src.length) {
        const lt = this.src.indexOf("<", this.pos);
        if (lt === -1) {
          const tail = this.src.slice(this.pos).trim();
          if (tail) out.push({ kind: "text", attrs: {}, children: [], text: tail });
          this.pos = this.src.length;
          break;
        }
        if (lt > this.pos) {
          const txt = this.src.slice(this.pos, lt).trim();
          if (txt) out.push({ kind: "text", attrs: {}, children: [], text: txt });
        }
        this.pos = lt;
        if (closer && this.peekClose(closer)) {
          this.pos += closer.length + 3;
          return out;
        }
        if (this.src[this.pos + 1] === "/") {
          const gt = this.src.indexOf(">", this.pos);
          if (gt === -1) {
            this.pos = this.src.length;
            break;
          }
          this.pos = gt + 1;
          continue;
        }
        const node = this.parseElement();
        if (node) out.push(node);
      }
      return out;
    }
    peekClose(name) {
      const tag = `</${name}>`;
      return this.src.slice(this.pos, this.pos + tag.length).toLowerCase() === tag.toLowerCase();
    }
    parseElement() {
      if (this.src[this.pos] !== "<") return null;
      this.pos++;
      const nameStart = this.pos;
      while (this.pos < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.pos])) this.pos++;
      const rawName = this.src.slice(nameStart, this.pos);
      const name = normalizeName(rawName);
      const attrs = {};
      let selfClose = false;
      while (this.pos < this.src.length) {
        this.skipWs();
        const ch = this.src[this.pos];
        if (ch === ">") {
          this.pos++;
          break;
        }
        if (ch === "/" && this.src[this.pos + 1] === ">") {
          selfClose = true;
          this.pos += 2;
          break;
        }
        if (this.pos >= this.src.length) break;
        const keyStart = this.pos;
        while (this.pos < this.src.length && /[A-Za-z0-9_-]/.test(this.src[this.pos])) this.pos++;
        const key = this.src.slice(keyStart, this.pos);
        if (!key) {
          this.pos++;
          continue;
        }
        this.skipWs();
        if (this.src[this.pos] === "=") {
          this.pos++;
          this.skipWs();
          const q = this.src[this.pos];
          if (q === '"' || q === "'") {
            this.pos++;
            const valStart = this.pos;
            while (this.pos < this.src.length && this.src[this.pos] !== q) this.pos++;
            attrs[key] = this.src.slice(valStart, this.pos);
            if (this.src[this.pos] === q) this.pos++;
          } else {
            const valStart = this.pos;
            while (this.pos < this.src.length && !/[\s>/]/.test(this.src[this.pos])) this.pos++;
            attrs[key] = this.src.slice(valStart, this.pos);
          }
        } else {
          attrs[key] = true;
        }
      }
      if (!ALLOWED.has(name)) {
        if (selfClose) return { kind: "text", attrs: {}, children: [], text: `<${rawName}/>` };
        const inner = this.parseChildren(rawName);
        const flat = inner.map((n) => n.text ?? "").join(" ").trim();
        return { kind: "text", attrs: {}, children: [], text: flat || `<${rawName}>` };
      }
      if (selfClose) return { kind: name, attrs, children: [] };
      const children = this.parseChildren(rawName);
      return { kind: name, attrs, children };
    }
    skipWs() {
      while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
    }
  };
  function normalizeName(raw) {
    const map = {
      row: "Row",
      col: "Col",
      column: "Col",
      card: "Card",
      title: "Title",
      text: "Text",
      list: "List",
      btn: "Btn",
      button: "Btn",
      form: "Form",
      field: "Field",
      input: "Field",
      submit: "Submit",
      badge: "Badge",
      pill: "Badge",
      chip: "Badge",
      tag: "Badge",
      code: "Code",
      pre: "Code",
      divider: "Divider",
      hr: "Divider",
      separator: "Divider",
      kbd: "Kbd",
      key: "Kbd",
      shortcut: "Kbd",
      spacer: "Spacer",
      gap: "Spacer"
    };
    return map[raw.toLowerCase()] ?? raw;
  }

  // runtime/intent/render.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/components/intent-surface/IntentSurface.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/components.cls.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // runtime/core_stub.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // runtime/classifier.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react = __toESM(require_react(), 1);
  init_theme();
  init_primitives();

  // runtime/icons/Icon.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();

  // runtime/icons/registry.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var registry = /* @__PURE__ */ new Map();
  var lowerMap = /* @__PURE__ */ new Map();
  function toPascalCase(s) {
    return s.replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/[-_]/g, "");
  }
  var ALIASES = {
    "stop": "CircleStop",
    "search": "Search",
    "settings": "Settings",
    "menu": "Menu",
    "mouse": "MousePointer",
    "atom": "Atom",
    "cloud-rain": "CloudRain",
    "flask": "FlaskConical",
    "presentation": "Presentation",
    "rss": "Rss",
    "trending-up": "TrendingUp",
    "home": "Home",
    "folder": "Folder",
    "folder-open": "FolderOpen",
    "file": "File",
    "file-code": "FileCode",
    "file-json": "FileJson",
    "file-text": "FileText",
    "trash": "Trash2",
    "edit": "Pencil",
    "copy": "Copy",
    "paste": "ClipboardPaste",
    "save": "Save",
    "download": "Download",
    "upload": "Upload",
    "refresh": "RefreshCw",
    "close": "X",
    "check": "Check",
    "plus": "Plus",
    "minus": "Minus",
    "info": "Info",
    "warning": "TriangleAlert",
    "warn": "TriangleAlert",
    "error": "CircleX",
    "help": "CircleHelp",
    "question-mark": "CircleHelp",
    "link": "Link",
    "unlink": "Unlink",
    "lock": "Lock",
    "unlock": "Unlock",
    "eye": "Eye",
    "eye-off": "EyeOff",
    "star": "Star",
    "heart": "Heart",
    "bookmark": "Bookmark",
    "pin": "Pin",
    "filter": "Filter",
    "sort": "ArrowUpDown",
    "arrow-left": "ArrowLeft",
    "arrow-right": "ArrowRight",
    "arrow-up": "ArrowUp",
    "arrow-down": "ArrowDown",
    "chevron-left": "ChevronLeft",
    "chevron-right": "ChevronRight",
    "chevron-up": "ChevronUp",
    "chevron-down": "ChevronDown",
    "move": "Move",
    "maximize": "Maximize",
    "minimize": "Minimize",
    "expand": "Expand",
    "shrink": "Shrink",
    "external-link": "ExternalLink",
    "image": "Image",
    "video": "Video",
    "music": "Music",
    "camera": "Camera",
    "mic": "Mic",
    "volume": "Volume2",
    "speaker": "Speaker",
    "database": "Database",
    "table": "Table",
    "chart": "ChartLine",
    "code": "Code",
    "terminal": "Terminal",
    "git": "GitBranch",
    "git-branch": "GitBranch",
    "git-commit": "GitCommitHorizontal",
    "bug": "Bug",
    "cpu": "Cpu",
    "globe": "Globe",
    "server": "Server",
    "cloud": "Cloud",
    "wifi": "Wifi",
    "zap": "Zap",
    "sun": "Sun",
    "moon": "Moon",
    "clock": "Clock",
    "calendar": "Calendar",
    "mail": "Mail",
    "message": "MessageSquare",
    "chat": "MessageSquare",
    "send": "Send",
    "phone": "Phone",
    "user": "User",
    "users": "Users",
    "shield": "Shield",
    "key": "Key",
    "tag": "Tag",
    "box": "Box",
    "package": "Package",
    "layers": "Layers",
    "grid": "Grid3x3",
    "list": "List",
    "hash": "Hash",
    "at": "AtSign",
    "at-sign": "AtSign",
    "alert": "TriangleAlert",
    "bell": "Bell",
    "book": "Book",
    "book-open": "BookOpen",
    "map": "Map",
    "compass": "Compass",
    "flag": "Flag",
    "target": "Target",
    "palette": "Palette",
    "ruler": "Ruler",
    "keyboard": "Keyboard",
    "play": "Play",
    "pause": "Pause",
    "scissors": "Scissors",
    "bot": "Bot",
    "sparkles": "Sparkles",
    "panel-left": "PanelLeft",
    "panel-right": "PanelRight",
    "panel-bottom": "PanelBottom",
    "pencil": "Pencil",
    "dots-vertical": "EllipsisVertical",
    "x": "X",
    "braces": "Braces",
    "command": "Command",
    "flame": "Flame",
    "graph": "Waypoints",
    "network": "Network",
    "wallet": "Wallet",
    "house": "Home"
  };
  function lookupIcon(name) {
    const direct = registry.get(name);
    if (direct) return direct;
    const canonical = lowerMap.get(name.toLowerCase());
    if (canonical) return registry.get(canonical);
    const pascal = toPascalCase(name);
    const pascalHit = registry.get(pascal);
    if (pascalHit) return pascalHit;
    const alias = ALIASES[name] || ALIASES[name.toLowerCase()];
    if (alias) {
      const aliasHit = registry.get(alias);
      if (aliasHit) return aliasHit;
      const caseFix = lowerMap.get(alias.toLowerCase());
      if (caseFix) return registry.get(caseFix);
    }
    return void 0;
  }

  // runtime/icons/Icon.tsx
  var VIEW = 24;
  var HALF = 12;
  var SIMPLIFY_EPSILON = 0.35;
  var namedPathCache = /* @__PURE__ */ new Map();
  var directPathCache = /* @__PURE__ */ new WeakMap();
  function pointLineDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function simplifyPointRange(points, start, end, keep) {
    if (end <= start + 1) return;
    const ax = points[start][0];
    const ay = points[start][1];
    const bx = points[end][0];
    const by = points[end][1];
    let maxDistance = 0;
    let split = start;
    for (let i = start + 1; i < end; i++) {
      const distance = pointLineDistance(points[i][0], points[i][1], ax, ay, bx, by);
      if (distance > maxDistance) {
        maxDistance = distance;
        split = i;
      }
    }
    if (maxDistance > SIMPLIFY_EPSILON) {
      keep[split] = true;
      simplifyPointRange(points, start, split, keep);
      simplifyPointRange(points, split, end, keep);
    }
  }
  function simplifyPolyline(poly) {
    if (poly.length <= 8) return poly;
    const points = [];
    for (let i = 0; i + 1 < poly.length; i += 2) {
      points.push([poly[i], poly[i + 1]]);
    }
    if (points.length <= 2) return poly;
    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;
    simplifyPointRange(points, 0, points.length - 1, keep);
    const out = [];
    for (let i = 0; i < points.length; i++) {
      if (keep[i]) out.push(points[i][0], points[i][1]);
    }
    return out.length >= 4 ? out : poly;
  }
  function simplifyIconData(paths) {
    return paths.map(simplifyPolyline);
  }
  function resolvePaths(name, icon) {
    if (icon) {
      const cached2 = directPathCache.get(icon);
      if (cached2) return cached2;
      const simplified2 = simplifyIconData(icon);
      directPathCache.set(icon, simplified2);
      return simplified2;
    }
    if (!name) return void 0;
    const cached = namedPathCache.get(name);
    if (cached) return cached;
    const paths = lookupIcon(name);
    if (!paths) return void 0;
    const simplified = simplifyIconData(paths);
    namedPathCache.set(name, simplified);
    return simplified;
  }
  function polylineToD(poly) {
    if (poly.length < 4) return "";
    let out = `M ${poly[0] - HALF},${poly[1] - HALF}`;
    for (let i = 2; i < poly.length; i += 2) {
      out += ` L ${poly[i] - HALF},${poly[i + 1] - HALF}`;
    }
    return out;
  }
  function renderPaths(paths, color, strokeWidth) {
    return paths.map((poly, index) => /* @__PURE__ */ __jsx(
      Graph.Path,
      {
        key: index,
        d: polylineToD(poly),
        stroke: color,
        strokeWidth,
        fill: "none"
      }
    ));
  }
  function Icon(props) {
    const size = props.size ?? 16;
    const color = props.color ?? "theme:ink";
    const strokeWidth = props.strokeWidth ?? 2;
    const paths = resolvePaths(props.name, props.icon);
    if (!paths || paths.length === 0) {
      return /* @__PURE__ */ __jsx(Box, { style: { width: size, height: size } });
    }
    return /* @__PURE__ */ __jsx(Box, { style: { width: size, height: size, overflow: "hidden" } }, /* @__PURE__ */ __jsx(
      Graph,
      {
        style: { width: size, height: size },
        viewX: 0,
        viewY: 0,
        viewZoom: size / VIEW
      },
      renderPaths(paths, color, strokeWidth)
    ));
  }

  // runtime/classifier.tsx
  var PRIMITIVES = {
    Box,
    Text,
    Image,
    Pressable,
    ScrollView,
    TextInput,
    Canvas,
    CanvasNode: Canvas.Node,
    CanvasPath: Canvas.Path,
    CanvasClamp: Canvas.Clamp,
    Graph,
    GraphNode: Graph.Node,
    GraphPath: Graph.Path,
    Native,
    Icon
  };
  var STYLE_KEYS = [
    "style",
    "hoverStyle",
    "activeStyle",
    "focusStyle",
    "textStyle",
    "contentContainerStyle"
  ];
  var STYLE_KEY_SET = new Set(STYLE_KEYS);
  var RESERVED_KEYS = /* @__PURE__ */ new Set(["type", "use", "variants", "bp"]);
  function shallowMergeStyle(...blocks) {
    const present = blocks.filter((b) => !!b && typeof b === "object");
    if (present.length === 0) return void 0;
    if (present.length === 1) return present[0];
    return Object.assign({}, ...present);
  }
  function mergeStyleSets(...sets) {
    const out = {};
    for (const s of sets) {
      if (!s) continue;
      for (const k of Object.keys(s)) {
        if (RESERVED_KEYS.has(k)) continue;
        if (STYLE_KEY_SET.has(k)) {
          out[k] = shallowMergeStyle(out[k], s[k]);
        } else {
          out[k] = s[k];
        }
      }
    }
    return out;
  }
  function mergeUserProps(defaults, user) {
    const merged = { ...defaults, ...user };
    for (const k of STYLE_KEYS) {
      if (defaults[k] && user[k]) {
        merged[k] = { ...defaults[k], ...user[k] };
      }
    }
    return merged;
  }
  function stripReserved(def) {
    const out = {};
    for (const k of Object.keys(def)) {
      if (RESERVED_KEYS.has(k)) continue;
      out[k] = def[k];
    }
    return out;
  }
  function collectTokens(def) {
    if (hasTokens(stripReserved(def))) return true;
    if (def.variants) {
      for (const v of Object.values(def.variants)) {
        if (hasTokens(v)) return true;
      }
    }
    if (def.bp) {
      for (const bp of Object.values(def.bp)) {
        if (!bp) continue;
        if (hasTokens(bp)) return true;
      }
    }
    return false;
  }
  function hasAnyVariants(def) {
    if (def.variants && Object.keys(def.variants).length) return true;
    if (def.bp) {
      for (const bp of Object.values(def.bp)) {
        if (bp?.variants && Object.keys(bp.variants).length) return true;
      }
    }
    return false;
  }
  function hasAnyBreakpoints(def) {
    return !!(def.bp && Object.keys(def.bp).length);
  }
  function resolveEffective(def, variant, bp) {
    const base = stripReserved(def);
    const bpBase = def.bp?.[bp] ? stripReserved(def.bp[bp]) : void 0;
    const varBase = variant && def.variants?.[variant] ? stripReserved(def.variants[variant]) : void 0;
    const bpVar = variant && def.bp?.[bp]?.variants?.[variant] ? stripReserved(def.bp[bp].variants[variant]) : void 0;
    return mergeStyleSets(base, bpBase, varBase, bpVar);
  }
  var _registry = {};
  function classifier(defs) {
    for (const name of Object.keys(defs)) {
      if (_registry[name]) {
        throw new Error(
          `classifier: "${name}" already registered. Classifiers are global \u2014 one name, one definition.`
        );
      }
      const def = defs[name];
      const Primitive = PRIMITIVES[def.type];
      if (!Primitive) {
        throw new Error(
          `classifier: "${def.type}" is not a primitive. Valid: ${Object.keys(PRIMITIVES).join(", ")}`
        );
      }
      const needsTokens = collectTokens(def);
      const needsVariants = hasAnyVariants(def);
      const needsBp = hasAnyBreakpoints(def);
      const needsHook = typeof def.use === "function";
      const needsStore = needsTokens || needsVariants || needsBp;
      const staticBase = stripReserved(def);
      const staticBaseIsEmpty = Object.keys(staticBase).length === 0;
      let C;
      if (!needsStore && !needsHook && staticBaseIsEmpty) {
        C = Primitive;
      } else if (!needsStore && !needsHook) {
        C = (props) => import_react.default.createElement(Primitive, mergeUserProps(staticBase, props));
      } else {
        C = (props) => {
          const snap = needsStore ? __useClassifierSnapshot() : null;
          let effective;
          if (snap && (needsVariants || needsBp)) {
            effective = resolveEffective(def, snap.variant, snap.breakpoint);
          } else {
            effective = staticBase;
          }
          let resolved;
          if (needsTokens && snap) {
            resolved = resolveTokens(effective, snap.colors, snap.styles);
          } else {
            resolved = effective;
          }
          const hookProps = needsHook ? def.use() : null;
          const merged = hookProps ? mergeUserProps(resolved, mergeUserProps(hookProps, props)) : mergeUserProps(resolved, props);
          return import_react.default.createElement(Primitive, merged);
        };
      }
      C.displayName = name;
      C.__isClassifier = true;
      C.__def = def;
      _registry[name] = C;
    }
  }
  var classifiers = _registry;

  // cart/app/gallery/components.cls.ts
  var APP_BOTTOM_BAR_H = 226;
  classifier({
    // ══════════════════════════════════════════════════════════════
    //   Page shell + chrome
    // ══════════════════════════════════════════════════════════════
    // Full-viewport container.
    Page: { type: "Box", style: {
      width: "100%",
      height: "100%",
      backgroundColor: "theme:bg"
    }, variants: {
      light: { style: { backgroundColor: "theme:paper" } },
      dark: { style: { backgroundColor: "theme:bg" } }
    } },
    // Pinned top: icon + title + badge + spacer + subtitle.
    StoryHeader: { type: "Box", style: {
      flexDirection: "row",
      flexShrink: 0,
      backgroundColor: "theme:bg1",
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX6",
      paddingBottom: "theme:spaceX6",
      gap: "theme:spaceX7"
    }, variants: {
      light: { style: {
        flexDirection: "column",
        alignItems: "flex-start",
        backgroundColor: "theme:paper",
        borderBottomWidth: 2,
        borderColor: "theme:paperRule",
        gap: "theme:spaceX3"
      } },
      dark: { style: {
        backgroundColor: "theme:bg2",
        borderBottomWidth: 2,
        borderColor: "theme:accentHot",
        paddingTop: "theme:spaceX4",
        paddingBottom: "theme:spaceX4",
        gap: "theme:spaceX5"
      } }
    } },
    // Pinned bottom: breadcrumb path.
    StoryFooter: { type: "Box", style: {
      flexDirection: "row",
      flexShrink: 0,
      backgroundColor: "theme:bg1",
      borderTopWidth: 1,
      borderColor: "theme:rule",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      gap: "theme:spaceX6"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paperAlt",
        borderTopWidth: 2,
        borderColor: "theme:paperRule",
        paddingTop: "theme:spaceX4",
        paddingBottom: "theme:spaceX4"
      } },
      dark: { style: {
        backgroundColor: "theme:bg2",
        borderTopWidth: 2,
        borderColor: "theme:ruleBright",
        paddingTop: "theme:spaceX2",
        paddingBottom: "theme:spaceX2"
      } }
    } },
    // Standard gallery display wrapper. This is the target chrome for examples
    // that need normalized viewport, scale, and identification.
    GalleryDisplayFrame: { type: "Box", style: {
      flexDirection: "column",
      flexShrink: 0,
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      borderRadius: "theme:radiusMd",
      backgroundColor: "theme:bg",
      overflow: "hidden"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule"
      } },
      dark: { style: {
        backgroundColor: "theme:bg",
        borderColor: "theme:accentHot"
      } }
    } },
    GalleryDisplayTopBar: { type: "Box", style: {
      flexDirection: "row",
      height: 22,
      flexShrink: 0,
      alignItems: "center",
      gap: "theme:spaceX4",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      backgroundColor: "theme:bg1",
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    GalleryDisplayCode: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:accentHot",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.2 }
    },
    GalleryDisplayTitle: {
      type: "Text",
      size: "theme:typeBody",
      bold: true,
      color: "theme:ink",
      numberOfLines: 1
    },
    GalleryDisplayMeta: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:inkDimmer",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 0.8 }
    },
    GalleryDisplayFooter: { type: "Box", style: {
      flexDirection: "row",
      height: 18,
      flexShrink: 0,
      alignItems: "center",
      gap: "theme:spaceX3",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      backgroundColor: "theme:bg1",
      borderTopWidth: 1,
      borderColor: "theme:rule"
    } },
    GalleryDisplayBarcode: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "stretch",
      height: 12,
      gap: 1
    } },
    GalleryDisplayBarcodeBar: { type: "Box", style: {
      width: 1,
      height: 12,
      backgroundColor: "theme:inkDim"
    } },
    GalleryDisplayBarcodeHot: { type: "Box", style: {
      width: 2,
      height: 12,
      backgroundColor: "theme:accentHot"
    } },
    GalleryDisplayStage: { type: "Box", style: {
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      position: "relative",
      overflow: "hidden",
      backgroundColor: "theme:bg2"
    } },
    GalleryDisplayBody: { type: "Box", style: {
      flex: 1,
      minWidth: 0,
      minHeight: 0
    } },
    GalleryDisplayCenter: { type: "Box", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 0,
      minHeight: 0
    } },
    // ══════════════════════════════════════════════════════════════
    //   Bands (story content rows)
    // ══════════════════════════════════════════════════════════════
    // Accent left-border, full-width hero intro.
    Hero: { type: "Box", style: {
      borderLeftWidth: 3,
      borderColor: "theme:accent",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX7",
      paddingBottom: "theme:spaceX7",
      gap: "theme:spaceX4"
    }, variants: {
      light: { style: {
        borderLeftWidth: 0,
        borderTopWidth: 4,
        backgroundColor: "theme:paperAlt",
        borderColor: "theme:accent",
        borderRadius: "theme:radiusXl"
      } },
      dark: { style: {
        borderLeftWidth: 6,
        backgroundColor: "theme:bg2",
        borderColor: "theme:accentHot",
        paddingTop: "theme:spaceX5",
        paddingBottom: "theme:spaceX5"
      } }
    } },
    // Two-column band (zigzag layout row).
    Band: { type: "Box", style: {
      flexDirection: "row",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX7",
      paddingBottom: "theme:spaceX7",
      gap: "theme:spaceX7"
    }, variants: {
      light: { style: {
        flexDirection: "column",
        backgroundColor: "theme:paper",
        borderRadius: "theme:radiusXl",
        borderWidth: 1,
        borderColor: "theme:paperRule"
      } },
      dark: { style: {
        flexDirection: "row",
        gap: "theme:spaceX5",
        paddingTop: "theme:spaceX5",
        paddingBottom: "theme:spaceX5"
      } }
    } },
    // One side of a Band (50/50 split).
    Half: { type: "Box", style: {
      flexGrow: 1,
      flexBasis: 0,
      gap: "theme:spaceX4"
    } },
    HalfCenter: { type: "Box", style: {
      flexGrow: 1,
      flexBasis: 0,
      gap: "theme:spaceX4",
      alignItems: "center",
      justifyContent: "center"
    } },
    // Full-width band (no split).
    FullBand: { type: "Box", style: {
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX7",
      paddingBottom: "theme:spaceX7",
      gap: "theme:spaceX4"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paper",
        borderRadius: "theme:radiusXl",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        gap: "theme:spaceX6"
      } },
      dark: { style: {
        backgroundColor: "theme:bg1",
        borderWidth: 1,
        borderColor: "theme:rule",
        borderRadius: "theme:radiusSm",
        gap: "theme:spaceX3"
      } }
    } },
    // Highlighted insight strip.
    Callout: { type: "Box", style: {
      flexDirection: "row",
      backgroundColor: "theme:bg1",
      borderLeftWidth: 3,
      borderColor: "theme:blue",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX6",
      paddingBottom: "theme:spaceX6",
      gap: "theme:spaceX4",
      alignItems: "center"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paperAlt",
        borderLeftWidth: 0,
        borderWidth: 1,
        borderColor: "theme:blue",
        borderRadius: "theme:radiusLg"
      } },
      dark: { style: {
        backgroundColor: "theme:bg2",
        borderLeftWidth: 4,
        borderColor: "theme:blue",
        borderRadius: "theme:radiusSm"
      } }
    } },
    // Warning band.
    Warn: { type: "Box", style: {
      flexDirection: "row",
      backgroundColor: "theme:bg1",
      borderLeftWidth: 3,
      borderColor: "theme:warn",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX6",
      paddingBottom: "theme:spaceX6",
      gap: "theme:spaceX4",
      alignItems: "center"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paperAlt",
        borderLeftWidth: 0,
        borderWidth: 1,
        borderColor: "theme:warn",
        borderRadius: "theme:radiusLg"
      } },
      dark: { style: {
        backgroundColor: "theme:bg2",
        borderLeftWidth: 4,
        borderColor: "theme:warn",
        borderRadius: "theme:radiusSm"
      } }
    } },
    // Horizontal divider.
    Divider: { type: "Box", style: {
      height: 1,
      flexShrink: 0,
      backgroundColor: "theme:rule"
    } },
    // Vertical divider.
    VertDivider: { type: "Box", style: {
      width: 1,
      flexShrink: 0,
      backgroundColor: "theme:rule"
    } },
    // ══════════════════════════════════════════════════════════════
    //   Surfaces (cards, wells, etc.)
    // ══════════════════════════════════════════════════════════════
    // Padded card surface w/ radius+gap. Compose with CardHeader/CardBody.
    Card: { type: "Box", style: {
      flexDirection: "column",
      padding: "theme:spaceX7",
      backgroundColor: "theme:bg1",
      borderRadius: "theme:radiusLg",
      gap: "theme:spaceX4"
    }, variants: {
      light: { style: {
        padding: "theme:spaceX8",
        backgroundColor: "theme:paper",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusXl",
        gap: "theme:spaceX5"
      } },
      dark: { style: {
        padding: "theme:spaceX5",
        backgroundColor: "theme:bg2",
        borderWidth: 1,
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm",
        gap: "theme:spaceX3"
      } }
    } },
    // Card header row: title + spacer + badge.
    CardHeader: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "theme:spaceX4"
    } },
    // Card body column.
    CardBody: { type: "Box", style: {
      gap: "theme:spaceX3"
    } },
    // Recessed surface (paper-style).
    Surface: { type: "Box", style: {
      padding: "theme:spaceX6",
      backgroundColor: "theme:bg2",
      borderRadius: "theme:radiusMd"
    }, variants: {
      light: { style: {
        padding: "theme:spaceX7",
        backgroundColor: "theme:paperAlt",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusLg"
      } },
      dark: { style: {
        padding: "theme:spaceX5",
        backgroundColor: "theme:bg",
        borderWidth: 1,
        borderColor: "theme:rule",
        borderRadius: "theme:radiusSm"
      } }
    } },
    // Alternate-tier surface (paperAlt-style).
    SurfaceAlt: { type: "Box", style: {
      padding: "theme:spaceX6",
      backgroundColor: "theme:bg1",
      borderRadius: "theme:radiusMd"
    }, variants: {
      light: { style: {
        padding: "theme:spaceX7",
        backgroundColor: "theme:paper",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusLg"
      } },
      dark: { style: {
        padding: "theme:spaceX5",
        backgroundColor: "theme:bg2",
        borderWidth: 1,
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm"
      } }
    } },
    // Elevated demo well — for interactive previews.
    Well: { type: "Box", style: {
      padding: "theme:spaceX7",
      backgroundColor: "theme:bg1",
      borderRadius: "theme:radiusLg",
      gap: "theme:spaceX5"
    }, variants: {
      light: { style: {
        padding: "theme:spaceX8",
        backgroundColor: "theme:paper",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusXl",
        gap: "theme:spaceX6"
      } },
      dark: { style: {
        padding: "theme:spaceX5",
        backgroundColor: "theme:bg2",
        borderWidth: 1,
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm",
        gap: "theme:spaceX4"
      } }
    } },
    // Recessed input area for displaying values.
    InputWell: { type: "Box", style: {
      backgroundColor: "theme:bg2",
      borderRadius: "theme:radiusSm",
      padding: "theme:spaceX3"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paper",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusMd",
        padding: "theme:spaceX4"
      } },
      dark: { style: {
        backgroundColor: "theme:bg",
        borderWidth: 1,
        borderColor: "theme:rule",
        borderRadius: "theme:radiusSm",
        padding: "theme:spaceX3"
      } }
    } },
    // ══════════════════════════════════════════════════════════════
    //   Sections + section labels
    // ══════════════════════════════════════════════════════════════
    Section: { type: "Box", style: {
      gap: "theme:spaceX6"
    }, variants: {
      light: { style: { gap: "theme:spaceX7" } },
      dark: { style: { gap: "theme:spaceX4" } }
    } },
    SectionBody: { type: "Box", style: {
      gap: "theme:spaceX4"
    }, variants: {
      light: { style: { gap: "theme:spaceX5" } },
      dark: { style: { gap: "theme:spaceX3" } }
    } },
    SectionLabel: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3"
    }, variants: {
      light: { style: {
        gap: "theme:spaceX4",
        paddingBottom: "theme:spaceX2",
        borderBottomWidth: 1,
        borderColor: "theme:paperRule"
      } },
      dark: { style: {
        gap: "theme:spaceX2",
        paddingLeft: "theme:spaceX3",
        borderLeftWidth: 2,
        borderColor: "theme:accentHot"
      } }
    } },
    KV: { type: "Box", style: {
      flexDirection: "row",
      gap: "theme:spaceX3",
      alignItems: "flex-start"
    }, variants: {
      light: { style: { gap: "theme:spaceX4" } },
      dark: { style: { gap: "theme:spaceX2" } }
    } },
    // ══════════════════════════════════════════════════════════════
    //   Buttons (Pressable)
    // ══════════════════════════════════════════════════════════════
    Button: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      borderRadius: "theme:radiusMd",
      backgroundColor: "theme:accent"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX8",
        paddingRight: "theme:spaceX8",
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:accent"
      } },
      dark: { style: {
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:accentHot",
        borderWidth: 1,
        borderColor: "theme:accentHot"
      } }
    } },
    ButtonOutline: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      borderRadius: "theme:radiusMd",
      borderWidth: 1,
      borderColor: "theme:rule"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX8",
        paddingRight: "theme:spaceX8",
        borderRadius: "theme:radiusRound",
        borderColor: "theme:accent",
        backgroundColor: "theme:paper"
      } },
      dark: { style: {
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        borderRadius: "theme:radiusSm",
        borderColor: "theme:ruleBright",
        backgroundColor: "theme:bg2"
      } }
    } },
    // ══════════════════════════════════════════════════════════════
    //   Badges
    // ══════════════════════════════════════════════════════════════
    BadgeNeutral: { type: "Box", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4",
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:paperAlt",
        borderWidth: 1,
        borderColor: "theme:paperRule"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:bg",
        borderWidth: 1,
        borderColor: "theme:rule"
      } }
    } },
    BadgeAccent: { type: "Box", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:accent"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4",
        borderRadius: "theme:radiusRound"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:accentHot"
      } }
    } },
    BadgeSuccess: { type: "Box", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:ok"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4",
        borderRadius: "theme:radiusRound"
      } },
      dark: { style: { borderRadius: "theme:radiusSm" } }
    } },
    BadgeError: { type: "Box", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:flag"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4",
        borderRadius: "theme:radiusRound"
      } },
      dark: { style: { borderRadius: "theme:radiusSm" } }
    } },
    BadgeWarning: { type: "Box", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:warn"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4",
        borderRadius: "theme:radiusRound"
      } },
      dark: { style: { borderRadius: "theme:radiusSm" } }
    } },
    BadgeInfo: { type: "Box", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:blue"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4",
        borderRadius: "theme:radiusRound"
      } },
      dark: { style: { borderRadius: "theme:radiusSm" } }
    } },
    // ══════════════════════════════════════════════════════════════
    //   Pills + chips + dots
    // ══════════════════════════════════════════════════════════════
    Chip: { type: "Box", style: {
      backgroundColor: "theme:bg2",
      borderRadius: "theme:radiusSm",
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paperAlt",
        borderRadius: "theme:radiusRound",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4"
      } },
      dark: { style: {
        backgroundColor: "theme:bg",
        borderRadius: "theme:radiusSm",
        borderWidth: 1,
        borderColor: "theme:rule"
      } }
    } },
    // ══════════════════════════════════════════════════════════════
    //   Command composer chrome
    // ══════════════════════════════════════════════════════════════
    CommandComposerFrame: { type: "Box", style: {
      flexDirection: "column",
      width: "100%",
      minHeight: 206,
      minWidth: 0,
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      overflow: "hidden"
    }, bp: {
      // Compact mode — header and footer are JSX-suppressed at sm by the
      // host (cart/app/InputStrip.tsx). Drop the frame's reserved space so
      // it doesn't keep claiming room for chrome that isn't rendered.
      sm: { style: { minHeight: 80 } }
    } },
    CommandComposerTopbar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 40,
      paddingLeft: 12,
      paddingRight: 12,
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      gap: 12,
      backgroundColor: "theme:bg1"
    } },
    CommandComposerMain: { type: "Box", style: {
      flexGrow: 1,
      justifyContent: "space-between",
      minHeight: 132,
      paddingLeft: 32,
      paddingRight: 24,
      paddingTop: 22,
      paddingBottom: 14,
      gap: 12
    } },
    CommandComposerFooter: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 28,
      paddingLeft: 8,
      paddingRight: 10,
      borderTopWidth: 1,
      borderColor: "theme:rule",
      gap: 8,
      backgroundColor: "theme:bg1"
    } },
    CommandComposerPromptRows: { type: "Box", style: {
      gap: 8,
      minWidth: 0
    } },
    CommandComposerTopCluster: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 24,
      gap: 8,
      minWidth: 0
    } },
    CommandComposerActionRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      gap: 12
    } },
    CommandComposerShortcutGroup: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 18,
      flexShrink: 0,
      gap: 5
    } },
    CommandComposerFooterShortcuts: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 18,
      flexShrink: 0,
      gap: 10
    } },
    CommandComposerPromptFlow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 10,
      minWidth: 0
    } },
    CommandComposerChip: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 24,
      paddingLeft: 8,
      paddingRight: 8,
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg1"
    } },
    CommandComposerChipAccent: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 24,
      paddingLeft: 8,
      paddingRight: 8,
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2"
    } },
    CommandComposerChipSuccess: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 24,
      paddingLeft: 8,
      paddingRight: 8,
      borderWidth: 1,
      borderColor: "theme:ok",
      backgroundColor: "theme:bg2"
    } },
    CommandComposerReference: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 26,
      paddingLeft: 10,
      paddingRight: 10,
      borderWidth: 1,
      borderColor: "theme:accent",
      backgroundColor: "theme:bg2"
    } },
    CommandComposerVariableRef: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 26,
      paddingLeft: 10,
      paddingRight: 10,
      borderWidth: 1,
      borderColor: "theme:warn",
      backgroundColor: "theme:bg2"
    } },
    CommandComposerCommandRef: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 26,
      paddingLeft: 10,
      paddingRight: 10,
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2",
      shadowColor: "theme:accentHot",
      shadowBlur: 8
    } },
    CommandComposerKeycap: { type: "Box", style: {
      minWidth: 20,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: 4,
      paddingRight: 4,
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2"
    } },
    CommandComposerSend: { type: "Pressable", style: {
      minWidth: 84,
      height: 32,
      paddingLeft: 14,
      paddingRight: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "theme:accentHot"
    } },
    CommandComposerIconButton: { type: "Pressable", style: {
      width: 48,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2"
    } },
    CommandComposerInlineIconSlot: { type: "Box", style: {
      width: 13,
      height: 13,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    } },
    CommandComposerPromptIconSlot: { type: "Box", style: {
      width: 14,
      height: 14,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    } },
    CommandComposerToolbarIconSlot: { type: "Box", style: {
      width: 12,
      height: 12,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    } },
    CommandComposerMetaText: {
      type: "Text",
      size: 9,
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", letterSpacing: 4, lineHeight: 11, whiteSpace: "pre" }
    },
    CommandComposerMutedText: {
      type: "Text",
      size: 12,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", lineHeight: 14, whiteSpace: "pre" }
    },
    CommandComposerShortcutText: {
      type: "Text",
      size: 10,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", flexShrink: 0, lineHeight: 12, whiteSpace: "pre" }
    },
    CommandComposerPromptText: {
      type: "Text",
      size: 18,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 22 }
    },
    CommandComposerTokenText: {
      type: "Text",
      size: 13,
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", lineHeight: 16, whiteSpace: "pre" }
    },
    CommandComposerHotText: {
      type: "Text",
      size: 13,
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono", lineHeight: 16, whiteSpace: "pre" }
    },
    CommandComposerKeycapText: {
      type: "Text",
      size: 10,
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    CommandComposerWarnText: {
      type: "Text",
      size: 13,
      color: "theme:warn",
      style: { fontFamily: "theme:fontMono", lineHeight: 16, whiteSpace: "pre" }
    },
    CommandComposerSuccessText: {
      type: "Text",
      size: 13,
      color: "theme:ok",
      style: { fontFamily: "theme:fontMono", lineHeight: 16, whiteSpace: "pre" }
    },
    CommandComposerActionText: {
      type: "Text",
      size: 11,
      bold: true,
      color: "theme:bg",
      style: { fontFamily: "theme:fontMono", letterSpacing: 3, lineHeight: 13, whiteSpace: "pre" }
    },
    CommandComposerIconText: {
      type: "Text",
      size: 18,
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 20, whiteSpace: "pre" }
    },
    // ══════════════════════════════════════════════════════════════
    //   Spreadsheet chrome
    // ══════════════════════════════════════════════════════════════
    SpreadsheetFrame: { type: "Box", style: {
      flexDirection: "column",
      width: "100%",
      minWidth: 0,
      minHeight: 0,
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusLg",
      overflow: "hidden"
    } },
    SpreadsheetTopBar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 46,
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX5",
      paddingBottom: "theme:spaceX5",
      gap: "theme:spaceX6",
      backgroundColor: "theme:bg1",
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetTopCluster: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      flexWrap: "wrap",
      gap: "theme:spaceX3",
      minWidth: 0
    } },
    SpreadsheetFormulaBar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 42,
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      gap: "theme:spaceX4",
      backgroundColor: "theme:bg",
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetNameBox: { type: "Box", style: {
      width: 58,
      height: 28,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetFormulaInput: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      height: 28,
      justifyContent: "center",
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetAdjustments: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      gap: "theme:spaceX3"
    } },
    SpreadsheetToolbarButton: { type: "Pressable", style: {
      minWidth: 46,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetGridSlot: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      minWidth: 0,
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetGridSurface: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      minWidth: 0,
      width: "100%",
      height: "100%",
      overflow: "hidden",
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetGridContent: { type: "Box", style: {
      flexDirection: "column",
      flexShrink: 0,
      alignSelf: "flex-start"
    } },
    SpreadsheetGridRow: { type: "Box", style: {
      flexDirection: "row",
      flexShrink: 0
    } },
    SpreadsheetCornerCell: { type: "Box", style: {
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "theme:bg1",
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetColumnHeaderCell: { type: "Box", style: {
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "theme:bg1",
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetRowHeaderCell: { type: "Box", style: {
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "theme:bg1",
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetCell: { type: "Pressable", style: {
      flexShrink: 0,
      justifyContent: "center",
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      backgroundColor: "theme:bg2",
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetCellAlt: { type: "Pressable", style: {
      flexShrink: 0,
      justifyContent: "center",
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      backgroundColor: "theme:bg1",
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetCellSelected: { type: "Pressable", style: {
      flexShrink: 0,
      justifyContent: "center",
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:accent"
    } },
    SpreadsheetNativeGridSurface: { type: "Native", style: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      minWidth: 0,
      width: "100%",
      height: "100%"
    } },
    SpreadsheetMetricStrip: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "stretch",
      flexWrap: "wrap",
      gap: "theme:spaceX3",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      backgroundColor: "theme:bg1",
      borderTopWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetMetric: { type: "Box", style: {
      minWidth: 92,
      gap: "theme:spaceX1",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetStatusBar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 26,
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      backgroundColor: "theme:bg1",
      borderTopWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetBadge: { type: "Box", style: {
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetBadgeError: { type: "Box", style: {
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      borderWidth: 1,
      borderColor: "theme:flag",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    } },
    SpreadsheetAtomPad: { type: "Box", style: {
      width: "100%",
      minWidth: 0,
      padding: "theme:spaceX6",
      alignItems: "stretch",
      justifyContent: "center",
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:rule"
    } },
    SpreadsheetTitle: {
      type: "Text",
      size: "theme:typeStrong",
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 18 }
    },
    SpreadsheetSubtitle: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", lineHeight: 12 }
    },
    SpreadsheetLabel: {
      type: "Text",
      size: "theme:typeMicro",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", lineHeight: 10, whiteSpace: "pre" }
    },
    SpreadsheetAddressText: {
      type: "Text",
      size: "theme:typeBody",
      bold: true,
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", lineHeight: 14, whiteSpace: "pre" }
    },
    SpreadsheetFormulaText: {
      type: "Text",
      size: "theme:typeBody",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 14, whiteSpace: "pre" }
    },
    SpreadsheetDimText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    SpreadsheetValueText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    SpreadsheetCellText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    SpreadsheetCellNumberText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre", textAlign: "right" }
    },
    SpreadsheetCellFormulaText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre", textAlign: "right" }
    },
    SpreadsheetCellHeaderText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    SpreadsheetMetricAccent: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    SpreadsheetErrorText: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:flag",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    SpreadsheetPositiveText: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:ok",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    SpreadsheetNegativeText: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:flag",
      style: { fontFamily: "theme:fontMono", lineHeight: 12, whiteSpace: "pre" }
    },
    // ══════════════════════════════════════════════════════════════
    //   Git lanes terminal chrome
    // ══════════════════════════════════════════════════════════════
    GitLaneFrame: { type: "Box", style: {
      flexDirection: "column",
      width: "100%",
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      overflow: "hidden"
    } },
    GitLaneTopbar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 26,
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      gap: "theme:spaceX5",
      backgroundColor: "theme:bg1"
    } },
    GitLaneBody: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      backgroundColor: "theme:bg"
    } },
    GitLaneSplitBody: { type: "Box", style: {
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      backgroundColor: "theme:bg"
    } },
    GitLaneFooter: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 24,
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      borderTopWidth: 1,
      borderColor: "theme:rule",
      gap: "theme:spaceX5",
      backgroundColor: "theme:bg1",
      overflow: "hidden"
    } },
    GitFooterAction: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3",
      flexShrink: 0,
      minHeight: 14
    } },
    GitLaneSearchRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 28,
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      gap: "theme:spaceX4",
      backgroundColor: "theme:bg"
    } },
    GitLaneList: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0
    } },
    GitLaneGraphColumn: { type: "Box", style: {
      width: 84,
      flexShrink: 0,
      borderRightWidth: 1,
      borderColor: "theme:rule"
    } },
    GitLaneGraphSurface: { type: "Box", style: {
      width: "100%",
      height: "100%",
      minHeight: 0
    } },
    GitLaneDetailPane: { type: "Box", style: {
      flexDirection: "column",
      width: 254,
      flexShrink: 0,
      borderLeftWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg"
    } },
    GitLaneDetailHeader: { type: "Box", style: {
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      gap: "theme:spaceX2",
      backgroundColor: "theme:bg1"
    } },
    GitCommitRow: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 24,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      gap: "theme:spaceX4",
      backgroundColor: "theme:bg"
    } },
    GitCommitRowActive: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 24,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      gap: "theme:spaceX4",
      backgroundColor: "theme:bg2"
    } },
    GitCommitRowAlert: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 24,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      gap: "theme:spaceX4",
      backgroundColor: "theme:bg"
    } },
    GitDiffFileRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 23,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      gap: "theme:spaceX3"
    } },
    GitDiffCodeLine: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 22,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      gap: "theme:spaceX2"
    } },
    GitDiffCodeAdd: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 22,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      gap: "theme:spaceX2",
      backgroundColor: "theme:bg1"
    } },
    GitDiffCodeRemove: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 22,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      gap: "theme:spaceX2",
      backgroundColor: "theme:bg1"
    } },
    GitKeycap: { type: "Box", style: {
      minWidth: 16,
      minHeight: 14,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      backgroundColor: "theme:bg2"
    } },
    GitDash: { type: "Box", style: {
      width: "theme:spaceX5",
      height: 1,
      backgroundColor: "theme:rule",
      opacity: 0.85
    } },
    GitLegendSwatch: { type: "Box", style: {
      width: "theme:spaceX5",
      height: "theme:spaceX5",
      flexShrink: 0
    } },
    GitTextTitle: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono", letterSpacing: "theme:lsWide", whiteSpace: "pre" }
    },
    GitTextMeta: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", letterSpacing: "theme:lsWide", whiteSpace: "pre" }
    },
    GitTextGhost: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:inkGhost",
      style: { fontFamily: "theme:fontMono", fontStyle: "italic", whiteSpace: "pre" }
    },
    GitTextDim: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextInk: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextAccent: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextHot: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextOk: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ok",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextWarn: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:warn",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextFlag: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:flag",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextBlue: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:blue",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextLilac: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:lilac",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextDetailTitle: {
      type: "Text",
      size: "theme:typeBody",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 14 }
    },
    GitTextDetailMeta: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", letterSpacing: "theme:lsWide", whiteSpace: "pre" }
    },
    GitTextBadgeSha: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:bg",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextFileBase: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextFileDir: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    GitTextHunk: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono", letterSpacing: "theme:lsWide", whiteSpace: "pre" }
    },
    NavPill: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      borderRadius: "theme:radiusSm"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        borderRadius: "theme:radiusRound",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        backgroundColor: "theme:paper"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        borderWidth: 1,
        borderColor: "theme:rule",
        backgroundColor: "theme:bg"
      } }
    } },
    NavPillActive: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:accent"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:bg2",
        borderWidth: 1,
        borderColor: "theme:accentHot"
      } }
    } },
    Dot: { type: "Box", style: {
      width: "theme:spaceX3",
      height: "theme:spaceX3",
      borderRadius: "theme:radiusSm",
      flexShrink: 0
    }, variants: {
      light: { style: { borderRadius: "theme:radiusRound" } },
      dark: { style: { borderRadius: "theme:radiusSm" } }
    } },
    // Progress track.
    Track: { type: "Box", style: {
      width: "100%",
      height: "theme:spaceX2",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    }, variants: {
      light: { style: {
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:paperAlt",
        borderWidth: 1,
        borderColor: "theme:paperRule"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:bg"
      } }
    } },
    // Progress fill.
    Fill: { type: "Box", style: {
      height: "theme:spaceX2",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:accent"
    }, variants: {
      light: { style: { borderRadius: "theme:radiusRound" } },
      dark: { style: { borderRadius: "theme:radiusSm", backgroundColor: "theme:accentHot" } }
    } },
    // ══════════════════════════════════════════════════════════════
    //   Typography roles
    // ══════════════════════════════════════════════════════════════
    Title: { type: "Text", size: "theme:typeHeading", bold: true, color: "theme:ink" },
    Headline: { type: "Text", size: "theme:typeStrong", bold: true, color: "theme:ink" },
    Heading: { type: "Text", size: "theme:typeStrong", bold: true, color: "theme:ink" },
    Subheading: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:ink" },
    Body: { type: "Text", size: "theme:typeBody", color: "theme:ink" },
    BodyDim: { type: "Text", size: "theme:typeBody", color: "theme:inkDim" },
    Muted: { type: "Text", size: "theme:typeBody", color: "theme:inkDim" },
    Caption: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    TinyDim: { type: "Text", size: "theme:typeTiny", color: "theme:inkDim" },
    MicroDim: { type: "Text", size: "theme:typeMicro", color: "theme:inkDim" },
    Label: {
      type: "Text",
      size: "theme:typeTiny",
      bold: true,
      color: "theme:inkDim",
      style: { letterSpacing: "theme:lsWide" }
    },
    Code: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono" }
    },
    Error: { type: "Text", size: "theme:typeBody", color: "theme:flag" },
    // Button-shaped texts.
    ButtonLabel: { type: "Text", size: "theme:typeBody", bold: true, color: "theme:bg" },
    ButtonOutlineLabel: { type: "Text", size: "theme:typeBody", color: "theme:ink" },
    // Badge texts.
    BadgeNeutralText: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    BadgeAccentText: { type: "Text", size: "theme:typeCaption", color: "theme:bg" },
    BadgeSuccessText: { type: "Text", size: "theme:typeCaption", color: "theme:bg" },
    BadgeErrorText: { type: "Text", size: "theme:typeCaption", color: "theme:bg" },
    BadgeWarningText: { type: "Text", size: "theme:typeCaption", color: "theme:bg" },
    BadgeInfoText: { type: "Text", size: "theme:typeCaption", color: "theme:bg" },
    // Footer breadcrumb.
    Breadcrumb: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    BreadcrumbActive: { type: "Text", size: "theme:typeCaption", color: "theme:ink" },
    // ══════════════════════════════════════════════════════════════
    //   Code block + syntax atoms
    // ══════════════════════════════════════════════════════════════
    CodeBlockFrame: { type: "Box", style: {
      flexDirection: "column",
      width: "100%",
      minWidth: 0,
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusLg",
      overflow: "hidden"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusXl"
      } },
      dark: { style: {
        backgroundColor: "theme:bg",
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm"
      } }
    } },
    CodeBlockHeader: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "theme:spaceX5",
      backgroundColor: "theme:bg1",
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paperAlt",
        borderColor: "theme:paperRule",
        paddingTop: "theme:spaceX5",
        paddingBottom: "theme:spaceX5"
      } },
      dark: { style: {
        backgroundColor: "theme:bg2",
        borderColor: "theme:accentHot",
        paddingTop: "theme:spaceX3",
        paddingBottom: "theme:spaceX3"
      } }
    } },
    CodeBlockMeta: { type: "Box", style: {
      minWidth: 0,
      gap: "theme:spaceX1"
    } },
    CodeBlockBadge: { type: "Box", style: {
      flexShrink: 0,
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      borderRadius: "theme:radiusSm",
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      backgroundColor: "theme:bg2"
    }, variants: {
      light: { style: {
        borderRadius: "theme:radiusRound",
        borderColor: "theme:accent",
        backgroundColor: "theme:paper"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        borderColor: "theme:accentHot",
        backgroundColor: "theme:bg"
      } }
    } },
    CodeBlockBody: { type: "Box", style: {
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      paddingTop: "theme:spaceX5",
      paddingBottom: "theme:spaceX5",
      gap: "theme:spaceX1"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX7",
        paddingRight: "theme:spaceX7",
        paddingTop: "theme:spaceX7",
        paddingBottom: "theme:spaceX7",
        gap: "theme:spaceX2"
      } },
      dark: { style: {
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX4",
        paddingTop: "theme:spaceX4",
        paddingBottom: "theme:spaceX4",
        gap: "theme:spaceX0"
      } }
    } },
    CodeBlockScroll: { type: "ScrollView", showScrollbar: true, style: {
      width: "100%",
      maxHeight: 360
    } },
    CodeLine: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: "theme:spaceX4",
      minHeight: 16,
      minWidth: 0,
      borderRadius: "theme:radiusSm"
    }, variants: {
      light: { style: {
        gap: "theme:spaceX5",
        minHeight: 20,
        borderRadius: "theme:radiusMd"
      } },
      dark: { style: {
        gap: "theme:spaceX3",
        minHeight: 14,
        borderRadius: "theme:radiusSm"
      } }
    } },
    CodeLineEmphasis: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: "theme:spaceX4",
      minHeight: 16,
      minWidth: 0,
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg1"
    }, variants: {
      light: { style: {
        gap: "theme:spaceX5",
        minHeight: 20,
        borderRadius: "theme:radiusMd",
        backgroundColor: "theme:paperAlt"
      } },
      dark: { style: {
        gap: "theme:spaceX3",
        minHeight: 14,
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:bg2"
      } }
    } },
    CodeLineNumber: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDimmer",
      style: { width: 28, textAlign: "right", fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    CodeLineContent: { type: "Box", style: { flexDirection: "row", gap: 0, minWidth: 0 } },
    CodeBlockTitle: {
      type: "Text",
      size: "theme:typeBase",
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans" }
    },
    CodeBlockSubtle: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    CodeBlockBadgeText: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    CodeBlockCopyButton: { type: "Pressable", style: {
      flexShrink: 0,
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusSm",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      backgroundColor: "theme:bg2"
    }, variants: {
      light: { style: {
        borderRadius: "theme:radiusRound",
        borderColor: "theme:paperRule",
        backgroundColor: "theme:paper"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        borderColor: "theme:accentHot",
        backgroundColor: "theme:bg"
      } }
    } },
    CodeBlockCopyText: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxPlain: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxKeyword: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxString: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ok",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxNumber: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:warn",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxComment: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre", fontStyle: "italic" }
    },
    SyntaxFunction: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:blue",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxType: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:lilac",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxProperty: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ctx",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxPunctuation: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxOperator: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:flag",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxTag: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:atch",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    SyntaxMeta: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:tool",
      style: { fontFamily: "theme:fontMono", whiteSpace: "pre" }
    },
    // ══════════════════════════════════════════════════════════════
    //   Icons (Image roles)
    // ══════════════════════════════════════════════════════════════
    HeaderIcon: { type: "Image", style: { width: 18, height: 18 } },
    SectionIcon: { type: "Image", style: { width: "theme:spaceX5", height: "theme:spaceX5" } },
    InfoIcon: { type: "Image", style: { width: "theme:spaceX6", height: "theme:spaceX6" } },
    FooterIcon: {
      type: "Image",
      style: { width: "theme:spaceX6", height: "theme:spaceX6" },
      tintColor: "theme:inkDim"
    },
    Icon8: { type: "Image", style: { width: "theme:spaceX4", height: "theme:spaceX4" } },
    Icon10: { type: "Image", style: { width: "theme:spaceX5", height: "theme:spaceX5" } },
    Icon12: { type: "Image", style: { width: "theme:spaceX6", height: "theme:spaceX6" } },
    Icon20: { type: "Image", style: { width: 20, height: 20 } },
    DimIcon8: {
      type: "Image",
      style: { width: "theme:spaceX4", height: "theme:spaceX4" },
      tintColor: "theme:inkDim"
    },
    DimIcon12: {
      type: "Image",
      style: { width: "theme:spaceX6", height: "theme:spaceX6" },
      tintColor: "theme:inkDim"
    },
    TextIcon12: {
      type: "Image",
      style: { width: "theme:spaceX6", height: "theme:spaceX6" },
      tintColor: "theme:ink"
    },
    AccentIcon20: {
      type: "Image",
      style: { width: 20, height: 20 },
      tintColor: "theme:accent"
    },
    // ══════════════════════════════════════════════════════════════
    //   Existing entries — token-ified, names preserved.
    //   These are consumed by ~50 component files already; renaming
    //   would break them. Values now resolve from cockpit theme.
    // ══════════════════════════════════════════════════════════════
    // ── Type ladder (matches theme.type.*) ─────────────────────
    TypeMicro: { type: "Text", size: "theme:typeMicro", style: { fontFamily: "theme:fontMono" } },
    TypeMicroBold: { type: "Text", size: "theme:typeMicro", bold: true, style: { fontFamily: "theme:fontMono" } },
    TypeTiny: { type: "Text", size: "theme:typeTiny", style: { fontFamily: "theme:fontMono" } },
    TypeTinyBold: { type: "Text", size: "theme:typeTiny", bold: true, style: { fontFamily: "theme:fontMono" } },
    TypeCaption: { type: "Text", size: "theme:typeCaption", style: { fontFamily: "theme:fontMono" } },
    TypeBody: { type: "Text", size: "theme:typeBody", style: { fontFamily: "theme:fontMono" } },
    TypeBodyBold: { type: "Text", size: "theme:typeBody", bold: true, style: { fontFamily: "theme:fontMono" } },
    TypeBase: { type: "Text", size: "theme:typeBase", style: { fontFamily: "theme:fontMono" } },
    // ── Inline (Row) rhythm (matches theme.spacing x*) ─────────
    InlineX2: { type: "Box", style: { flexDirection: "row", alignItems: "center", gap: "theme:spaceX2" } },
    InlineX3: { type: "Box", style: { flexDirection: "row", alignItems: "center", gap: "theme:spaceX3" } },
    InlineX4: { type: "Box", style: { flexDirection: "row", gap: "theme:spaceX4", alignItems: "stretch" } },
    InlineX4Center: { type: "Box", style: { flexDirection: "row", alignItems: "center", gap: "theme:spaceX4" } },
    InlineX5: { type: "Box", style: { flexDirection: "row", gap: "theme:spaceX5", alignItems: "center" } },
    InlineX5Between: { type: "Box", style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "theme:spaceX5" } },
    InlineX4BetweenFull: { type: "Box", style: { flexDirection: "row", width: "100%", justifyContent: "space-between", gap: "theme:spaceX4" } },
    // ── Stack (Col) rhythm (matches theme.spacing x*) ──────────
    StackX1: { type: "Box", style: { gap: "theme:spaceX1" } },
    StackX1Center: { type: "Box", style: { alignItems: "center", gap: "theme:spaceX1" } },
    StackX2: { type: "Box", style: { gap: "theme:spaceX2" } },
    StackX3: { type: "Box", style: { gap: "theme:spaceX3" } },
    StackX4: { type: "Box", style: { gap: "theme:spaceX4" } },
    StackX4Center: { type: "Box", style: { alignItems: "center", gap: "theme:spaceX4" } },
    StackX5: { type: "Box", style: { gap: "theme:spaceX5" } },
    StackX5Center: { type: "Box", style: { gap: "theme:spaceX5", alignItems: "center" } },
    StackX6: { type: "Box", style: { gap: "theme:spaceX6" } },
    // ── Radius primitives (matches theme.radius.*) ─────────────
    DotSm: { type: "Box", style: { width: "theme:spaceX4", height: "theme:spaceX4", borderRadius: "theme:radiusSm" } },
    DotMd: { type: "Box", style: { width: "theme:spaceX6", height: "theme:spaceX6", borderRadius: "theme:radiusMd", borderWidth: 1 } },
    RoundPill: { type: "Box", style: { borderRadius: "theme:radiusLg" } },
    ChipRound: { type: "Box", style: { paddingLeft: "theme:spaceX4", paddingRight: "theme:spaceX4", paddingTop: "theme:spaceX2", paddingBottom: "theme:spaceX2", borderRadius: "theme:radiusMd", borderWidth: 1 } },
    // ── Layout utilities ──────────────────────────────────────
    // Graph with top-left origin, fills parent.
    BareGraph: { type: "Graph", originTopLeft: true, style: { width: "100%", height: "100%" } },
    Spacer: { type: "Box", style: { flexGrow: 1 } },
    HalfPress: { type: "Pressable", style: { flexGrow: 1, flexBasis: 0 } },
    // --------------------------------------------------------------
    //   Social image gallery
    // --------------------------------------------------------------
    SocialGalleryShell: { type: "Box", style: {
      flexDirection: "column",
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusLg",
      overflow: "hidden"
    } },
    SocialGalleryMain: { type: "Box", style: {
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      minHeight: 0,
      backgroundColor: "theme:bg"
    } },
    SocialGalleryViewerPane: { type: "Box", style: {
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      minHeight: 0,
      padding: "theme:spaceX6",
      gap: "theme:spaceX5",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryMediaShell: { type: "Box", style: {
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      gap: "theme:spaceX4"
    } },
    SocialGalleryMediaRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      gap: "theme:spaceX4"
    } },
    SocialGalleryMediaFrame: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      minHeight: 260,
      borderRadius: "theme:radiusLg",
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      backgroundColor: "theme:bg",
      overflow: "hidden"
    } },
    SocialGalleryImage: { type: "Image", style: {
      width: "100%",
      height: "100%",
      minHeight: 260,
      backgroundColor: "theme:bg",
      objectFit: "cover"
    } },
    SocialGalleryNavButton: { type: "Pressable", style: {
      width: 34,
      height: 54,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      backgroundColor: "theme:bg1"
    } },
    SocialGalleryOverlayBar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      backgroundColor: "theme:bg1"
    } },
    SocialGalleryThumbRail: { type: "ScrollView", horizontal: true, showScrollbar: false, style: {
      width: "100%",
      maxHeight: 76,
      flexShrink: 0
    } },
    SocialGalleryThumbRailInner: { type: "Box", style: {
      flexDirection: "row",
      gap: "theme:spaceX4"
    } },
    SocialGalleryThumb: { type: "Pressable", style: {
      width: 74,
      height: 58,
      flexShrink: 0,
      borderRadius: "theme:radiusMd",
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg1",
      overflow: "hidden"
    } },
    SocialGalleryThumbActive: { type: "Pressable", style: {
      width: 74,
      height: 58,
      flexShrink: 0,
      borderRadius: "theme:radiusMd",
      borderWidth: 2,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg1",
      overflow: "hidden"
    } },
    SocialGalleryThumbImage: { type: "Image", style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryMetaPanel: { type: "Box", style: {
      flexDirection: "column",
      width: 310,
      flexShrink: 0,
      minHeight: 0,
      borderLeftWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg1"
    } },
    SocialGalleryMetaScroll: { type: "ScrollView", showScrollbar: true, style: {
      flexGrow: 1,
      minHeight: 0
    } },
    SocialGalleryMetaInner: { type: "Box", style: {
      flexDirection: "column",
      padding: "theme:spaceX6",
      gap: "theme:spaceX6"
    } },
    SocialGalleryAuthorRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: "theme:spaceX5"
    } },
    SocialGalleryAvatar: { type: "Box", style: {
      width: 42,
      height: 42,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "theme:radiusLg",
      borderWidth: 1,
      borderColor: "theme:accent",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryTopicRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "theme:spaceX3"
    } },
    SocialGalleryTopic: { type: "Box", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryCaptionBlock: { type: "Box", style: {
      flexDirection: "column",
      gap: "theme:spaceX3"
    } },
    SocialGalleryActionBar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3",
      paddingTop: "theme:spaceX5",
      borderTopWidth: 1,
      borderColor: "theme:rule",
      overflow: "hidden"
    } },
    SocialGalleryActionButton: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 28,
      flexShrink: 0,
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      gap: "theme:spaceX2",
      borderRadius: "theme:radiusMd",
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryActionButtonActive: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 28,
      flexShrink: 0,
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      gap: "theme:spaceX2",
      borderRadius: "theme:radiusMd",
      borderWidth: 1,
      borderColor: "theme:accent",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryActionIconSlot: { type: "Box", style: {
      width: 15,
      height: 15,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center"
    } },
    SocialGalleryCommentList: { type: "Box", style: {
      flexDirection: "column",
      gap: "theme:spaceX5",
      paddingTop: "theme:spaceX5",
      borderTopWidth: 1,
      borderColor: "theme:rule"
    } },
    SocialGalleryCommentRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: "theme:spaceX4"
    } },
    SocialGalleryCommentAvatar: { type: "Box", style: {
      width: 26,
      height: 26,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "theme:radiusMd",
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryCommentBody: { type: "Box", style: {
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: "theme:spaceX2"
    } },
    SocialGalleryComposer: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX4",
      minHeight: 38,
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      borderRadius: "theme:radiusMd",
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    SocialGalleryIcon: { type: "Icon", size: 15, color: "theme:inkDim", strokeWidth: 2.1 },
    SocialGalleryIconInk: { type: "Icon", size: 15, color: "theme:ink", strokeWidth: 2.1 },
    SocialGalleryIconAccent: { type: "Icon", size: 15, color: "theme:accentHot", strokeWidth: 2.2 },
    SocialGalleryIconOk: { type: "Icon", size: 15, color: "theme:ok", strokeWidth: 2.2 },
    SocialGalleryIconBlue: { type: "Icon", size: 15, color: "theme:blue", strokeWidth: 2.2 },
    SocialGalleryAuthorName: {
      type: "Text",
      size: "theme:typeBase",
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 15 }
    },
    SocialGalleryHandle: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", lineHeight: 13 }
    },
    SocialGalleryMetaText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontSans", lineHeight: 14 }
    },
    SocialGalleryCaption: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 18 }
    },
    SocialGalleryImageTitle: {
      type: "Text",
      size: "theme:typeStrong",
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 18 }
    },
    SocialGalleryCount: {
      type: "Text",
      size: "theme:typeCaption",
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 13 }
    },
    SocialGalleryTopicText: {
      type: "Text",
      size: "theme:typeTiny",
      bold: true,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", lineHeight: 11 }
    },
    SocialGalleryAvatarText: {
      type: "Text",
      size: "theme:typeBody",
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 13 }
    },
    // ══════════════════════════════════════════════════════════════
    //   Document viewer
    // ══════════════════════════════════════════════════════════════
    // Outer dark frame.
    DocShell: { type: "Box", style: {
      flexDirection: "column",
      width: "100%",
      height: "100%",
      backgroundColor: "theme:bg2",
      borderRadius: "theme:radiusSm",
      overflow: "hidden"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paperAlt",
        borderRadius: "theme:radiusXl",
        borderWidth: 1,
        borderColor: "theme:paperRule"
      } },
      dark: { style: {
        backgroundColor: "theme:bg",
        borderRadius: "theme:radiusSm",
        borderWidth: 1,
        borderColor: "theme:ruleBright"
      } }
    } },
    // Top toolbar strip.
    DocToolbar: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      height: "theme:chromeStrip",
      backgroundColor: "theme:bg2",
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      gap: "theme:spaceX5",
      flexShrink: 0
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        height: "theme:chromeStrip",
        paddingLeft: "theme:spaceX7",
        paddingRight: "theme:spaceX7"
      } },
      dark: { style: {
        backgroundColor: "theme:bg2",
        borderColor: "theme:accentHot",
        height: "theme:chromeStrip",
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5"
      } }
    } },
    // Toolbar slot for the title block (grows to fill).
    DocToolbarTitleSlot: { type: "Box", style: {
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      gap: "theme:spaceX0"
    } },
    // Toolbar icon button (square, outlined).
    DocToolbarBtn: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      borderWidth: 1,
      borderColor: "theme:rule",
      alignItems: "center",
      justifyContent: "center"
    }, variants: {
      light: { style: {
        borderRadius: "theme:radiusRound",
        borderColor: "theme:paperRule",
        backgroundColor: "theme:paperAlt"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        borderColor: "theme:ruleBright",
        backgroundColor: "theme:bg"
      } }
    } },
    DocToolbarBtnActive: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:accent",
      alignItems: "center",
      justifyContent: "center"
    }, variants: {
      light: { style: {
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:accent"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:accentHot"
      } }
    } },
    // Document body (toolbar | content split).
    DocBody: { type: "Box", style: {
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
      width: "100%"
    }, variants: {
      light: { style: { gap: "theme:spaceX5", padding: "theme:spaceX5" } },
      dark: { style: { gap: 0, padding: 0 } }
    } },
    // Paper-cream sidebar outline.
    DocOutline: { type: "Box", style: {
      flexDirection: "column",
      width: 200,
      flexShrink: 0,
      backgroundColor: "theme:paper",
      borderRightWidth: 1,
      borderColor: "theme:paperRule"
    }, variants: {
      light: { style: {
        width: 240,
        borderRightWidth: 0,
        borderRadius: "theme:radiusLg",
        backgroundColor: "theme:paper",
        borderWidth: 1,
        borderColor: "theme:paperRule"
      } },
      dark: { style: {
        width: 180,
        backgroundColor: "theme:bg2",
        borderRightWidth: 1,
        borderColor: "theme:rule"
      } }
    } },
    DocOutlineHeader: { type: "Box", style: {
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX5",
      paddingBottom: "theme:spaceX3",
      borderBottomWidth: 1,
      borderColor: "theme:paperRule"
    } },
    DocOutlineRow: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      borderLeftWidth: 2,
      borderColor: "theme:paper"
    } },
    DocOutlineRowActive: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      backgroundColor: "theme:paperAlt",
      borderLeftWidth: 2,
      borderColor: "theme:paperRuleBright"
    } },
    // Page slot (right of outline) — dark frame around the paper.
    DocPageWrap: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      padding: "theme:spaceX6",
      backgroundColor: "theme:bg2"
    }, variants: {
      light: { style: {
        padding: "theme:spaceX7",
        backgroundColor: "theme:paperAlt",
        borderRadius: "theme:radiusLg"
      } },
      dark: { style: {
        padding: "theme:spaceX4",
        backgroundColor: "theme:bg"
      } }
    } },
    // Page surface — cream paper.
    DocPage: { type: "Box", style: {
      flexGrow: 1,
      flexShrink: 1,
      flexDirection: "column",
      backgroundColor: "theme:paper",
      borderWidth: 1,
      borderColor: "theme:paperRule",
      borderRadius: "theme:radiusSm",
      overflow: "hidden"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusLg"
      } },
      dark: { style: {
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRuleBright",
        borderRadius: "theme:radiusSm"
      } }
    } },
    // Inner padded content column inside the page.
    DocPageContent: { type: "Box", style: {
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      paddingTop: "theme:spaceX8",
      paddingBottom: "theme:spaceX8",
      gap: "theme:spaceX5"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX8",
        paddingRight: "theme:spaceX8",
        paddingTop: "theme:spaceX8",
        paddingBottom: "theme:spaceX8",
        gap: "theme:spaceX6"
      } },
      dark: { style: {
        paddingLeft: "theme:spaceX6",
        paddingRight: "theme:spaceX6",
        paddingTop: "theme:spaceX6",
        paddingBottom: "theme:spaceX6",
        gap: "theme:spaceX4"
      } }
    } },
    // Code block (recessed dark surface).
    DocCode: { type: "Box", style: {
      backgroundColor: "theme:bg2",
      borderRadius: "theme:radiusSm",
      padding: "theme:spaceX5"
    }, variants: {
      light: { style: {
        backgroundColor: "theme:paperAlt",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusMd",
        padding: "theme:spaceX6"
      } },
      dark: { style: {
        backgroundColor: "theme:bg",
        borderWidth: 1,
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm",
        padding: "theme:spaceX4"
      } }
    } },
    // Quote (vertical accent bar + content row).
    DocQuoteRow: { type: "Box", style: {
      flexDirection: "row",
      gap: "theme:spaceX4"
    } },
    DocQuoteBar: { type: "Box", style: {
      width: 3,
      backgroundColor: "theme:paperRuleBright",
      borderRadius: "theme:radiusSm",
      alignSelf: "stretch"
    }, variants: {
      light: { style: { width: 4, borderRadius: "theme:radiusRound" } },
      dark: { style: { width: 2, borderRadius: "theme:radiusSm", backgroundColor: "theme:accentHot" } }
    } },
    // Paper-rule horizontal divider.
    DocPaperRule: { type: "Box", style: {
      height: 1,
      flexShrink: 0,
      backgroundColor: "theme:paperRule"
    } },
    // Doc typography (text on paper).
    DocTitle: { type: "Text", size: "theme:typeHeading", bold: true, color: "theme:paperInk" },
    DocSubtitle: {
      type: "Text",
      size: "theme:typeStrong",
      color: "theme:paperInkDim",
      style: { fontStyle: "italic" }
    },
    DocMeta: { type: "Text", size: "theme:typeCaption", color: "theme:paperInkDim" },
    DocH1: { type: "Text", size: "theme:typeHeading", bold: true, color: "theme:paperInk" },
    DocH2: { type: "Text", size: "theme:typeStrong", bold: true, color: "theme:paperInk" },
    DocH3: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:paperInk" },
    DocBodyText: { type: "Text", size: "theme:typeBody", color: "theme:paperInk" },
    DocBodyDim: { type: "Text", size: "theme:typeBody", color: "theme:paperInkDim" },
    DocQuoteText: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:paperInk",
      style: { fontStyle: "italic" }
    },
    DocAttribution: { type: "Text", size: "theme:typeCaption", color: "theme:paperInkDim" },
    DocCodeText: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono" }
    },
    // Doc typography (text in dark toolbar / shell).
    DocToolbarTitle: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:ink" },
    DocToolbarSection: { type: "Text", size: "theme:typeMicro", color: "theme:inkDim" },
    DocToolbarGlyph: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:ink" },
    DocToolbarZoom: {
      type: "Text",
      size: "theme:typeTiny",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono" }
    },
    // Outline typography.
    DocOutlineLabel: { type: "Text", size: "theme:typeMicro", bold: true, color: "theme:paperInkDim" },
    DocOutlineEntry: { type: "Text", size: "theme:typeCaption", color: "theme:paperInkDim" },
    DocOutlineEntryActive: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:paperInk" },
    DocOutlineEntryH1: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:paperInkDim" },
    DocOutlineEntryH1Active: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:paperInk" },
    // ══════════════════════════════════════════════════════════════
    //   cart/app — onboarding flow + custom window chrome
    //
    //   These names are consumed by cart/app/index.tsx, page.jsx,
    //   onboarding/*.jsx. All theme-touching styling for cart/app
    //   lives here — there is no cart/app/theme.js shim. Active /
    //   inactive variants are separate classifiers; the JSX picks one.
    // ══════════════════════════════════════════════════════════════
    // ── Window chrome (top strip) ───────────────────────────────
    AppChrome: { type: "Box", style: {
      flexDirection: "row",
      width: "100%",
      height: 36,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX3",
      backgroundColor: "theme:bg1",
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    }, variants: {
      light: { style: {
        height: "theme:chromeTopbar",
        backgroundColor: "theme:paper",
        borderBottomWidth: 1,
        borderColor: "theme:paperRule",
        paddingLeft: "theme:spaceX7",
        paddingRight: "theme:spaceX5"
      } },
      dark: { style: {
        height: "theme:chromeTopbar",
        backgroundColor: "theme:bg2",
        borderBottomWidth: 2,
        borderColor: "theme:accentHot",
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX3"
      } }
    } },
    AppChromeBrandRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX4"
    } },
    AppChromeNavRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX2"
    } },
    AppChromeRightCluster: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX2"
    } },
    AppBrandSwatch: { type: "Box", style: {
      width: 18,
      height: 18,
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:accentHot",
      borderWidth: 1,
      borderColor: "theme:ruleBright"
    }, variants: {
      light: { style: { borderRadius: "theme:radiusRound" } },
      dark: { style: {} }
    } },
    AppBrandTitle: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:ink" },
    AppBrandSub: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    AppChromeDivider: { type: "Box", style: {
      width: 1,
      height: 18,
      backgroundColor: "theme:rule",
      marginLeft: "theme:spaceX4",
      marginRight: "theme:spaceX2"
    } },
    // ── Tour banner (chrome, post-onboarding offer) ─────────────
    // Drops into the right cluster the moment onboarding completes. Compact
    // pill — sits flush with the nav row, fades in over the home-entry
    // carryover, and unmounts when the user picks Yes / No.
    AppChromeTourBanner: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX4",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX3",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusRound",
      marginRight: "theme:spaceX4"
    } },
    AppChromeTourText: { type: "Text", size: "theme:typeMeta", color: "theme:ink" },
    AppChromeTourActions: { type: "Box", style: {
      flexDirection: "row",
      gap: "theme:spaceX2",
      alignItems: "center"
    } },
    AppChromeTourYes: { type: "Pressable", style: {
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      borderRadius: "theme:radiusRound",
      backgroundColor: "theme:accentHot"
    } },
    AppChromeTourNo: { type: "Pressable", style: {
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      borderRadius: "theme:radiusRound",
      backgroundColor: "theme:transparent",
      borderWidth: 1,
      borderColor: "theme:rule"
    } },
    AppChromeTourYesLabel: { type: "Text", size: "theme:typeMeta", bold: true, color: "theme:paper" },
    AppChromeTourNoLabel: { type: "Text", size: "theme:typeMeta", color: "theme:ink" },
    // ── Nav links (chrome route nav) ────────────────────────────
    AppNavLink: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      borderRadius: "theme:radiusMd",
      backgroundColor: "theme:transparent"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        borderRadius: "theme:radiusRound",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        backgroundColor: "theme:paper"
      } },
      dark: { style: {
        paddingLeft: "theme:spaceX3",
        paddingRight: "theme:spaceX3",
        borderRadius: "theme:radiusSm",
        borderWidth: 1,
        borderColor: "theme:rule",
        backgroundColor: "theme:bg"
      } }
    } },
    AppNavLinkActive: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      borderRadius: "theme:radiusMd",
      backgroundColor: "theme:bg2"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:accent"
      } },
      dark: { style: {
        paddingLeft: "theme:spaceX3",
        paddingRight: "theme:spaceX3",
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:bg2",
        borderWidth: 1,
        borderColor: "theme:accentHot"
      } }
    } },
    AppNavIcon: { type: "Icon", size: 14, strokeWidth: 2, color: "theme:inkDim" },
    AppNavIconActive: {
      type: "Icon",
      size: 14,
      strokeWidth: 2,
      color: "theme:ink",
      variants: {
        light: { color: "theme:bg" },
        dark: { color: "theme:accentHot" }
      }
    },
    AppNavLabel: { type: "Text", size: "theme:typeBase", color: "theme:inkDim" },
    AppNavLabelActive: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:ink",
      variants: {
        light: { color: "theme:bg" },
        dark: { color: "theme:accentHot" }
      }
    },
    // ── Step cubes (onboarding progress in chrome) ──────────────
    AppStepCubePast: { type: "Pressable", style: { width: 14, height: 14, backgroundColor: "theme:inkDim" } },
    AppStepCubeCurrent: { type: "Pressable", style: { width: 14, height: 14, backgroundColor: "theme:accent" } },
    AppStepCubeFuture: { type: "Pressable", style: { width: 14, height: 14, backgroundColor: "theme:rule" } },
    AppStepCubeRow: { type: "Box", style: { flexDirection: "row", alignItems: "center", gap: "theme:spaceX2" } },
    // ── Window buttons (minimize / maximize / close) ────────────
    AppWindowBtn: { type: "Pressable", style: {
      width: 26,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "theme:radiusSm"
    }, variants: {
      light: { style: {
        width: 30,
        height: 26,
        borderRadius: "theme:radiusRound",
        borderWidth: 1,
        borderColor: "theme:paperRule",
        backgroundColor: "theme:paper"
      } },
      dark: { style: {
        width: 24,
        height: 20,
        borderRadius: "theme:radiusSm",
        borderWidth: 1,
        borderColor: "theme:rule",
        backgroundColor: "theme:bg"
      } }
    } },
    AppWindowBtnIcon: { type: "Icon", size: 14, strokeWidth: 2, color: "theme:inkDim" },
    AppWindowBtnIconClose: { type: "Icon", size: 14, strokeWidth: 2, color: "theme:flag" },
    // ── Onboarding step shell ───────────────────────────────────
    AppStepFrame: { type: "Box", style: { flexGrow: 1, position: "relative" } },
    AppStepCenter: { type: "Box", style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center"
    } },
    AppStepCenterCol: { type: "Box", style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "theme:spaceX8",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8"
    } },
    AppStepBottomLeft: { type: "Box", style: { position: "absolute", bottom: 24, left: 24 } },
    AppStepBottomRight: { type: "Box", style: { position: "absolute", bottom: 24, right: 24 } },
    AppStepBottomRightRow: { type: "Box", style: {
      position: "absolute",
      bottom: 24,
      right: 24,
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX6"
    } },
    AppStepDimmable: { type: "Box", style: { opacity: 1 } },
    // ── Onboarding text (large, on dark page) ───────────────────
    // FirstStep — "Hello", "what is your name?", greet/exit lines.
    AppHello: { type: "Text", size: 48, bold: true, color: "theme:ink" },
    AppQuestion: { type: "Text", size: 16, color: "theme:inkDim" },
    AppGreet: { type: "Text", size: 32, bold: true, color: "theme:ink" },
    // Step2/Step3 — section prompt + branching exit message.
    AppPromptText: {
      type: "Text",
      size: 22,
      bold: true,
      color: "theme:ink",
      style: { textAlign: "center" }
    },
    AppExitMessage: {
      type: "Text",
      size: 32,
      bold: true,
      color: "theme:ink",
      style: { textAlign: "center" }
    },
    // ── Onboarding inputs ───────────────────────────────────────
    AppNameInput: { type: "TextInput", style: {
      width: 280,
      height: 36,
      fontSize: 16,
      color: "theme:ink",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6"
    } },
    AppFormInput: { type: "TextInput", style: {
      width: "100%",
      height: 36,
      fontSize: 13,
      color: "theme:ink",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6"
    } },
    AppFormInputMono: { type: "TextInput", style: {
      width: "100%",
      height: 36,
      fontSize: 13,
      color: "theme:ink",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      fontFamily: "theme:fontMono"
    } },
    // ── Provider tiles (Step2) ──────────────────────────────────
    AppProviderRow: { type: "Box", style: {
      flexDirection: "row",
      gap: "theme:spaceX7",
      alignItems: "stretch",
      flexWrap: "wrap",
      justifyContent: "center"
    } },
    AppProviderTile: { type: "Pressable", style: {
      width: 240,
      minHeight: 120,
      padding: "theme:spaceX7",
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusXl",
      gap: "theme:spaceX4",
      justifyContent: "center"
    }, variants: {
      light: { style: {
        width: 280,
        minHeight: 140,
        padding: "theme:spaceX8",
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusXl",
        gap: "theme:spaceX5"
      } },
      dark: { style: {
        width: 220,
        minHeight: 104,
        padding: "theme:spaceX5",
        backgroundColor: "theme:bg2",
        borderColor: "theme:rule",
        borderRadius: "theme:radiusSm",
        gap: "theme:spaceX3"
      } }
    } },
    AppProviderTileActive: { type: "Pressable", style: {
      width: 240,
      minHeight: 120,
      padding: "theme:spaceX7",
      backgroundColor: "theme:bg1",
      borderWidth: 2,
      borderColor: "theme:accent",
      borderRadius: "theme:radiusXl",
      gap: "theme:spaceX4",
      justifyContent: "center"
    }, variants: {
      light: { style: {
        width: 280,
        minHeight: 140,
        padding: "theme:spaceX8",
        backgroundColor: "theme:paper",
        borderWidth: 2,
        borderColor: "theme:accent",
        borderRadius: "theme:radiusXl",
        gap: "theme:spaceX5"
      } },
      dark: { style: {
        width: 220,
        minHeight: 104,
        padding: "theme:spaceX5",
        backgroundColor: "theme:bg2",
        borderWidth: 2,
        borderColor: "theme:accentHot",
        borderRadius: "theme:radiusSm",
        gap: "theme:spaceX3"
      } }
    } },
    AppProviderTileTitle: { type: "Text", size: "theme:typeStrong", bold: true, color: "theme:ink" },
    AppProviderTileTitleActive: { type: "Text", size: "theme:typeStrong", bold: true, color: "theme:accent" },
    AppProviderTileSubtitle: { type: "Text", size: "theme:typeMeta", color: "theme:inkDim" },
    // ── Inline form shell (Step2 provider forms) ────────────────
    AppFormShell: { type: "Box", style: {
      flexDirection: "column",
      width: 480,
      padding: "theme:spaceX8",
      gap: "theme:spaceX6",
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusXl"
    }, variants: {
      light: { style: {
        width: 540,
        padding: "theme:spaceX8",
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusXl",
        gap: "theme:spaceX7"
      } },
      dark: { style: {
        width: 440,
        padding: "theme:spaceX6",
        backgroundColor: "theme:bg2",
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm",
        gap: "theme:spaceX5"
      } }
    }, bp: {
      // At sm the form shell drops its fixed width and fills the parent
      // column. variants get explicit overrides because variant.style would
      // otherwise win the merge against bp.style.
      sm: {
        style: { width: "100%" },
        variants: {
          light: { style: { width: "100%" } },
          dark: { style: { width: "100%" } }
        }
      }
    } },
    AppFormFieldCol: { type: "Box", style: {
      flexDirection: "column",
      gap: "theme:spaceX3"
    } },
    AppFormButtonRow: { type: "Box", style: {
      flexDirection: "row",
      justifyContent: "flex-end"
    } },
    AppFormLabel: { type: "Text", size: "theme:typeBase", color: "theme:inkDim" },
    // ── Probe result ────────────────────────────────────────────
    AppProbeResult: { type: "Box", style: {
      flexDirection: "column",
      gap: "theme:spaceX2",
      padding: "theme:spaceX6",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd"
    } },
    AppProbeOk: { type: "Text", size: "theme:typeMeta", bold: true, color: "theme:ok" },
    AppProbeFail: { type: "Text", size: "theme:typeMeta", bold: true, color: "theme:flag" },
    AppProbeMessage: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono" }
    },
    // ── Model list (Step2) ──────────────────────────────────────
    AppModelListLabel: { type: "Text", size: "theme:typeBase", color: "theme:inkDim" },
    AppModelListBox: { type: "Box", style: {
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      padding: "theme:spaceX2",
      backgroundColor: "theme:bg2",
      overflow: "hidden"
    } },
    AppModelChoice: { type: "Pressable", style: {
      padding: "theme:spaceX5",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd"
    } },
    AppModelChoiceActive: { type: "Pressable", style: {
      padding: "theme:spaceX5",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:accent",
      borderRadius: "theme:radiusMd"
    } },
    AppModelChoiceText: {
      type: "Text",
      size: "theme:typeMeta",
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono" }
    },
    AppModelChoiceTextActive: {
      type: "Text",
      size: "theme:typeMeta",
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono" }
    },
    // ── Trait chips (Step3) ─────────────────────────────────────
    AppTraitGrid: { type: "Box", style: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: "theme:spaceX4",
      justifyContent: "center"
    } },
    AppTraitChip: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      borderRadius: "theme:radiusRound",
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule"
    }, variants: {
      light: { style: {
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        paddingLeft: "theme:spaceX8",
        paddingRight: "theme:spaceX8"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:bg",
        borderColor: "theme:rule",
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5"
      } }
    } },
    AppTraitChipActive: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      borderRadius: "theme:radiusRound",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:accentHot"
    }, variants: {
      light: { style: {
        borderRadius: "theme:radiusRound",
        backgroundColor: "theme:accent",
        borderColor: "theme:accent",
        paddingLeft: "theme:spaceX8",
        paddingRight: "theme:spaceX8"
      } },
      dark: { style: {
        borderRadius: "theme:radiusSm",
        backgroundColor: "theme:bg2",
        borderColor: "theme:accentHot",
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5"
      } }
    } },
    AppTraitChipText: { type: "Text", size: "theme:typeMeta", color: "theme:ink" },
    AppTraitChipTextActive: { type: "Text", size: "theme:typeMeta", bold: true, color: "theme:accentHot" },
    // ── Inline prompt row + hyperlink (Step5) ───────────────────
    // Step5's prompt is "What is your first goal?" with "goal" rendered as a
    // tooltip-bearing hyperlink. The row keeps the segments aligned and the
    // link picks up underline + accent color while staying flush with the
    // surrounding AppPromptText (size 22, bold).
    AppPromptRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 0
    } },
    AppPromptLink: { type: "Pressable", style: {} },
    AppPromptLinkText: {
      type: "Text",
      size: 22,
      bold: true,
      color: "theme:accent",
      style: { textDecorationLine: "underline" }
    },
    // ══════════════════════════════════════════════════════════════
    //   Menu representations — launcher / hub surfaces
    //
    //   Compositional vocabulary for menu tiles. Every menu shape in
    //   `cart/component-gallery/components/menu-*` is built by stacking
    //   these primitives. Each tile is a single artboard surface; the
    //   *form* varies, the entries (cart/component-gallery/data/menu-entry.ts)
    //   stay constant.
    // ══════════════════════════════════════════════════════════════
    // Tile shell — the artboard chrome every menu sits inside. Fixed
    // dimensions so flex:1 children (the stage) actually claim space.
    MenuTile: { type: "Box", style: {
      flexDirection: "column",
      width: 560,
      minWidth: 560,
      height: 420,
      minHeight: 420,
      flexShrink: 0,
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusLg",
      overflow: "hidden"
    }, variants: {
      light: { style: {
        width: 620,
        minWidth: 620,
        height: 470,
        minHeight: 470,
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusXl"
      } },
      dark: { style: {
        width: 520,
        minWidth: 520,
        height: 390,
        minHeight: 390,
        backgroundColor: "theme:bg",
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm"
      } }
    } },
    MenuTileSquare: { type: "Box", style: {
      flexDirection: "column",
      width: 420,
      minWidth: 420,
      height: 420,
      minHeight: 420,
      flexShrink: 0,
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusLg",
      overflow: "hidden"
    }, variants: {
      light: { style: {
        width: 460,
        minWidth: 460,
        height: 460,
        minHeight: 460,
        backgroundColor: "theme:paper",
        borderColor: "theme:paperRule",
        borderRadius: "theme:radiusXl"
      } },
      dark: { style: {
        width: 390,
        minWidth: 390,
        height: 390,
        minHeight: 390,
        backgroundColor: "theme:bg",
        borderColor: "theme:ruleBright",
        borderRadius: "theme:radiusSm"
      } }
    } },
    MenuTileChrome: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX4",
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule",
      backgroundColor: "theme:bg1",
      flexShrink: 0
    }, variants: {
      light: { style: {
        gap: "theme:spaceX6",
        paddingLeft: "theme:spaceX7",
        paddingRight: "theme:spaceX7",
        paddingTop: "theme:spaceX5",
        paddingBottom: "theme:spaceX5",
        borderBottomColor: "theme:paperRule",
        backgroundColor: "theme:paperAlt"
      } },
      dark: { style: {
        gap: "theme:spaceX4",
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        paddingTop: "theme:spaceX3",
        paddingBottom: "theme:spaceX3",
        borderBottomColor: "theme:accentHot",
        backgroundColor: "theme:bg2"
      } }
    } },
    MenuTileId: {
      type: "Text",
      size: "theme:typeBody",
      bold: true,
      color: "theme:accent",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.2 }
    },
    MenuTileTitle: {
      type: "Text",
      size: "theme:typeBody",
      color: "theme:ink",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1 }
    },
    MenuTileKind: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDimmer",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.4, textTransform: "uppercase" }
    },
    MenuTileSpacer: { type: "Box", style: { flex: 1 } },
    MenuTileStage: { type: "Box", style: {
      flexDirection: "column",
      flex: 1,
      flexGrow: 1,
      position: "relative",
      overflow: "hidden",
      backgroundColor: "theme:bg"
    }, variants: {
      light: { style: { backgroundColor: "theme:paper" } },
      dark: { style: { backgroundColor: "theme:bg" } }
    } },
    // ── Shared text rungs ────────────────────────────────────────
    // Single-line by default — menu rows live in tight flex contexts where
    // accidental wrapping breaks the artboard. Override per-instance with
    // `numberOfLines={N}` if a specific surface needs wrapping.
    MenuLabel: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:ink",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    MenuLabelActive: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:accent",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" },
      variants: {
        light: { color: "theme:accent" },
        dark: { color: "theme:accentHot" }
      }
    },
    MenuLabelStrong: {
      type: "Text",
      size: "theme:typeStrong",
      color: "theme:ink",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    MenuHint: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    MenuHintDim: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDimmer",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.2 }
    },
    MenuKey: {
      type: "Text",
      size: "theme:typeBase",
      bold: true,
      color: "theme:accentHot",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    MenuNum: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDimmer",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    MenuNumAccent: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:accent",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.4 }
    },
    MenuCaret: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:accent",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    // Section eyebrow (e.g. "STAGE · 03").
    MenuEyebrow: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:accent",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 2.4 }
    },
    // ── A · Lists — basic indent + caret ─────────────────────────
    MenuListBox: { type: "Box", style: {
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX6",
      paddingBottom: "theme:spaceX6",
      gap: "theme:spaceX1"
    }, variants: {
      light: { style: {
        paddingLeft: "theme:spaceX8",
        paddingRight: "theme:spaceX8",
        paddingTop: "theme:spaceX7",
        paddingBottom: "theme:spaceX7",
        gap: "theme:spaceX2"
      } },
      dark: { style: {
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        paddingTop: "theme:spaceX4",
        paddingBottom: "theme:spaceX4",
        gap: "theme:spaceX0"
      } }
    } },
    MenuListRow: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      borderRadius: "theme:radiusSm"
    }, variants: {
      light: { style: {
        gap: "theme:spaceX6",
        paddingLeft: "theme:spaceX5",
        paddingRight: "theme:spaceX5",
        paddingTop: "theme:spaceX4",
        paddingBottom: "theme:spaceX4",
        borderRadius: "theme:radiusRound"
      } },
      dark: { style: {
        gap: "theme:spaceX3",
        paddingLeft: "theme:spaceX3",
        paddingRight: "theme:spaceX3",
        paddingTop: "theme:spaceX2",
        paddingBottom: "theme:spaceX2",
        borderRadius: "theme:radiusSm"
      } }
    } },
    MenuListRowActive: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      backgroundColor: "theme:bg2",
      borderRadius: "theme:radiusSm"
    }, variants: {
      light: { style: {
        gap: "theme:spaceX6",
        paddingLeft: "theme:spaceX7",
        paddingRight: "theme:spaceX5",
        paddingTop: "theme:spaceX4",
        paddingBottom: "theme:spaceX4",
        backgroundColor: "theme:paperAlt",
        borderRadius: "theme:radiusRound"
      } },
      dark: { style: {
        gap: "theme:spaceX3",
        paddingLeft: "theme:spaceX4",
        paddingRight: "theme:spaceX3",
        paddingTop: "theme:spaceX2",
        paddingBottom: "theme:spaceX2",
        backgroundColor: "theme:bg2",
        borderRadius: "theme:radiusSm",
        borderWidth: 1,
        borderColor: "theme:accentHot"
      } }
    } },
    MenuListLabelCol: { type: "Box", style: { flex: 1 } },
    // A3 keyed list rows (single keycap + label, hover spreads gap)
    MenuKeyedRow: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX6",
      paddingLeft: "theme:spaceX2",
      paddingRight: "theme:spaceX2",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3"
    } },
    MenuKeyedRowActive: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX8",
      paddingLeft: "theme:spaceX2",
      paddingRight: "theme:spaceX2",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3"
    } },
    // A5 sliding marker
    MenuMarkerBox: { type: "Box", style: {
      position: "relative",
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX6",
      paddingBottom: "theme:spaceX6"
    } },
    MenuMarkerSlab: { type: "Box", style: {
      position: "absolute",
      left: 8,
      right: 8,
      height: 28,
      backgroundColor: "theme:bg2",
      borderLeftWidth: 2,
      borderLeftColor: "theme:accent"
    } },
    MenuMarkerRow: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 28,
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      gap: "theme:spaceX5"
    } },
    // ── B · Radials — fan blade body (surface around an SVG Graph) ──
    MenuRadialBox: { type: "Box", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: "theme:spaceX5"
    } },
    MenuRadialCenter: { type: "Box", style: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      gap: "theme:spaceX1"
    } },
    // ── C · Grids ────────────────────────────────────────────────
    MenuGridBox: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX6",
      gap: "theme:spaceX5"
    } },
    MenuGridRow: { type: "Box", style: {
      flexDirection: "row",
      flex: 1,
      gap: "theme:spaceX5"
    } },
    MenuGridTile: { type: "Pressable", style: {
      flex: 1,
      padding: "theme:spaceX5",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg",
      justifyContent: "space-between",
      gap: "theme:spaceX2"
    } },
    MenuGridTileActive: { type: "Pressable", style: {
      flex: 1,
      padding: "theme:spaceX5",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg1",
      justifyContent: "space-between",
      gap: "theme:spaceX2"
    } },
    // C3 brick row (offset every other) — uses flex-grow to bloom on active
    MenuBrickRow: { type: "Box", style: {
      flexDirection: "row",
      flex: 1,
      gap: "theme:spaceX2"
    } },
    MenuBrickRowOffset: { type: "Box", style: {
      flexDirection: "row",
      flex: 1,
      gap: "theme:spaceX2",
      paddingLeft: "theme:spaceX8"
    } },
    MenuBrick: { type: "Pressable", style: {
      flex: 1,
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      alignItems: "flex-start",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg"
    } },
    MenuBrickActive: { type: "Pressable", style: {
      flex: 2,
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      alignItems: "flex-start",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2"
    } },
    // ── D · Rails ────────────────────────────────────────────────
    // D1 left rail
    MenuSpine: { type: "Box", style: { flexDirection: "row", flex: 1 } },
    MenuRail: { type: "Box", style: {
      width: 56,
      borderRightWidth: 1,
      borderRightColor: "theme:rule"
    } },
    MenuRailBtn: { type: "Pressable", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule",
      backgroundColor: "theme:bg"
    } },
    MenuRailBtnActive: { type: "Pressable", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule",
      borderLeftWidth: 3,
      borderLeftColor: "theme:accentHot",
      backgroundColor: "theme:bg1"
    } },
    MenuPreview: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX8",
      gap: "theme:spaceX4"
    } },
    MenuPreviewTitle: {
      type: "Text",
      size: "theme:typeHeading",
      bold: true,
      color: "theme:ink",
      numberOfLines: 1,
      style: { letterSpacing: -0.4 }
    },
    // D2 ribbon
    MenuRibbon: { type: "Box", style: { flexDirection: "column", flex: 1 } },
    MenuRibbonTabs: { type: "Box", style: {
      flexDirection: "row",
      height: 36,
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule"
    } },
    MenuRibbonTab: { type: "Pressable", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRightWidth: 1,
      borderRightColor: "theme:rule"
    } },
    MenuRibbonTabActive: { type: "Pressable", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRightWidth: 1,
      borderRightColor: "theme:rule",
      borderBottomWidth: 2,
      borderBottomColor: "theme:accentHot",
      backgroundColor: "theme:bg1"
    } },
    MenuRibbonBody: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX8",
      gap: "theme:spaceX4"
    } },
    // D3 dock
    MenuDock: { type: "Box", style: { flexDirection: "column", flex: 1 } },
    MenuDockStage: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX8",
      gap: "theme:spaceX2"
    } },
    MenuDockBar: { type: "Box", style: {
      flexDirection: "row",
      height: 56,
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      gap: "theme:spaceX3",
      borderTopWidth: 1,
      borderTopColor: "theme:rule"
    } },
    MenuDockBtn: { type: "Pressable", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "theme:radiusSm",
      gap: "theme:spaceX1"
    } },
    MenuDockBtnActive: { type: "Pressable", style: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2",
      gap: "theme:spaceX1"
    } },
    MenuDockGlyph: {
      type: "Text",
      size: "theme:typeHeading",
      color: "theme:inkDim",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    MenuDockGlyphActive: {
      type: "Text",
      size: "theme:typeHeading",
      color: "theme:accent",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono" }
    },
    // D4 marquee strip
    MenuMarquee: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX8",
      gap: "theme:spaceX3"
    } },
    MenuMarqueeTrack: { type: "Box", style: {
      height: 32,
      position: "relative",
      borderTopWidth: 1,
      borderTopColor: "theme:rule",
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule",
      overflow: "hidden"
    } },
    MenuMarqueeStrip: { type: "Box", style: {
      flexDirection: "row",
      position: "absolute",
      top: 0,
      bottom: 0,
      alignItems: "center"
    } },
    MenuMarqueeItem: { type: "Pressable", style: {
      flexDirection: "row",
      width: 160,
      height: 30,
      gap: "theme:spaceX2",
      alignItems: "center",
      justifyContent: "flex-start",
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5"
    } },
    // ── E · Cards ────────────────────────────────────────────────
    // E1 dossier (absolute layout)
    MenuDossier: { type: "Box", style: {
      flex: 1,
      position: "relative",
      padding: "theme:spaceX7"
    } },
    MenuDossierCard: { type: "Pressable", style: {
      width: 270,
      height: 168,
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      padding: "theme:spaceX6",
      justifyContent: "space-between"
    } },
    MenuDossierCardActive: { type: "Pressable", style: {
      width: 270,
      height: 168,
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:accent",
      padding: "theme:spaceX6",
      justifyContent: "space-between"
    } },
    MenuDossierTitle: { type: "Text", size: "theme:typeHeading", color: "theme:ink", numberOfLines: 1 },
    // E2 file folder
    MenuFolder: { type: "Box", style: {
      flex: 1,
      flexDirection: "column",
      padding: "theme:spaceX5"
    } },
    MenuFolderTabs: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: 36,
      gap: 1
    } },
    MenuFolderTab: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX4",
      paddingBottom: "theme:spaceX3",
      backgroundColor: "theme:bg1",
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: "theme:rule",
      borderTopLeftRadius: "theme:radiusSm",
      borderTopRightRadius: "theme:radiusSm"
    } },
    MenuFolderTabActive: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX5",
      paddingBottom: "theme:spaceX3",
      backgroundColor: "theme:bg2",
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: "theme:ruleBright",
      borderTopLeftRadius: "theme:radiusSm",
      borderTopRightRadius: "theme:radiusSm"
    } },
    MenuFolderBody: { type: "Box", style: {
      flex: 1,
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      padding: "theme:spaceX8",
      gap: "theme:spaceX4"
    } },
    // ── F · Diagrams ─────────────────────────────────────────────
    MenuCli: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX8",
      gap: "theme:spaceX2"
    } },
    MenuCliPrompt: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono" }
    },
    MenuCliBranch: { type: "Pressable", style: {
      flexDirection: "row",
      gap: "theme:spaceX3",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1"
    } },
    MenuCliGlyph: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono" }
    },
    MenuCliHint: {
      type: "Text",
      size: "theme:typeCaption",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", marginLeft: 8 }
    },
    // ── G · Spatial / diegetic ───────────────────────────────────
    // G1 depth tiers (transformed rows)
    MenuDepth: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX7",
      gap: "theme:spaceX3"
    } },
    MenuDepthRow: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2"
    } },
    MenuDepthRowActive: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      paddingLeft: "theme:spaceX7"
    } },
    MenuDisplayLabel: { type: "Text", size: "theme:typeStrong", color: "theme:inkDim", numberOfLines: 1 },
    MenuDisplayLabelActive: { type: "Text", size: "theme:typeStrong", bold: true, color: "theme:accentHot", numberOfLines: 1 },
    // G2 terminal
    MenuTerm: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX7",
      gap: "theme:spaceX2",
      backgroundColor: "theme:bg"
    } },
    MenuTermLine: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono" }
    },
    MenuTermLineOk: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:ok",
      style: { fontFamily: "theme:fontMono" }
    },
    MenuTermPrompt: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX1",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3"
    } },
    MenuTermCursor: { type: "Box", style: {
      width: 8,
      height: 14,
      backgroundColor: "theme:accentHot"
    } },
    MenuTermOpt: { type: "Pressable", style: {
      flexDirection: "row",
      gap: "theme:spaceX5",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2"
    } },
    MenuTermOptActive: { type: "Pressable", style: {
      flexDirection: "row",
      gap: "theme:spaceX5",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2"
    } },
    // G3 console panel
    MenuConsole: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX6",
      gap: "theme:spaceX4"
    } },
    MenuConsoleRow: { type: "Box", style: {
      flexDirection: "row",
      flex: 1,
      gap: "theme:spaceX4"
    } },
    MenuConsoleCell: { type: "Pressable", style: {
      flex: 1,
      padding: "theme:spaceX5",
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      backgroundColor: "theme:bg1",
      justifyContent: "space-between",
      gap: "theme:spaceX3"
    } },
    MenuConsoleCellActive: { type: "Pressable", style: {
      flex: 1,
      padding: "theme:spaceX5",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2",
      justifyContent: "space-between",
      gap: "theme:spaceX3"
    } },
    MenuConsoleHead: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX4"
    } },
    MenuLed: { type: "Box", style: {
      width: 8,
      height: 8,
      borderRadius: "theme:radiusPill",
      backgroundColor: "theme:inkDimmer"
    } },
    MenuLedActive: { type: "Box", style: {
      width: 8,
      height: 8,
      borderRadius: "theme:radiusPill",
      backgroundColor: "theme:accentHot"
    } },
    // G4 curtain
    MenuCurtain: { type: "Box", style: { flex: 1, flexDirection: "column" } },
    MenuCurtainRow: { type: "Pressable", style: {
      flexDirection: "row",
      flex: 1,
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule",
      backgroundColor: "theme:bg"
    } },
    MenuCurtainRowActive: { type: "Pressable", style: {
      flexDirection: "row",
      flex: 3,
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX8",
      paddingRight: "theme:spaceX8",
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    MenuCurtainSpacer: { type: "Box", style: { flex: 1 } },
    // ── H · Weird ────────────────────────────────────────────────
    // H2 barcode
    MenuBarcode: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX6",
      gap: "theme:spaceX5"
    } },
    MenuBarcodeStrip: { type: "Box", style: {
      flexDirection: "row",
      flex: 1,
      gap: 2,
      alignItems: "stretch"
    } },
    MenuBarcodeBar: { type: "Pressable", style: {
      flex: 1,
      backgroundColor: "theme:ink",
      paddingLeft: "theme:spaceX2",
      paddingRight: "theme:spaceX2",
      paddingBottom: "theme:spaceX5",
      justifyContent: "flex-end"
    } },
    MenuBarcodeBarActive: { type: "Pressable", style: {
      flex: 4,
      backgroundColor: "theme:accentHot",
      paddingLeft: "theme:spaceX2",
      paddingRight: "theme:spaceX2",
      paddingBottom: "theme:spaceX5",
      justifyContent: "flex-end"
    } },
    MenuBarcodeLabel: {
      type: "Text",
      size: "theme:typeMicro",
      color: "theme:bg",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.6 }
    },
    MenuBarcodeLabelActive: {
      type: "Text",
      size: "theme:typeMicro",
      color: "theme:ink",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.6 }
    },
    MenuBarcodeFoot: { type: "Box", style: {
      flexDirection: "row",
      justifyContent: "space-between"
    } },
    // H3 periodic — square 1:1 surface, periodic-table silhouette of cards
    MenuPeriodic: { type: "Box", style: {
      flex: 1,
      flexDirection: "column",
      paddingTop: "theme:spaceX6",
      paddingBottom: "theme:spaceX6",
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      gap: "theme:spaceX5"
    } },
    MenuPeriodicGroupRow: { type: "Box", style: {
      flexDirection: "row",
      paddingLeft: 18,
      gap: 4
    } },
    MenuPeriodicGroupTick: { type: "Box", style: {
      width: 50,
      alignItems: "center"
    } },
    MenuPeriodicTable: { type: "Box", style: {
      flexDirection: "column",
      flex: 1,
      gap: 4
    } },
    MenuPeriodicTableRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4
    } },
    MenuPeriodicPeriodTick: { type: "Box", style: {
      width: 14,
      alignItems: "center"
    } },
    MenuPeriodicEmpty: { type: "Box", style: {
      width: 50,
      height: 56,
      alignItems: "center",
      justifyContent: "center"
    } },
    MenuPeriodicEmptyDot: { type: "Box", style: {
      width: 3,
      height: 3,
      borderRadius: "theme:radiusPill",
      backgroundColor: "theme:rule"
    } },
    MenuPeriodicCellLive: { type: "Pressable", style: {
      width: 50,
      height: 56,
      borderWidth: 1,
      borderColor: "theme:ruleBright",
      backgroundColor: "theme:bg1",
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
      justifyContent: "space-between"
    } },
    MenuPeriodicCellActive: { type: "Pressable", style: {
      width: 50,
      height: 56,
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2",
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
      justifyContent: "space-between"
    } },
    MenuPeriodicCellHead: { type: "Box", style: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start"
    } },
    MenuPeriodicSym: {
      type: "Text",
      size: 22,
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", textAlign: "center", lineHeight: 22 }
    },
    MenuPeriodicSymActive: {
      type: "Text",
      size: 22,
      bold: true,
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono", textAlign: "center", lineHeight: 22 }
    },
    MenuPeriodicSymRow: { type: "Box", style: { flex: 1, alignItems: "center", justifyContent: "center" } },
    MenuPeriodicNum: {
      type: "Text",
      size: "theme:typeMicro",
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono" }
    },
    MenuPeriodicMass: {
      type: "Text",
      size: "theme:typeMicro",
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono" }
    },
    MenuPeriodicName: {
      type: "Text",
      size: 6,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", letterSpacing: 1, textAlign: "center" }
    },
    MenuPeriodicNameActive: {
      type: "Text",
      size: 6,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", letterSpacing: 1, textAlign: "center" }
    },
    MenuPeriodicGroupNum: {
      type: "Text",
      size: "theme:typeMicro",
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.4 }
    },
    MenuPeriodicPeriodNum: {
      type: "Text",
      size: "theme:typeMicro",
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.4 }
    },
    // H3 featured-element strip (the popout below the table)
    MenuPeriodicFeature: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX6",
      borderTopWidth: 1,
      borderTopColor: "theme:rule",
      paddingTop: "theme:spaceX5"
    } },
    MenuPeriodicFeatureSym: { type: "Box", style: {
      width: 56,
      height: 64,
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2",
      paddingLeft: 5,
      paddingRight: 5,
      paddingTop: 5,
      paddingBottom: 5,
      justifyContent: "space-between"
    } },
    MenuPeriodicFeatureMain: { type: "Box", style: {
      flex: 1,
      gap: 2
    } },
    // H5 type-as-menu
    MenuTypeStack: { type: "Box", style: {
      flex: 1,
      padding: "theme:spaceX8",
      gap: "theme:spaceX2"
    } },
    MenuTypeStackBody: { type: "Box", style: {
      flex: 1,
      justifyContent: "center"
    } },
    MenuTypeRow: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1"
    } },
    MenuTypeRowActive: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX5",
      paddingLeft: "theme:spaceX7",
      paddingTop: "theme:spaceX1",
      paddingBottom: "theme:spaceX1"
    } },
    MenuTypeBar: { type: "Box", style: {
      width: 16,
      height: 1,
      backgroundColor: "theme:accentHot"
    } },
    MenuTypeText: {
      type: "Text",
      size: "theme:typeStrong",
      color: "theme:inkDimmer",
      numberOfLines: 1,
      style: { letterSpacing: -0.4 }
    },
    MenuTypeTextActive: {
      type: "Text",
      size: "theme:typeHeading",
      bold: true,
      color: "theme:ink",
      numberOfLines: 1,
      style: { letterSpacing: -0.4 }
    },
    MenuTypeHint: {
      type: "Text",
      size: "theme:typeBase",
      color: "theme:accent",
      numberOfLines: 1,
      style: { fontFamily: "theme:fontMono", letterSpacing: 1.2 }
    },
    // ── Common atoms used across multiple menus ──────────────────
    MenuStatusDotLive: { type: "Box", style: {
      width: 6,
      height: 6,
      borderRadius: "theme:radiusPill",
      backgroundColor: "theme:ok"
    } },
    MenuStatusDotWarn: { type: "Box", style: {
      width: 6,
      height: 6,
      borderRadius: "theme:radiusPill",
      backgroundColor: "theme:warn"
    } },
    MenuStatusDotMute: { type: "Box", style: {
      width: 6,
      height: 6,
      borderRadius: "theme:radiusPill",
      backgroundColor: "theme:inkDimmer"
    } },
    // ──────────────────────────────────────────────────────────────
    //   Input slot containers — morph-driven layout
    // ──────────────────────────────────────────────────────────────
    //
    // Two slot containers wrap the persistent <InputStrip> in cart/app.
    // The cart drives their dimensions per render via local style
    // overrides (paddingRight on BottomInputBar; width on SideMenuInput;
    // height on BottomInputBar) so the layout can interpolate smoothly
    // instead of snapping via display:none.
    //
    // Variant ('side' vs null) controls input PLACEMENT only — JSX
    // conditional renders the input inside whichever container's natural
    // home it currently is. Visibility is purely a function of the
    // morph values applied as inline styles.
    AppBottomInputBar: { type: "Box", style: {
      width: "100%",
      height: APP_BOTTOM_BAR_H,
      flexShrink: 0,
      overflow: "hidden",
      // Anchor the input to the bar's bottom — the classifier height is
      // a slight over-estimate of CommandComposerFrame's natural height,
      // so without flex-end the input would float a few pixels above the
      // floor. The over-allocated gap above the input fills with theme:bg
      // (matches the page bg).
      flexDirection: "column",
      justifyContent: "flex-end",
      backgroundColor: "theme:bg"
    } },
    AppSideMenuInput: { type: "Box", style: {
      width: 0,
      height: "100%",
      flexShrink: 0,
      flexDirection: "column",
      overflow: "hidden",
      // Match the page bg so there's no visible color split where the
      // side menu meets the rest of the app. Once menu items land, they
      // can carry their own surfaces.
      backgroundColor: "theme:bg",
      justifyContent: "flex-end"
    } },
    // ══════════════════════════════════════════════════════════════
    //   Manifest Gate (cart/manifest_gate/index.tsx) — Round-2 of the
    //   line-manifest benchmark. All theme-touching styling lives here;
    //   per-render values (spring opacity, slide y, pulse-driven sizes)
    //   flow as inline style overrides at the call sites.
    // ══════════════════════════════════════════════════════════════
    ManifestGateRoot: { type: "Box", style: {
      width: "100%",
      height: "100%",
      backgroundColor: "theme:bg",
      flexDirection: "column"
    } },
    ManifestGateChrome: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX5",
      paddingBottom: "theme:spaceX5",
      backgroundColor: "theme:bg1",
      borderBottomWidth: 1,
      borderColor: "theme:rule"
    } },
    ManifestGateChromeTitle: { type: "Text", size: "theme:typeHeading", bold: true, color: "theme:ink" },
    ManifestGateChromeSubtitle: { type: "Text", size: "theme:typeMeta", color: "theme:inkDim" },
    ManifestGateChromeStatusCol: { type: "Box", style: {
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "theme:spaceX1"
    } },
    ManifestGateChromeStatusRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3"
    } },
    ManifestGatePhaseLabel: { type: "Text", size: "theme:typeMeta", bold: true, color: "theme:ink" },
    ManifestGatePhaseMeta: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    // Status-dot variants — discrete classifier per phase color so the
    // theme owns the palette. JSX picks one based on phase.
    ManifestGateStatusDotIdle: { type: "Box", style: { borderRadius: "theme:radiusRound", backgroundColor: "theme:inkDim" } },
    ManifestGateStatusDotLoading: { type: "Box", style: { borderRadius: "theme:radiusRound", backgroundColor: "theme:warn" } },
    ManifestGateStatusDotLoaded: { type: "Box", style: { borderRadius: "theme:radiusRound", backgroundColor: "theme:ok" } },
    ManifestGateStatusDotGenerating: { type: "Box", style: { borderRadius: "theme:radiusRound", backgroundColor: "theme:accent" } },
    ManifestGateStatusDotFailed: { type: "Box", style: { borderRadius: "theme:radiusRound", backgroundColor: "theme:flag" } },
    // Body region (everything below the chrome).
    ManifestGateBody: { type: "Box", style: {
      flexGrow: 1,
      paddingLeft: "theme:spaceX7",
      paddingRight: "theme:spaceX7",
      paddingTop: "theme:spaceX6",
      paddingBottom: "theme:spaceX6",
      gap: "theme:spaceX5",
      flexDirection: "column"
    } },
    ManifestGatePanel: { type: "Box", style: {
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX5",
      paddingBottom: "theme:spaceX5",
      gap: "theme:spaceX4",
      flexDirection: "column"
    } },
    ManifestGatePanelGrow: { type: "Box", style: {
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: "theme:radiusMd",
      paddingLeft: "theme:spaceX6",
      paddingRight: "theme:spaceX6",
      paddingTop: "theme:spaceX5",
      paddingBottom: "theme:spaceX5",
      gap: "theme:spaceX4",
      flexDirection: "column",
      flexGrow: 1,
      minHeight: 0
    } },
    ManifestGatePanelHeader: { type: "Box", style: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    } },
    ManifestGatePanelTitle: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:ink" },
    ManifestGatePanelHint: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    ManifestGatePanelHintMono: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim", font: "theme:fontMono" },
    // Verdict count badges — separate classifiers, picked by JSX.
    ManifestGateCountTrue: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:ok" },
    ManifestGateCountFalse: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:flag" },
    ManifestGateCountUnclear: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:warn" },
    ManifestGateCountElapsed: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    // Run button: active vs disabled (separate classifiers, no inline color
    // logic — JSX picks based on (ready && !running)).
    ManifestGateRunBtn: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:accent",
      alignItems: "center",
      justifyContent: "center"
    } },
    ManifestGateRunBtnDisabled: { type: "Pressable", style: {
      paddingLeft: "theme:spaceX5",
      paddingRight: "theme:spaceX5",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2",
      alignItems: "center",
      justifyContent: "center"
    } },
    ManifestGateRunBtnLabel: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:ink" },
    ManifestGateRunBtnLabelDisabled: { type: "Text", size: "theme:typeBase", bold: true, color: "theme:inkDim" },
    // Stream panel — heartbeat sparkline cells + the live token line.
    ManifestGateStreamSubtitle: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    ManifestGateStreamCells: { type: "Box", style: {
      flexDirection: "row",
      gap: "theme:spaceX1"
    } },
    ManifestGateStreamCellOff: { type: "Box", style: {
      width: 6,
      height: 12,
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2"
    } },
    ManifestGateStreamCellOn: { type: "Box", style: {
      width: 6,
      height: 12,
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:accent"
    } },
    ManifestGateStreamClaim: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    ManifestGateStreamBox: { type: "Box", style: {
      backgroundColor: "theme:bg2",
      borderRadius: "theme:radiusSm",
      paddingLeft: "theme:spaceX4",
      paddingRight: "theme:spaceX4",
      paddingTop: "theme:spaceX3",
      paddingBottom: "theme:spaceX3",
      minHeight: 28
    } },
    ManifestGateStreamText: { type: "Text", size: "theme:typeCaption", color: "theme:accent", font: "theme:fontMono" },
    ManifestGateStreamPlaceholder: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim", font: "theme:fontMono" },
    // Verdict row — idle vs active (active gets a continuous border-flow
    // trace; the GenericCardShell pattern from list_lab "border" scene).
    ManifestGateVerdictRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3",
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule"
    } },
    ManifestGateVerdictRowActive: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: "theme:spaceX3",
      paddingLeft: "theme:spaceX3",
      paddingRight: "theme:spaceX3",
      paddingTop: "theme:spaceX2",
      paddingBottom: "theme:spaceX2",
      borderRadius: "theme:radiusSm",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:accent",
      borderDashOn: 6,
      borderDashOff: 4,
      borderDashWidth: 1,
      borderFlowSpeed: 24
    } },
    // Verdict badge — discrete classifier per state (no inline color picks).
    ManifestGateBadgeTrue: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:ok", font: "theme:fontMono" },
    ManifestGateBadgeFalse: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:flag", font: "theme:fontMono" },
    ManifestGateBadgePending: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:warn", font: "theme:fontMono" },
    ManifestGateBadgeUnclear: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:warn", font: "theme:fontMono" },
    ManifestGateBadgeIdle: { type: "Text", size: "theme:typeCaption", bold: true, color: "theme:inkDim", font: "theme:fontMono" },
    ManifestGateBadgeSlot: { type: "Box", style: { width: 64, alignItems: "center" } },
    ManifestGateLineSlot: { type: "Box", style: { width: 40 } },
    ManifestGateLineLabel: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim", font: "theme:fontMono" },
    ManifestGateClaimSlot: { type: "Box", style: { flexGrow: 1 } },
    ManifestGateClaimText: { type: "Text", size: "theme:typeCaption", color: "theme:ink" },
    ManifestGateEmpty: { type: "Text", size: "theme:typeCaption", color: "theme:inkDim" },
    // ──────────────────────────────────────────────────────────────
    //   Persistent assistant chat (full ↔ side fluid surface)
    // ──────────────────────────────────────────────────────────────
    //
    // The supervisor chat renders above the InputStrip in two shapes:
    //   - 'side' — pinned inside AppSideMenuInput, above the docked
    //              InputStrip (state B = activity-docked)
    //   - 'full' — fills the activity content area, above the bottom
    //              InputStrip bar (state C = activity-focal)
    // Same component, two slots; thread state lives in cart/app/chat/store.
    // The morph itself is a fade — geometry rides the InputStrip GOLDEN
    // morph; the chat panel renders into whichever slot is winning.
    AppChatPanel: { type: "Box", style: {
      width: "100%",
      flexGrow: 1,
      minHeight: 0,
      flexDirection: "column",
      backgroundColor: "theme:bg",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      overflow: "hidden"
    } },
    AppChatPanelHeader: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 36,
      paddingLeft: 12,
      paddingRight: 8,
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      gap: 8,
      backgroundColor: "theme:bg1",
      flexShrink: 0
    } },
    AppChatPanelHeaderLeft: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10
    } },
    AppChatPanelHeaderDot: { type: "Box", style: {
      width: 8,
      height: 8,
      borderRadius: "theme:radiusPill",
      backgroundColor: "theme:accent"
    } },
    AppChatPanelHeaderTitle: {
      type: "Text",
      size: 11,
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", letterSpacing: 3, lineHeight: 13, whiteSpace: "pre" }
    },
    AppChatPanelHeaderState: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 18,
      paddingLeft: 6,
      paddingRight: 6,
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    AppChatPanelHeaderStateText: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatPanelHeaderToggle: { type: "Pressable", style: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    AppChatPanelHeaderToggleText: {
      type: "Text",
      size: 12,
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 14, whiteSpace: "pre" }
    },
    AppChatPanelSubline: { type: "Box", style: {
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderColor: "theme:rule",
      flexShrink: 0
    } },
    AppChatPanelSublineText: {
      type: "Text",
      size: 9,
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatTranscript: { type: "Box", style: {
      flexGrow: 1,
      minHeight: 0,
      flexDirection: "column",
      paddingLeft: 14,
      paddingRight: 14,
      paddingTop: 14,
      paddingBottom: 14,
      gap: 14,
      overflow: "scroll"
    } },
    AppChatTurn: { type: "Box", style: {
      flexDirection: "column",
      gap: 6
    } },
    AppChatTurnMetaRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    } },
    AppChatTurnAuthor: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 16,
      paddingLeft: 4,
      paddingRight: 4,
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg2"
    } },
    AppChatTurnAuthorText: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatTurnTime: {
      type: "Text",
      size: 9,
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", letterSpacing: 1, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatTurnTag: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 16,
      paddingLeft: 4,
      paddingRight: 4,
      borderWidth: 1,
      borderColor: "theme:accent",
      backgroundColor: "theme:bg"
    } },
    AppChatTurnTagText: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatTurnLift: {
      type: "Text",
      size: 9,
      color: "theme:inkDimmer",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatTurnBody: {
      type: "Text",
      size: 13,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 18 }
    },
    AppChatYouTurn: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 6,
      borderLeftWidth: 2,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg1"
    } },
    AppChatYouTurnCaret: {
      type: "Text",
      size: 13,
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", lineHeight: 18, whiteSpace: "pre" }
    },
    AppChatYouTurnText: {
      type: "Text",
      size: 13,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 18 }
    },
    // Embedded surface card (audit / fleet / etc.). Border is the
    // continuous-flow dash from Animation principles → Card / box borders
    // → Continuous marching flow ("this card is alive").
    AppChatSurfaceCard: { type: "Box", style: {
      flexDirection: "column",
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
      gap: 10,
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:accentHot",
      borderDash: [44, 108],
      borderDashWidth: 1,
      borderFlowSpeed: 18
    } },
    AppChatSurfaceHeader: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    } },
    AppChatSurfaceTitle: {
      type: "Text",
      size: 14,
      bold: true,
      color: "theme:ink",
      style: { fontFamily: "theme:fontSans", lineHeight: 18 }
    },
    AppChatSurfaceTag: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      height: 16,
      paddingLeft: 4,
      paddingRight: 4,
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg"
    } },
    AppChatSurfaceTagText: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:accentHot",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatSurfaceCommand: { type: "Box", style: {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 6,
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg"
    } },
    AppChatSurfaceCommandText: {
      type: "Text",
      size: 12,
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", lineHeight: 16, whiteSpace: "pre" }
    },
    AppChatSurfaceBody: {
      type: "Text",
      size: 12,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontSans", lineHeight: 16 }
    },
    AppChatSurfaceActions: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    } },
    AppChatSurfaceAction: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 24,
      paddingLeft: 10,
      paddingRight: 10,
      borderWidth: 1,
      borderColor: "theme:rule",
      backgroundColor: "theme:bg"
    } },
    AppChatSurfaceActionPrimary: { type: "Pressable", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 24,
      paddingLeft: 10,
      paddingRight: 10,
      borderWidth: 1,
      borderColor: "theme:accentHot",
      backgroundColor: "theme:bg2"
    } },
    AppChatSurfaceActionText: {
      type: "Text",
      size: 11,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", letterSpacing: 1, lineHeight: 13, whiteSpace: "pre" }
    },
    // Fleet status pills — IDLE / TOOL / STUCK / RAT. One pill body per
    // state so the border / text colors stay token-driven and never drift
    // into hex. Add new states by adding a sibling classifier; never
    // inline a color here.
    AppChatStatusPill: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 18,
      paddingLeft: 6,
      paddingRight: 6,
      borderWidth: 1,
      borderColor: "theme:ok",
      backgroundColor: "theme:bg"
    } },
    AppChatStatusPillTool: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 18,
      paddingLeft: 6,
      paddingRight: 6,
      borderWidth: 1,
      borderColor: "theme:accent",
      backgroundColor: "theme:bg"
    } },
    AppChatStatusPillStuck: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 18,
      paddingLeft: 6,
      paddingRight: 6,
      borderWidth: 1,
      borderColor: "theme:warn",
      backgroundColor: "theme:bg"
    } },
    AppChatStatusPillRat: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 18,
      paddingLeft: 6,
      paddingRight: 6,
      borderWidth: 1,
      borderColor: "theme:flag",
      backgroundColor: "theme:bg"
    } },
    AppChatStatusPillText: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:ok",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatStatusPillTextTool: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:accent",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatStatusPillTextStuck: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:warn",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatStatusPillTextRat: {
      type: "Text",
      size: 9,
      bold: true,
      color: "theme:flag",
      style: { fontFamily: "theme:fontMono", letterSpacing: 2, lineHeight: 11, whiteSpace: "pre" }
    },
    AppChatFleetGrid: { type: "Box", style: {
      flexDirection: "column",
      gap: 8
    } },
    AppChatFleetRow: { type: "Box", style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap"
    } },
    AppChatFleetCell: { type: "Box", style: {
      flexDirection: "column",
      gap: 4,
      minWidth: 84
    } },
    AppChatFleetCellName: {
      type: "Text",
      size: 12,
      color: "theme:ink",
      style: { fontFamily: "theme:fontMono", lineHeight: 14, whiteSpace: "pre" }
    },
    AppChatFleetNote: {
      type: "Text",
      size: 12,
      color: "theme:inkDim",
      style: { fontFamily: "theme:fontSans", lineHeight: 16 }
    }
  });

  // cart/app/gallery/components/intent-surface/IntentSurface.tsx
  init_primitives();

  // cart/app/gallery/components/intent-surface/IntentTitle.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentTitle({ children }) {
    const Title = classifiers.Title || Text;
    return /* @__PURE__ */ __jsx(Title, null, children);
  }

  // cart/app/gallery/components/intent-surface/IntentText.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentText({ children }) {
    const Body2 = classifiers.Body || Text;
    return /* @__PURE__ */ __jsx(Body2, null, children);
  }

  // cart/app/gallery/components/intent-surface/IntentCard.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentCard({ children }) {
    const Card = classifiers.Card || Col;
    return /* @__PURE__ */ __jsx(Card, null, children);
  }

  // cart/app/gallery/components/intent-surface/IntentRow.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentRow({ children }) {
    const Inline = classifiers.InlineX4Center || Row;
    return /* @__PURE__ */ __jsx(Inline, { style: { flexWrap: "wrap" } }, children);
  }

  // cart/app/gallery/components/intent-surface/IntentCol.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentCol({ children }) {
    const Stack = classifiers.StackX4 || Col;
    return /* @__PURE__ */ __jsx(Stack, null, children);
  }

  // cart/app/gallery/components/intent-surface/IntentList.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentList({ items }) {
    const Stack = classifiers.StackX2 || Col;
    const Item = classifiers.Body || Text;
    return /* @__PURE__ */ __jsx(Stack, null, items.map((it, i) => /* @__PURE__ */ __jsx(Item, { key: i }, `\u2022 ${it}`)));
  }

  // cart/app/gallery/components/intent-surface/IntentBtn.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentBtn({ reply, label, onAction }) {
    const Button = classifiers.Button || Pressable;
    const Label = classifiers.ButtonLabel || Text;
    return /* @__PURE__ */ __jsx(Button, { onPress: () => onAction(reply), style: { alignSelf: "flex-start" } }, /* @__PURE__ */ __jsx(Label, null, label ?? reply));
  }

  // cart/app/gallery/components/intent-surface/IntentForm.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react2 = __toESM(require_react());
  init_primitives();
  var FormContext = (0, import_react2.createContext)(null);
  function IntentForm({ children, onAction }) {
    const [, setTick] = (0, import_react2.useState)(0);
    const valuesRef = (0, import_react2.useRef)({});
    const ctx = {
      valuesRef,
      set: (name, value) => {
        valuesRef.current[name] = value;
        setTick((n) => n + 1);
      }
    };
    ctx.onAction = onAction;
    const FormFrame = classifiers.Card || Col;
    return /* @__PURE__ */ __jsx(FormContext.Provider, { value: ctx }, /* @__PURE__ */ __jsx(FormFrame, null, children));
  }
  function IntentField({
    name,
    label,
    placeholder,
    initial
  }) {
    const ctx = (0, import_react2.useContext)(FormContext);
    const [value, setValue] = (0, import_react2.useState)(initial ?? "");
    const seeded = (0, import_react2.useRef)(false);
    if (ctx && !seeded.current && initial) {
      ctx.valuesRef.current[name] = initial;
      seeded.current = true;
    }
    if (!ctx) {
      const ErrorText = classifiers.Error || Text;
      return /* @__PURE__ */ __jsx(ErrorText, null, "[Field outside Form]");
    }
    const Field = classifiers.StackX2 || Col;
    const Label = classifiers.Label || Text;
    const Input = classifiers.AppFormInput || TextInput;
    return /* @__PURE__ */ __jsx(Field, null, label ? /* @__PURE__ */ __jsx(Label, null, label) : null, /* @__PURE__ */ __jsx(
      Input,
      {
        value,
        placeholder: placeholder ?? "",
        onChangeText: (text) => {
          setValue(text);
          ctx.set(name, text);
        }
      }
    ));
  }
  function IntentSubmit({
    replyTemplate,
    label
  }) {
    const ctx = (0, import_react2.useContext)(FormContext);
    if (!ctx) {
      const ErrorText = classifiers.Error || Text;
      return /* @__PURE__ */ __jsx(ErrorText, null, "[Submit outside Form]");
    }
    const onAction = ctx.onAction;
    const press = () => {
      const values = ctx.valuesRef.current;
      const reply = replyTemplate ? interpolate(replyTemplate, values) : defaultReply(values);
      onAction(reply);
    };
    const Button = classifiers.Button || Pressable;
    const Label = classifiers.ButtonLabel || Text;
    return /* @__PURE__ */ __jsx(Button, { onPress: press, style: { alignSelf: "flex-start" } }, /* @__PURE__ */ __jsx(Label, null, label ?? "Submit"));
  }
  function interpolate(tpl, values) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
  }
  function defaultReply(values) {
    const pairs = Object.entries(values).map(([k, v]) => `${k}=${v}`).join("; ");
    return `FORM_SUBMITTED: ${pairs}`;
  }

  // cart/app/gallery/components/intent-surface/IntentBadge.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/components/controls-specimen/StatusBadge.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();

  // cart/app/gallery/components/controls-specimen/controlsSpecimenParts.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();

  // cart/app/gallery/components/controls-specimen/ControlsSpecimenShell.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/components/controls-specimen/controlsSpecimenTheme.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/gallery-theme.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_theme();

  // cart/app/gallery/theme-system.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  function defineThemeTokenCategory(category) {
    return category;
  }
  function defineThemeClassifierFile(file) {
    return file;
  }
  function defineThemeVariant(theme) {
    return theme;
  }
  function defineThemeSystem(definition) {
    return definition;
  }
  function mergeThemeTokenCategories(globalTokens, localTokens) {
    const categories = [];
    const categoryIndex = /* @__PURE__ */ new Map();
    const ensureCategory = (id, title) => {
      const existingIndex = categoryIndex.get(id);
      if (existingIndex != null) return categories[existingIndex];
      const nextCategory = {
        id,
        title,
        tokens: []
      };
      categoryIndex.set(id, categories.length);
      categories.push(nextCategory);
      return nextCategory;
    };
    for (const category of globalTokens) {
      const resolved = ensureCategory(category.id, category.title);
      for (const [name, value] of Object.entries(category.tokens || {})) {
        resolved.tokens.push({
          name,
          value,
          scope: "global"
        });
      }
    }
    for (const category of localTokens) {
      const resolved = ensureCategory(category.id, category.title);
      const tokenIndex = /* @__PURE__ */ new Map();
      resolved.tokens.forEach((token, index) => {
        tokenIndex.set(token.name, index);
      });
      for (const [name, value] of Object.entries(category.tokens || {})) {
        const existingIndex = tokenIndex.get(name);
        if (existingIndex == null) {
          tokenIndex.set(name, resolved.tokens.length);
          resolved.tokens.push({
            name,
            value,
            scope: "local"
          });
          continue;
        }
        resolved.tokens[existingIndex] = {
          name,
          value,
          scope: "local"
        };
      }
    }
    return categories;
  }

  // cart/app/gallery/themes/index.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/themes/cockpit/CockpitThemeSystem.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/themes/shared/global-theme-tokens.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var sharedGlobalThemeTokens = [
    defineThemeTokenCategory({
      id: "type",
      title: "Type Sizes",
      tokens: {
        micro: 7,
        tiny: 8,
        caption: 9,
        body: 10,
        base: 11,
        meta: 12,
        strong: 14,
        heading: 18
      }
    }),
    defineThemeTokenCategory({
      id: "radius",
      title: "Corner Radius",
      tokens: {
        sm: 4,
        md: 6,
        lg: 8,
        xl: 10,
        pill: 99,
        round: 999
      }
    })
  ];

  // cart/app/gallery/themes/cockpit/theme-classifier.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var cockpitThemeClassifier = defineThemeClassifierFile({
    kind: "theme",
    label: "Cockpit Theme Classifier",
    source: "cart/component-gallery/themes/cockpit/theme-classifier.ts"
  });
  var cockpitDefaultTheme = defineThemeVariant({
    id: "default",
    title: "Cockpit",
    summary: "Warm paper-black ATC aesthetic. Sweatshop cockpit base palette.",
    tokens: [
      defineThemeTokenCategory({
        id: "surfaces",
        title: "Surfaces",
        tokens: {
          bg: "#0e0b09",
          bg1: "#14100d",
          bg2: "#1a1511"
        }
      }),
      defineThemeTokenCategory({
        id: "paper",
        title: "Paper (Content Surface)",
        tokens: {
          paper: "#e8dcc4",
          // primary warm paper — content background
          paperAlt: "#eadfca",
          // softer cream — secondary content tier
          paperInk: "#2a1f14",
          // dark warm ink on paper
          paperInkDim: "#7a6e5d",
          // dimmer ink on paper (matches inkDimmer)
          paperRule: "#3a2a1e",
          // border on paper (matches rule)
          paperRuleBright: "#8a4a20"
          // accent border on paper (matches ruleBright)
        }
      }),
      defineThemeTokenCategory({
        id: "ink",
        title: "Ink (Text)",
        tokens: {
          ink: "#f2e8dc",
          inkDim: "#b8a890",
          inkDimmer: "#7a6e5d",
          inkGhost: "#4a4238"
        }
      }),
      defineThemeTokenCategory({
        id: "rules",
        title: "Rules (Borders)",
        tokens: {
          rule: "#3a2a1e",
          ruleBright: "#8a4a20"
        }
      }),
      defineThemeTokenCategory({
        id: "accent",
        title: "Accent",
        tokens: {
          accent: "#d26a2a",
          accentHot: "#e8501c"
        }
      }),
      defineThemeTokenCategory({
        id: "state",
        title: "State Signals",
        tokens: {
          ok: "#6aa390",
          warn: "#d6a54a",
          flag: "#e14a2a"
        }
      }),
      defineThemeTokenCategory({
        id: "auxiliary",
        title: "Auxiliary",
        tokens: {
          lilac: "#8a7fd4",
          blue: "#5a8bd6"
        }
      }),
      defineThemeTokenCategory({
        id: "categories",
        title: "Category Tones (Data Channels)",
        tokens: {
          sys: "#5a8bd6",
          ctx: "#8a7fd4",
          usr: "#6aa390",
          ast: "#d26a2a",
          atch: "#d48aa7",
          tool: "#6ac3d6",
          wnd: "#e14a2a",
          pin: "#8aca6a"
        }
      }),
      defineThemeTokenCategory({
        id: "decorative",
        title: "Decorative",
        tokens: {
          transparent: "transparent",
          gridDot: "rgba(138, 74, 32, 0.08)",
          gridDotStrong: "rgba(138, 74, 32, 0.18)"
        }
      }),
      defineThemeTokenCategory({
        id: "typography",
        title: "Typography",
        tokens: {
          fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
          fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
          lineHeight: 1.35
        }
      }),
      defineThemeTokenCategory({
        id: "type",
        title: "Type Sizes",
        tokens: {
          micro: 7,
          tiny: 8,
          caption: 9,
          body: 10,
          base: 11,
          meta: 12,
          strong: 14,
          heading: 18
        }
      }),
      defineThemeTokenCategory({
        id: "radius",
        title: "Corner Radius",
        tokens: {
          sm: 4,
          md: 6,
          lg: 8,
          xl: 10,
          pill: 99,
          round: 999
        }
      }),
      defineThemeTokenCategory({
        id: "letterSpacing",
        title: "Letter Spacing",
        tokens: {
          tight: "0.05em",
          normal: "0.08em",
          wide: "0.1em",
          wider: "0.12em",
          widest: "0.15em",
          ultra: "0.2em",
          brand: "0.24em"
        }
      }),
      defineThemeTokenCategory({
        id: "spacing",
        title: "Spacing Rhythm",
        tokens: {
          x0: 1,
          x1: 2,
          x2: 4,
          x3: 6,
          x4: 8,
          x5: 10,
          x6: 12,
          x7: 16,
          x8: 18
        }
      }),
      defineThemeTokenCategory({
        id: "chrome",
        title: "Chrome Heights",
        tokens: {
          topbar: 28,
          statusbar: 22,
          tileHead: 20,
          strip: 28
        }
      })
    ]
  });
  var cockpitSignalTheme = defineThemeVariant({
    id: "signal",
    title: "Signal Room",
    summary: "Cold green-black operations palette with amber control accents. Same token vocabulary, different values.",
    tokens: [
      defineThemeTokenCategory({
        id: "surfaces",
        title: "Surfaces",
        tokens: {
          bg: "#06110f",
          bg1: "#0b1b17",
          bg2: "#10271f"
        }
      }),
      defineThemeTokenCategory({
        id: "paper",
        title: "Paper (Content Surface)",
        tokens: {
          paper: "#d8f0df",
          paperAlt: "#cce7d6",
          paperInk: "#10231b",
          paperInkDim: "#51695b",
          paperRule: "#24483d",
          paperRuleBright: "#2f8f73"
        }
      }),
      defineThemeTokenCategory({
        id: "ink",
        title: "Ink (Text)",
        tokens: {
          ink: "#eafff2",
          inkDim: "#9fc8b4",
          inkDimmer: "#60786b",
          inkGhost: "#34493f"
        }
      }),
      defineThemeTokenCategory({
        id: "rules",
        title: "Rules (Borders)",
        tokens: {
          rule: "#24483d",
          ruleBright: "#2f8f73"
        }
      }),
      defineThemeTokenCategory({
        id: "accent",
        title: "Accent",
        tokens: {
          accent: "#e0a84f",
          accentHot: "#ff6b2f"
        }
      }),
      defineThemeTokenCategory({
        id: "state",
        title: "State Signals",
        tokens: {
          ok: "#4ed08f",
          warn: "#f1c257",
          flag: "#ff5f4c"
        }
      }),
      defineThemeTokenCategory({
        id: "auxiliary",
        title: "Auxiliary",
        tokens: {
          lilac: "#8ea4ff",
          blue: "#4aa7d8"
        }
      }),
      defineThemeTokenCategory({
        id: "categories",
        title: "Category Tones (Data Channels)",
        tokens: {
          sys: "#4aa7d8",
          ctx: "#8ea4ff",
          usr: "#4ed08f",
          ast: "#e0a84f",
          atch: "#e284a4",
          tool: "#59d3c7",
          wnd: "#ff5f4c",
          pin: "#9dd45a"
        }
      }),
      defineThemeTokenCategory({
        id: "decorative",
        title: "Decorative",
        tokens: {
          transparent: "transparent",
          gridDot: "rgba(47, 143, 115, 0.10)",
          gridDotStrong: "rgba(47, 143, 115, 0.22)"
        }
      }),
      defineThemeTokenCategory({
        id: "typography",
        title: "Typography",
        tokens: {
          fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
          fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
          lineHeight: 1.32
        }
      }),
      defineThemeTokenCategory({
        id: "type",
        title: "Type Sizes",
        tokens: {
          micro: 7,
          tiny: 8,
          caption: 9,
          body: 10,
          base: 11,
          meta: 12,
          strong: 14,
          heading: 18
        }
      }),
      defineThemeTokenCategory({
        id: "radius",
        title: "Corner Radius",
        tokens: {
          sm: 2,
          md: 3,
          lg: 4,
          xl: 6,
          pill: 99,
          round: 999
        }
      }),
      defineThemeTokenCategory({
        id: "letterSpacing",
        title: "Letter Spacing",
        tokens: {
          tight: "0.04em",
          normal: "0.07em",
          wide: "0.1em",
          wider: "0.13em",
          widest: "0.16em",
          ultra: "0.22em",
          brand: "0.26em"
        }
      }),
      defineThemeTokenCategory({
        id: "spacing",
        title: "Spacing Rhythm",
        tokens: {
          x0: 1,
          x1: 2,
          x2: 3,
          x3: 5,
          x4: 7,
          x5: 9,
          x6: 11,
          x7: 14,
          x8: 16
        }
      }),
      defineThemeTokenCategory({
        id: "chrome",
        title: "Chrome Heights",
        tokens: {
          topbar: 26,
          statusbar: 20,
          tileHead: 18,
          strip: 26
        }
      })
    ]
  });
  var cockpitBasicLightTheme = defineThemeVariant({
    id: "light",
    title: "Basic Light",
    summary: "Neutral light mode using the existing cockpit token vocabulary. Airier spacing, larger type, and softer radii.",
    tokens: [
      defineThemeTokenCategory({
        id: "surfaces",
        title: "Surfaces",
        tokens: {
          bg: "#f6f3eb",
          bg1: "#ffffff",
          bg2: "#ebe6da"
        }
      }),
      defineThemeTokenCategory({
        id: "paper",
        title: "Paper (Content Surface)",
        tokens: {
          paper: "#ffffff",
          paperAlt: "#f3efe6",
          paperInk: "#1f2328",
          paperInkDim: "#667085",
          paperRule: "#d0d7de",
          paperRuleBright: "#7a91b5"
        }
      }),
      defineThemeTokenCategory({
        id: "ink",
        title: "Ink (Text)",
        tokens: {
          ink: "#1f2328",
          inkDim: "#57606a",
          inkDimmer: "#8c959f",
          inkGhost: "#c9d1d9"
        }
      }),
      defineThemeTokenCategory({
        id: "rules",
        title: "Rules (Borders)",
        tokens: {
          rule: "#d0d7de",
          ruleBright: "#7a91b5"
        }
      }),
      defineThemeTokenCategory({
        id: "accent",
        title: "Accent",
        tokens: {
          accent: "#2563eb",
          accentHot: "#0f4fd1"
        }
      }),
      defineThemeTokenCategory({
        id: "state",
        title: "State Signals",
        tokens: {
          ok: "#16845b",
          warn: "#b7791f",
          flag: "#d1242f"
        }
      }),
      defineThemeTokenCategory({
        id: "auxiliary",
        title: "Auxiliary",
        tokens: {
          lilac: "#7c3aed",
          blue: "#2563eb"
        }
      }),
      defineThemeTokenCategory({
        id: "categories",
        title: "Category Tones (Data Channels)",
        tokens: {
          sys: "#2563eb",
          ctx: "#7c3aed",
          usr: "#16845b",
          ast: "#b65f00",
          atch: "#c24175",
          tool: "#0891b2",
          wnd: "#d1242f",
          pin: "#4d7c0f"
        }
      }),
      defineThemeTokenCategory({
        id: "decorative",
        title: "Decorative",
        tokens: {
          transparent: "transparent",
          gridDot: "rgba(37, 99, 235, 0.08)",
          gridDotStrong: "rgba(37, 99, 235, 0.18)"
        }
      }),
      defineThemeTokenCategory({
        id: "typography",
        title: "Typography",
        tokens: {
          fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
          fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
          lineHeight: 1.42
        }
      }),
      defineThemeTokenCategory({
        id: "type",
        title: "Type Sizes",
        tokens: {
          micro: 8,
          tiny: 9,
          caption: 10,
          body: 12,
          base: 13,
          meta: 12,
          strong: 16,
          heading: 24
        }
      }),
      defineThemeTokenCategory({
        id: "radius",
        title: "Corner Radius",
        tokens: {
          sm: 8,
          md: 12,
          lg: 18,
          xl: 24,
          pill: 99,
          round: 999
        }
      }),
      defineThemeTokenCategory({
        id: "letterSpacing",
        title: "Letter Spacing",
        tokens: {
          tight: "0.01em",
          normal: "0.02em",
          wide: "0.04em",
          wider: "0.06em",
          widest: "0.08em",
          ultra: "0.1em",
          brand: "0.12em"
        }
      }),
      defineThemeTokenCategory({
        id: "spacing",
        title: "Spacing Rhythm",
        tokens: {
          x0: 2,
          x1: 4,
          x2: 6,
          x3: 8,
          x4: 12,
          x5: 16,
          x6: 20,
          x7: 24,
          x8: 32
        }
      }),
      defineThemeTokenCategory({
        id: "chrome",
        title: "Chrome Heights",
        tokens: {
          topbar: 40,
          statusbar: 28,
          tileHead: 30,
          strip: 34
        }
      })
    ]
  });
  var cockpitDarkModeTheme = defineThemeVariant({
    id: "dark",
    title: "Dark Mode",
    summary: "Neutral dark mode using the same token vocabulary. Compact spacing, sharper corners, and high contrast control surfaces.",
    tokens: [
      defineThemeTokenCategory({
        id: "surfaces",
        title: "Surfaces",
        tokens: {
          bg: "#07090d",
          bg1: "#0e131b",
          bg2: "#151c27"
        }
      }),
      defineThemeTokenCategory({
        id: "paper",
        title: "Paper (Content Surface)",
        tokens: {
          paper: "#101820",
          paperAlt: "#172330",
          paperInk: "#ecf3ff",
          paperInkDim: "#9aa7ba",
          paperRule: "#2a3848",
          paperRuleBright: "#5ba7ff"
        }
      }),
      defineThemeTokenCategory({
        id: "ink",
        title: "Ink (Text)",
        tokens: {
          ink: "#ecf3ff",
          inkDim: "#a8b3c7",
          inkDimmer: "#657185",
          inkGhost: "#2d3748"
        }
      }),
      defineThemeTokenCategory({
        id: "rules",
        title: "Rules (Borders)",
        tokens: {
          rule: "#263241",
          ruleBright: "#5ba7ff"
        }
      }),
      defineThemeTokenCategory({
        id: "accent",
        title: "Accent",
        tokens: {
          accent: "#6bb7ff",
          accentHot: "#36d7ff"
        }
      }),
      defineThemeTokenCategory({
        id: "state",
        title: "State Signals",
        tokens: {
          ok: "#42d392",
          warn: "#f2c94c",
          flag: "#ff5c7a"
        }
      }),
      defineThemeTokenCategory({
        id: "auxiliary",
        title: "Auxiliary",
        tokens: {
          lilac: "#a78bfa",
          blue: "#5ba7ff"
        }
      }),
      defineThemeTokenCategory({
        id: "categories",
        title: "Category Tones (Data Channels)",
        tokens: {
          sys: "#5ba7ff",
          ctx: "#a78bfa",
          usr: "#42d392",
          ast: "#ffb86b",
          atch: "#ff7ab6",
          tool: "#36d7ff",
          wnd: "#ff5c7a",
          pin: "#a3e635"
        }
      }),
      defineThemeTokenCategory({
        id: "decorative",
        title: "Decorative",
        tokens: {
          transparent: "transparent",
          gridDot: "rgba(91, 167, 255, 0.10)",
          gridDotStrong: "rgba(91, 167, 255, 0.24)"
        }
      }),
      defineThemeTokenCategory({
        id: "typography",
        title: "Typography",
        tokens: {
          fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
          fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
          lineHeight: 1.32
        }
      }),
      defineThemeTokenCategory({
        id: "type",
        title: "Type Sizes",
        tokens: {
          micro: 7,
          tiny: 8,
          caption: 9,
          body: 11,
          base: 12,
          meta: 12,
          strong: 15,
          heading: 22
        }
      }),
      defineThemeTokenCategory({
        id: "radius",
        title: "Corner Radius",
        tokens: {
          sm: 2,
          md: 4,
          lg: 6,
          xl: 8,
          pill: 99,
          round: 999
        }
      }),
      defineThemeTokenCategory({
        id: "letterSpacing",
        title: "Letter Spacing",
        tokens: {
          tight: "0.04em",
          normal: "0.07em",
          wide: "0.1em",
          wider: "0.12em",
          widest: "0.16em",
          ultra: "0.2em",
          brand: "0.24em"
        }
      }),
      defineThemeTokenCategory({
        id: "spacing",
        title: "Spacing Rhythm",
        tokens: {
          x0: 1,
          x1: 2,
          x2: 4,
          x3: 6,
          x4: 8,
          x5: 10,
          x6: 12,
          x7: 14,
          x8: 18
        }
      }),
      defineThemeTokenCategory({
        id: "chrome",
        title: "Chrome Heights",
        tokens: {
          topbar: 30,
          statusbar: 22,
          tileHead: 20,
          strip: 26
        }
      })
    ]
  });

  // cart/app/gallery/themes/cockpit/style-classifier.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var cockpitStyleClassifier = defineThemeClassifierFile({
    kind: "style",
    label: "Cockpit Style Classifier",
    source: "cart/component-gallery/themes/cockpit/style-classifier.ts"
  });

  // cart/app/gallery/themes/cockpit/variant-classifier.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var cockpitVariantClassifier = defineThemeClassifierFile({
    kind: "variant",
    label: "Cockpit Variant Classifier",
    source: "cart/component-gallery/themes/cockpit/variant-classifier.ts"
  });

  // cart/app/gallery/themes/cockpit/breakpoint-classifier.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var cockpitBreakpointClassifier = defineThemeClassifierFile({
    kind: "breakpoint",
    label: "Cockpit Breakpoint Classifier",
    source: "cart/component-gallery/themes/cockpit/breakpoint-classifier.ts"
  });

  // cart/app/gallery/themes/cockpit/CockpitThemeSystem.ts
  var cockpitThemeSystem = defineThemeSystem({
    classifiers: [
      cockpitThemeClassifier,
      cockpitStyleClassifier,
      cockpitVariantClassifier,
      cockpitBreakpointClassifier
    ],
    globalTokens: sharedGlobalThemeTokens,
    themes: [cockpitDefaultTheme, cockpitSignalTheme, cockpitBasicLightTheme, cockpitDarkModeTheme]
  });

  // cart/app/gallery/themes/index.ts
  var galleryThemeSystems = [
    {
      id: "cockpit",
      title: "Cockpit",
      source: "cart/component-gallery/themes/cockpit/CockpitThemeSystem.ts",
      system: cockpitThemeSystem
    }
    // component-gallery:theme-systems
  ];

  // cart/app/gallery/surface.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var DEFAULT_PAGE_SURFACE = {
    id: "page",
    label: "Page Surface",
    width: 960,
    minHeight: 640,
    padding: 32,
    backgroundColor: "theme:paper",
    borderColor: "theme:paperRuleBright",
    textColor: "theme:paperInk",
    mutedTextColor: "theme:paperInkDim",
    radius: 8
  };
  var DEFAULT_COLORS = {
    appBg: "theme:bg",
    railBg: "theme:bg1",
    panelBg: "theme:bg2",
    panelRaised: "theme:rule",
    border: "theme:rule",
    borderStrong: "theme:ruleBright",
    text: "theme:ink",
    muted: "theme:inkDim",
    faint: "theme:inkDimmer",
    accent: "theme:accent",
    accentInk: "theme:bg",
    success: "theme:ok",
    warning: "theme:warn",
    compose: "theme:lilac",
    previewBg: "theme:paper"
  };
  var PAGE_SURFACE = { ...DEFAULT_PAGE_SURFACE };
  var COLORS = { ...DEFAULT_COLORS };
  function stringToken(tokens, path, fallback) {
    const value = tokens?.[path];
    return typeof value === "string" ? value : fallback;
  }
  function numberToken(tokens, path, fallback) {
    const value = tokens?.[path];
    return typeof value === "number" ? value : fallback;
  }
  function applyGallerySurfaceTheme(tokens) {
    const bg = stringToken(tokens, "surfaces.bg", DEFAULT_COLORS.appBg);
    const bg1 = stringToken(tokens, "surfaces.bg1", DEFAULT_COLORS.railBg);
    const bg2 = stringToken(tokens, "surfaces.bg2", DEFAULT_COLORS.panelBg);
    const rule = stringToken(tokens, "rules.rule", DEFAULT_COLORS.border);
    const ruleBright = stringToken(tokens, "rules.ruleBright", DEFAULT_COLORS.borderStrong);
    const ink = stringToken(tokens, "ink.ink", DEFAULT_COLORS.text);
    const inkDim = stringToken(tokens, "ink.inkDim", DEFAULT_COLORS.muted);
    const inkDimmer = stringToken(tokens, "ink.inkDimmer", DEFAULT_COLORS.faint);
    const paper = stringToken(tokens, "paper.paper", DEFAULT_PAGE_SURFACE.backgroundColor);
    const paperInk = stringToken(tokens, "paper.paperInk", DEFAULT_PAGE_SURFACE.textColor);
    const paperInkDim = stringToken(tokens, "paper.paperInkDim", DEFAULT_PAGE_SURFACE.mutedTextColor);
    const paperRuleBright = stringToken(tokens, "paper.paperRuleBright", DEFAULT_PAGE_SURFACE.borderColor);
    Object.assign(PAGE_SURFACE, {
      backgroundColor: paper,
      borderColor: paperRuleBright,
      textColor: paperInk,
      mutedTextColor: paperInkDim,
      radius: numberToken(tokens, "radius.lg", DEFAULT_PAGE_SURFACE.radius)
    });
    Object.assign(COLORS, {
      appBg: bg,
      railBg: bg1,
      panelBg: bg2,
      panelRaised: rule,
      border: rule,
      borderStrong: ruleBright,
      text: ink,
      muted: inkDim,
      faint: inkDimmer,
      accent: stringToken(tokens, "accent.accent", DEFAULT_COLORS.accent),
      accentInk: bg,
      success: stringToken(tokens, "state.ok", DEFAULT_COLORS.success),
      warning: stringToken(tokens, "state.warn", DEFAULT_COLORS.warning),
      compose: stringToken(tokens, "auxiliary.lilac", DEFAULT_COLORS.compose),
      previewBg: paper
    });
  }

  // cart/app/gallery/gallery-theme.ts
  var TOKEN_PREFIX_BY_CATEGORY = {
    radius: "radius",
    spacing: "space",
    type: "type",
    chrome: "chrome",
    letterSpacing: "ls"
  };
  function logGalleryTheme(message, payload) {
    console.log("[gallery-theme]", message, payload || {});
  }
  function applyPrefix(categoryId, tokenName) {
    const prefix = TOKEN_PREFIX_BY_CATEGORY[categoryId];
    if (!prefix) return tokenName;
    return prefix + tokenName.charAt(0).toUpperCase() + tokenName.slice(1);
  }
  function pushGalleryThemeToRuntime(option) {
    if (!option) {
      applyGallerySurfaceTheme(null);
      setVariant(null);
      logGalleryTheme("push skipped: no active option");
      return;
    }
    const colors = {};
    const styles = {};
    for (const category of option.mergedCategories) {
      for (const token of category.tokens) {
        const key = applyPrefix(category.id, token.name);
        if (typeof token.value === "number") {
          styles[key] = token.value;
        } else {
          colors[key] = token.value;
        }
      }
    }
    const runtimeVariant = option.variantId === "default" ? null : option.variantId;
    applyGallerySurfaceTheme(option.tokensByPath);
    const resolvedColors = applyThemeTokenOverrides(colors);
    setTokens(resolvedColors);
    setStyleTokens(styles);
    setVariant(runtimeVariant);
    logGalleryTheme("pushed runtime theme", {
      id: option.id,
      label: option.label,
      runtimeVariant,
      colors: Object.keys(resolvedColors).length,
      styles: Object.keys(styles).length,
      sample: {
        bg: resolvedColors.bg,
        bg1: resolvedColors.bg1,
        bg2: resolvedColors.bg2,
        paper: resolvedColors.paper,
        paperInk: resolvedColors.paperInk,
        accent: resolvedColors.accent,
        accentHot: resolvedColors.accentHot
      }
    });
  }
  var STORE_KEY = ".-active-theme";
  var OVERRIDES_STORE_KEY = ".-theme-token-overrides";
  var listeners2 = /* @__PURE__ */ new Set();
  function readPersisted(key) {
    try {
      const host4 = globalThis;
      if (typeof host4.__store_get === "function") {
        const value = host4.__store_get(key);
        if (typeof value === "string") return value;
      }
    } catch (_error) {
    }
    return null;
  }
  function readPersistedJson(key, fallback) {
    const raw = readPersisted(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return fallback;
    }
  }
  var themeTokenOverrides = readPersistedJson(OVERRIDES_STORE_KEY, {});
  function applyThemeTokenOverrides(colors) {
    const next = { ...colors };
    for (const [key, value] of Object.entries(themeTokenOverrides)) {
      const clean = typeof value === "string" ? value.trim() : "";
      if (clean) next[key] = clean;
    }
    return next;
  }
  function buildGalleryThemeOptions() {
    const options = [];
    for (const registered of galleryThemeSystems) {
      const variants = registered.system.themes || [];
      const singleVariant = variants.length <= 1;
      for (const variant of variants) {
        const mergedCategories = mergeThemeTokenCategories(registered.system.globalTokens, variant.tokens);
        const tokensByPath = {};
        for (const category of mergedCategories) {
          for (const token of category.tokens) {
            tokensByPath[`${category.id}.${token.name}`] = token.value;
          }
        }
        options.push({
          id: `${registered.id}:${variant.id}`,
          label: singleVariant ? registered.title : `${registered.title} / ${variant.title}`,
          source: registered.source,
          systemId: registered.id,
          systemTitle: registered.title,
          variantId: variant.id,
          variantTitle: variant.title,
          mergedCategories,
          tokensByPath
        });
      }
    }
    return options;
  }
  var GALLERY_THEME_OPTIONS = buildGalleryThemeOptions();
  var GALLERY_THEME_OPTIONS_BY_ID = new Map(GALLERY_THEME_OPTIONS.map((option) => [option.id, option]));
  var DEFAULT_THEME_ID = GALLERY_THEME_OPTIONS[0]?.id || "";
  function restoreActiveThemeId() {
    const restored = readPersisted(STORE_KEY);
    if (restored && GALLERY_THEME_OPTIONS_BY_ID.has(restored)) return restored;
    return DEFAULT_THEME_ID;
  }
  var activeGalleryThemeId = restoreActiveThemeId();
  function getActiveGalleryTheme() {
    return GALLERY_THEME_OPTIONS_BY_ID.get(activeGalleryThemeId) || GALLERY_THEME_OPTIONS[0] || null;
  }
  function getActiveGalleryThemeValue(path) {
    return getActiveGalleryTheme()?.tokensByPath[path];
  }
  pushGalleryThemeToRuntime(getActiveGalleryTheme());
  function subscribeGalleryTheme(listener) {
    listeners2.add(listener);
    return () => {
      listeners2.delete(listener);
    };
  }

  // cart/app/gallery/components/controls-specimen/controlsSpecimenTheme.ts
  var DEFAULT_CTRL = {
    pageWidth: 860,
    pagePadding: 24,
    bg: "theme:bg",
    bg1: "theme:bg1",
    bg2: "theme:bg2",
    bg3: "theme:bg2",
    ink: "theme:ink",
    inkDim: "theme:inkDim",
    inkDimmer: "theme:inkDimmer",
    inkGhost: "theme:inkGhost",
    rule: "theme:rule",
    ruleBright: "theme:ruleBright",
    accent: "theme:accent",
    accentHot: "theme:accentHot",
    ok: "theme:ok",
    warn: "theme:warn",
    flag: "theme:flag",
    lilac: "theme:lilac",
    blue: "theme:blue",
    shadow: "theme:accent",
    softAccent: "theme:accent",
    softOk: "theme:ok",
    softFlag: "theme:flag",
    mono: "monospace",
    sans: "sans-serif",
    cardTallMinHeight: 184,
    cardMinHeight: 144,
    cardWide: 412,
    cardMedium: 274,
    cardNarrow: 205
  };
  var CTRL = { ...DEFAULT_CTRL };
  function firstString(paths, fallback) {
    for (const path of paths) {
      const value = getActiveGalleryThemeValue(path);
      if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return fallback;
  }
  function firstNumber(paths, fallback) {
    for (const path of paths) {
      const value = getActiveGalleryThemeValue(path);
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return fallback;
  }
  function syncControlTheme() {
    const accent = firstString(["accent.accent"], DEFAULT_CTRL.accent);
    const accentHot = firstString(["accent.accentHot", "accent.accent"], DEFAULT_CTRL.accentHot);
    const ok = firstString(["state.ok", "accent.success"], DEFAULT_CTRL.ok);
    const warn = firstString(["state.warn", "accent.warning"], DEFAULT_CTRL.warn);
    const flag = firstString(["state.flag", "accent.danger"], DEFAULT_CTRL.flag);
    const lilac = firstString(["auxiliary.lilac", "categories.ctx"], DEFAULT_CTRL.lilac);
    const blue = firstString(["auxiliary.blue", "categories.sys", "accent.accent"], DEFAULT_CTRL.blue);
    const ink = firstString(["ink.ink", "text.text"], DEFAULT_CTRL.ink);
    Object.assign(CTRL, {
      ...DEFAULT_CTRL,
      pagePadding: firstNumber(["spacing.x7", "layout.spaceLg"], DEFAULT_CTRL.pagePadding),
      bg: firstString(["surfaces.bg"], DEFAULT_CTRL.bg),
      bg1: firstString(["surfaces.bg1", "surfaces.surface", "surfaces.panel"], DEFAULT_CTRL.bg1),
      bg2: firstString(["surfaces.bg2", "surfaces.panel", "surfaces.surface"], DEFAULT_CTRL.bg2),
      bg3: firstString(["surfaces.bg3", "surfaces.panelAlt", "surfaces.panelActive"], DEFAULT_CTRL.bg3),
      ink,
      inkDim: firstString(["ink.inkDim", "text.textMuted"], DEFAULT_CTRL.inkDim),
      inkDimmer: firstString(["ink.inkDimmer", "text.textSubtle", "text.textMuted"], DEFAULT_CTRL.inkDimmer),
      inkGhost: firstString(["ink.inkGhost", "rules.rule", "text.textSubtle"], DEFAULT_CTRL.inkGhost),
      rule: firstString(["rules.rule", "surfaces.border"], DEFAULT_CTRL.rule),
      ruleBright: firstString(["rules.ruleBright", "accent.accentHot", "accent.accent"], DEFAULT_CTRL.ruleBright),
      accent,
      accentHot,
      ok,
      warn,
      flag,
      lilac,
      blue,
      shadow: firstString(["decorative.shadow"], DEFAULT_CTRL.shadow),
      softAccent: firstString(["decorative.softAccent"], accent),
      softOk: firstString(["decorative.softOk"], ok),
      softFlag: firstString(["decorative.softFlag"], flag),
      mono: firstString(["typography.fontMono"], DEFAULT_CTRL.mono),
      sans: firstString(["typography.fontSans"], DEFAULT_CTRL.sans)
    });
  }
  syncControlTheme();
  subscribeGalleryTheme(syncControlTheme);
  function toneColor(tone = "default") {
    switch (tone) {
      case "accent":
        return CTRL.accent;
      case "ok":
        return CTRL.ok;
      case "warn":
        return CTRL.warn;
      case "flag":
        return CTRL.flag;
      case "blue":
        return CTRL.blue;
      case "lilac":
        return CTRL.lilac;
      case "ink":
        return CTRL.ink;
      case "neutral":
        return CTRL.inkDim;
      default:
        return CTRL.ruleBright;
    }
  }
  function toneSoftBackground(tone = "default") {
    switch (tone) {
      case "accent":
        return CTRL.softAccent;
      case "ok":
        return CTRL.softOk;
      case "flag":
        return CTRL.softFlag;
      case "warn":
        return CTRL.warn;
      case "blue":
        return CTRL.blue;
      case "lilac":
        return CTRL.lilac;
      case "ink":
        return CTRL.inkGhost;
      default:
        return CTRL.bg2;
    }
  }

  // cart/app/gallery/components/controls-specimen/controlsSpecimenParts.tsx
  function Mono(props) {
    return /* @__PURE__ */ __jsx(
      Text,
      {
        noWrap: props.noWrap,
        numberOfLines: props.numberOfLines,
        style: {
          fontFamily: CTRL.mono,
          color: props.color ?? CTRL.inkDim,
          fontSize: props.fontSize ?? 8,
          fontWeight: props.fontWeight ?? "normal",
          letterSpacing: props.letterSpacing ?? 1.2,
          ...props.lineHeight != null ? { lineHeight: props.lineHeight } : {},
          ...props.style || {}
        }
      },
      props.children
    );
  }

  // cart/app/gallery/components/controls-specimen/StatusBadge.tsx
  function StatusBadge({
    label,
    tone = "accent",
    variant = "outline"
  }) {
    const color = toneColor(tone);
    const rounded = variant === "pill" || variant === "dot";
    const solid = variant === "solid";
    if (variant === "led" || variant === "dot") {
      return /* @__PURE__ */ __jsx(
        Row,
        {
          style: {
            gap: 8,
            alignItems: "center",
            paddingLeft: rounded ? 10 : 8,
            paddingRight: rounded ? 10 : 8,
            paddingTop: 5,
            paddingBottom: 5,
            borderWidth: 1,
            borderColor: color,
            borderRadius: rounded ? 6 : 0,
            backgroundColor: toneSoftBackground(tone)
          }
        },
        /* @__PURE__ */ __jsx(
          Box,
          {
            style: {
              width: variant === "dot" ? 6 : 8,
              height: variant === "dot" ? 6 : 8,
              borderRadius: variant === "dot" ? 3 : 4,
              backgroundColor: color
            }
          }
        ),
        /* @__PURE__ */ __jsx(Mono, { color, fontSize: 9, fontWeight: "bold", letterSpacing: 1.4, lineHeight: 10, noWrap: true }, label)
      );
    }
    return /* @__PURE__ */ __jsx(
      Box,
      {
        style: {
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 5,
          paddingBottom: 5,
          borderWidth: 1,
          borderColor: color,
          borderRadius: rounded ? 999 : 0,
          backgroundColor: solid ? color : toneSoftBackground(tone)
        }
      },
      /* @__PURE__ */ __jsx(Mono, { color: solid ? CTRL.bg : color, fontSize: 9, fontWeight: "bold", letterSpacing: 1.4, lineHeight: 10, noWrap: true }, label)
    );
  }

  // cart/app/gallery/components/intent-surface/IntentBadge.tsx
  var TONES = {
    neutral: "neutral",
    success: "ok",
    warning: "warn",
    error: "flag",
    info: "blue"
  };
  function IntentBadge({ tone = "neutral", children }) {
    return /* @__PURE__ */ __jsx(StatusBadge, { label: textContent(children), tone: TONES[tone] ?? TONES.neutral, variant: "pill" });
  }
  function textContent(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(textContent).join("");
    return String(value);
  }

  // cart/app/gallery/components/intent-surface/IntentCode.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/components/code-block/CodeBlock.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();

  // cart/app/gallery/components/code-copy-button/CodeCopyButton.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function copyToClipboard(value) {
    try {
      const host4 = globalThis;
      if (typeof host4.__clipboard_set === "function") host4.__clipboard_set(value);
    } catch (_error) {
    }
  }
  function CodeCopyButton({ row }) {
    const Button = classifiers.CodeBlockCopyButton || Pressable;
    const Label = classifiers.CodeBlockCopyText || Text;
    return /* @__PURE__ */ __jsx(Button, { onPress: () => copyToClipboard(row.code) }, /* @__PURE__ */ __jsx(Label, null, "Copy"));
  }

  // cart/app/gallery/components/code-line-number/CodeLineNumber.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function CodeLineNumber({ row }) {
    const LineNumber = classifiers.CodeLineNumber || Text;
    return /* @__PURE__ */ __jsx(LineNumber, null, String(row.lineNumber).padStart(2, " "));
  }

  // cart/app/gallery/components/syntax-highlighter/SyntaxHighlighter.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  var JS_KEYWORDS = /* @__PURE__ */ new Set([
    "as",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "of",
    "return",
    "satisfies",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "typeof",
    "undefined",
    "var",
    "void",
    "while",
    "yield"
  ]);
  var ZIG_KEYWORDS = /* @__PURE__ */ new Set([
    "align",
    "allowzero",
    "and",
    "anyframe",
    "anytype",
    "asm",
    "async",
    "await",
    "break",
    "callconv",
    "catch",
    "comptime",
    "const",
    "continue",
    "defer",
    "else",
    "enum",
    "errdefer",
    "error",
    "export",
    "extern",
    "false",
    "fn",
    "for",
    "if",
    "inline",
    "noalias",
    "null",
    "opaque",
    "or",
    "orelse",
    "packed",
    "pub",
    "resume",
    "return",
    "struct",
    "suspend",
    "switch",
    "test",
    "threadlocal",
    "true",
    "try",
    "undefined",
    "union",
    "unreachable",
    "usingnamespace",
    "var",
    "volatile",
    "while"
  ]);
  var PY_KEYWORDS = /* @__PURE__ */ new Set([
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
    "yield"
  ]);
  var SHELL_KEYWORDS = /* @__PURE__ */ new Set([
    "case",
    "do",
    "done",
    "elif",
    "else",
    "esac",
    "export",
    "fi",
    "for",
    "function",
    "if",
    "in",
    "local",
    "readonly",
    "select",
    "set",
    "shift",
    "then",
    "until",
    "while"
  ]);
  function getSyntaxComponent(kind) {
    if (kind === "keyword") return classifiers.SyntaxKeyword || classifiers.SyntaxPlain || Text;
    if (kind === "string") return classifiers.SyntaxString || classifiers.SyntaxPlain || Text;
    if (kind === "number") return classifiers.SyntaxNumber || classifiers.SyntaxPlain || Text;
    if (kind === "comment") return classifiers.SyntaxComment || classifiers.SyntaxPlain || Text;
    if (kind === "function") return classifiers.SyntaxFunction || classifiers.SyntaxPlain || Text;
    if (kind === "type") return classifiers.SyntaxType || classifiers.SyntaxPlain || Text;
    if (kind === "property") return classifiers.SyntaxProperty || classifiers.SyntaxPlain || Text;
    if (kind === "punctuation") return classifiers.SyntaxPunctuation || classifiers.SyntaxPlain || Text;
    if (kind === "operator") return classifiers.SyntaxOperator || classifiers.SyntaxPlain || Text;
    if (kind === "tag") return classifiers.SyntaxTag || classifiers.SyntaxPlain || Text;
    if (kind === "meta") return classifiers.SyntaxMeta || classifiers.SyntaxPlain || Text;
    return classifiers.SyntaxPlain || Text;
  }
  function isWordStart(char) {
    return /[A-Za-z_$]/.test(char);
  }
  function isWordPart(char) {
    return /[A-Za-z0-9_$-]/.test(char);
  }
  function takeString(line, start) {
    const quote = line[start];
    let index = start + 1;
    while (index < line.length) {
      if (line[index] === "\\") {
        index += 2;
        continue;
      }
      if (line[index] === quote) return index + 1;
      index += 1;
    }
    return line.length;
  }
  function takeNumber(line, start) {
    const match = line.slice(start).match(/^-?(0x[0-9a-fA-F_]+|\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?)/);
    return start + (match ? match[0].length : 1);
  }
  function previousNonSpace(line, index) {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (!/\s/.test(line[i])) return line[i];
    }
    return "";
  }
  function nextNonSpace(line, index) {
    for (let i = index; i < line.length; i += 1) {
      if (!/\s/.test(line[i])) return line[i];
    }
    return "";
  }
  function classifyWord(word, line, start, language) {
    const keywordSet = language === "zig" ? ZIG_KEYWORDS : language === "python" ? PY_KEYWORDS : language === "shell" ? SHELL_KEYWORDS : JS_KEYWORDS;
    if (keywordSet.has(word)) return "keyword";
    if (language === "shell" && word.startsWith("$")) return "meta";
    if (previousNonSpace(line, start) === ".") return "property";
    if (nextNonSpace(line, start + word.length) === "(") return "function";
    if (/^[A-Z]/.test(word) || language === "zig" && word.startsWith("@")) return "type";
    return "plain";
  }
  function pushToken(tokens, text, kind) {
    if (!text) return;
    const prev = tokens[tokens.length - 1];
    if (prev?.kind === kind) {
      prev.text += text;
    } else {
      tokens.push({ text, kind });
    }
  }
  function tokenizeJsonLine(line) {
    const tokens = [];
    let index = 0;
    while (index < line.length) {
      const char = line[index];
      if (/\s/.test(char)) {
        pushToken(tokens, char, "plain");
        index += 1;
        continue;
      }
      if (char === '"') {
        const end = takeString(line, index);
        const kind = nextNonSpace(line, end) === ":" ? "property" : "string";
        pushToken(tokens, line.slice(index, end), kind);
        index = end;
        continue;
      }
      if (/[0-9-]/.test(char)) {
        const end = takeNumber(line, index);
        pushToken(tokens, line.slice(index, end), "number");
        index = end;
        continue;
      }
      if (/[A-Za-z]/.test(char)) {
        let end = index + 1;
        while (end < line.length && /[A-Za-z]/.test(line[end])) end += 1;
        pushToken(tokens, line.slice(index, end), "keyword");
        index = end;
        continue;
      }
      pushToken(tokens, char, "{}[],:".includes(char) ? "punctuation" : "operator");
      index += 1;
    }
    return tokens.length ? tokens : [{ text: " ", kind: "plain" }];
  }
  function tokenizeCodeLine(line, language, state) {
    if (language === "json") return tokenizeJsonLine(line);
    if (language === "text") return [{ text: line || " ", kind: "plain" }];
    const tokens = [];
    let index = 0;
    if (state.inBlockComment) {
      const close = line.indexOf("*/");
      if (close < 0) return [{ text: line || " ", kind: "comment" }];
      pushToken(tokens, line.slice(0, close + 2), "comment");
      state.inBlockComment = false;
      index = close + 2;
    }
    while (index < line.length) {
      const char = line[index];
      const rest = line.slice(index);
      if (/\s/.test(char)) {
        pushToken(tokens, char, "plain");
        index += 1;
        continue;
      }
      if (rest.startsWith("//") || language === "shell" && char === "#" || language === "python" && char === "#") {
        pushToken(tokens, rest, "comment");
        break;
      }
      if (rest.startsWith("/*")) {
        const close = line.indexOf("*/", index + 2);
        const end = close >= 0 ? close + 2 : line.length;
        pushToken(tokens, line.slice(index, end), "comment");
        if (close < 0) state.inBlockComment = true;
        index = end;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        const end = takeString(line, index);
        pushToken(tokens, line.slice(index, end), "string");
        index = end;
        continue;
      }
      if (/[0-9]/.test(char)) {
        const end = takeNumber(line, index);
        pushToken(tokens, line.slice(index, end), "number");
        index = end;
        continue;
      }
      if ((language === "tsx" || language === "ts" || language === "js") && char === "<" && /[A-Za-z/]/.test(line[index + 1] || "")) {
        pushToken(tokens, "<", "punctuation");
        index += 1;
        continue;
      }
      if (isWordStart(char) || language === "zig" && char === "@" || language === "shell" && char === "$") {
        let end = index + 1;
        while (end < line.length && isWordPart(line[end])) end += 1;
        const word = line.slice(index, end);
        const prev = previousNonSpace(line, index);
        const kind = prev === "<" || prev === "/" ? "tag" : classifyWord(word, line, index, language);
        pushToken(tokens, word, kind);
        index = end;
        continue;
      }
      pushToken(tokens, char, "{}[]().,;:".includes(char) ? "punctuation" : "operator");
      index += 1;
    }
    return tokens.length ? tokens : [{ text: " ", kind: "plain" }];
  }
  function splitSnippetIntoCodeLines(snippet) {
    const highlighted = new Set(snippet.emphasisLines || []);
    const state = { inBlockComment: false };
    return snippet.code.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((text, index) => {
      const startsInBlockComment = state.inBlockComment;
      tokenizeCodeLine(text, snippet.language, state);
      return {
        id: `${snippet.id}-line-${index + 1}`,
        snippetId: snippet.id,
        lineNumber: index + 1,
        text,
        language: snippet.language,
        highlighted: highlighted.has(index + 1),
        startsInBlockComment
      };
    });
  }
  function SyntaxHighlighter({ row, wrap = false }) {
    const LineContent = classifiers.CodeLineContent || Box;
    const state = { inBlockComment: row.startsInBlockComment };
    const tokens = tokenizeCodeLine(row.text, row.language, state);
    return /* @__PURE__ */ __jsx(LineContent, { style: { flexWrap: wrap ? "wrap" : "nowrap" } }, tokens.map((token, index) => {
      const Token = getSyntaxComponent(token.kind);
      return /* @__PURE__ */ __jsx(Token, { key: `${row.id}-${index}` }, token.text);
    }));
  }

  // cart/app/gallery/components/code-block/CodeBlock.tsx
  var FALLBACK_SNIPPET = {
    id: "code-snippet-fallback",
    title: "Code Block",
    filename: "snippet.txt",
    language: "text",
    code: "Code snippet unavailable.",
    showLineNumbers: true,
    wrap: true
  };
  function normalizeLanguage(value) {
    if (value === "tsx" || value === "ts" || value === "js" || value === "json" || value === "zig" || value === "python" || value === "shell" || value === "text") {
      return value;
    }
    return "text";
  }
  function normalizeCodeSnippet(row) {
    if (!row || typeof row !== "object") return FALLBACK_SNIPPET;
    const id = typeof row.id === "string" && row.id ? row.id : FALLBACK_SNIPPET.id;
    const code = typeof row.code === "string" ? row.code : typeof row.content === "string" ? row.content : FALLBACK_SNIPPET.code;
    return {
      id,
      title: typeof row.title === "string" && row.title ? row.title : id,
      filename: typeof row.filename === "string" ? row.filename : void 0,
      language: normalizeLanguage(row.language),
      code,
      showLineNumbers: typeof row.showLineNumbers === "boolean" ? row.showLineNumbers : true,
      wrap: typeof row.wrap === "boolean" ? row.wrap : false,
      emphasisLines: Array.isArray(row.emphasisLines) ? row.emphasisLines.filter((line) => typeof line === "number" && Number.isFinite(line)) : []
    };
  }
  function displayLanguage(language) {
    if (language === "tsx") return "TSX";
    if (language === "ts") return "TypeScript";
    if (language === "js") return "JavaScript";
    if (language === "json") return "JSON";
    if (language === "zig") return "Zig";
    if (language === "python") return "Python";
    if (language === "shell") return "Shell";
    return "Text";
  }
  function CodeBlock({ row }) {
    const snippet = normalizeCodeSnippet(row);
    const lines = splitSnippetIntoCodeLines(snippet);
    const Frame = classifiers.CodeBlockFrame || Box;
    const Header = classifiers.CodeBlockHeader || Box;
    const Meta = classifiers.CodeBlockMeta || Box;
    const Title = classifiers.CodeBlockTitle || Text;
    const Subtle = classifiers.CodeBlockSubtle || Text;
    const Badge = classifiers.CodeBlockBadge || Box;
    const BadgeText = classifiers.CodeBlockBadgeText || Text;
    const CodeScroll = classifiers.CodeBlockScroll || ScrollView;
    const Body2 = classifiers.CodeBlockBody || Box;
    const Line = classifiers.CodeLine || Box;
    const LineEmphasis = classifiers.CodeLineEmphasis || Line;
    const HeaderActions = classifiers.InlineX4Center || Box;
    return /* @__PURE__ */ __jsx(Frame, null, /* @__PURE__ */ __jsx(Header, null, /* @__PURE__ */ __jsx(Meta, null, /* @__PURE__ */ __jsx(Title, null, snippet.title), /* @__PURE__ */ __jsx(Subtle, null, snippet.filename || snippet.id)), /* @__PURE__ */ __jsx(HeaderActions, null, /* @__PURE__ */ __jsx(Badge, null, /* @__PURE__ */ __jsx(BadgeText, null, displayLanguage(snippet.language))), /* @__PURE__ */ __jsx(CodeCopyButton, { row: snippet }))), /* @__PURE__ */ __jsx(CodeScroll, null, /* @__PURE__ */ __jsx(Body2, null, lines.map((line) => {
      const LineFrame = line.highlighted ? LineEmphasis : Line;
      return /* @__PURE__ */ __jsx(LineFrame, { key: line.id }, snippet.showLineNumbers ? /* @__PURE__ */ __jsx(CodeLineNumber, { row: line }) : null, /* @__PURE__ */ __jsx(SyntaxHighlighter, { row: line, wrap: snippet.wrap }));
    }))));
  }

  // cart/app/gallery/components/intent-surface/IntentCode.tsx
  function IntentCode({ lang, children }) {
    const language = normalizeLanguage2(lang);
    const label = lang ? lang.trim() : "text";
    return /* @__PURE__ */ __jsx(
      CodeBlock,
      {
        row: {
          id: `intent-code-${language}`,
          title: "Code",
          filename: label,
          language,
          code: textContent2(children),
          showLineNumbers: false,
          wrap: true
        }
      }
    );
  }
  function normalizeLanguage2(value) {
    const lang = (value || "").trim().toLowerCase();
    if (lang === "tsx") return "tsx";
    if (lang === "typescript" || lang === "ts") return "ts";
    if (lang === "javascript" || lang === "js") return "js";
    if (lang === "json") return "json";
    if (lang === "zig") return "zig";
    if (lang === "python" || lang === "py") return "python";
    if (lang === "shell" || lang === "sh" || lang === "bash") return "shell";
    return "text";
  }
  function textContent2(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(textContent2).join("");
    return String(value);
  }

  // cart/app/gallery/components/intent-surface/IntentDivider.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentDivider() {
    const Divider = classifiers.Divider || Box;
    return /* @__PURE__ */ __jsx(Divider, null);
  }

  // cart/app/gallery/components/intent-surface/IntentKbd.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  function IntentKbd({ children }) {
    const Keycap = classifiers.CodeBlockBadge || Box;
    const Label = classifiers.CodeBlockBadgeText || Text;
    return /* @__PURE__ */ __jsx(Keycap, { style: { alignSelf: "flex-start" } }, /* @__PURE__ */ __jsx(Label, null, children));
  }

  // cart/app/gallery/components/intent-surface/IntentSpacer.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  var SIZES = { sm: 8, md: 16, lg: 32 };
  function IntentSpacer({ size = "md" }) {
    const px = SIZES[size] ?? SIZES.md;
    const Spacer = classifiers.StackX1 || Box;
    return /* @__PURE__ */ __jsx(Spacer, { style: { height: px, width: px, flexShrink: 0 } });
  }

  // cart/app/gallery/components/intent-surface/IntentSurface.tsx
  function IntentSurface({ nodes, onAction }) {
    const Stack = classifiers.StackX4 || Col;
    return /* @__PURE__ */ __jsx(Stack, null, nodes.map((n, i) => /* @__PURE__ */ __jsx(IntentNode, { key: i, node: n, onAction })));
  }
  function IntentNode({ node, onAction }) {
    switch (node.kind) {
      case "text":
        return /* @__PURE__ */ __jsx(IntentText, null, node.text);
      case "Title":
        return /* @__PURE__ */ __jsx(IntentTitle, null, flatText(node));
      case "Text":
        if (node.children.length > 0 && node.children.some((c) => c.kind !== "text")) {
          const Stack = classifiers.StackX2 || Col;
          return /* @__PURE__ */ __jsx(Stack, null, node.children.map((c, i) => /* @__PURE__ */ __jsx(IntentNode, { key: i, node: c, onAction })));
        }
        return /* @__PURE__ */ __jsx(IntentText, null, flatText(node));
      case "Card":
        return /* @__PURE__ */ __jsx(IntentCard, null, node.children.map((c, i) => /* @__PURE__ */ __jsx(IntentNode, { key: i, node: c, onAction })));
      case "Row":
        return /* @__PURE__ */ __jsx(IntentRow, null, node.children.map((c, i) => /* @__PURE__ */ __jsx(IntentNode, { key: i, node: c, onAction })));
      case "Col":
        return /* @__PURE__ */ __jsx(IntentCol, null, node.children.map((c, i) => /* @__PURE__ */ __jsx(IntentNode, { key: i, node: c, onAction })));
      case "List": {
        const items = flatText(node).split("\n").map((s) => s.trim()).filter(Boolean);
        return /* @__PURE__ */ __jsx(IntentList, { items });
      }
      case "Btn": {
        const reply = stringAttr(node.attrs.reply) ?? flatText(node) ?? "pick";
        const label = flatText(node) || stringAttr(node.attrs.label) || void 0;
        return /* @__PURE__ */ __jsx(IntentBtn, { reply, label, onAction });
      }
      case "Form":
        return /* @__PURE__ */ __jsx(IntentForm, { onAction }, node.children.map((c, i) => /* @__PURE__ */ __jsx(IntentNode, { key: i, node: c, onAction })));
      case "Field":
        return /* @__PURE__ */ __jsx(
          IntentField,
          {
            name: stringAttr(node.attrs.name) ?? "",
            label: stringAttr(node.attrs.label),
            placeholder: stringAttr(node.attrs.placeholder),
            initial: stringAttr(node.attrs.value)
          }
        );
      case "Submit": {
        const replyTemplate = stringAttr(node.attrs.reply);
        const label = flatText(node) || void 0;
        return /* @__PURE__ */ __jsx(IntentSubmit, { replyTemplate, label });
      }
      case "Badge": {
        const tone = stringAttr(node.attrs.tone);
        return /* @__PURE__ */ __jsx(IntentBadge, { tone }, flatText(node));
      }
      case "Code": {
        const lang = stringAttr(node.attrs.lang);
        return /* @__PURE__ */ __jsx(IntentCode, { lang }, flatText(node));
      }
      case "Divider":
        return /* @__PURE__ */ __jsx(IntentDivider, null);
      case "Kbd":
        return /* @__PURE__ */ __jsx(IntentKbd, null, flatText(node));
      case "Spacer": {
        const size = stringAttr(node.attrs.size);
        return /* @__PURE__ */ __jsx(IntentSpacer, { size });
      }
      default:
        return null;
    }
  }
  function flatText(node) {
    if (node.text) return node.text;
    return node.children.map(flatText).join(" ").trim();
  }
  function stringAttr(v) {
    return typeof v === "string" ? v : void 0;
  }

  // runtime/intent/render.tsx
  function RenderIntent({ nodes, onAction }) {
    return /* @__PURE__ */ __jsx(IntentSurface, { nodes, onAction });
  }

  // runtime/intent/save.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // runtime/intent/printer.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var TAG_TO_COMPONENT = {
    Row: "IntentRow",
    Col: "IntentCol",
    Card: "IntentCard",
    Title: "IntentTitle",
    Text: "IntentText",
    List: "IntentList",
    Btn: "IntentBtn",
    Form: "IntentForm",
    Field: "IntentField",
    Submit: "IntentSubmit",
    Badge: "IntentBadge",
    Code: "IntentCode",
    Divider: "IntentDivider",
    Kbd: "IntentKbd",
    Spacer: "IntentSpacer"
  };
  function printIntentCart(nodes, opts) {
    const used = /* @__PURE__ */ new Set();
    const body = nodes.map((n) => renderNode(n, used, 4)).join("\n");
    const importLines = [...used].sort().map((comp) => `import { ${comp} } from '${opts.importBase}/${comp}';`).join("\n");
    return `${importLines}

export default function App() {
  const onAction = (reply: string) => console.log('intent action:', reply);
  return (
    <>
${body}
    </>
  );
}
`;
  }
  function renderNode(node, used, indent) {
    const pad = " ".repeat(indent);
    if (node.kind === "text") {
      const t = (node.text ?? "").trim();
      if (!t) return "";
      return `${pad}{${JSON.stringify(t)}}`;
    }
    const comp = TAG_TO_COMPONENT[node.kind];
    if (!comp) return "";
    used.add(comp);
    const propParts = [];
    if (node.kind === "Btn") {
      const reply = stringAttr2(node.attrs.reply);
      const inner = flatText2(node);
      propParts.push(`reply=${jsxString(reply ?? inner ?? "pick")}`);
      if (inner) propParts.push(`label=${jsxString(inner)}`);
      propParts.push(`onAction={onAction}`);
      return `${pad}<${comp} ${propParts.join(" ")} />`;
    }
    if (node.kind === "Submit") {
      const replyTpl = stringAttr2(node.attrs.reply);
      const inner = flatText2(node);
      if (replyTpl) propParts.push(`replyTemplate=${jsxString(replyTpl)}`);
      if (inner) propParts.push(`label=${jsxString(inner)}`);
      return `${pad}<${comp} ${propParts.join(" ")} />`;
    }
    if (node.kind === "Field") {
      const name = stringAttr2(node.attrs.name) ?? "";
      propParts.push(`name=${jsxString(name)}`);
      const label = stringAttr2(node.attrs.label);
      if (label) propParts.push(`label=${jsxString(label)}`);
      const placeholder = stringAttr2(node.attrs.placeholder);
      if (placeholder) propParts.push(`placeholder=${jsxString(placeholder)}`);
      const initial = stringAttr2(node.attrs.value);
      if (initial) propParts.push(`initial=${jsxString(initial)}`);
      return `${pad}<${comp} ${propParts.join(" ")} />`;
    }
    if (node.kind === "Form") {
      propParts.push(`onAction={onAction}`);
    }
    if (node.kind === "Badge") {
      const tone = stringAttr2(node.attrs.tone);
      if (tone) propParts.push(`tone=${jsxString(tone)}`);
      return `${pad}<${comp}${propParts.length ? " " + propParts.join(" ") : ""}>${flatText2(node)}</${comp}>`;
    }
    if (node.kind === "Code") {
      const lang = stringAttr2(node.attrs.lang);
      if (lang) propParts.push(`lang=${jsxString(lang)}`);
      return `${pad}<${comp}${propParts.length ? " " + propParts.join(" ") : ""}>{${JSON.stringify(flatText2(node))}}</${comp}>`;
    }
    if (node.kind === "Spacer") {
      const size = stringAttr2(node.attrs.size);
      if (size) propParts.push(`size=${jsxString(size)}`);
      return `${pad}<${comp}${propParts.length ? " " + propParts.join(" ") : ""} />`;
    }
    if (node.kind === "Divider") {
      return `${pad}<${comp} />`;
    }
    if (node.kind === "Kbd") {
      return `${pad}<${comp}>${flatText2(node)}</${comp}>`;
    }
    if (node.kind === "List") {
      const items = flatText2(node).split("\n").map((s) => s.trim()).filter(Boolean);
      propParts.push(`items={${JSON.stringify(items)}}`);
      return `${pad}<${comp} ${propParts.join(" ")} />`;
    }
    if (node.kind === "Title" || node.kind === "Text") {
      return `${pad}<${comp}>${flatText2(node)}</${comp}>`;
    }
    const propStr = propParts.length ? " " + propParts.join(" ") : "";
    if (!node.children.length) {
      return `${pad}<${comp}${propStr} />`;
    }
    const childLines = node.children.map((c) => renderNode(c, used, indent + 2)).filter((s) => s.length > 0).join("\n");
    return `${pad}<${comp}${propStr}>
${childLines}
${pad}</${comp}>`;
  }
  function flatText2(node) {
    if (node.text) return node.text;
    return node.children.map(flatText2).join(" ").trim();
  }
  function stringAttr2(v) {
    return typeof v === "string" ? v : void 0;
  }
  function jsxString(s) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  // runtime/intent/save.ts
  init_fs();
  var INTENT_SURFACE_DIR = "cart/app/gallery/components/intent-surface";
  function saveIntentCart(nodes, targetPath) {
    if (!targetPath.endsWith(".tsx")) {
      return { ok: false, path: targetPath, error: "path must end in .tsx" };
    }
    const parentDir = parentOf(targetPath);
    if (parentDir && !exists(parentDir)) {
      if (!mkdir(parentDir)) {
        return { ok: false, path: targetPath, error: `mkdir failed: ${parentDir}` };
      }
    }
    const importBase = relativePath(parentDir, INTENT_SURFACE_DIR);
    const tsx = printIntentCart(nodes, { importBase });
    const wrote = writeFile(targetPath, tsx);
    if (!wrote) {
      return { ok: false, path: targetPath, error: "writeFile failed" };
    }
    return { ok: true, path: targetPath };
  }
  function parentOf(path) {
    const i = path.lastIndexOf("/");
    return i === -1 ? "" : path.slice(0, i);
  }
  function relativePath(fromDir, toDir) {
    const from = fromDir.split("/").filter(Boolean);
    const to = toDir.split("/").filter(Boolean);
    let i = 0;
    while (i < from.length && i < to.length && from[i] === to[i]) i++;
    const ups = from.length - i;
    const downs = to.slice(i);
    const parts = [];
    for (let k = 0; k < ups; k++) parts.push("..");
    parts.push(...downs);
    if (parts.length === 0) return ".";
    if (parts[0] !== "..") return "./" + parts.join("/");
    return parts.join("/");
  }

  // cart/app/isolated_tests/chat-loom.tsx
  var ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions";
  var MODEL = "gemma-4-e2b-uncensored-hauhaucs-aggressive";
  var SYSTEM_PROMPT = `You respond to the user with an interactive chat surface, not prose.

Wrap your entire response in [ ... ]. Inside, compose a small tree from these tags ONLY:

  <Title>large heading text</Title>
  <Text>body paragraph text</Text>
  <Card>group related content in a padded surface</Card>
  <Row>arrange children horizontally</Row>
  <Col>arrange children vertically</Col>
  <List>one item per line</List>
  <Btn reply="what to send back when clicked">label shown to user</Btn>

Display tags (use freely to make the surface read like a real UI):

  <Badge tone=success>label</Badge>     // tones: neutral, success, warning, error, info \u2014 bare word, no quotes
  <Code lang=ts>...code text...</Code>  // formatted code block; lang is bare
  <Divider />                           // horizontal separator inside a Col
  <Kbd>Cmd+S</Kbd>                      // inline keyboard chip
  <Spacer size=md />                    // vertical/horizontal gap; size: sm, md, lg

Forms (use when collecting structured input):

  <Form>
    <Field name="fieldKey" label="Label shown above" placeholder="hint text" />
    <Field name="another" label="..." />
    <Submit reply="message template with {fieldKey} interpolation">Submit label</Submit>
  </Form>

Rules:
- Always wrap output in [ ... ].
- Use <Btn> for single-choice picks. Use <Form> when you need multiple values.
- A <Submit>'s reply attribute is a template \u2014 every {fieldKey} is replaced with that field's current value. Always use this so you control the format.
- The user will reply with the interpolated string. When you receive a form submission, respond with a confirmation card showing what was received.
- Plain text outside any tag is allowed for short prose.
- No other tags. No HTML. No markdown.

Form example, "ask about the user":
[<Col>
  <Title>Tell me about yourself</Title>
  <Form>
    <Field name="name" label="Your name" placeholder="Alice" />
    <Field name="role" label="What you do" placeholder="builder / designer / etc" />
    <Field name="goal" label="One thing you want to ship this week" />
    <Submit reply="FORM_SUBMITTED name={name} role={role} goal={goal}">Send</Submit>
  </Form>
</Col>]

When you then receive "FORM_SUBMITTED name=... role=... goal=...", reply with a confirmation:
[<Card>
  <Title>Got it \u2713</Title>
  <Text>Recorded for {name} ({role}). Goal noted: {goal}.</Text>
  <Btn reply="start over">Reset</Btn>
</Card>]
(Substitute the actual values into your reply text \u2014 that confirmation IS how the user knows the round-trip worked.)
`;
  function App() {
    const [turns, setTurns] = (0, import_react3.useState)([]);
    const [input, setInput] = (0, import_react3.useState)("");
    const [busy, setBusy] = (0, import_react3.useState)(false);
    const [error, setError] = (0, import_react3.useState)(null);
    const inputRef = (0, import_react3.useRef)("");
    const turnsRef = (0, import_react3.useRef)([]);
    const busyRef = (0, import_react3.useRef)(false);
    inputRef.current = input;
    turnsRef.current = turns;
    busyRef.current = busy;
    const send = async (text) => {
      const msg = text.trim();
      if (!msg || busyRef.current) return;
      setError(null);
      setBusy(true);
      busyRef.current = true;
      const next = [...turnsRef.current, { role: "user", content: msg }];
      setTurns(next);
      turnsRef.current = next;
      setInput("");
      inputRef.current = "";
      try {
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...next.map((t) => ({ role: t.role, content: t.content }))
        ];
        const body = JSON.stringify({ model: MODEL, messages, temperature: 0.4, stream: false });
        const res = await requestAsync({
          method: "POST",
          url: ENDPOINT,
          headers: { "Content-Type": "application/json" },
          body,
          timeoutMs: 999e3
        });
        if (res.status !== 200) {
          const detail = res.error ? `: ${res.error}` : res.body ? `: ${res.body.slice(0, 240)}` : "";
          setError(`HTTP ${res.status}${detail}`);
          return;
        }
        const json = JSON.parse(res.body);
        const content = json?.choices?.[0]?.message?.content ?? "";
        const parsed = parseIntent(content);
        const after = [...turnsRef.current, { role: "assistant", content, parsed }];
        setTurns(after);
        turnsRef.current = after;
      } catch (e) {
        setError(`fetch failed: ${e?.message ?? String(e)}`);
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    };
    const sendCurrent = () => send(inputRef.current);
    return /* @__PURE__ */ __jsx(Box, { style: { width: "100%", height: "100%", flexDirection: "column", backgroundColor: "#0b1020" } }, /* @__PURE__ */ __jsx(Box, { style: { padding: 12, paddingLeft: 18, paddingRight: 18, borderBottomWidth: 1, borderColor: "#1e293b" } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 13, color: "#94a3b8" } }, "chat-loom \xB7 ", MODEL, " @ ", ENDPOINT)), /* @__PURE__ */ __jsx(ScrollView, { style: { flexGrow: 1, padding: 18 } }, /* @__PURE__ */ __jsx(Col, { style: { gap: 18 } }, turns.map((t, i) => /* @__PURE__ */ __jsx(Col, { key: i, style: { gap: 4 } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 10, color: "#64748b" } }, t.role.toUpperCase()), t.role === "user" ? /* @__PURE__ */ __jsx(Text, { style: { fontSize: 14, color: "#f1f5f9" } }, t.content) : t.parsed && t.parsed.length > 0 ? /* @__PURE__ */ __jsx(Col, { style: { gap: 8 } }, /* @__PURE__ */ __jsx(RenderIntent, { nodes: t.parsed, onAction: send }), /* @__PURE__ */ __jsx(LiftRow, { nodes: t.parsed, index: i })) : /* @__PURE__ */ __jsx(Col, { style: { gap: 4 } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 12, color: "#fbbf24" } }, "[unparseable]"), /* @__PURE__ */ __jsx(Text, { style: { fontSize: 12, color: "#fbbf24" } }, t.content)))), busy ? /* @__PURE__ */ __jsx(Text, { style: { fontSize: 13, color: "#64748b" } }, "thinking\u2026") : null, error ? /* @__PURE__ */ __jsx(Text, { style: { fontSize: 13, color: "#ef4444" } }, error) : null)), /* @__PURE__ */ __jsx(Row, { style: { padding: 12, gap: 8, borderTopWidth: 1, borderColor: "#1e293b", alignItems: "center" } }, /* @__PURE__ */ __jsx(
      TextInput,
      {
        value: input,
        placeholder: "ask anything\u2026",
        onChangeText: (text) => {
          setInput(text);
          inputRef.current = text;
        },
        onSubmit: sendCurrent,
        style: {
          flexGrow: 1,
          flexBasis: 0,
          padding: 10,
          paddingLeft: 14,
          paddingRight: 14,
          backgroundColor: "#1e293b",
          color: "#f1f5f9",
          borderWidth: 1,
          borderColor: "#334155",
          borderRadius: 6,
          fontSize: 14
        }
      }
    ), /* @__PURE__ */ __jsx(Pressable, { onPress: sendCurrent }, /* @__PURE__ */ __jsx(Box, { style: {
      padding: 10,
      paddingLeft: 18,
      paddingRight: 18,
      backgroundColor: "#1d4ed8",
      borderRadius: 6
    } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 14, color: "#ffffff" } }, "send")))));
  }
  function LiftRow({ nodes, index }) {
    const defaultPath = `cart/lifted/turn-${index + 1}.tsx`;
    const [path, setPath] = (0, import_react3.useState)(defaultPath);
    const [status, setStatus] = (0, import_react3.useState)(null);
    const pathRef = (0, import_react3.useRef)(defaultPath);
    pathRef.current = path;
    const onLift = () => {
      const result = saveIntentCart(nodes, pathRef.current.trim());
      if (result.ok) {
        setStatus({ tone: "ok", msg: `\u2713 saved to ${result.path}` });
      } else {
        setStatus({ tone: "err", msg: `\u2717 ${result.error ?? "failed"}` });
      }
    };
    return /* @__PURE__ */ __jsx(Row, { style: { gap: 8, alignItems: "center", paddingTop: 4 } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 10, color: "#475569" } }, "lift to"), /* @__PURE__ */ __jsx(
      TextInput,
      {
        value: path,
        onChangeText: (t) => {
          setPath(t);
          pathRef.current = t;
        },
        style: {
          flexGrow: 1,
          flexBasis: 0,
          padding: 4,
          paddingLeft: 8,
          paddingRight: 8,
          backgroundColor: "#0f172a",
          color: "#cbd5e1",
          borderWidth: 1,
          borderColor: "#1e293b",
          borderRadius: 4,
          fontSize: 11
        }
      }
    ), /* @__PURE__ */ __jsx(Pressable, { onPress: onLift }, /* @__PURE__ */ __jsx(Box, { style: {
      padding: 4,
      paddingLeft: 10,
      paddingRight: 10,
      backgroundColor: "#334155",
      borderRadius: 4
    } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 11, color: "#e2e8f0" } }, "lift"))), status ? /* @__PURE__ */ __jsx(Text, { style: { fontSize: 10, color: status.tone === "ok" ? "#16a34a" : "#ef4444" } }, status.msg) : null);
  }

  // runtime/cartridge_entry.tsx
  var g = globalThis;
  var slot = g.__cartridgeLoadSlot;
  if (slot && typeof slot === "object") {
    slot.App = App;
  } else {
    g.__lastCartridge = App;
  }
})();
