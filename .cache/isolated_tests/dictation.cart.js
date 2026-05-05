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
        const React4 = require_react();
        const hotId = React4.useId();
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
        const React4 = require_react();
        const id = React4.useId();
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

  // cart/app/isolated_tests/dictation.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react3 = __toESM(require_react());
  init_primitives();

  // runtime/hooks/useEnsembleTranscript.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react2 = __toESM(require_react(), 1);

  // runtime/hooks/useVoiceInput.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react = __toESM(require_react(), 1);
  var subs = {
    level: /* @__PURE__ */ new Set(),
    vadFrame: /* @__PURE__ */ new Set(),
    speechStart: /* @__PURE__ */ new Set(),
    speechEnd: /* @__PURE__ */ new Set(),
    previewReady: /* @__PURE__ */ new Set(),
    transcript: /* @__PURE__ */ new Set()
  };
  function emit(set, payload) {
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (e) {
        console.error("[voice] handler error:", e?.message || e);
      }
    }
  }
  var G = globalThis;
  if (!G.__voice_handlers_installed) {
    G.__voice_handlers_installed = true;
    G.__voice_onLevel = (rms_x100, vad_verdict) => {
      emit(subs.level, Math.max(0, Math.min(1, rms_x100 / 1e4)));
      emit(subs.vadFrame, (vad_verdict ?? 0) === 1 ? 1 : 0);
    };
    G.__voice_onSpeechStart = () => emit(subs.speechStart);
    G.__voice_onSpeechEnd = (id, lenSamples) => {
      emit(subs.speechEnd, { id, lenSamples, durationMs: lenSamples / 16e3 * 1e3 });
    };
    G.__voice_onPreviewReady = (id, lenSamples) => {
      emit(subs.previewReady, { id, lenSamples, durationMs: lenSamples / 16e3 * 1e3 });
    };
    G.__voice_onTranscript = (text) => emit(subs.transcript, text);
  }
  function subscribePreview(fn) {
    const wrapper = (v) => fn(v);
    subs.previewReady.add(wrapper);
    return () => {
      subs.previewReady.delete(wrapper);
    };
  }
  function subscribeSpeechStart(fn) {
    const wrapper = () => fn();
    subs.speechStart.add(wrapper);
    return () => {
      subs.speechStart.delete(wrapper);
    };
  }
  function useVoiceInput(opts = {}) {
    const [isListening, setListening] = (0, import_react.useState)(false);
    const [isSpeaking, setSpeaking] = (0, import_react.useState)(false);
    const [vadFrame, setVadFrame] = (0, import_react.useState)(0);
    const [level, setLevel] = (0, import_react.useState)(0);
    const [transcript, setTranscript] = (0, import_react.useState)("");
    const [utterance, setUtterance] = (0, import_react.useState)({ id: 0, ms: 0 });
    const autoRelease = opts.autoRelease !== false;
    const autoReleaseRef = (0, import_react.useRef)(autoRelease);
    autoReleaseRef.current = autoRelease;
    (0, import_react.useEffect)(() => {
      const fn = G.__voice_set_mode;
      if (typeof fn === "function") fn(opts.mode ?? 2);
    }, [opts.mode]);
    (0, import_react.useEffect)(() => {
      const fn = G.__voice_set_floor;
      if (typeof fn !== "function") return;
      const f = Math.max(0, Math.min(1, opts.floor ?? 0));
      fn(Math.round(f * 1e4));
    }, [opts.floor]);
    (0, import_react.useEffect)(() => {
      if (opts.previewStrideMs === void 0) return;
      const fn = G.__voice_set_preview_stride_ms;
      if (typeof fn !== "function") return;
      fn(Math.max(0, Math.round(opts.previewStrideMs)));
    }, [opts.previewStrideMs]);
    (0, import_react.useEffect)(() => {
      const onLevel = (v) => setLevel(v);
      const onVadFrame = (v) => setVadFrame(v ? 1 : 0);
      const onSpeechStart = () => setSpeaking(true);
      const onSpeechEnd = (e) => {
        setSpeaking(false);
        setUtterance({ id: e.id, ms: e.durationMs });
        if (autoReleaseRef.current) {
          const rel = G.__voice_release_buffer;
          if (typeof rel === "function") rel(e.id);
        }
      };
      const onTranscript = (text) => setTranscript(String(text ?? ""));
      subs.level.add(onLevel);
      subs.vadFrame.add(onVadFrame);
      subs.speechStart.add(onSpeechStart);
      subs.speechEnd.add(onSpeechEnd);
      subs.transcript.add(onTranscript);
      return () => {
        subs.level.delete(onLevel);
        subs.vadFrame.delete(onVadFrame);
        subs.speechStart.delete(onSpeechStart);
        subs.speechEnd.delete(onSpeechEnd);
        subs.transcript.delete(onTranscript);
      };
    }, []);
    const start = (0, import_react.useCallback)(() => {
      const fn = G.__voice_start;
      if (typeof fn !== "function") {
        console.warn("[voice] __voice_start missing \u2014 was -Dhas-voice=true set?");
        return false;
      }
      const ok = !!fn();
      if (ok) setListening(true);
      return ok;
    }, []);
    const stop = (0, import_react.useCallback)(() => {
      const fn = G.__voice_stop;
      if (typeof fn === "function") fn();
      setListening(false);
      setSpeaking(false);
      setLevel(0);
    }, []);
    return {
      isListening,
      isSpeaking,
      vadFrame,
      level,
      transcript,
      utteranceId: utterance.id,
      utteranceMs: utterance.ms,
      start,
      stop
    };
  }

  // runtime/hooks/whisper.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var G2 = globalThis;
  var pending = /* @__PURE__ */ new Map();
  if (!G2.__whisper_handlers_installed) {
    G2.__whisper_handlers_installed = true;
    G2.__whisper_onResult = (json) => {
      let r2;
      try {
        const o = JSON.parse(json);
        r2 = {
          bufId: Number(o.buf_id) || 0,
          model: String(o.model ?? ""),
          text: String(o.text ?? ""),
          elapsedMs: Number(o.elapsed_ms) || 0,
          success: !!o.success
        };
      } catch {
        return;
      }
      const resolve = pending.get(r2.bufId);
      if (resolve) {
        pending.delete(r2.bufId);
        resolve(r2);
      }
    };
  }
  function transcribe(bufId, modelPath2) {
    return new Promise((resolve, reject) => {
      const fn = G2.__whisper_transcribe;
      if (typeof fn !== "function") {
        reject(new Error("__whisper_transcribe missing \u2014 was -Dhas-whisper=true set?"));
        return;
      }
      pending.set(bufId, resolve);
      const ok = fn(bufId, modelPath2);
      if (!ok) {
        pending.delete(bufId);
        reject(new Error(`whisper.transcribe(${bufId}) refused \u2014 buffer missing or queue full`));
      }
    });
  }

  // runtime/hooks/useEnsembleTranscript.ts
  function tokenize(text) {
    return text.toLowerCase().replace(/[^\w\s']/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  }
  function pickAnchor(tokens) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < tokens.length; i++) {
      let score = 0;
      for (let j = 0; j < tokens.length; j++) {
        if (i === j) continue;
        const setJ = new Set(tokens[j]);
        for (const w of tokens[i]) if (setJ.has(w)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
  var ANCHOR_WINDOW = 2;
  function voteOnAnchor(anchor, others, anchorName) {
    return anchor.map((word, i) => {
      const candMap = /* @__PURE__ */ new Map();
      candMap.set(word, [anchorName]);
      const sources = [anchorName];
      for (const t of others) {
        const lo = Math.max(0, i - ANCHOR_WINDOW);
        const hi = Math.min(t.words.length, i + ANCHOR_WINDOW + 1);
        let matched = null;
        for (let j = lo; j < hi; j++) {
          if (t.words[j] === word) {
            matched = t.words[j];
            break;
          }
        }
        if (matched !== null) {
          sources.push(t.name);
          const list = candMap.get(matched) || [];
          if (!list.includes(t.name)) list.push(t.name);
          candMap.set(matched, list);
        } else {
          const alt = t.words[i] ?? t.words[Math.min(i, t.words.length - 1)];
          if (alt) {
            const list = candMap.get(alt) || [];
            if (!list.includes(t.name)) list.push(t.name);
            candMap.set(alt, list);
          }
        }
      }
      const candidates = Array.from(candMap.entries()).map(([w, src]) => ({ word: w, sources: src })).sort((a, b) => b.sources.length - a.sources.length);
      return { word, votes: sources.length, sources, candidates };
    });
  }
  function ensembleVote(transcripts) {
    if (transcripts.length === 0) return null;
    const tok = transcripts.map((t) => ({ name: t.name, words: tokenize(t.text) }));
    if (tok.every((t) => t.words.length === 0)) return null;
    if (tok.length === 1) {
      return {
        words: tok[0].words.map((word) => ({
          word,
          votes: 1,
          sources: [tok[0].name],
          candidates: [{ word, sources: [tok[0].name] }]
        })),
        anchor: tok[0].name,
        modelCount: 1
      };
    }
    const anchorIdx = pickAnchor(tok.map((t) => t.words));
    const anchor = tok[anchorIdx];
    const others = tok.filter((_, i) => i !== anchorIdx);
    return {
      words: voteOnAnchor(anchor.words, others, anchor.name),
      anchor: anchor.name,
      modelCount: tok.length
    };
  }
  function useEnsembleTranscript(opts) {
    const { models, escalateTo, escalationThreshold, livePreviewModel, ...voiceOpts } = opts;
    const v = useVoiceInput({ ...voiceOpts, autoRelease: false });
    const livePreviewResolved = livePreviewModel === null ? null : livePreviewModel ?? (models[0] ?? null);
    const [partial, setPartial] = (0, import_react2.useState)("");
    const [individual, setIndividual] = (0, import_react2.useState)({});
    const [ensemble, setEnsemble] = (0, import_react2.useState)(null);
    const [isProcessing, setProcessing] = (0, import_react2.useState)(false);
    const [isEscalating, setEscalating] = (0, import_react2.useState)(false);
    const [escalatedWith, setEscalatedWith] = (0, import_react2.useState)([]);
    const [livePreview, setLivePreview] = (0, import_react2.useState)("");
    const lastIdRef = (0, import_react2.useRef)(0);
    const modelsRef = (0, import_react2.useRef)(models);
    modelsRef.current = models;
    const escalateRef = (0, import_react2.useRef)(escalateTo);
    escalateRef.current = escalateTo;
    const thresholdRef = (0, import_react2.useRef)(escalationThreshold ?? 2);
    thresholdRef.current = escalationThreshold ?? 2;
    const liveModelRef = (0, import_react2.useRef)(livePreviewResolved);
    liveModelRef.current = livePreviewResolved;
    const previewBusyRef = (0, import_react2.useRef)(false);
    const previewGenRef = (0, import_react2.useRef)(0);
    (0, import_react2.useEffect)(() => {
      if (v.utteranceId === 0 || v.utteranceId === lastIdRef.current) return;
      lastIdRef.current = v.utteranceId;
      const id = v.utteranceId;
      const selected = modelsRef.current.slice();
      const escalation = (escalateRef.current ?? []).slice();
      const threshold = thresholdRef.current;
      setPartial("");
      setIndividual({});
      setEnsemble(null);
      setProcessing(true);
      setEscalating(false);
      setEscalatedWith([]);
      (async () => {
        const G3 = globalThis;
        const collected = [];
        for (let i = 0; i < selected.length; i++) {
          const m = selected[i];
          try {
            const r2 = await transcribe(id, m.path);
            const text = (r2.text || "").trim();
            collected.push({ name: m.name, text });
            if (i === 0) setPartial(text);
            setIndividual((prev) => ({ ...prev, [m.name]: text }));
            setEnsemble(ensembleVote(collected));
          } catch (e) {
            setIndividual((prev) => ({ ...prev, [m.name]: `(error: ${String(e?.message ?? e)})` }));
          }
        }
        if (escalation.length > 0) {
          const baseEnsemble = ensembleVote(collected);
          const anyLow = baseEnsemble && baseEnsemble.words.some((w) => w.votes < threshold);
          if (anyLow) {
            setEscalating(true);
            for (const m of escalation) {
              try {
                const r2 = await transcribe(id, m.path);
                const text = (r2.text || "").trim();
                collected.push({ name: m.name, text });
                setIndividual((prev) => ({ ...prev, [m.name]: text }));
                setEscalatedWith((prev) => [...prev, m.name]);
                setEnsemble(ensembleVote(collected));
                const updated = ensembleVote(collected);
                if (updated && updated.words.every((w) => w.votes >= threshold)) {
                  break;
                }
              } catch (e) {
                setIndividual((prev) => ({
                  ...prev,
                  [m.name]: `(error: ${String(e?.message ?? e)})`
                }));
              }
            }
            setEscalating(false);
          }
        }
        const rel = G3.__voice_release_buffer;
        if (typeof rel === "function") rel(id);
        setProcessing(false);
      })();
    }, [v.utteranceId]);
    (0, import_react2.useEffect)(() => {
      if (liveModelRef.current === null) return;
      const G3 = globalThis;
      const offStart = subscribeSpeechStart(() => {
        previewGenRef.current += 1;
        setLivePreview("");
      });
      const offPreview = subscribePreview(({ id }) => {
        const liveModel = liveModelRef.current;
        if (liveModel === null) {
          const rel = G3.__voice_release_buffer;
          if (typeof rel === "function") rel(id);
          return;
        }
        if (previewBusyRef.current) {
          const rel = G3.__voice_release_buffer;
          if (typeof rel === "function") rel(id);
          return;
        }
        previewBusyRef.current = true;
        const myGen = previewGenRef.current;
        transcribe(id, liveModel.path).then((r2) => {
          if (myGen === previewGenRef.current) {
            const text = (r2.text || "").trim();
            if (text) setLivePreview(text);
          }
        }).catch(() => {
        }).finally(() => {
          const rel = G3.__voice_release_buffer;
          if (typeof rel === "function") rel(id);
          previewBusyRef.current = false;
        });
      });
      return () => {
        offStart();
        offPreview();
      };
    }, [livePreviewResolved?.path ?? ""]);
    return {
      partial,
      individual,
      ensemble,
      isProcessing,
      isEscalating,
      escalatedWith,
      livePreview,
      livePreviewModelName: livePreviewResolved?.name ?? "",
      isListening: v.isListening,
      isSpeaking: v.isSpeaking,
      level: v.level,
      utteranceId: v.utteranceId,
      utteranceMs: v.utteranceMs,
      start: v.start,
      stop: v.stop
    };
  }

  // cart/app/isolated_tests/dictation.tsx
  init_fs();

  // runtime/hooks/http.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_ffi();
  var _dlSeq = 1;
  function download(opts) {
    return new Promise((resolve, reject) => {
      const rid = `d${_dlSeq++}`;
      const unsubProgress = subscribe2(`http-download-progress:${rid}`, (raw) => {
        if (!opts.onProgress) return;
        try {
          const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
          opts.onProgress({ bytes: Number(obj.d) || 0, total: Number(obj.t) || 0 });
        } catch {
        }
      });
      const unsubEnd = subscribe2(`http-download-end:${rid}`, (raw) => {
        unsubProgress();
        unsubEnd();
        let obj = {};
        try {
          obj = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
        }
        if (typeof obj.error === "string") {
          reject(new Error(obj.error));
          return;
        }
        const status = Number(obj.status) || 0;
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status}`));
          return;
        }
        resolve({ status });
      });
      const spec = JSON.stringify({
        method: "GET",
        url: opts.url,
        headers: opts.headers ?? {}
      });
      callHost("__http_download_to_file", void 0, spec, opts.destPath, rid);
    });
  }

  // runtime/hooks/process.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_ffi();

  // runtime/hooks/ifttt-registry.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var _sources = /* @__PURE__ */ new Map();
  var _actions = /* @__PURE__ */ new Map();
  function registerIfttSource(prefix, src) {
    _sources.set(prefix, src);
  }
  function registerIfttAction(prefix, run) {
    _actions.set(prefix, run);
  }

  // runtime/hooks/process.ts
  function spawn(opts) {
    return callHost("__proc_spawn", 0, JSON.stringify(opts));
  }
  function kill(pid, signal = "SIGTERM") {
    return callHost("__proc_kill", false, pid, signal);
  }
  function stdinWrite(pid, data) {
    return callHost("__proc_stdin_write", false, pid, data);
  }
  function envGet(name) {
    return callHost("__env_get", null, name);
  }
  var _watchRefs = /* @__PURE__ */ new Map();
  function watchProcess(pid, intervalMs = 500) {
    const cur = _watchRefs.get(pid) ?? 0;
    _watchRefs.set(pid, cur + 1);
    if (cur === 0) {
      callHost("__proc_watch_add", void 0, pid, Math.max(100, intervalMs | 0));
    }
    return () => {
      const n = (_watchRefs.get(pid) ?? 1) - 1;
      if (n <= 0) {
        _watchRefs.delete(pid);
        callHost("__proc_watch_remove", void 0, pid);
      } else {
        _watchRefs.set(pid, n);
      }
    };
  }
  function parsePayload(raw) {
    if (typeof raw !== "string") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  registerIfttSource("proc:line:", {
    match(spec) {
      if (!spec.startsWith("proc:line:")) return null;
      const rest = spec.slice("proc:line:".length);
      const colon = rest.indexOf(":");
      if (colon < 0) return null;
      const pid = rest.slice(0, colon);
      const pattern = rest.slice(colon + 1);
      let re;
      try {
        re = new RegExp(pattern);
      } catch {
        console.warn(`[ifttt] bad regex in '${spec}'`);
        return null;
      }
      return {
        subscribe(onFire) {
          return subscribe2(`proc:stdout:${pid}`, (line) => {
            const s = typeof line === "string" ? line : String(line);
            const m = re.exec(s);
            if (m) onFire({ pid: Number(pid), line: s, match: m });
          });
        }
      };
    }
  });
  registerIfttAction("proc:spawn:", (rest, _payload) => {
    if (!rest) return;
    spawn({ cmd: rest });
  });
  registerIfttAction("proc:kill:", (rest, _payload) => {
    const pid = Number(rest);
    if (!pid || pid <= 0) return;
    kill(pid, "SIGTERM");
  });
  registerIfttAction("proc:write:", (rest, _payload) => {
    const colon = rest.indexOf(":");
    if (colon < 0) return;
    const pid = Number(rest.slice(0, colon));
    const text = rest.slice(colon + 1);
    if (!pid || pid <= 0) return;
    stdinWrite(pid, text);
  });
  function parseRamThreshold(s) {
    const m = /^(\d+(?:\.\d+)?)(%|B|KB|MB|GB)?$/i.exec(s);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    const unit = (m[2] || "").toUpperCase();
    switch (unit) {
      case "":
        return { kind: "frac", value: n };
      case "%":
        return { kind: "frac", value: n / 100 };
      case "B":
        return { kind: "bytes", value: n };
      case "KB":
        return { kind: "bytes", value: n * 1024 };
      case "MB":
        return { kind: "bytes", value: n * 1024 * 1024 };
      case "GB":
        return { kind: "bytes", value: n * 1024 * 1024 * 1024 };
    }
    return null;
  }
  registerIfttSource("proc:ram:", {
    match(spec) {
      const rest = spec.slice("proc:ram:".length);
      const m = /^(\d+)(?::([<>]):(.+))?$/.exec(rest);
      if (!m) return null;
      const pid = Number(m[1]);
      const op = m[2];
      const threshold = m[3] != null ? parseRamThreshold(m[3]) : null;
      if (m[3] != null && !threshold) {
        console.warn(`[ifttt] bad proc:ram threshold '${m[3]}' in '${spec}'`);
        return null;
      }
      return {
        subscribe(onFire) {
          const release = watchProcess(pid);
          const off = subscribe2(`proc:ram:${pid}`, (raw) => {
            const payload = parsePayload(raw);
            if (threshold && op) {
              const sampled = threshold.kind === "frac" ? Number(payload?.percent ?? 0) : Number(payload?.rss ?? 0);
              if (op === ">" && !(sampled > threshold.value)) return;
              if (op === "<" && !(sampled < threshold.value)) return;
            }
            onFire(payload);
          });
          return () => {
            off();
            release();
          };
        }
      };
    }
  });
  registerIfttSource("proc:cpu:", {
    match(spec) {
      const rest = spec.slice("proc:cpu:".length);
      if (!/^\d+$/.test(rest)) return null;
      const pid = Number(rest);
      return {
        subscribe(onFire) {
          const release = watchProcess(pid);
          const off = subscribe2(`proc:cpu:${pid}`, (raw) => onFire(parsePayload(raw)));
          return () => {
            off();
            release();
          };
        }
      };
    }
  });
  registerIfttSource("proc:idle:", {
    match(spec) {
      const rest = spec.slice("proc:idle:".length);
      const m = /^(\d+):(\d+)$/.exec(rest);
      if (!m) return null;
      const pid = Number(m[1]);
      const idleMs = Number(m[2]);
      if (!pid || idleMs <= 0) return null;
      return {
        subscribe(onFire) {
          const release = watchProcess(pid);
          let timer = null;
          const arm = () => {
            if (timer != null) clearTimeout(timer);
            timer = setTimeout(() => {
              timer = null;
              onFire({ pid, id: pid, idleMs, at: Date.now() });
            }, idleMs);
          };
          arm();
          const offCpu = subscribe2(`proc:cpu:${pid}`, arm);
          const offOut = subscribe2(`proc:stdout:${pid}`, arm);
          const offErr = subscribe2(`proc:stderr:${pid}`, arm);
          return () => {
            if (timer != null) {
              clearTimeout(timer);
              timer = null;
            }
            offCpu();
            offOut();
            offErr();
            release();
          };
        }
      };
    }
  });

  // cart/app/isolated_tests/dictation.tsx
  var C = {
    bg: "#08090d",
    surface: "#11141d",
    surfaceHi: "#181c28",
    border: "#222637",
    text: "#e7eaf3",
    dim: "#7a8294",
    amp: "#7dd3fc",
    vad: "#22c55e",
    hot: "#fb7185",
    warn: "#fbbf24"
  };
  var SHADES = ["#475569", "#94a3b8", "#cbd5e1", "#f8fafc"];
  function consensusColor(votes, max) {
    const ratio = votes / max;
    if (ratio >= 0.99) return "#f8fafc";
    if (ratio >= 0.66) return "#cbd5e1";
    if (ratio >= 0.5) return "#fbbf24";
    return "#fb7185";
  }
  function EnsembleWordView({
    word,
    votes,
    candidates,
    max,
    fontSize = 18
  }) {
    const color = consensusColor(votes, max);
    const isLow = votes < max;
    const losers = candidates.filter((c) => c.word !== word);
    const showAlts = isLow && losers.length > 0;
    return /* @__PURE__ */ __jsx(Row, { style: { alignItems: "baseline", gap: 4 } }, /* @__PURE__ */ __jsx(Text, { fontSize, color }, word), showAlts && /* @__PURE__ */ __jsx(Row, { style: { alignItems: "baseline", gap: 2 } }, /* @__PURE__ */ __jsx(Text, { fontSize: Math.max(10, fontSize - 8), color: C.dim }, "("), losers.map((c, i) => /* @__PURE__ */ __jsx(Row, { key: c.word + i, style: { alignItems: "baseline" } }, i > 0 && /* @__PURE__ */ __jsx(Text, { fontSize: Math.max(10, fontSize - 8), color: C.dim }, "|"), /* @__PURE__ */ __jsx(Text, { fontSize: Math.max(10, fontSize - 8), color: C.dim }, c.word))), /* @__PURE__ */ __jsx(Text, { fontSize: Math.max(10, fontSize - 8), color: C.dim }, ")")));
  }
  var HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
  var MODEL_REGISTRY = [
    { name: "tiny", filename: "ggml-tiny.en-q5_1.bin", approxBytes: 31 * 1024 * 1024 },
    { name: "base", filename: "ggml-base.en-q5_1.bin", approxBytes: 58 * 1024 * 1024 },
    { name: "small", filename: "ggml-small.en-q5_1.bin", approxBytes: 190 * 1024 * 1024 },
    { name: "medium", filename: "ggml-medium.en-q5_0.bin", approxBytes: 514 * 1024 * 1024 }
  ];
  var BASE_TIER = ["tiny", "base", "small"];
  var ESCALATION_TIER = ["medium"];
  function modelPath(name) {
    const def = MODEL_REGISTRY.find((m) => m.name === name);
    return `~/.reactjit/models/${def.filename}`;
  }
  function modelUrl(name) {
    const def = MODEL_REGISTRY.find((m) => m.name === name);
    return `${HF_BASE}/${def.filename}`;
  }
  var MODELS = BASE_TIER.map((name) => ({ name, path: modelPath(name) }));
  var ESCALATION = ESCALATION_TIER.map((name) => ({ name, path: modelPath(name) }));
  function expandHome(p) {
    if (!p.startsWith("~/")) return p;
    const home = envGet("HOME") ?? "";
    return home + p.slice(1);
  }
  function DownloadGate({ onReady }) {
    const allModels = [...MODELS, ...ESCALATION];
    const [missing, setMissing] = (0, import_react3.useState)(null);
    const [progress, setProgress] = (0, import_react3.useState)({});
    const [running, setRunning] = (0, import_react3.useState)(false);
    (0, import_react3.useEffect)(() => {
      const missList = allModels.filter((m) => !exists(expandHome(m.path)));
      setMissing(missList);
      if (missList.length === 0) onReady();
    }, []);
    if (missing === null) {
      return /* @__PURE__ */ __jsx(Col, { style: { width: "100%", height: "100%", backgroundColor: C.bg, padding: 18, justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 12, color: C.dim }, "checking models\u2026"));
    }
    const totalApprox = missing.reduce((s, m) => {
      const def = MODEL_REGISTRY.find((d) => d.name === m.name);
      return s + (def?.approxBytes ?? 0);
    }, 0);
    const startDownload = async () => {
      setRunning(true);
      mkdir(expandHome("~/.reactjit/models"));
      for (const m of missing) {
        const url = modelUrl(m.name);
        const dest = expandHome(m.path);
        setProgress((prev) => ({ ...prev, [m.name]: { bytes: 0, total: 0, done: false } }));
        try {
          await download({
            url,
            destPath: dest,
            onProgress: ({ bytes, total }) => {
              setProgress((prev) => ({ ...prev, [m.name]: { bytes, total, done: false } }));
            }
          });
          setProgress((prev) => ({ ...prev, [m.name]: { ...prev[m.name], done: true } }));
        } catch (e) {
          setProgress((prev) => ({
            ...prev,
            [m.name]: { ...prev[m.name], done: false, err: String(e?.message ?? e) }
          }));
        }
      }
      const stillMissing = allModels.filter((m) => !exists(expandHome(m.path)));
      if (stillMissing.length === 0) {
        onReady();
      } else {
        setMissing(stillMissing);
        setRunning(false);
      }
    };
    const fmtMb = (n) => `${(n / 1024 / 1024).toFixed(0)} MB`;
    return /* @__PURE__ */ __jsx(Col, { style: { width: "100%", height: "100%", backgroundColor: C.bg, padding: 24, gap: 18 } }, /* @__PURE__ */ __jsx(Col, { style: { gap: 6 } }, /* @__PURE__ */ __jsx(Text, { fontSize: 20, color: C.text }, "Whisper models needed"), /* @__PURE__ */ __jsx(Text, { fontSize: 12, color: C.dim }, "Voice-to-text uses local whisper.cpp models. ", missing.length, " of ", allModels.length, " aren't on disk yet. They live in ~/.reactjit/models/ and only need to be fetched once.")), /* @__PURE__ */ __jsx(Col, { style: {
      gap: 10,
      padding: 16,
      backgroundColor: C.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border
    } }, missing.map((m) => {
      const def = MODEL_REGISTRY.find((d) => d.name === m.name);
      const p = progress[m.name];
      const ratio = p && p.total > 0 ? p.bytes / p.total : p ? Math.min(1, p.bytes / def.approxBytes) : 0;
      return /* @__PURE__ */ __jsx(Col, { key: m.name, style: { gap: 4 } }, /* @__PURE__ */ __jsx(Row, { style: { gap: 8, alignItems: "baseline" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 13, color: C.text, style: { width: 80 } }, m.name), /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim, style: { width: 80 } }, fmtMb(def.approxBytes)), p?.err && /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.hot }, p.err), p?.done && /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.vad }, "done"), p && !p.done && !p.err && /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim }, `${fmtMb(p.bytes)}${p.total > 0 ? ` / ${fmtMb(p.total)}` : ""}`)), /* @__PURE__ */ __jsx(Box, { style: { height: 6, backgroundColor: C.surfaceHi, borderRadius: 3, overflow: "hidden" } }, /* @__PURE__ */ __jsx(Box, { style: {
        height: 6,
        width: `${Math.round(ratio * 100)}%`,
        backgroundColor: p?.done ? C.vad : p?.err ? C.hot : C.amp
      } })));
    })), /* @__PURE__ */ __jsx(
      Pressable,
      {
        onPress: startDownload,
        disabled: running,
        style: {
          height: 48,
          borderRadius: 8,
          backgroundColor: running ? C.surfaceHi : C.amp,
          borderWidth: 1,
          borderColor: running ? C.border : C.amp,
          justifyContent: "center",
          alignItems: "center",
          opacity: running ? 0.6 : 1
        }
      },
      /* @__PURE__ */ __jsx(Text, { fontSize: 13, color: running ? C.dim : "#0b1220" }, running ? "downloading\u2026" : `download ${missing.length} model${missing.length === 1 ? "" : "s"} (~${fmtMb(totalApprox)})`)
    ), /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim }, "Source: huggingface.co/ggerganov/whisper.cpp \xB7 once downloaded, this prompt won't appear again."));
  }
  function DictationCore() {
    const [armed, setArmed] = (0, import_react3.useState)(false);
    const [history, setHistory] = (0, import_react3.useState)([]);
    const e = useEnsembleTranscript({
      models: MODELS,
      escalateTo: ESCALATION,
      escalationThreshold: 2,
      mode: 1,
      floor: 0.333,
      // Live preview: while the user is mid-utterance, the Zig side fires a
      // snapshot every previewStrideMs into a stable buffer; we feed it to
      // base.en for a "watch it transcribe as I talk" UX. tiny is faster
      // (no swap penalty when the ensemble starts) but base picks up
      // punctuation and is what the user wants to see live.
      livePreviewModel: { name: "base", path: modelPath("base") },
      previewStrideMs: 1500
    });
    (0, import_react3.useEffect)(() => {
      if (e.isProcessing) return;
      if (!e.ensemble) return;
      if (e.utteranceId === 0) return;
      if (history.some((h2) => h2.id === e.utteranceId)) return;
      setHistory((prev) => [{
        id: e.utteranceId,
        ms: e.utteranceMs,
        individual: { ...e.individual },
        ensembleWords: e.ensemble.words.slice(),
        anchor: e.ensemble.anchor,
        modelCount: e.ensemble.modelCount,
        escalatedWith: e.escalatedWith.slice()
      }, ...prev].slice(0, 6));
    }, [e.isProcessing, e.utteranceId]);
    return /* @__PURE__ */ __jsx(Col, { style: { width: "100%", height: "100%", backgroundColor: C.bg, padding: 18, gap: 14 } }, /* @__PURE__ */ __jsx(Col, { style: { gap: 4 } }, /* @__PURE__ */ __jsx(Text, { fontSize: 18, color: C.text }, "Dictation \u2014 3-model ensemble"), /* @__PURE__ */ __jsx(Text, { fontSize: 11, color: C.dim }, "Speak a phrase. tiny lays down a fast preview, then base and small vote on each word. Brighter words = more model agreement. Dim words mean only one model produced them.")), /* @__PURE__ */ __jsx(
      Pressable,
      {
        onPress: () => {
          if (armed) e.stop();
          else e.start();
          setArmed((x) => !x);
        },
        style: {
          height: 48,
          borderRadius: 8,
          backgroundColor: armed ? C.vad : C.surfaceHi,
          borderWidth: 1,
          borderColor: armed ? C.vad : C.border,
          justifyContent: "center",
          alignItems: "center"
        }
      },
      /* @__PURE__ */ __jsx(Text, { fontSize: 13, color: armed ? "#0b1220" : C.text }, armed ? "\u25C9 listening \u2014 speak, then pause" : "\u25CB tap to start dictating")
    ), /* @__PURE__ */ __jsx(Row, { style: { gap: 8, alignItems: "center" } }, /* @__PURE__ */ __jsx(Box, { style: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: e.isSpeaking ? C.vad : C.surfaceHi,
      borderWidth: 1,
      borderColor: e.isSpeaking ? C.vad : C.border
    } }, /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: e.isSpeaking ? "#0b1220" : C.dim }, e.isSpeaking ? "speaking" : "silent")), e.isProcessing && !e.isEscalating && /* @__PURE__ */ __jsx(Box, { style: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: C.warn,
      borderWidth: 1,
      borderColor: C.warn
    } }, /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: "#0b1220" }, "transcribing\u2026")), e.isEscalating && /* @__PURE__ */ __jsx(Box, { style: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: C.hot,
      borderWidth: 1,
      borderColor: C.hot
    } }, /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: "#0b1220" }, "\u2191 escalating to medium")), e.escalatedWith.length > 0 && !e.isProcessing && /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim }, `(escalated: ${e.escalatedWith.join(", ")})`), /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim }, `level=${e.level.toFixed(2)}`)), /* @__PURE__ */ __jsx(Col, { style: {
      gap: 10,
      padding: 16,
      backgroundColor: C.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      minHeight: 110
    } }, /* @__PURE__ */ __jsx(Row, { style: { gap: 8, alignItems: "baseline" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim }, "live"), e.isSpeaking && e.livePreview && /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: C.amp }, `\u25C9 ${e.livePreviewModelName} preview`)), e.isSpeaking && e.livePreview && !e.ensemble ? (
      // Mid-utterance, base has produced a chunk: show it in amber so
      // the user knows it's a preview, not the final answer.
      /* @__PURE__ */ __jsx(Text, { fontSize: 18, color: C.warn }, e.livePreview)
    ) : e.ensemble ? /* @__PURE__ */ __jsx(Row, { style: { flexWrap: "wrap", gap: 8 } }, e.ensemble.words.map((w, i) => /* @__PURE__ */ __jsx(
      EnsembleWordView,
      {
        key: i,
        word: w.word,
        votes: w.votes,
        candidates: w.candidates,
        max: e.ensemble.modelCount,
        fontSize: 18
      }
    ))) : e.partial ? /* @__PURE__ */ __jsx(Text, { fontSize: 18, color: SHADES[1] }, e.partial) : e.livePreview ? /* @__PURE__ */ __jsx(Text, { fontSize: 18, color: C.warn }, e.livePreview) : /* @__PURE__ */ __jsx(Text, { fontSize: 14, color: C.dim }, armed ? "\u2014 waiting for speech \u2014" : "\u2014 tap to start, then say something \u2014"), e.ensemble && /* @__PURE__ */ __jsx(Row, { style: { gap: 14, alignItems: "center", flexWrap: "wrap" } }, Object.entries(e.individual).map(([name, text]) => /* @__PURE__ */ __jsx(Row, { key: name, style: { gap: 6, alignItems: "baseline" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: C.dim, style: { width: 36 } }, name), /* @__PURE__ */ __jsx(Text, { fontSize: 11, color: C.dim, fontFamily: "monospace" }, text || "\u2026"))), /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: C.dim }, `anchor=${e.ensemble.anchor}`))), /* @__PURE__ */ __jsx(Col, { style: {
      flexGrow: 1,
      gap: 0,
      padding: 14,
      backgroundColor: C.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border
    } }, /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim, style: { marginBottom: 8 } }, "history"), /* @__PURE__ */ __jsx(ScrollView, { style: { flexGrow: 1 } }, history.length === 0 ? /* @__PURE__ */ __jsx(Text, { fontSize: 11, color: C.dim }, "\u2014 nothing yet \u2014") : history.map((h2) => /* @__PURE__ */ __jsx(Col, { key: h2.id, style: {
      gap: 6,
      padding: 12,
      marginBottom: 8,
      backgroundColor: C.bg,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: C.border
    } }, /* @__PURE__ */ __jsx(Row, { style: { flexWrap: "wrap", gap: 6 } }, h2.ensembleWords.map((w, i) => /* @__PURE__ */ __jsx(
      EnsembleWordView,
      {
        key: i,
        word: w.word,
        votes: w.votes,
        candidates: w.candidates,
        max: h2.modelCount,
        fontSize: 14
      }
    ))), /* @__PURE__ */ __jsx(Row, { style: { gap: 14, flexWrap: "wrap" } }, Object.entries(h2.individual).map(([name, text]) => /* @__PURE__ */ __jsx(Row, { key: name, style: { gap: 6, alignItems: "baseline" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: C.dim, style: { width: 36 } }, name), /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: C.dim, fontFamily: "monospace" }, text))), /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: C.dim }, `#${h2.id} \xB7 ${h2.ms.toFixed(0)}ms \xB7 anchor=${h2.anchor}${h2.escalatedWith.length ? ` \xB7 \u2191${h2.escalatedWith.join(",")}` : ""}`)))))));
  }
  function Dictation() {
    const [ready, setReady] = (0, import_react3.useState)(false);
    if (!ready) return /* @__PURE__ */ __jsx(DownloadGate, { onReady: () => setReady(true) });
    return /* @__PURE__ */ __jsx(DictationCore, null);
  }

  // runtime/cartridge_entry.tsx
  var g = globalThis;
  var slot = g.__cartridgeLoadSlot;
  if (slot && typeof slot === "object") {
    slot.App = Dictation;
  } else {
    g.__lastCartridge = Dictation;
  }
})();
