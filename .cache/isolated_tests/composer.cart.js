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
        const host5 = globalThis;
        let initialY = 0;
        if (typeof host5.__hot_get === "function") {
          try {
            const raw = host5.__hot_get(hotKey);
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
            if (typeof host5.__hot_set === "function" && Number.isFinite(payload?.scrollY)) {
              host5.__hot_set(hotKey, String(payload.scrollY));
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
  var __jsx, Fragment;
  var init_jsx_shim = __esm({
    "runtime/jsx_shim.ts"() {
      __jsx = function __jsx2(...a) {
        a[0] = resolveIntrinsic(a[0]);
        return require_react().createElement(...a);
      };
      Fragment = /* @__PURE__ */ Symbol.for("react.fragment");
    }
  });

  // runtime/cartridge_entry.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/isolated_tests/composer.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var React4 = __toESM(require_react());
  init_primitives();
  var C_BG = "#0e0f12";
  var C_PANEL = "#16181c";
  var C_PANEL2 = "#1d2026";
  var C_BORDER = "#2a2e35";
  var C_FG = "#dde2ea";
  var C_DIM = "#7e8694";
  var C_ACCENT = "#22d3ee";
  var C_DANGER = "#f87171";
  var SURFACE = 1e3;
  var PALETTE = [
    "transparent",
    "#ffffff",
    "#000000",
    "#9ca3af",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#3b82f6",
    "#a855f7",
    "#ec4899"
  ];
  var _seq = 0;
  var nid = () => `n${++_seq}`;
  function defaults(kind) {
    const n = { id: nid(), kind, children: [] };
    if (kind === "Box") {
      n.width = 240;
      n.height = 140;
      n.bg = "#1f2937";
      n.padding = 16;
    } else if (kind === "Text") {
      n.text = "hello!";
      n.color = "#ffffff";
    } else if (kind === "Pressable") {
      n.text = "my button";
      n.bg = "#3b82f6";
      n.color = "#ffffff";
      n.padding = 10;
    }
    return n;
  }
  function find(ns, id) {
    for (const n of ns) {
      if (n.id === id) return n;
      const c = find(n.children, id);
      if (c) return c;
    }
    return null;
  }
  function findParent(ns, id) {
    for (const n of ns) {
      if (n.children.some((c) => c.id === id)) return n;
      const p = findParent(n.children, id);
      if (p) return p;
    }
    return null;
  }
  function patch(ns, id, p) {
    return ns.map(
      (n) => n.id === id ? { ...n, ...p } : { ...n, children: patch(n.children, id, p) }
    );
  }
  function remove(ns, id) {
    const out = [];
    for (const n of ns) {
      if (n.id === id) continue;
      out.push({ ...n, children: remove(n.children, id) });
    }
    return out;
  }
  function add(ns, parentId, node) {
    if (parentId == null) return [...ns, node];
    return ns.map(
      (n) => n.id === parentId ? { ...n, children: [...n.children, node] } : { ...n, children: add(n.children, parentId, node) }
    );
  }
  function move(ns, id, delta) {
    const i = ns.findIndex((n) => n.id === id);
    if (i >= 0) {
      const j = i + delta;
      if (j < 0 || j >= ns.length) return ns;
      const out = [...ns];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    }
    return ns.map((n) => {
      const k = n.children.findIndex((c) => c.id === id);
      if (k >= 0) {
        const m = k + delta;
        if (m < 0 || m >= n.children.length) return n;
        const cs = [...n.children];
        [cs[k], cs[m]] = [cs[m], cs[k]];
        return { ...n, children: cs };
      }
      return { ...n, children: move(n.children, id, delta) };
    });
  }
  function styleProps(n) {
    const p = [];
    if (n.width != null) p.push(`width: ${n.width}`);
    if (n.height != null) p.push(`height: ${n.height}`);
    if (n.bg && n.bg !== "transparent") p.push(`backgroundColor: '${n.bg}'`);
    if (n.padding != null && n.padding > 0) p.push(`padding: ${n.padding}`);
    if (n.alignH) p.push(`alignItems: '${n.alignH}'`);
    if (n.alignV) p.push(`justifyContent: '${n.alignV}'`);
    return p;
  }
  function emit(n, depth) {
    const ind = "  ".repeat(depth);
    const sp = styleProps(n);
    const styleAttr = sp.length ? ` style={{ ${sp.join(", ")} }}` : "";
    const colorAttr = n.kind !== "Box" && n.color ? ` color="${n.color}"` : "";
    const txt = n.text ?? "";
    if (n.kind === "Text") return `${ind}<Text${colorAttr}${styleAttr}>${txt}</Text>`;
    if (n.kind === "Pressable") return `${ind}<Pressable${colorAttr}${styleAttr}>${txt}</Pressable>`;
    if (n.children.length === 0) return `${ind}<Box${styleAttr} />`;
    const inner = n.children.map((c) => emit(c, depth + 1)).join("\n");
    return `${ind}<Box${styleAttr}>
${inner}
${ind}</Box>`;
  }
  function emitAll(tree) {
    if (tree.length === 0) return "";
    return tree.map((n) => emit(n, 0)).join("\n");
  }
  var ParseError = class extends Error {
  };
  var JsxParser = class {
    src;
    pos;
    constructor(src) {
      this.src = src;
      this.pos = 0;
    }
    eof() {
      return this.pos >= this.src.length;
    }
    skipWS() {
      while (this.pos < this.src.length) {
        const c = this.src[this.pos];
        if (c === " " || c === "	" || c === "\n" || c === "\r") {
          this.pos++;
          continue;
        }
        if (c === "/" && this.src[this.pos + 1] === "/") {
          while (this.pos < this.src.length && this.src[this.pos] !== "\n") this.pos++;
          continue;
        }
        if (c === "/" && this.src[this.pos + 1] === "*") {
          this.pos += 2;
          while (this.pos < this.src.length && !(this.src[this.pos] === "*" && this.src[this.pos + 1] === "/")) this.pos++;
          if (this.pos < this.src.length) this.pos += 2;
          continue;
        }
        break;
      }
    }
    peek(s) {
      return this.src.slice(this.pos, this.pos + s.length) === s;
    }
    expect(s) {
      if (!this.peek(s)) {
        const got = this.src.slice(this.pos, this.pos + 20).replace(/\n/g, "\\n");
        throw new ParseError(`expected "${s}" at pos ${this.pos}, got "${got}"`);
      }
      this.pos += s.length;
    }
    readIdent() {
      const m = this.src.slice(this.pos).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!m) throw new ParseError(`expected identifier at pos ${this.pos}`);
      this.pos += m[0].length;
      return m[0];
    }
    parseString() {
      const q = this.src[this.pos];
      if (q !== '"' && q !== "'") throw new ParseError(`expected quote at pos ${this.pos}`);
      this.pos++;
      let out = "";
      while (this.pos < this.src.length && this.src[this.pos] !== q) {
        if (this.src[this.pos] === "\\") {
          this.pos++;
          out += this.src[this.pos++] ?? "";
        } else {
          out += this.src[this.pos++];
        }
      }
      if (this.pos >= this.src.length) throw new ParseError(`unterminated string`);
      this.pos++;
      return out;
    }
    parseExprValue() {
      this.skipWS();
      if (this.peek('"') || this.peek("'")) return this.parseString();
      const m = this.src.slice(this.pos).match(/^-?\d+(\.\d+)?/);
      if (m) {
        this.pos += m[0].length;
        return parseFloat(m[0]);
      }
      if (this.peek("true")) {
        this.pos += 4;
        return true;
      }
      if (this.peek("false")) {
        this.pos += 5;
        return false;
      }
      if (this.peek("null")) {
        this.pos += 4;
        return null;
      }
      throw new ParseError(`expected literal value at pos ${this.pos}`);
    }
    parseObjectBody() {
      const obj = {};
      this.skipWS();
      while (!this.peek("}")) {
        this.skipWS();
        let key;
        if (this.peek('"') || this.peek("'")) key = this.parseString();
        else key = this.readIdent();
        this.skipWS();
        this.expect(":");
        this.skipWS();
        obj[key] = this.parseExprValue();
        this.skipWS();
        if (this.peek(",")) {
          this.pos++;
          this.skipWS();
        }
      }
      return obj;
    }
    parseAttrValue() {
      if (this.peek('"') || this.peek("'")) return this.parseString();
      if (this.peek("{")) {
        this.pos++;
        this.skipWS();
        let value;
        if (this.peek("{")) {
          this.pos++;
          value = this.parseObjectBody();
          this.expect("}");
        } else {
          value = this.parseExprValue();
        }
        this.skipWS();
        this.expect("}");
        return value;
      }
      throw new ParseError(`expected attribute value at pos ${this.pos}`);
    }
    parseAttrs() {
      const attrs = {};
      while (true) {
        this.skipWS();
        if (this.peek(">") || this.peek("/>")) break;
        const name = this.readIdent();
        this.skipWS();
        this.expect("=");
        this.skipWS();
        attrs[name] = this.parseAttrValue();
      }
      return attrs;
    }
    parseElement() {
      this.skipWS();
      this.expect("<");
      const tag = this.readIdent();
      if (tag !== "Box" && tag !== "Text" && tag !== "Pressable") {
        throw new ParseError(`unknown tag <${tag}> \u2014 only Box, Text, Pressable are recognized`);
      }
      const attrs = this.parseAttrs();
      this.skipWS();
      const node = { id: nid(), kind: tag, children: [] };
      Object.assign(node, attrsToNode(attrs));
      if (this.peek("/>")) {
        this.pos += 2;
        return node;
      }
      this.expect(">");
      if (tag === "Text" || tag === "Pressable") {
        const closing = `</${tag}>`;
        const end = this.src.indexOf(closing, this.pos);
        if (end < 0) throw new ParseError(`unterminated <${tag}>`);
        node.text = this.src.slice(this.pos, end).replace(/^\s+|\s+$/g, "");
        this.pos = end + closing.length;
      } else {
        while (true) {
          this.skipWS();
          if (this.peek(`</${tag}>`)) {
            this.pos += `</${tag}>`.length;
            break;
          }
          if (this.eof()) throw new ParseError(`unterminated <${tag}>`);
          node.children.push(this.parseElement());
        }
      }
      return node;
    }
  };
  function attrsToNode(attrs) {
    const out = {};
    if (typeof attrs.color === "string") out.color = attrs.color;
    const style = attrs.style;
    if (style && typeof style === "object") {
      if (typeof style.width === "number") out.width = style.width;
      if (typeof style.height === "number") out.height = style.height;
      if (typeof style.padding === "number") out.padding = style.padding;
      if (typeof style.backgroundColor === "string") out.bg = style.backgroundColor;
      if (typeof style.alignItems === "string") out.alignH = style.alignItems;
      if (typeof style.justifyContent === "string") out.alignV = style.justifyContent;
    }
    return out;
  }
  function parseAll(src) {
    const trimmed = src.trim();
    if (trimmed.length === 0) return [];
    const p = new JsxParser(src);
    const out = [];
    p.skipWS();
    while (!p.eof()) {
      out.push(p.parseElement());
      p.skipWS();
    }
    return out;
  }
  function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }
  function ResizeHandle({ onBegin }) {
    return /* @__PURE__ */ __jsx(
      Pressable,
      {
        onMouseDown: onBegin,
        style: {
          position: "absolute",
          right: -7,
          bottom: -7,
          width: 14,
          height: 14,
          backgroundColor: C_ACCENT,
          borderWidth: 1,
          borderColor: "#000",
          zIndex: 1e3
        }
      }
    );
  }
  function StageNode({ node, sel, resizingId, onSelect, onBeginResize }) {
    const isSel = node.id === sel;
    const isResizing = node.id === resizingId;
    const s = {
      position: "relative",
      borderWidth: isSel ? 2 : 1,
      borderColor: isSel ? C_ACCENT : "rgba(255,255,255,0.06)"
    };
    if (node.width != null) s.width = node.width;
    if (node.height != null) s.height = node.height;
    if (node.bg && node.bg !== "transparent") s.backgroundColor = node.bg;
    if (node.padding != null) s.padding = node.padding;
    if (node.alignH) s.alignItems = node.alignH;
    if (node.alignV) s.justifyContent = node.alignV;
    if (node.kind === "Text") {
      return /* @__PURE__ */ __jsx(Pressable, { style: s, onPress: () => onSelect(node.id) }, /* @__PURE__ */ __jsx(Text, { color: node.color ?? "#fff" }, node.text ?? ""), isResizing && /* @__PURE__ */ __jsx(ResizeHandle, { onBegin: () => onBeginResize(node.id) }));
    }
    if (node.kind === "Pressable") {
      return /* @__PURE__ */ __jsx(Pressable, { style: s, onPress: () => onSelect(node.id) }, /* @__PURE__ */ __jsx(Text, { color: node.color ?? "#fff" }, node.text ?? ""), isResizing && /* @__PURE__ */ __jsx(ResizeHandle, { onBegin: () => onBeginResize(node.id) }));
    }
    return /* @__PURE__ */ __jsx(Pressable, { style: s, onPress: () => onSelect(node.id) }, node.children.map((c) => /* @__PURE__ */ __jsx(
      StageNode,
      {
        key: c.id,
        node: c,
        sel,
        resizingId,
        onSelect,
        onBeginResize
      }
    )), isResizing && /* @__PURE__ */ __jsx(ResizeHandle, { onBegin: () => onBeginResize(node.id) }));
  }
  function Stage({ tree, sel, resizingId, onSelect, onBeginResize }) {
    return /* @__PURE__ */ __jsx(
      Pressable,
      {
        style: {
          width: SURFACE,
          height: SURFACE,
          backgroundColor: "#0a0a0c",
          borderWidth: 1,
          borderColor: C_BORDER,
          padding: 16,
          gap: 12,
          alignItems: "flex-start"
        },
        onPress: () => onSelect(null)
      },
      tree.map((n) => /* @__PURE__ */ __jsx(
        StageNode,
        {
          key: n.id,
          node: n,
          sel,
          resizingId,
          onSelect: (id) => onSelect(id),
          onBeginResize
        }
      ))
    );
  }
  function Layers({ tree, sel, onSelect, onMove, onDelete }) {
    const rows = [];
    function walk(ns, depth) {
      for (const n of ns) {
        const isSel = n.id === sel;
        rows.push(
          /* @__PURE__ */ __jsx(
            Pressable,
            {
              key: n.id,
              onPress: () => onSelect(n.id),
              style: {
                flexDirection: "row",
                alignItems: "center",
                paddingTop: 4,
                paddingBottom: 4,
                paddingRight: 6,
                paddingLeft: 8 + depth * 14,
                backgroundColor: isSel ? C_PANEL2 : "transparent",
                borderLeftWidth: 2,
                borderLeftColor: isSel ? C_ACCENT : "transparent"
              }
            },
            /* @__PURE__ */ __jsx(Text, { size: 11, color: isSel ? C_ACCENT : C_FG, style: { flexGrow: 1 } }, n.kind, n.text ? ` \xB7 ${truncate(n.text, 12)}` : ""),
            /* @__PURE__ */ __jsx(Pressable, { onPress: () => onMove(n.id, -1), style: { paddingLeft: 4, paddingRight: 4 } }, /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM }, "\u25B2")),
            /* @__PURE__ */ __jsx(Pressable, { onPress: () => onMove(n.id, 1), style: { paddingLeft: 4, paddingRight: 4 } }, /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM }, "\u25BC")),
            /* @__PURE__ */ __jsx(Pressable, { onPress: () => onDelete(n.id), style: { paddingLeft: 4, paddingRight: 4 } }, /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DANGER }, "\u2715"))
          )
        );
        walk(n.children, depth + 1);
      }
    }
    walk(tree, 0);
    return /* @__PURE__ */ __jsx(Col, { style: {
      width: 200,
      height: "100%",
      backgroundColor: C_PANEL,
      borderRightWidth: 1,
      borderRightColor: C_BORDER
    } }, /* @__PURE__ */ __jsx(PanelTitle, { text: "LAYERS" }), /* @__PURE__ */ __jsx(ScrollView, { style: { flexGrow: 1, height: "100%" } }, rows.length === 0 ? /* @__PURE__ */ __jsx(Text, { size: 11, color: C_DIM, style: { padding: 12 } }, "(empty \u2014 add a Box above)") : rows));
  }
  function Props({ node, onPatch }) {
    if (!node) {
      return /* @__PURE__ */ __jsx(Col, { style: {
        width: 260,
        height: "100%",
        backgroundColor: C_PANEL,
        borderLeftWidth: 1,
        borderLeftColor: C_BORDER
      } }, /* @__PURE__ */ __jsx(PanelTitle, { text: "PROPERTIES" }), /* @__PURE__ */ __jsx(Text, { size: 11, color: C_DIM, style: { padding: 12 } }, "Click any node on the surface or in the layers panel."));
    }
    const showText = node.kind === "Text" || node.kind === "Pressable";
    const showBg = node.kind === "Box" || node.kind === "Pressable";
    const showFg = node.kind === "Text" || node.kind === "Pressable";
    return /* @__PURE__ */ __jsx(Col, { key: node.id, style: {
      width: 260,
      height: "100%",
      backgroundColor: C_PANEL,
      borderLeftWidth: 1,
      borderLeftColor: C_BORDER
    } }, /* @__PURE__ */ __jsx(PanelTitle, { text: "PROPERTIES" }), /* @__PURE__ */ __jsx(ScrollView, { style: { flexGrow: 1, height: "100%" } }, /* @__PURE__ */ __jsx(Col, { style: { padding: 10, gap: 4 } }, /* @__PURE__ */ __jsx(Row, { style: { alignItems: "baseline", gap: 6 } }, /* @__PURE__ */ __jsx(Text, { size: 12, color: C_ACCENT, bold: true }, node.kind), /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM }, node.id)), showText && /* @__PURE__ */ __jsx(Fragment, null, /* @__PURE__ */ __jsx(SectionLabel, { text: "content" }), /* @__PURE__ */ __jsx(TextField, { label: "text", value: node.text ?? "", onChange: (v) => onPatch({ text: v }) })), /* @__PURE__ */ __jsx(SectionLabel, { text: "size" }), /* @__PURE__ */ __jsx(NumField, { label: "width", value: node.width ?? 0, onChange: (v) => onPatch({ width: v }) }), /* @__PURE__ */ __jsx(NumField, { label: "height", value: node.height ?? 0, onChange: (v) => onPatch({ height: v }) }), showBg && /* @__PURE__ */ __jsx(NumField, { label: "padding", value: node.padding ?? 0, onChange: (v) => onPatch({ padding: v }) }), showBg && /* @__PURE__ */ __jsx(Fragment, null, /* @__PURE__ */ __jsx(SectionLabel, { text: "align children" }), /* @__PURE__ */ __jsx(
      AlignGrid,
      {
        alignH: node.alignH,
        alignV: node.alignV,
        onChange: (h2, v) => onPatch({ alignH: h2, alignV: v })
      }
    )), showBg && /* @__PURE__ */ __jsx(Fragment, null, /* @__PURE__ */ __jsx(SectionLabel, { text: "background" }), /* @__PURE__ */ __jsx(Swatches, { value: node.bg ?? "transparent", onChange: (v) => onPatch({ bg: v }) }), /* @__PURE__ */ __jsx(HexField, { label: "hex", value: node.bg ?? "", onChange: (v) => onPatch({ bg: v }) })), showFg && /* @__PURE__ */ __jsx(Fragment, null, /* @__PURE__ */ __jsx(SectionLabel, { text: "text color" }), /* @__PURE__ */ __jsx(Swatches, { value: node.color ?? "#ffffff", onChange: (v) => onPatch({ color: v }) }), /* @__PURE__ */ __jsx(HexField, { label: "hex", value: node.color ?? "", onChange: (v) => onPatch({ color: v }) })))));
  }
  function PanelTitle({ text }) {
    return /* @__PURE__ */ __jsx(Box, { style: {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: C_BORDER
    } }, /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM, bold: true, style: { letterSpacing: 1.5 } }, text));
  }
  function SectionLabel({ text }) {
    return /* @__PURE__ */ __jsx(
      Text,
      {
        size: 10,
        color: C_DIM,
        bold: true,
        style: { letterSpacing: 1, marginTop: 10, marginBottom: 2 }
      },
      text.toUpperCase()
    );
  }
  function TextField({ label, value, onChange }) {
    return /* @__PURE__ */ __jsx(Row, { style: { alignItems: "center", gap: 8, paddingTop: 2, paddingBottom: 2 } }, /* @__PURE__ */ __jsx(Text, { size: 11, color: C_DIM, style: { width: 56 } }, label), /* @__PURE__ */ __jsx(
      TextInput,
      {
        value,
        onChangeText: onChange,
        style: {
          flexGrow: 1,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 4,
          paddingBottom: 4,
          backgroundColor: "#000",
          color: C_FG,
          borderWidth: 1,
          borderColor: C_BORDER,
          fontSize: 12
        }
      }
    ));
  }
  function NumField({ label, value, onChange }) {
    return /* @__PURE__ */ __jsx(Row, { style: { alignItems: "center", gap: 8, paddingTop: 2, paddingBottom: 2 } }, /* @__PURE__ */ __jsx(Text, { size: 11, color: C_DIM, style: { width: 56 } }, label), /* @__PURE__ */ __jsx(
      TextInput,
      {
        value: String(value),
        onChangeText: (s) => {
          const n = parseFloat(s);
          if (!isNaN(n)) onChange(n);
        },
        style: {
          flexGrow: 1,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 4,
          paddingBottom: 4,
          backgroundColor: "#000",
          color: C_FG,
          borderWidth: 1,
          borderColor: C_BORDER,
          fontSize: 12
        }
      }
    ));
  }
  function HexField({ label, value, onChange }) {
    return /* @__PURE__ */ __jsx(Row, { style: { alignItems: "center", gap: 8, paddingTop: 2, paddingBottom: 2 } }, /* @__PURE__ */ __jsx(Text, { size: 11, color: C_DIM, style: { width: 56 } }, label), /* @__PURE__ */ __jsx(
      TextInput,
      {
        value,
        onChangeText: onChange,
        style: {
          flexGrow: 1,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 4,
          paddingBottom: 4,
          backgroundColor: "#000",
          color: C_FG,
          borderWidth: 1,
          borderColor: C_BORDER,
          fontSize: 12,
          fontFamily: "mono"
        }
      }
    ));
  }
  function Swatches({ value, onChange }) {
    return /* @__PURE__ */ __jsx(Row, { style: { flexWrap: "wrap", gap: 4, paddingTop: 4, paddingBottom: 4 } }, PALETTE.map((c) => {
      const sel = c === value;
      const isTransparent = c === "transparent";
      return /* @__PURE__ */ __jsx(
        Pressable,
        {
          key: c,
          onPress: () => onChange(c),
          style: {
            width: 22,
            height: 22,
            backgroundColor: isTransparent ? "#1a1a1a" : c,
            borderWidth: sel ? 2 : 1,
            borderColor: sel ? C_ACCENT : C_BORDER,
            alignItems: "center",
            justifyContent: "center"
          }
        },
        isTransparent && /* @__PURE__ */ __jsx(Text, { size: 10, color: "#666" }, "\xD7")
      );
    }));
  }
  function AlignGrid({ alignH, alignV, onChange }) {
    const opts = ["flex-start", "center", "flex-end"];
    const cell = 28;
    const dot = 6;
    return /* @__PURE__ */ __jsx(Col, { style: { gap: 0, alignItems: "flex-start" } }, opts.map((v) => /* @__PURE__ */ __jsx(Row, { key: v, style: { gap: 0 } }, opts.map((h2) => {
      const isSel = alignH === h2 && alignV === v;
      return /* @__PURE__ */ __jsx(
        Pressable,
        {
          key: h2,
          onPress: () => isSel ? onChange(void 0, void 0) : onChange(h2, v),
          style: {
            width: cell,
            height: cell,
            borderWidth: 1,
            borderColor: isSel ? C_ACCENT : C_BORDER,
            backgroundColor: isSel ? "#0a2933" : "#0a0a0c",
            alignItems: h2,
            justifyContent: v,
            padding: 4
          }
        },
        /* @__PURE__ */ __jsx(Box, { style: {
          width: dot,
          height: dot,
          backgroundColor: isSel ? C_ACCENT : C_DIM
        } })
      );
    }))), /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM, style: { marginTop: 4 } }, alignH && alignV ? `${labelOf(alignH)} \xB7 ${labelOf(alignV)}` : "default (stretch \xB7 top)"));
  }
  function labelOf(a) {
    if (a === "flex-start") return "start";
    if (a === "flex-end") return "end";
    return "center";
  }
  function ToolBtn({ label, onPress, danger }) {
    return /* @__PURE__ */ __jsx(
      Pressable,
      {
        onPress,
        style: {
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: C_PANEL,
          borderWidth: 1,
          borderColor: danger ? C_DANGER : C_BORDER
        }
      },
      /* @__PURE__ */ __jsx(Text, { size: 11, color: danger ? C_DANGER : C_FG }, label)
    );
  }
  function Toolbar({ onAdd, onClear }) {
    return /* @__PURE__ */ __jsx(Row, { style: {
      alignItems: "center",
      height: 44,
      paddingLeft: 12,
      paddingRight: 12,
      gap: 8,
      backgroundColor: C_PANEL2,
      borderBottomWidth: 1,
      borderBottomColor: C_BORDER
    } }, /* @__PURE__ */ __jsx(Text, { size: 12, color: C_FG, bold: true, style: { letterSpacing: 1.2 } }, "COMPOSER"), /* @__PURE__ */ __jsx(Box, { style: { width: 1, height: 24, backgroundColor: C_BORDER, marginLeft: 4, marginRight: 4 } }), /* @__PURE__ */ __jsx(ToolBtn, { label: "+ Box", onPress: () => onAdd("Box") }), /* @__PURE__ */ __jsx(ToolBtn, { label: "+ Text", onPress: () => onAdd("Text") }), /* @__PURE__ */ __jsx(ToolBtn, { label: "+ Pressable", onPress: () => onAdd("Pressable") }), /* @__PURE__ */ __jsx(Box, { style: { flexGrow: 1 } }), /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM }, "click = select \xB7 double-click = drag corner to resize"), /* @__PURE__ */ __jsx(Box, { style: { width: 1, height: 24, backgroundColor: C_BORDER, marginLeft: 4, marginRight: 4 } }), /* @__PURE__ */ __jsx(ToolBtn, { label: "clear", onPress: onClear, danger: true }));
  }
  function CodePanel({
    code,
    parseError,
    onChangeText
  }) {
    return /* @__PURE__ */ __jsx(Col, { style: {
      height: 260,
      backgroundColor: "#06070a",
      borderTopWidth: 1,
      borderTopColor: C_BORDER
    } }, /* @__PURE__ */ __jsx(Row, { style: {
      alignItems: "center",
      gap: 10,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: C_BORDER
    } }, /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM, bold: true, style: { letterSpacing: 1.5 } }, "CODE"), /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DIM }, "edit, paste, or watch the canvas write it"), /* @__PURE__ */ __jsx(Box, { style: { flexGrow: 1 } }), parseError ? /* @__PURE__ */ __jsx(Text, { size: 10, color: C_DANGER, style: { fontFamily: "mono" } }, truncate(parseError, 80)) : /* @__PURE__ */ __jsx(Text, { size: 10, color: "#22c55e" }, "\u2713 parses")), /* @__PURE__ */ __jsx(
      TextArea,
      {
        value: code,
        onChangeText,
        placeholder: "<Box style={{ width: 240, height: 140, backgroundColor: '#1f2937', padding: 16 }}>\n  <Text color='#fff'>hello!</Text>\n</Box>",
        style: {
          flexGrow: 1,
          width: "100%",
          padding: 12,
          backgroundColor: "#06070a",
          color: C_FG,
          fontFamily: "mono",
          fontSize: 12
        }
      }
    ));
  }
  var host4 = globalThis;
  function readMouseX() {
    try {
      const v = Number(host4.getMouseX?.());
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }
  function readMouseY() {
    try {
      const v = Number(host4.getMouseY?.());
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }
  function readMouseDown() {
    try {
      return !!host4.getMouseDown?.();
    } catch {
      return false;
    }
  }
  function maxSizeIn(parent) {
    if (parent == null) return { w: SURFACE - 32, h: SURFACE - 32 };
    const pad = (parent.padding ?? 0) * 2;
    const w = (parent.width ?? SURFACE) - pad;
    const h2 = (parent.height ?? SURFACE) - pad;
    return { w: Math.max(20, w), h: Math.max(20, h2) };
  }
  function Composer() {
    const [tree, setTree] = React4.useState([]);
    const [codeText, setCodeText] = React4.useState("");
    const [parseError, setParseError] = React4.useState(null);
    const [sel, setSel] = React4.useState(null);
    const [resizingId, setResizingId] = React4.useState(null);
    const treeRef = React4.useRef(tree);
    treeRef.current = tree;
    const selRef = React4.useRef(sel);
    selRef.current = sel;
    const updateTree = React4.useCallback((fn) => {
      setTree((prev) => {
        const next = fn(prev);
        setCodeText(emitAll(next));
        return next;
      });
    }, []);
    const handleCodeChange = React4.useCallback((s) => {
      setCodeText(s);
      try {
        const parsed = parseAll(s);
        setTree(parsed);
        setParseError(null);
        if (selRef.current && !find(parsed, selRef.current)) {
          setSel(null);
          setResizingId(null);
        }
      } catch (e) {
        setParseError(e?.message ? String(e.message) : String(e));
      }
    }, []);
    const lastClickRef = React4.useRef({ id: "", t: 0 });
    const dragRef = React4.useRef(null);
    const frameRef = React4.useRef(null);
    const stopFrame = React4.useCallback(() => {
      if (frameRef.current == null) return;
      const cancel = host4.cancelAnimationFrame?.bind(host4);
      if (cancel) cancel(frameRef.current);
      else clearTimeout(frameRef.current);
      frameRef.current = null;
    }, []);
    const scheduleFrame = React4.useCallback((cb) => {
      const raf = host4.requestAnimationFrame?.bind(host4);
      if (raf) frameRef.current = raf(cb);
      else frameRef.current = setTimeout(cb, 16);
    }, []);
    const tick = React4.useCallback(() => {
      const d = dragRef.current;
      if (d == null) {
        stopFrame();
        return;
      }
      if (!readMouseDown()) {
        dragRef.current = null;
        stopFrame();
        return;
      }
      const mx = readMouseX();
      const my = readMouseY();
      let w = d.w0 + (mx - d.mx0);
      let h2 = d.h0 + (my - d.my0);
      w = Math.min(d.maxW, Math.max(20, w));
      h2 = Math.min(d.maxH, Math.max(20, h2));
      updateTree((prev) => patch(prev, d.id, { width: Math.round(w), height: Math.round(h2) }));
      scheduleFrame(tick);
    }, [updateTree, scheduleFrame, stopFrame]);
    const handleBeginResize = React4.useCallback((id) => {
      const t = treeRef.current;
      const node = find(t, id);
      if (!node) return;
      const parent = findParent(t, id);
      const { w: maxW, h: maxH } = maxSizeIn(parent);
      dragRef.current = {
        id,
        mx0: readMouseX(),
        my0: readMouseY(),
        w0: node.width ?? 0,
        h0: node.height ?? 0,
        maxW,
        maxH
      };
      stopFrame();
      scheduleFrame(tick);
    }, [scheduleFrame, stopFrame, tick]);
    React4.useEffect(() => () => stopFrame(), [stopFrame]);
    const handleAdd = React4.useCallback((kind) => {
      const s = selRef.current;
      const t = treeRef.current;
      const selected = s ? find(t, s) : null;
      let parent = null;
      if (selected?.kind === "Box") parent = selected;
      else if (selected) parent = findParent(t, selected.id);
      const n = defaults(kind);
      const lim = maxSizeIn(parent);
      if (n.width != null && n.width > lim.w) n.width = lim.w;
      if (n.height != null && n.height > lim.h) n.height = lim.h;
      updateTree((prev) => add(prev, parent?.id ?? null, n));
      setSel(n.id);
      setResizingId(null);
    }, [updateTree]);
    const handlePatch = React4.useCallback((p) => {
      const id = selRef.current;
      if (!id) return;
      updateTree((prev) => patch(prev, id, p));
    }, [updateTree]);
    const handleSelect = React4.useCallback((id) => {
      if (id == null) {
        setSel(null);
        setResizingId(null);
        lastClickRef.current = { id: "", t: 0 };
        return;
      }
      const now = host4.performance?.now?.() ?? Date.now();
      const last = lastClickRef.current;
      const isDouble = last.id === id && now - last.t < 400;
      lastClickRef.current = { id, t: now };
      setSel(id);
      if (isDouble) setResizingId(id);
      else if (resizingId !== null && resizingId !== id) setResizingId(null);
    }, [resizingId]);
    const handleMove = React4.useCallback((id, d) => {
      updateTree((prev) => move(prev, id, d));
    }, [updateTree]);
    const handleDelete = React4.useCallback((id) => {
      updateTree((prev) => remove(prev, id));
      if (selRef.current === id) setSel(null);
      if (resizingId === id) setResizingId(null);
    }, [updateTree, resizingId]);
    const handleClear = React4.useCallback(() => {
      setTree([]);
      setCodeText("");
      setParseError(null);
      setSel(null);
      setResizingId(null);
    }, []);
    const selNode = sel ? find(tree, sel) : null;
    return /* @__PURE__ */ __jsx(Col, { style: { width: "100%", height: "100%", backgroundColor: C_BG } }, /* @__PURE__ */ __jsx(Toolbar, { onAdd: handleAdd, onClear: handleClear }), /* @__PURE__ */ __jsx(Row, { style: { flexGrow: 1 } }, /* @__PURE__ */ __jsx(
      Layers,
      {
        tree,
        sel,
        onSelect: handleSelect,
        onMove: handleMove,
        onDelete: handleDelete
      }
    ), /* @__PURE__ */ __jsx(Box, { style: { flexGrow: 1, backgroundColor: C_BG } }, /* @__PURE__ */ __jsx(ScrollView, { style: { flexGrow: 1, width: "100%", height: "100%" } }, /* @__PURE__ */ __jsx(Box, { style: { padding: 20, alignItems: "flex-start" } }, /* @__PURE__ */ __jsx(
      Stage,
      {
        tree,
        sel,
        resizingId,
        onSelect: handleSelect,
        onBeginResize: handleBeginResize
      }
    )))), /* @__PURE__ */ __jsx(Props, { node: selNode, onPatch: handlePatch })), /* @__PURE__ */ __jsx(CodePanel, { code: codeText, parseError, onChangeText: handleCodeChange }));
  }

  // runtime/cartridge_entry.tsx
  var g = globalThis;
  var slot = g.__cartridgeLoadSlot;
  if (slot && typeof slot === "object") {
    slot.App = Composer;
  } else {
    g.__lastCartridge = Composer;
  }
})();
