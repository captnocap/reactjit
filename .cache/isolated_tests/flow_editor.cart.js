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

  // cart/app/isolated_tests/flow_editor.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react3 = __toESM(require_react());
  init_primitives();

  // cart/app/gallery/components/flow-editor/FlowEditor.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();

  // cart/app/gallery/lib/useTick.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react = __toESM(require_react());
  function useTick() {
    const [t, setT] = (0, import_react.useState)(0);
    (0, import_react.useEffect)(() => {
      const g2 = globalThis;
      const raf = g2.requestAnimationFrame ? (fn) => g2.requestAnimationFrame(fn) : (fn) => setTimeout(fn, 16);
      const caf = g2.cancelAnimationFrame || clearTimeout;
      let handle = null;
      const start = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      const loop = (now) => {
        const t0 = (typeof now === "number" ? now : Date.now()) - start;
        setT(t0 / 1e3);
        handle = raf(loop);
      };
      handle = raf(loop);
      return () => {
        if (handle != null) {
          try {
            caf(handle);
          } catch (_) {
          }
        }
      };
    }, []);
    return t;
  }

  // cart/app/gallery/components/flow-editor/flowEditorTheme.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var FLOW_EDITOR_DEFAULT_THEME = {
    bg: "theme:bg",
    tileBg: "theme:bg2",
    tileBgSelected: "theme:paperInk",
    tileBorder: "theme:bg2",
    tileBorderSelected: "theme:tool",
    tilePending: "theme:warn",
    frameColor: "theme:paperRule",
    frameColorStrong: "theme:inkGhost",
    selectedRing: "theme:tool",
    headerBg: "theme:bg1",
    bodyBg: "theme:bg2",
    footBg: "theme:bg1",
    codeBg: "theme:bg",
    rowBg: "theme:paperInk",
    roleBg: "theme:bg",
    roleText: "theme:ink",
    accentHot: "theme:warn",
    edgeColor: "theme:tool",
    edgeStrokeWidth: 1.25,
    wirePacketSize: 8,
    wirePacketSpeed: 82,
    wirePacketGap: 42,
    wirePacketOpacity: 0.92,
    portIn: "theme:inkGhost",
    portOut: "theme:tool",
    flowColor: "theme:warn",
    dataColor: "theme:tool",
    toolColor: "theme:accent",
    condTrueColor: "theme:ok",
    condFalseColor: "theme:flag",
    errorColor: "theme:danger",
    ctxColor: "theme:paperAlt",
    loopColor: "theme:paperInkDim",
    stateIdle: "theme:inkGhost",
    stateRun: "theme:warn",
    stateOk: "theme:ok",
    stateErr: "theme:danger",
    stateWait: "theme:paperInkDim",
    portRadius: 3,
    gridColor: "theme:bg2",
    gridMajorColor: "theme:paperRule",
    gridStep: 40,
    gridMajorEvery: 5,
    textBright: "theme:ink",
    textDim: "theme:ok",
    deleteBg: "theme:bg1",
    radiusMd: 8,
    tileWidth: 226,
    tileHeight: 148,
    hairlineWidth: 1.25
  };

  // cart/app/gallery/components/flow-editor/bezier.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  function bezierFor(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const forward = Math.max(50, adx * 0.5);
    const backward = Math.max(80, ady * 0.5 + 60);
    const horiz = Math.min(240, dx >= 0 ? forward : backward);
    const c1x = x1 + horiz;
    const c2x = x2 - horiz;
    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${y1.toFixed(1)}, ${c2x.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    return { d, c1x, c1y: y1, c2x, c2y: y2 };
  }

  // cart/app/gallery/components/flow-editor/FlowTile.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_primitives();
  var HEADER_H = 32;
  var FOOT_H = 24;
  var BODY_PAD_X = 10;
  function asVisualData(data) {
    if (!data || typeof data !== "object") return {};
    return data;
  }
  function nodeKind(node) {
    return asVisualData(node.data).kind ?? "action";
  }
  function getFlowNodeVisual(node) {
    return asVisualData(node.data);
  }
  function getFlowNodeSize(node, theme) {
    const minW = theme.tileWidth;
    const minH = theme.tileHeight;
    switch (nodeKind(node)) {
      case "sequence":
        return { width: Math.max(minW, 252), height: Math.max(minH, 194) };
      case "if":
        return { width: Math.max(minW, 248), height: Math.max(minH, 174) };
      case "switch":
        return { width: Math.max(minW, 264), height: Math.max(minH, 206) };
      case "lanes":
        return { width: Math.max(minW, 290), height: Math.max(minH, 194) };
      case "loop":
        return { width: Math.max(minW, 242), height: Math.max(minH, 176) };
      case "token":
        return { width: Math.max(minW, 286), height: Math.max(minH, 216) };
      case "trigger":
      case "end":
      case "action":
      default:
        return { width: Math.max(minW, 226), height: Math.max(minH, 148) };
    }
  }
  function getPortColor(kind, theme) {
    switch (kind) {
      case "data":
        return theme.dataColor;
      case "tool":
        return theme.toolColor;
      case "cond-true":
        return theme.condTrueColor;
      case "cond-false":
        return theme.condFalseColor;
      case "error":
        return theme.errorColor;
      case "ctx":
        return theme.ctxColor;
      case "loop":
        return theme.loopColor;
      case "flow":
      default:
        return theme.flowColor;
    }
  }
  function getEdgeColor(kind, theme) {
    return getPortColor(kind ?? "flow", theme);
  }
  function getEdgeDasharray(kind) {
    if (kind === "tool") return "5,4";
    if (kind === "error") return "2,4";
    return void 0;
  }
  function withOffsets(ports, size) {
    const left = ports.filter((port) => port.side === "in");
    const right = ports.filter((port) => port.side === "out");
    const spread = (list) => {
      if (list.length === 0) return [];
      if (list.every((port) => typeof port.offsetY === "number")) return list;
      const start = Math.max(HEADER_H + 22, size.height / 2 - (list.length - 1) * 14);
      return list.map((port, index) => ({
        ...port,
        offsetY: port.offsetY ?? start + index * 28
      }));
    };
    return [...spread(left), ...spread(right)];
  }
  function getFlowNodePorts(node, theme) {
    const data = getFlowNodeVisual(node);
    const size = getFlowNodeSize(node, theme);
    if (data.ports && data.ports.length > 0) return withOffsets(data.ports, size);
    const center = size.height / 2;
    const lower = size.height - FOOT_H - 10;
    const kind = data.kind ?? "action";
    switch (kind) {
      case "if":
        return withOffsets([
          { id: "in", side: "in", kind: "flow", label: "flow in", offsetY: center },
          { id: "true", side: "out", kind: "cond-true", label: "true branch", offsetY: center - 24 },
          { id: "false", side: "out", kind: "cond-false", label: "false branch", offsetY: center + 8 },
          { id: "err", side: "out", kind: "error", label: "exception path", offsetY: lower }
        ], size);
      case "switch": {
        const cases = data.cases ?? [];
        const outPorts = cases.length > 0 ? cases.map((item, index) => ({
          id: item.id,
          side: "out",
          kind: "cond-true",
          label: `case ${index + 1}: ${item.label}`,
          offsetY: HEADER_H + 48 + index * 28
        })) : [
          { id: "case-1", side: "out", kind: "cond-true", label: "case 1", offsetY: center - 18 },
          { id: "case-2", side: "out", kind: "cond-false", label: "case 2", offsetY: center + 18 }
        ];
        return withOffsets([
          { id: "in", side: "in", kind: "flow", label: "flow in", offsetY: center },
          ...outPorts,
          { id: "err", side: "out", kind: "error", label: "exception path", offsetY: lower }
        ], size);
      }
      case "loop":
        return withOffsets([
          { id: "in", side: "in", kind: "flow", label: "flow in", offsetY: center },
          { id: "item", side: "out", kind: "loop", label: "per-item loop tail", offsetY: center - 28 },
          { id: "done", side: "out", kind: "flow", label: "loop done", offsetY: center + 2 },
          { id: "err", side: "out", kind: "error", label: "exception path", offsetY: lower }
        ], size);
      case "token":
        return withOffsets([
          { id: "prompt", side: "in", kind: "data", label: "prompt input" },
          { id: "ctx", side: "in", kind: "ctx", label: "context injection" },
          { id: "tools", side: "in", kind: "tool", label: "tool binding" },
          { id: "tokens", side: "out", kind: "data", label: "token stream" },
          { id: "output", side: "out", kind: "flow", label: "model output" },
          { id: "err", side: "out", kind: "error", label: "exception path" }
        ], size);
      case "trigger":
        return withOffsets([
          { id: "out", side: "out", kind: "flow", label: "trigger flow out", offsetY: center },
          { id: "ctx", side: "out", kind: "ctx", label: "trigger context", offsetY: lower }
        ], size);
      case "end":
        return withOffsets([
          { id: "in", side: "in", kind: "flow", label: "flow in", offsetY: center - 12 },
          { id: "err", side: "in", kind: "error", label: "error in", offsetY: center + 20 }
        ], size);
      case "sequence":
      case "lanes":
      case "action":
      default:
        return withOffsets([
          { id: "in", side: "in", kind: "flow", label: "flow in", offsetY: center },
          { id: "out", side: "out", kind: "flow", label: "flow out", offsetY: center - 12 },
          { id: "err", side: "out", kind: "error", label: "exception path", offsetY: lower }
        ], size);
    }
  }
  function roleDefaults(kind) {
    switch (kind) {
      case "sequence":
        return { role: "SEQ", glyph: "\u2261", roleKind: "flow" };
      case "if":
        return { role: "IF", glyph: "?", roleKind: "cond-true" };
      case "switch":
        return { role: "SW", glyph: "#", roleKind: "cond-false" };
      case "lanes":
        return { role: "LANE", glyph: "\u2551", roleKind: "ctx" };
      case "loop":
        return { role: "LOOP", glyph: "\u21BA", roleKind: "loop" };
      case "token":
        return { role: "AI", glyph: "\u2726", roleKind: "tool" };
      case "trigger":
        return { role: "TRG", glyph: "\u25C9", roleKind: "ctx" };
      case "end":
        return { role: "END", glyph: "\u25A0", roleKind: "error" };
      case "action":
      default:
        return { role: "ACT", glyph: "\xB7", roleKind: "flow" };
    }
  }
  function stateColor(state, theme) {
    switch (state) {
      case "run":
        return theme.stateRun;
      case "ok":
      case "done":
        return theme.stateOk;
      case "err":
        return theme.stateErr;
      case "wait":
        return theme.stateWait;
      case "skip":
      case "idle":
      default:
        return theme.stateIdle;
    }
  }
  function StatePip({ state, theme }) {
    const color = stateColor(state, theme);
    const active = state === "run" || state === "err";
    return /* @__PURE__ */ __jsx(
      Box,
      {
        style: {
          width: active ? 12 : 9,
          height: active ? 12 : 9,
          borderRadius: active ? 6 : 5,
          borderWidth: active ? 1 : 0,
          borderColor: color,
          borderDashOn: active ? 2 : void 0,
          borderDashOff: active ? 2 : void 0,
          borderDashWidth: active ? 1 : void 0,
          borderFlowSpeed: state === "run" ? 24 : state === "err" ? 36 : void 0,
          alignItems: "center",
          justifyContent: "center"
        }
      },
      /* @__PURE__ */ __jsx(
        Box,
        {
          style: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color
          }
        }
      )
    );
  }
  function RenderKvRows({ rows, theme }) {
    return /* @__PURE__ */ __jsx(Box, { style: { gap: 4 } }, rows.map((row) => /* @__PURE__ */ __jsx(
      Row,
      {
        key: `${row.key}:${row.value}`,
        style: {
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderColor: theme.frameColor,
          paddingBottom: 2
        }
      },
      /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textDim, style: { fontFamily: "monospace" } }, row.key),
      /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: theme.textBright, numberOfLines: 1, style: { fontWeight: "bold" } }, row.value)
    )));
  }
  function RenderCodePreview({ lines, theme }) {
    return /* @__PURE__ */ __jsx(
      Box,
      {
        style: {
          gap: 2,
          borderWidth: 1,
          borderColor: theme.frameColor,
          borderRadius: 4,
          backgroundColor: theme.codeBg,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6
        }
      },
      lines.map((line, index) => /* @__PURE__ */ __jsx(Text, { key: `${index}:${line}`, fontSize: 8, color: index === 0 ? theme.accentHot : theme.textBright, numberOfLines: 1, style: { fontFamily: "monospace" } }, line))
    );
  }
  function RenderSteps({ steps, theme }) {
    return /* @__PURE__ */ __jsx(Box, { style: { gap: 4 } }, steps.map((step, index) => {
      const running = step.state === "run";
      return /* @__PURE__ */ __jsx(
        Row,
        {
          key: step.id,
          style: {
            gap: 6,
            alignItems: "center",
            paddingLeft: 7,
            paddingRight: 7,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: running ? theme.stateRun : theme.frameColor,
            backgroundColor: running ? theme.rowBg : theme.bodyBg
          }
        },
        /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: running ? theme.stateRun : theme.textDim, style: { fontFamily: "monospace", fontWeight: "bold" } }, step.glyph ?? `${index + 1}`),
        /* @__PURE__ */ __jsx(StatePip, { state: step.state, theme }),
        /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: theme.textBright, numberOfLines: 1, style: { flexGrow: 1, flexBasis: 0 } }, step.label),
        /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textDim, style: { fontFamily: "monospace" } }, step.metric ?? "--")
      );
    }));
  }
  function RenderCases({ cases, activeCaseId, theme }) {
    return /* @__PURE__ */ __jsx(Box, { style: { gap: 4 } }, cases.map((item, index) => {
      const active = item.active || item.id === activeCaseId;
      return /* @__PURE__ */ __jsx(
        Row,
        {
          key: item.id,
          style: {
            gap: 8,
            alignItems: "center",
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: active ? theme.condTrueColor : theme.frameColor,
            backgroundColor: active ? theme.rowBg : theme.bodyBg
          }
        },
        /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: active ? theme.condTrueColor : theme.textDim, style: { fontFamily: "monospace", fontWeight: "bold" } }, index + 1),
        /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: theme.textBright, numberOfLines: 1, style: { flexGrow: 1, flexBasis: 0 } }, item.label),
        /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: active ? theme.stateRun : theme.textDim, style: { fontFamily: "monospace" } }, item.hitRate ?? item.value ?? "--")
      );
    }));
  }
  function RenderLanes({ lanes, theme }) {
    return /* @__PURE__ */ __jsx(Row, { style: { gap: 6, alignItems: "stretch", flexGrow: 1 } }, lanes.map((lane) => /* @__PURE__ */ __jsx(
      Box,
      {
        key: lane.id,
        style: {
          flexGrow: 1,
          flexBasis: 0,
          borderWidth: 1,
          borderColor: stateColor(lane.state, theme),
          borderRadius: 5,
          backgroundColor: theme.codeBg,
          paddingLeft: 7,
          paddingRight: 7,
          paddingTop: 6,
          paddingBottom: 6,
          gap: 4
        }
      },
      /* @__PURE__ */ __jsx(Row, { style: { gap: 5, alignItems: "center" } }, /* @__PURE__ */ __jsx(StatePip, { state: lane.state, theme }), /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: theme.textBright, numberOfLines: 1, style: { fontWeight: "bold" } }, lane.label)),
      (lane.lines ?? []).map((line) => /* @__PURE__ */ __jsx(Text, { key: line, fontSize: 8, color: theme.textDim, numberOfLines: 1, style: { fontFamily: "monospace" } }, line)),
      /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: stateColor(lane.state, theme), style: { fontFamily: "monospace" } }, lane.metric ?? "--")
    )));
  }
  function RenderLoopBar({ data, theme }) {
    const loop = data.loop ?? { current: 0, total: 1, label: "iteration" };
    const ratio = loop.total > 0 ? Math.max(0, Math.min(1, loop.current / loop.total)) : 0;
    return /* @__PURE__ */ __jsx(Box, { style: { gap: 5 } }, /* @__PURE__ */ __jsx(Row, { style: { justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textDim, style: { fontFamily: "monospace" } }, loop.label ?? "iteration"), /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.loopColor, style: { fontFamily: "monospace", fontWeight: "bold" } }, loop.current, "/", loop.total)), /* @__PURE__ */ __jsx(
      Box,
      {
        style: {
          height: 12,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.loopColor,
          backgroundColor: theme.codeBg,
          overflow: "hidden"
        }
      },
      /* @__PURE__ */ __jsx(
        Box,
        {
          style: {
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            backgroundColor: theme.loopColor,
            borderDashOn: 3,
            borderDashOff: 3,
            borderDashWidth: 1
          }
        }
      )
    ));
  }
  function RenderTokenChip({ node, theme }) {
    const ports = getFlowNodePorts(node, theme);
    const left = ports.filter((port) => port.side === "in");
    const right = ports.filter((port) => port.side === "out");
    return /* @__PURE__ */ __jsx(Row, { style: { gap: 8, alignItems: "stretch", flexGrow: 1 } }, /* @__PURE__ */ __jsx(Box, { style: { width: 58, gap: 5 } }, left.map((port) => /* @__PURE__ */ __jsx(Row, { key: port.id, style: { gap: 4, alignItems: "center" } }, /* @__PURE__ */ __jsx(Box, { style: { width: 10, height: 3, backgroundColor: getPortColor(port.kind, theme) } }), /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textDim, numberOfLines: 1, style: { fontFamily: "monospace" } }, port.id)))), /* @__PURE__ */ __jsx(
      Box,
      {
        style: {
          flexGrow: 1,
          flexBasis: 0,
          borderWidth: 1,
          borderColor: theme.accentHot,
          borderRadius: 6,
          backgroundColor: theme.codeBg,
          alignItems: "center",
          justifyContent: "center",
          gap: 4
        }
      },
      /* @__PURE__ */ __jsx(Text, { fontSize: 18, color: theme.accentHot, style: { fontWeight: "bold" } }, "LLM"),
      /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textDim, style: { fontFamily: "monospace" } }, "prompt + ctx + tools"),
      /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textBright, style: { fontFamily: "monospace" } }, "tokens \u2192 output")
    ), /* @__PURE__ */ __jsx(Box, { style: { width: 58, gap: 5, alignItems: "flex-end" } }, right.map((port) => /* @__PURE__ */ __jsx(Row, { key: port.id, style: { gap: 4, alignItems: "center", justifyContent: "flex-end" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textDim, numberOfLines: 1, style: { fontFamily: "monospace" } }, port.id), /* @__PURE__ */ __jsx(Box, { style: { width: 10, height: 3, backgroundColor: getPortColor(port.kind, theme) } })))));
  }
  function RenderDefaultBody({ node, theme }) {
    const data = getFlowNodeVisual(node);
    const kind = data.kind ?? "action";
    if (kind === "sequence") {
      return /* @__PURE__ */ __jsx(RenderSteps, { steps: data.steps ?? [], theme });
    }
    if (kind === "if") {
      return /* @__PURE__ */ __jsx(Box, { style: { gap: 8 } }, /* @__PURE__ */ __jsx(RenderCodePreview, { lines: data.code ?? ["return input.ok && budget > cost"], theme }), /* @__PURE__ */ __jsx(Row, { style: { gap: 6 } }, /* @__PURE__ */ __jsx(Box, { style: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: theme.condTrueColor, borderRadius: 4, paddingTop: 4, paddingBottom: 4, alignItems: "center" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.condTrueColor, style: { fontFamily: "monospace", fontWeight: "bold" } }, "TRUE ", data.hitRate?.true ?? "0%")), /* @__PURE__ */ __jsx(Box, { style: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: theme.condFalseColor, borderRadius: 4, paddingTop: 4, paddingBottom: 4, alignItems: "center" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.condFalseColor, style: { fontFamily: "monospace", fontWeight: "bold" } }, "FALSE ", data.hitRate?.false ?? "0%"))));
    }
    if (kind === "switch") {
      return /* @__PURE__ */ __jsx(RenderCases, { cases: data.cases ?? [], activeCaseId: data.activeCaseId, theme });
    }
    if (kind === "lanes") {
      return /* @__PURE__ */ __jsx(RenderLanes, { lanes: data.lanes ?? [], theme });
    }
    if (kind === "loop") {
      return /* @__PURE__ */ __jsx(Box, { style: { gap: 8 } }, /* @__PURE__ */ __jsx(RenderKvRows, { rows: data.kv ?? [], theme }), /* @__PURE__ */ __jsx(RenderLoopBar, { data, theme }));
    }
    if (kind === "token") {
      return /* @__PURE__ */ __jsx(RenderTokenChip, { node, theme });
    }
    return /* @__PURE__ */ __jsx(
      RenderKvRows,
      {
        rows: data.kv ?? [
          { key: "method", value: "GET" },
          { key: "url", value: "/endpoint" },
          { key: "auth", value: "none" },
          { key: "timeout", value: "30s" }
        ],
        theme
      }
    );
  }
  function MetaStrip({ data, theme }) {
    const meta = data.meta ?? {};
    const parts = [
      `runs ${meta.runs ?? "0"}`,
      `${meta.ms ?? "--"}ms`,
      `$${meta.cost ?? "--"}`,
      meta.model ?? "--",
      meta.version ?? "v0",
      meta.lastRun ?? "never"
    ];
    return /* @__PURE__ */ __jsx(
      Row,
      {
        style: {
          height: FOOT_H,
          gap: 7,
          alignItems: "center",
          paddingLeft: BODY_PAD_X,
          paddingRight: BODY_PAD_X,
          borderTopWidth: 1,
          borderColor: theme.frameColor,
          backgroundColor: theme.footBg
        }
      },
      parts.map((part, index) => /* @__PURE__ */ __jsx(Text, { key: `${index}:${part}`, fontSize: 7, color: theme.textDim, numberOfLines: 1, style: { fontFamily: "monospace" } }, part))
    );
  }
  function CornerMarks({ color, width, height }) {
    const mark = { position: "absolute", backgroundColor: color };
    return /* @__PURE__ */ __jsx(Fragment, null, /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: 0, top: 0, width: 11, height: 1 } }), /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: 0, top: 0, width: 1, height: 11 } }), /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: width - 11, top: 0, width: 11, height: 1 } }), /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: width - 1, top: 0, width: 1, height: 11 } }), /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: 0, top: height - 1, width: 11, height: 1 } }), /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: 0, top: height - 11, width: 1, height: 11 } }), /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: width - 11, top: height - 1, width: 11, height: 1 } }), /* @__PURE__ */ __jsx(Box, { style: { ...mark, left: width - 1, top: height - 11, width: 1, height: 11 } }));
  }
  function PortPin({
    node,
    port,
    theme,
    width,
    pending,
    onPortClick
  }) {
    const color = pending ? theme.tilePending : getPortColor(port.kind, theme);
    const top = Math.max(HEADER_H + 4, (port.offsetY ?? 0) - 5);
    const left = port.side === "in" ? -4 : width - 6;
    return /* @__PURE__ */ __jsx(
      Pressable,
      {
        tooltip: port.label,
        hoverable: true,
        onPress: () => onPortClick(node.id, port.side, port.id),
        style: {
          position: "absolute",
          left,
          top,
          width: 10,
          height: 10,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 2,
          borderWidth: pending ? 1 : 0,
          borderColor: color
        }
      },
      /* @__PURE__ */ __jsx(
        Box,
        {
          style: {
            width: 8,
            height: 3,
            backgroundColor: color
          }
        }
      )
    );
  }
  function FlowTile({
    node,
    theme,
    selected,
    pendingIn,
    pendingOut,
    pendingPortId,
    onMove,
    onPortClick,
    onTileClick,
    onRemove,
    renderBody
  }) {
    const size = getFlowNodeSize(node, theme);
    const data = getFlowNodeVisual(node);
    const kind = data.kind ?? "action";
    const role = roleDefaults(kind);
    const ports = getFlowNodePorts(node, theme);
    const anyPending = pendingIn || pendingOut;
    const roleKind = data.roleKind ?? role.roleKind;
    const roleColor = kind === "token" ? theme.accentHot : getPortColor(roleKind, theme);
    const stripe = data.stripe ?? (kind === "trigger" ? "trigger" : kind === "end" ? "end" : void 0);
    const quickActions = data.quickActions ?? (kind === "switch" ? ["\u25C9", "+", "\u2691", "\u22EF"] : ["\u25C9", "\u2316", "\u2691", "\u23F8", "\u22EF"]);
    const frameColor = selected ? theme.selectedRing : anyPending ? theme.tilePending : theme.frameColor;
    return /* @__PURE__ */ __jsx(
      Canvas.Node,
      {
        gx: node.x,
        gy: node.y,
        gw: size.width,
        gh: size.height,
        onMove: (e) => onMove(node.id, e.gx, e.gy)
      },
      /* @__PURE__ */ __jsx(
        Box,
        {
          style: {
            width: "100%",
            height: "100%",
            position: "relative",
            borderRadius: theme.radiusMd,
            backgroundColor: selected ? theme.tileBgSelected : theme.tileBg,
            borderWidth: 1,
            borderColor: frameColor,
            borderDashOn: selected ? 5 : void 0,
            borderDashOff: selected ? 4 : void 0,
            borderDashWidth: selected ? 1 : void 0,
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ __jsx(
          Pressable,
          {
            onPress: () => onTileClick(node.id),
            style: {
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%"
            }
          },
          /* @__PURE__ */ __jsx(
            Row,
            {
              style: {
                height: HEADER_H,
                alignItems: "center",
                gap: 7,
                paddingLeft: BODY_PAD_X,
                paddingRight: onRemove ? 22 : BODY_PAD_X,
                borderBottomWidth: 1,
                borderColor: theme.frameColor,
                backgroundColor: theme.headerBg
              }
            },
            /* @__PURE__ */ __jsx(
              Row,
              {
                style: {
                  width: 48,
                  height: 18,
                  borderRadius: 4,
                  backgroundColor: theme.roleBg,
                  borderWidth: 1,
                  borderColor: roleColor,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3
                }
              },
              /* @__PURE__ */ __jsx(Box, { style: { width: 7, height: 7, borderRadius: 2, backgroundColor: roleColor } }),
              /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.roleText, style: { fontFamily: "monospace", fontWeight: "bold" } }, data.roleGlyph ?? role.glyph)
            ),
            /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: theme.textDim, numberOfLines: 1, style: { fontFamily: "monospace", width: 34 } }, node.id),
            /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: theme.textBright, numberOfLines: 1, style: { flexGrow: 1, flexBasis: 0, fontWeight: "bold" } }, node.label),
            /* @__PURE__ */ __jsx(StatePip, { state: data.state ?? "idle", theme }),
            /* @__PURE__ */ __jsx(Row, { style: { gap: 4, alignItems: "center" } }, quickActions.map((action) => /* @__PURE__ */ __jsx(Text, { key: action, fontSize: 9, color: theme.textDim, style: { fontFamily: "monospace", fontWeight: "bold" } }, action)))
          ),
          /* @__PURE__ */ __jsx(
            Box,
            {
              style: {
                flexGrow: 1,
                flexBasis: 0,
                minHeight: 0,
                paddingLeft: BODY_PAD_X,
                paddingRight: BODY_PAD_X,
                paddingTop: 9,
                paddingBottom: 8,
                backgroundColor: theme.bodyBg,
                gap: 7
              }
            },
            data.draft ? /* @__PURE__ */ __jsx(
              Box,
              {
                style: {
                  position: "absolute",
                  left: size.width - 56,
                  top: HEADER_H - 1,
                  width: 44,
                  height: 15,
                  borderWidth: 1,
                  borderColor: theme.stateWait,
                  borderRadius: 4,
                  backgroundColor: theme.headerBg,
                  alignItems: "center",
                  justifyContent: "center"
                }
              },
              /* @__PURE__ */ __jsx(Text, { fontSize: 7, color: theme.stateWait, style: { fontFamily: "monospace", fontWeight: "bold" } }, "DRAFT")
            ) : null,
            renderBody ? renderBody({ node, selected, pending: anyPending }) : /* @__PURE__ */ __jsx(RenderDefaultBody, { node, theme })
          ),
          /* @__PURE__ */ __jsx(MetaStrip, { data, theme })
        ),
        stripe === "trigger" ? /* @__PURE__ */ __jsx(Box, { style: { position: "absolute", left: 0, top: HEADER_H, width: 3, height: size.height - HEADER_H, backgroundColor: theme.ctxColor } }) : null,
        stripe === "end" ? /* @__PURE__ */ __jsx(Box, { style: { position: "absolute", left: size.width - 3, top: HEADER_H, width: 3, height: size.height - HEADER_H, backgroundColor: theme.errorColor } }) : null,
        /* @__PURE__ */ __jsx(CornerMarks, { color: selected ? theme.selectedRing : theme.frameColorStrong, width: size.width, height: size.height }),
        ports.map((port) => /* @__PURE__ */ __jsx(
          PortPin,
          {
            key: `${port.side}:${port.id}`,
            node,
            port,
            theme,
            width: size.width,
            pending: pendingPortId ? pendingPortId === port.id : port.side === "in" ? pendingIn : pendingOut,
            onPortClick
          }
        )),
        onRemove ? /* @__PURE__ */ __jsx(
          Pressable,
          {
            onPress: () => onRemove(node.id),
            style: {
              position: "absolute",
              left: size.width - 19,
              top: 7,
              width: 13,
              height: 13,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.deleteBg,
              borderWidth: 1,
              borderColor: theme.frameColor
            }
          },
          /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: theme.textDim }, "\xD7")
        ) : null
      )
    );
  }

  // cart/app/gallery/components/flow-editor/useFlowEditorState.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react2 = __toESM(require_react());
  function useFlowEditorState(options = {}) {
    const padX = options.spawnPadX ?? 280;
    const padY = options.spawnPadY ?? 190;
    const [nodes, setNodes] = (0, import_react2.useState)(options.initialNodes ?? []);
    const [edges, setEdges] = (0, import_react2.useState)(options.initialEdges ?? []);
    const [pending, setPending] = (0, import_react2.useState)(null);
    const [selectedId, setSelectedId] = (0, import_react2.useState)(null);
    const nodesRef = (0, import_react2.useRef)(nodes);
    nodesRef.current = nodes;
    const pendingRef = (0, import_react2.useRef)(pending);
    pendingRef.current = pending;
    const counterRef = (0, import_react2.useRef)((options.initialNodes ?? []).length);
    const edgeCounterRef = (0, import_react2.useRef)(0);
    const addNode = (0, import_react2.useCallback)((label, data) => {
      counterRef.current += 1;
      const id = `n${counterRef.current}_${Date.now().toString(36)}`;
      const existing = nodesRef.current;
      const overlaps = (x2, y2) => existing.some((n) => Math.abs(n.x - x2) < padX && Math.abs(n.y - y2) < padY);
      let x = 0;
      let y = 0;
      if (existing.length > 0) {
        let placed = false;
        for (let r2 = 1; r2 < 30 && !placed; r2 += 1) {
          for (let dy = -r2; dy <= r2 && !placed; dy += 1) {
            for (let dx = -r2; dx <= r2 && !placed; dx += 1) {
              if (Math.abs(dx) !== r2 && Math.abs(dy) !== r2) continue;
              const cx = dx * padX;
              const cy = dy * padY;
              if (!overlaps(cx, cy)) {
                x = cx;
                y = cy;
                placed = true;
              }
            }
          }
        }
      }
      const node = { id, label: label ?? `Step ${counterRef.current}`, x, y, data };
      setNodes((prev) => [...prev, node]);
      return id;
    }, [padX, padY]);
    const moveNode = (0, import_react2.useCallback)((id, x, y) => {
      setNodes((prev) => prev.map((n) => n.id === id ? { ...n, x, y } : n));
    }, []);
    const tryAddEdge = (0, import_react2.useCallback)((fromId, toId, fromPort, toPort, kind) => {
      if (fromId === toId) return;
      edgeCounterRef.current += 1;
      const id = `e${edgeCounterRef.current}_${Date.now().toString(36)}`;
      setEdges(
        (prev) => prev.some((e) => e.from === fromId && e.to === toId && (e.fromPort ?? "") === (fromPort ?? "") && (e.toPort ?? "") === (toPort ?? "")) ? prev : [...prev, { id, from: fromId, to: toId, fromPort, toPort, kind }]
      );
    }, []);
    const onPortClick = (0, import_react2.useCallback)((nodeId, side, portId) => {
      const cur = pendingRef.current;
      if (!cur) {
        setPending({ nodeId, side, portId });
        return;
      }
      if (cur.nodeId === nodeId) {
        setPending(null);
        return;
      }
      if (cur.side === side) {
        setPending({ nodeId, side, portId });
        return;
      }
      if (cur.side === "out") tryAddEdge(cur.nodeId, nodeId, cur.portId, portId);
      else tryAddEdge(nodeId, cur.nodeId, portId, cur.portId);
      setPending(null);
    }, [tryAddEdge]);
    const onTileClick = (0, import_react2.useCallback)((id) => {
      const cur = pendingRef.current;
      if (cur) {
        if (cur.nodeId !== id) {
          if (cur.side === "out") tryAddEdge(cur.nodeId, id, cur.portId);
          else tryAddEdge(id, cur.nodeId, void 0, cur.portId);
        }
        setPending(null);
        return;
      }
      setSelectedId(id);
    }, [tryAddEdge]);
    const removeNode = (0, import_react2.useCallback)((id) => {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
      setSelectedId((cur) => cur === id ? null : cur);
      setPending((cur) => cur?.nodeId === id ? null : cur);
    }, []);
    const clearAll = (0, import_react2.useCallback)(() => {
      setNodes([]);
      setEdges([]);
      setPending(null);
      setSelectedId(null);
    }, []);
    return {
      nodes,
      edges,
      pending,
      selectedId,
      setNodes,
      setEdges,
      setPending,
      setSelectedId,
      addNode,
      moveNode,
      removeNode,
      tryAddEdge,
      onPortClick,
      onTileClick,
      clearAll
    };
  }

  // cart/app/gallery/components/flow-editor/FlowEditor.tsx
  function FlowEditor(props) {
    const theme = { ...FLOW_EDITOR_DEFAULT_THEME, ...props.theme ?? {} };
    const tick = useTick();
    const stateOptions = {
      initialNodes: props.initialNodes,
      initialEdges: props.initialEdges,
      spawnPadX: props.spawnPadX,
      spawnPadY: props.spawnPadY
    };
    const state = useFlowEditorState(stateOptions);
    const controlledNodes = props.nodes;
    const controlledEdges = props.edges;
    const nodes = controlledNodes ?? state.nodes;
    const edges = controlledEdges ?? state.edges;
    const propagateNodes = (next) => {
      if (props.onNodesChange) props.onNodesChange(next);
      if (controlledNodes == null) state.setNodes(next);
    };
    const propagateEdges = (next) => {
      if (props.onEdgesChange) props.onEdgesChange(next);
      if (controlledEdges == null) state.setEdges(next);
    };
    const moveNode = (id, x, y) => {
      propagateNodes(nodes.map((n) => n.id === id ? { ...n, x, y } : n));
    };
    const removeNode = (id) => {
      propagateNodes(nodes.filter((n) => n.id !== id));
      propagateEdges(edges.filter((e) => e.from !== id && e.to !== id));
      if (state.selectedId === id) state.setSelectedId(null);
      if (state.pending?.nodeId === id) state.setPending(null);
    };
    const findNodePort = (nodeId, side, portId, kind) => {
      const node = nodes.find((item) => item.id === nodeId);
      if (!node) return void 0;
      const ports = getFlowNodePorts(node, theme).filter((port) => port.side === side);
      if (portId) {
        const byId2 = ports.find((port) => port.id === portId);
        if (byId2) return byId2;
      }
      if (kind) {
        const byKind = ports.find((port) => port.kind === kind);
        if (byKind) return byKind;
      }
      return ports[0];
    };
    const tryAddEdge = (fromId, toId, fromPort, toPort, kind) => {
      if (fromId === toId) return;
      if (edges.some((e) => e.from === fromId && e.to === toId && (e.fromPort ?? "") === (fromPort ?? "") && (e.toPort ?? "") === (toPort ?? ""))) return;
      const sourcePort = findNodePort(fromId, "out", fromPort, kind);
      const id = `e${Date.now().toString(36)}`;
      propagateEdges([...edges, { id, from: fromId, to: toId, fromPort, toPort, kind: kind ?? sourcePort?.kind ?? "flow" }]);
    };
    const onPortClick = (nodeId, side, portId) => {
      const cur = state.pending;
      if (!cur) {
        state.setPending({ nodeId, side, portId });
        return;
      }
      if (cur.nodeId === nodeId) {
        state.setPending(null);
        return;
      }
      if (cur.side === side) {
        state.setPending({ nodeId, side, portId });
        return;
      }
      if (cur.side === "out") tryAddEdge(cur.nodeId, nodeId, cur.portId, portId);
      else tryAddEdge(nodeId, cur.nodeId, portId, cur.portId);
      state.setPending(null);
    };
    const onTileClick = (id) => {
      const cur = state.pending;
      if (cur) {
        if (cur.nodeId !== id) {
          if (cur.side === "out") tryAddEdge(cur.nodeId, id, cur.portId);
          else tryAddEdge(id, cur.nodeId, void 0, cur.portId);
        }
        state.setPending(null);
        return;
      }
      state.setSelectedId(id);
    };
    const byId = /* @__PURE__ */ new Map();
    for (const n of nodes) byId.set(n.id, n);
    const cubicPoint = (x1, y1, x2, y2, curve, value) => {
      const t = value < 0 ? 0 : value > 1 ? 1 : value;
      const u = 1 - t;
      const tt = t * t;
      const uu = u * u;
      const uuu = uu * u;
      const ttt = tt * t;
      return {
        x: uuu * x1 + 3 * uu * t * curve.c1x + 3 * u * tt * curve.c2x + ttt * x2,
        y: uuu * y1 + 3 * uu * t * curve.c1y + 3 * u * tt * curve.c2y + ttt * y2
      };
    };
    const cubicLength = (x1, y1, x2, y2, curve) => {
      let length = 0;
      let prev = { x: x1, y: y1 };
      for (let step = 1; step <= 10; step += 1) {
        const point = cubicPoint(x1, y1, x2, y2, curve, step / 10);
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        length += Math.sqrt(dx * dx + dy * dy);
        prev = point;
      }
      return Math.max(1, length);
    };
    const squarePath = (x, y, size) => {
      const half = size / 2;
      const left = (x - half).toFixed(1);
      const top = (y - half).toFixed(1);
      const right = (x + half).toFixed(1);
      const bottom = (y + half).toFixed(1);
      return `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
    };
    const edgeHash = (id) => {
      let hash = 0;
      for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) % 997;
      return hash / 997;
    };
    const edgePaths = [];
    for (const e of edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const aSize = getFlowNodeSize(a, theme);
      const bSize = getFlowNodeSize(b, theme);
      const sourcePort = findNodePort(e.from, "out", e.fromPort, e.kind);
      const targetPort = findNodePort(e.to, "in", e.toPort);
      const kind = e.kind ?? sourcePort?.kind ?? "flow";
      const x1 = a.x + aSize.width / 2;
      const y1 = a.y - aSize.height / 2 + (sourcePort?.offsetY ?? aSize.height / 2);
      const x2 = b.x - bSize.width / 2;
      const y2 = b.y - bSize.height / 2 + (targetPort?.offsetY ?? bSize.height / 2);
      const bz = bezierFor(x1, y1, x2, y2);
      const color = getEdgeColor(kind, theme);
      const dash = getEdgeDasharray(kind);
      const length = cubicLength(x1, y1, x2, y2, bz);
      const packetCount = Math.max(1, Math.min(7, Math.floor(length / theme.wirePacketGap)));
      const basePhase = (tick * theme.wirePacketSpeed / length + edgeHash(e.id)) % 1;
      edgePaths.push(
        /* @__PURE__ */ __jsx(
          Graph.Path,
          {
            key: `p-${e.id}`,
            d: bz.d,
            stroke: color,
            strokeWidth: theme.hairlineWidth ?? theme.edgeStrokeWidth,
            strokeDasharray: dash,
            fill: "none"
          }
        )
      );
      for (let packetIndex = 0; packetIndex < packetCount; packetIndex += 1) {
        const phase = (basePhase + packetIndex / packetCount) % 1;
        const point = cubicPoint(x1, y1, x2, y2, bz, phase);
        edgePaths.push(
          /* @__PURE__ */ __jsx(
            Graph.Path,
            {
              key: `c-${e.id}-${packetIndex}`,
              d: squarePath(point.x, point.y, theme.wirePacketSize),
              fill: color,
              fillOpacity: theme.wirePacketOpacity,
              stroke: theme.bg,
              strokeWidth: 1
            }
          )
        );
      }
    }
    const tiles = nodes.map((node) => /* @__PURE__ */ __jsx(
      FlowTile,
      {
        key: node.id,
        node,
        theme,
        selected: state.selectedId === node.id,
        pendingIn: state.pending?.nodeId === node.id && state.pending.side === "in",
        pendingOut: state.pending?.nodeId === node.id && state.pending.side === "out",
        pendingPortId: state.pending?.nodeId === node.id ? state.pending.portId : void 0,
        onMove: moveNode,
        onPortClick,
        onTileClick,
        onRemove: props.allowDelete === false ? void 0 : removeNode,
        renderBody: props.renderTileBody
      }
    ));
    return /* @__PURE__ */ __jsx(Box, { style: { width: "100%", height: "100%", backgroundColor: theme.bg } }, /* @__PURE__ */ __jsx(
      Canvas,
      {
        style: { width: "100%", height: "100%", backgroundColor: theme.bg },
        gridStep: theme.gridStep,
        gridStroke: 1,
        gridColor: theme.gridColor,
        gridMajorColor: theme.gridMajorColor,
        gridMajorEvery: theme.gridMajorEvery
      },
      /* @__PURE__ */ __jsx(
        Graph,
        {
          style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" },
          viewX: 0,
          viewY: 0,
          viewZoom: 1
        },
        edgePaths
      ),
      tiles
    ));
  }

  // cart/app/gallery/components/flow-editor/demoFlow.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var FLOW_EDITOR_DEMO_NODES = [
    {
      id: "TRG",
      label: "Webhook Trigger",
      x: -430,
      y: -190,
      data: {
        kind: "trigger",
        role: "TRG",
        state: "ok",
        stripe: "trigger",
        kv: [
          { key: "event", value: "repo.push" },
          { key: "auth", value: "hmac" },
          { key: "source", value: "github" }
        ],
        meta: { runs: "912", ms: "8", cost: "0.000", model: "edge", version: "v12", lastRun: "09:41" }
      }
    },
    {
      id: "A01",
      label: "Fetch Build Plan",
      x: -160,
      y: -190,
      data: {
        kind: "action",
        role: "HTTP",
        roleGlyph: "->",
        state: "run",
        kv: [
          { key: "method", value: "POST" },
          { key: "url", value: "/api/plan" },
          { key: "auth", value: "bearer" },
          { key: "timeout", value: "12s" }
        ],
        ports: [
          { id: "in", side: "in", kind: "flow", label: "control flow in" },
          { id: "payload", side: "out", kind: "data", label: "structured plan payload" },
          { id: "err", side: "out", kind: "error", label: "HTTP exception" }
        ],
        meta: { runs: "279", ms: "41", cost: "0.001", model: "fetch", version: "v4", lastRun: "now" }
      }
    },
    {
      id: "B02",
      label: "Normalize + Score",
      x: 150,
      y: -190,
      data: {
        kind: "sequence",
        state: "run",
        draft: true,
        steps: [
          { id: "parse", label: "parse payload", glyph: "1", state: "done", metric: "6ms" },
          { id: "enrich", label: "join repo context", glyph: "2", state: "run", metric: "18ms" },
          { id: "rank", label: "rank actions", glyph: "3", state: "wait", metric: "--" },
          { id: "emit", label: "emit scored plan", glyph: "4", state: "skip", metric: "--" }
        ],
        ports: [
          { id: "payload", side: "in", kind: "data", label: "scored payload in" },
          { id: "out", side: "out", kind: "flow", label: "continue after sequence" },
          { id: "err", side: "out", kind: "error", label: "sequence exception" }
        ],
        meta: { runs: "214", ms: "33", cost: "0.004", model: "local", version: "v7", lastRun: "09:42" }
      }
    },
    {
      id: "C03",
      label: "Should Deploy?",
      x: 430,
      y: -190,
      data: {
        kind: "if",
        state: "wait",
        code: ["return score > 0.82", "  && tests.ok", "  && budget.left > cost"],
        hitRate: { true: "68%", false: "32%" },
        meta: { runs: "214", ms: "2", cost: "0.000", model: "expr", version: "v3", lastRun: "09:42" }
      }
    },
    {
      id: "D04",
      label: "Compare Lanes",
      x: -250,
      y: 90,
      data: {
        kind: "lanes",
        state: "ok",
        lanes: [
          { id: "canary", label: "canary", state: "run", metric: "14/20", lines: ["2 regions", "slow ramp"] },
          { id: "stable", label: "stable", state: "ok", metric: "ready", lines: ["all regions", "fast cut"] }
        ],
        ports: [
          { id: "true", side: "in", kind: "cond-true", label: "true branch in" },
          { id: "winner", side: "out", kind: "data", label: "winner lane payload" },
          { id: "err", side: "out", kind: "error", label: "lane exception" }
        ],
        meta: { runs: "146", ms: "25", cost: "0.002", model: "lane", version: "v5", lastRun: "09:42" }
      }
    },
    {
      id: "C05",
      label: "Route Failure Class",
      x: 95,
      y: 105,
      data: {
        kind: "switch",
        state: "ok",
        activeCaseId: "retry",
        cases: [
          { id: "retry", label: "network retryable", hitRate: "41%", active: true },
          { id: "hold", label: "quota hold", hitRate: "18%" },
          { id: "page", label: "human page", hitRate: "9%" },
          { id: "drop", label: "drop noisy", hitRate: "32%" }
        ],
        meta: { runs: "68", ms: "4", cost: "0.000", model: "case", version: "v2", lastRun: "09:40" }
      }
    },
    {
      id: "D06",
      label: "Deploy Loop",
      x: 400,
      y: 95,
      data: {
        kind: "loop",
        state: "run",
        kv: [
          { key: "collection", value: "regions" },
          { key: "parallel", value: "2" },
          { key: "retry", value: "3x" }
        ],
        loop: { current: 7, total: 12, label: "regions" },
        meta: { runs: "38", ms: "122", cost: "0.018", model: "deploy", version: "v9", lastRun: "now" }
      }
    },
    {
      id: "E07",
      label: "LLM Summarizer",
      x: 95,
      y: 250,
      data: {
        kind: "token",
        role: "AI",
        state: "run",
        quickActions: ["\u25C9", "\u2316", "\u2691", "\u23F8", "\u22EF"],
        ports: [
          { id: "prompt", side: "in", kind: "data", label: "prompt payload" },
          { id: "ctx", side: "in", kind: "ctx", label: "runtime context" },
          { id: "tools", side: "in", kind: "tool", label: "tool bindings" },
          { id: "tokens", side: "out", kind: "data", label: "token stream" },
          { id: "output", side: "out", kind: "flow", label: "summarized output" },
          { id: "err", side: "out", kind: "error", label: "model exception" }
        ],
        meta: { runs: "92", ms: "841", cost: "0.027", model: "gpt", version: "v11", lastRun: "now" }
      }
    },
    {
      id: "END",
      label: "Terminal",
      x: 420,
      y: 250,
      data: {
        kind: "end",
        state: "idle",
        stripe: "end",
        kv: [
          { key: "result", value: "archive" },
          { key: "notify", value: "slack" }
        ],
        meta: { runs: "279", ms: "3", cost: "0.000", model: "sink", version: "v1", lastRun: "09:42" }
      }
    }
  ];
  var FLOW_EDITOR_DEMO_EDGES = [
    { id: "e1", from: "TRG", fromPort: "out", to: "A01", toPort: "in", kind: "flow" },
    { id: "e2", from: "A01", fromPort: "payload", to: "B02", toPort: "payload", kind: "data" },
    { id: "e3", from: "B02", fromPort: "out", to: "C03", toPort: "in", kind: "flow" },
    { id: "e4", from: "C03", fromPort: "true", to: "D04", toPort: "true", kind: "cond-true" },
    { id: "e5", from: "C03", fromPort: "false", to: "C05", toPort: "in", kind: "cond-false" },
    { id: "e6", from: "D04", fromPort: "winner", to: "D06", toPort: "in", kind: "data" },
    { id: "e7", from: "C05", fromPort: "retry", to: "D06", toPort: "in", kind: "cond-true" },
    { id: "e8", from: "D06", fromPort: "item", to: "E07", toPort: "ctx", kind: "loop" },
    { id: "e9", from: "E07", fromPort: "output", to: "END", toPort: "in", kind: "flow" },
    { id: "e10", from: "A01", fromPort: "err", to: "END", toPort: "err", kind: "error" },
    { id: "e11", from: "E07", fromPort: "err", to: "END", toPort: "err", kind: "error" },
    { id: "e12", from: "TRG", fromPort: "ctx", to: "E07", toPort: "tools", kind: "tool" }
  ];

  // cart/app/isolated_tests/flow_editor.tsx
  function cloneNodes(nodes) {
    return nodes.map((node) => ({ ...node }));
  }
  function cloneEdges(edges) {
    return edges.map((edge) => ({ ...edge }));
  }
  function newActionData() {
    return {
      kind: "action",
      role: "ACT",
      state: "idle",
      kv: [
        { key: "method", value: "GET" },
        { key: "url", value: "/new-step" },
        { key: "auth", value: "none" },
        { key: "timeout", value: "30s" }
      ],
      meta: { runs: "0", ms: "--", cost: "--", model: "--", version: "v0", lastRun: "never" }
    };
  }
  function FlowEditorCart() {
    const theme = FLOW_EDITOR_DEFAULT_THEME;
    const [revision, setRevision] = (0, import_react3.useState)(0);
    const flow = useFlowEditorState({
      initialNodes: cloneNodes(FLOW_EDITOR_DEMO_NODES),
      initialEdges: cloneEdges(FLOW_EDITOR_DEMO_EDGES)
    });
    const resetDemo = () => {
      flow.setNodes(cloneNodes(FLOW_EDITOR_DEMO_NODES));
      flow.setEdges(cloneEdges(FLOW_EDITOR_DEMO_EDGES));
      flow.setPending(null);
      flow.setSelectedId(null);
      setRevision((value) => value + 1);
    };
    const clearAll = () => {
      flow.clearAll();
      setRevision((value) => value + 1);
    };
    const status = `${flow.nodes.length} nodes \xB7 ${flow.edges.length} wires \xB7 click a hairline pin to start wiring`;
    return /* @__PURE__ */ __jsx(Col, { style: { width: "100%", height: "100%", backgroundColor: theme.bg } }, /* @__PURE__ */ __jsx(
      Row,
      {
        style: {
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 10,
          alignItems: "center",
          borderBottomWidth: 1,
          borderColor: theme.frameColor,
          backgroundColor: theme.headerBg
        }
      },
      /* @__PURE__ */ __jsx(
        Pressable,
        {
          onPress: () => flow.addNode(void 0, newActionData()),
          style: {
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            backgroundColor: theme.flowColor
          }
        },
        /* @__PURE__ */ __jsx(Text, { fontSize: 11, color: "theme:bg", style: { fontWeight: "bold" } }, "+ Add action")
      ),
      /* @__PURE__ */ __jsx(
        Pressable,
        {
          onPress: resetDemo,
          style: {
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            borderWidth: 1,
            borderColor: theme.frameColor,
            backgroundColor: theme.bodyBg
          }
        },
        /* @__PURE__ */ __jsx(Text, { fontSize: 11, color: theme.textDim }, "reset demo")
      ),
      /* @__PURE__ */ __jsx(
        Pressable,
        {
          onPress: clearAll,
          style: {
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            borderWidth: 1,
            borderColor: theme.frameColor
          }
        },
        /* @__PURE__ */ __jsx(Text, { fontSize: 11, color: theme.textDim }, "clear")
      ),
      /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: theme.textDim, style: { marginLeft: 6 } }, status)
    ), /* @__PURE__ */ __jsx(Box, { style: { flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0 } }, /* @__PURE__ */ __jsx(
      FlowEditor,
      {
        key: revision,
        nodes: flow.nodes,
        edges: flow.edges,
        onNodesChange: flow.setNodes,
        onEdgesChange: flow.setEdges,
        theme
      }
    )));
  }

  // runtime/cartridge_entry.tsx
  var g = globalThis;
  var slot = g.__cartridgeLoadSlot;
  if (slot && typeof slot === "object") {
    slot.App = FlowEditorCart;
  } else {
    g.__lastCartridge = FlowEditorCart;
  }
})();
