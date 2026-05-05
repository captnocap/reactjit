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
    let set3 = _listeners.get(channel);
    if (!set3) {
      set3 = /* @__PURE__ */ new Set();
      _listeners.set(channel, set3);
    }
    set3.add(fn);
    return () => {
      set3.delete(fn);
    };
  }
  function dispatchListeners(channel, payload) {
    const set3 = _listeners.get(channel);
    if (!set3 || set3.size === 0) return;
    for (const fn of Array.from(set3)) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[ffi] ${channel} listener error:`, e?.message || e);
      }
    }
  }
  function emit(channel, payload) {
    dispatchListeners(channel, payload);
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
    window: () => window2
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
  var THEME_PREFIX2, Box, Row, Col, Text, GLYPH_SLOT, Image, Pressable, ScrollView, TextInput, TextArea, TextEditor, Terminal, terminal, Window, window2, Notification, notification, Video, Cartridge, RenderTarget, StaticSurface, Filter, PhysicsBase, Physics, Scene3DBase, Scene3D, AudioBase2, Audio3, CanvasBase, Canvas, GraphBase, Graph, Render, Effect, _NativeMemoized, Native;
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
      window2 = Window;
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

  // runtime/hooks/http.ts
  var http_exports = {};
  __export(http_exports, {
    download: () => download,
    get: () => get,
    getAsync: () => getAsync,
    installEventSourceShim: () => installEventSourceShim,
    installFetchShim: () => installFetchShim,
    post: () => post,
    postAsync: () => postAsync,
    request: () => request,
    requestAsync: () => requestAsync,
    requestStream: () => requestStream
  });
  function request(req) {
    return callHostJson(
      "__http_request_sync",
      { status: 0, headers: {}, body: "", error: "http not wired" },
      JSON.stringify(req)
    );
  }
  function get(url, headers) {
    return request({ method: "GET", url, headers });
  }
  function post(url, body, headers) {
    return request({ method: "POST", url, body, headers });
  }
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
  function getAsync(url, headers) {
    return requestAsync({ method: "GET", url, headers });
  }
  function postAsync(url, body, headers) {
    return requestAsync({ method: "POST", url, body, headers });
  }
  function requestStream(req, cb) {
    const rid = `s${_streamSeq++}`;
    const unsubChunk = subscribe2(`http-stream:${rid}`, (data) => {
      const s = typeof data === "string" ? data : String(data);
      cb.onChunk?.(s);
    });
    const unsubEnd = subscribe2(`http-stream-end:${rid}`, (raw) => {
      let obj = {};
      try {
        obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
      }
      unsubChunk();
      unsubEnd();
      if (typeof obj.error === "string") cb.onError?.(obj.error);
      else cb.onComplete?.({ status: obj.status ?? 0 });
    });
    callHost("__http_stream_open", void 0, JSON.stringify(req), rid);
    return {
      close: () => {
        unsubChunk();
        unsubEnd();
        callHost("__http_stream_close", void 0, rid);
      }
    };
  }
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
  function installFetchShim() {
    globalThis.fetch = async (url, init = {}) => {
      const r2 = await requestAsync({
        method: (init.method || "GET").toUpperCase(),
        url,
        headers: init.headers,
        body: init.body,
        via: init.via
      });
      return {
        ok: r2.status >= 200 && r2.status < 300,
        status: r2.status,
        statusText: "",
        headers: { get: (k) => r2.headers[k.toLowerCase()] || null },
        text: async () => r2.body,
        json: async () => JSON.parse(r2.body),
        blob: async () => {
          throw new Error("fetch shim: blob() not supported");
        },
        arrayBuffer: async () => {
          throw new Error("fetch shim: arrayBuffer() not supported");
        }
      };
    };
  }
  function installEventSourceShim() {
    globalThis.EventSource = ReactjitEventSource;
  }
  var _reqIdSeq, _streamSeq, _dlSeq, ReactjitEventSource;
  var init_http = __esm({
    "runtime/hooks/http.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ffi();
      _reqIdSeq = 1;
      _streamSeq = 1;
      _dlSeq = 1;
      ReactjitEventSource = class _ReactjitEventSource {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSED = 2;
        url;
        readyState = _ReactjitEventSource.CONNECTING;
        onopen = null;
        onmessage = null;
        onerror = null;
        _handle = null;
        _named = /* @__PURE__ */ new Map();
        _leftover = "";
        _evName = "message";
        _evData = "";
        _evId;
        constructor(url, _init) {
          this.url = url;
          this._handle = requestStream(
            { method: "GET", url, headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" } },
            {
              onChunk: (s) => {
                if (this.readyState === _ReactjitEventSource.CONNECTING) {
                  this.readyState = _ReactjitEventSource.OPEN;
                  this.onopen?.({ type: "open" });
                }
                this._feed(s);
              },
              onComplete: () => {
                if (this._leftover !== "") this._feed("\n");
                this.readyState = _ReactjitEventSource.CLOSED;
              },
              onError: (msg) => {
                this.readyState = _ReactjitEventSource.CLOSED;
                this.onerror?.({ type: "error", message: msg });
              }
            }
          );
        }
        addEventListener(name, handler) {
          let set3 = this._named.get(name);
          if (!set3) {
            set3 = /* @__PURE__ */ new Set();
            this._named.set(name, set3);
          }
          set3.add(handler);
        }
        removeEventListener(name, handler) {
          this._named.get(name)?.delete(handler);
        }
        close() {
          this.readyState = _ReactjitEventSource.CLOSED;
          this._handle?.close();
          this._handle = null;
        }
        _feed(incoming) {
          const buf = this._leftover + incoming;
          const lines = buf.split(/\r\n|\r|\n/);
          this._leftover = lines.pop() ?? "";
          for (const line of lines) {
            if (line === "") {
              this._dispatch();
              continue;
            }
            if (line.startsWith(":")) continue;
            const sep = line.indexOf(":");
            const field = sep === -1 ? line : line.slice(0, sep);
            let value = sep === -1 ? "" : line.slice(sep + 1);
            if (value.startsWith(" ")) value = value.slice(1);
            if (field === "event") this._evName = value;
            else if (field === "data") this._evData = this._evData === "" ? value : `${this._evData}
${value}`;
            else if (field === "id") this._evId = value;
          }
        }
        _dispatch() {
          if (this._evData === "" && this._evName === "message") {
            this._evName = "message";
            this._evData = "";
            this._evId = void 0;
            return;
          }
          const ev = { type: this._evName, data: this._evData, lastEventId: this._evId ?? "" };
          if (this._evName === "message") this.onmessage?.(ev);
          const named = this._named.get(this._evName);
          if (named) for (const h2 of named) h2(ev);
          this._evName = "message";
          this._evData = "";
          this._evId = void 0;
        }
      };
    }
  });

  // runtime/hooks/ifttt-registry.ts
  function prefixMatches(spec, prefix) {
    if (spec === prefix) return true;
    if (prefix.endsWith(":") && spec.startsWith(prefix)) return true;
    return false;
  }
  function registerIfttSource(prefix, src) {
    _sources.set(prefix, src);
  }
  function setIfttFallback(src) {
    _fallback = src;
  }
  function resolveTrigger(spec) {
    let bestPrefix = "";
    let bestSrc = null;
    for (const [p, s] of _sources) {
      if (!prefixMatches(spec, p)) continue;
      if (p.length > bestPrefix.length) {
        bestPrefix = p;
        bestSrc = s;
      }
    }
    if (bestSrc) {
      const sub = bestSrc.match(spec);
      if (sub) return sub;
    }
    return _fallback ? _fallback.match(spec) : null;
  }
  function registerIfttAction(prefix, run) {
    _actions.set(prefix, run);
  }
  function dispatchAction(action, payload) {
    let bestPrefix = "";
    let bestRunner = null;
    for (const [p, r2] of _actions) {
      if (!prefixMatches(action, p)) continue;
      if (p.length > bestPrefix.length) {
        bestPrefix = p;
        bestRunner = r2;
      }
    }
    if (!bestRunner) return false;
    bestRunner(action.slice(bestPrefix.length), payload);
    return true;
  }
  var _sources, _actions, _fallback;
  var init_ifttt_registry = __esm({
    "runtime/hooks/ifttt-registry.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      _sources = /* @__PURE__ */ new Map();
      _actions = /* @__PURE__ */ new Map();
      _fallback = null;
    }
  });

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
  var _watchRefs;
  var init_process = __esm({
    "runtime/hooks/process.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ffi();
      init_ifttt_registry();
      _watchRefs = /* @__PURE__ */ new Map();
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
    }
  });

  // runtime/hooks/localstore.ts
  var localstore_exports = {};
  __export(localstore_exports, {
    clear: () => clear,
    get: () => get2,
    getJson: () => getJson,
    installLocalStorageShim: () => installLocalStorageShim,
    keys: () => keys,
    nsClear: () => nsClear,
    nsDelete: () => nsDelete,
    nsGet: () => nsGet,
    nsHas: () => nsHas,
    nsKeys: () => nsKeys,
    nsSet: () => nsSet,
    remove: () => remove,
    set: () => set,
    setJson: () => setJson
  });
  function get2(key) {
    return callHost("__store_get", null, key);
  }
  function set(key, value) {
    callHost("__store_set", void 0, key, value);
  }
  function remove(key) {
    callHost("__store_remove", void 0, key);
  }
  function clear() {
    callHost("__store_clear", void 0);
  }
  function keys() {
    return callHostJson("__store_keys_json", []);
  }
  function nsGet(namespace, key) {
    return callHost("__localstoreGet", "", namespace, key);
  }
  function nsHas(namespace, key) {
    return callHost("__localstoreHas", 0, namespace, key) === 1;
  }
  function nsSet(namespace, key, value) {
    callHost("__localstoreSet", void 0, namespace, key, value);
  }
  function nsDelete(namespace, key) {
    callHost("__localstoreDelete", void 0, namespace, key);
  }
  function nsClear(namespace = "") {
    callHost("__localstoreClear", void 0, namespace);
  }
  function nsKeys(namespace) {
    return callHostJson("__localstoreKeysJson", [], namespace);
  }
  function getJson(key, fallback) {
    const raw = get2(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function setJson(key, value) {
    set(key, JSON.stringify(value));
  }
  function installLocalStorageShim() {
    globalThis.localStorage = {
      getItem: (k) => get2(k),
      setItem: (k, v) => set(k, v),
      removeItem: (k) => remove(k),
      clear: () => clear(),
      key: (i) => keys()[i] ?? null,
      get length() {
        return keys().length;
      }
    };
  }
  var init_localstore = __esm({
    "runtime/hooks/localstore.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ffi();
    }
  });

  // runtime/hooks/clipboard.ts
  function get3() {
    return callHost("__clipboard_get", "");
  }
  function set2(value) {
    callHost("__clipboard_set", void 0, value);
  }
  var init_clipboard = __esm({
    "runtime/hooks/clipboard.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ffi();
    }
  });

  // runtime/hooks/websocket.ts
  var websocket_exports = {};
  __export(websocket_exports, {
    ReactjitWebSocket: () => ReactjitWebSocket,
    installWebSocketShim: () => installWebSocketShim
  });
  function installWebSocketShim() {
    globalThis.WebSocket = ReactjitWebSocket;
  }
  var _idSeq, ReactjitWebSocket;
  var init_websocket = __esm({
    "runtime/hooks/websocket.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ffi();
      _idSeq = 1;
      ReactjitWebSocket = class {
        id;
        url;
        onopen = null;
        onmessage = null;
        onclose = null;
        onerror = null;
        _unsubs = [];
        constructor(url) {
          this.id = _idSeq++;
          this.url = url;
          this._unsubs.push(subscribe2(`ws:open:${this.id}`, () => {
            this.onopen?.({});
          }));
          this._unsubs.push(subscribe2(`ws:message:${this.id}`, (data) => {
            this.onmessage?.({ data });
          }));
          this._unsubs.push(subscribe2(`ws:close:${this.id}`, (p) => {
            this.onclose?.(p);
            this._cleanup();
          }));
          this._unsubs.push(subscribe2(`ws:error:${this.id}`, (msg) => {
            this.onerror?.({ message: msg });
          }));
          callHost("__ws_open", void 0, this.id, url);
        }
        send(data) {
          callHost("__ws_send", void 0, this.id, data);
        }
        close(code, reason) {
          callHost("__ws_close", void 0, this.id);
          this._cleanup();
        }
        _cleanup() {
          for (const u of this._unsubs) u();
          this._unsubs = [];
        }
      };
    }
  });

  // runtime/hooks/ifttt-compose.ts
  function isComposable(value) {
    if (value == null) return false;
    if (typeof value === "string" || typeof value === "function") return false;
    if (typeof value !== "object") return false;
    return "on" in value || "all" in value || "any" in value || "seq" in value || "trigger" in value;
  }
  function compileLeafString(spec) {
    let level = false;
    const subs = /* @__PURE__ */ new Set();
    let unsub = null;
    const ensureSubscribed = () => {
      if (unsub != null) return;
      const resolved = resolveTrigger(spec);
      if (!resolved) {
        console.warn(`[ifttt-compose] no source for leaf '${spec}'`);
        return;
      }
      unsub = resolved.subscribe((payload) => {
        level = true;
        for (const fn of Array.from(subs)) fn(true, payload);
        queueMicrotask(() => {
          if (!level) return;
          level = false;
          for (const fn of Array.from(subs)) fn(false, payload);
        });
      });
    };
    return {
      value: () => level,
      subscribe(fn) {
        subs.add(fn);
        ensureSubscribed();
        return () => {
          subs.delete(fn);
          if (subs.size === 0 && unsub) {
            unsub();
            unsub = null;
          }
        };
      }
    };
  }
  function compileLeafFn(fn) {
    let level = false;
    const subs = /* @__PURE__ */ new Set();
    let timer = null;
    const evalNow = () => {
      let cur = false;
      try {
        cur = !!fn();
      } catch {
        cur = false;
      }
      if (cur === level) return;
      level = cur;
      for (const s of Array.from(subs)) s(level, void 0);
    };
    return {
      value: () => level,
      subscribe(s) {
        subs.add(s);
        if (timer == null) {
          evalNow();
          timer = setInterval(evalNow, POLL_MS);
        }
        return () => {
          subs.delete(s);
          if (subs.size === 0 && timer != null) {
            clearInterval(timer);
            timer = null;
          }
        };
      }
    };
  }
  function compileAll(children) {
    const compiled = children.map(compile);
    let level = false;
    let lastPayload;
    const subs = /* @__PURE__ */ new Set();
    const recompute = (payload) => {
      const next = compiled.every((c) => c.value());
      if (next === level) return;
      level = next;
      if (level) lastPayload = payload;
      for (const s of Array.from(subs)) s(level, lastPayload);
    };
    return {
      value: () => level,
      subscribe(s) {
        subs.add(s);
        const unsubs = compiled.map(
          (c) => c.subscribe((_lvl, p) => recompute(p))
        );
        return () => {
          subs.delete(s);
          for (const u of unsubs) u();
        };
      }
    };
  }
  function compileAny(children) {
    const compiled = children.map(compile);
    let level = false;
    let lastPayload;
    const subs = /* @__PURE__ */ new Set();
    const recompute = (payload) => {
      const next = compiled.some((c) => c.value());
      if (next === level) return;
      level = next;
      if (level) lastPayload = payload;
      for (const s of Array.from(subs)) s(level, lastPayload);
    };
    return {
      value: () => level,
      subscribe(s) {
        subs.add(s);
        const unsubs = compiled.map(
          (c) => c.subscribe((_lvl, p) => recompute(p))
        );
        return () => {
          subs.delete(s);
          for (const u of unsubs) u();
        };
      }
    };
  }
  function compileSeq(children, within) {
    const compiled = children.map(compile);
    const subs = /* @__PURE__ */ new Set();
    return {
      value: () => false,
      // edge-only
      subscribe(s) {
        subs.add(s);
        let idx = 0;
        let firstAt = 0;
        const unsubs = compiled.map(
          (c, i) => c.subscribe((level, payload) => {
            if (!level) return;
            const now = Date.now();
            if (i === 0 && idx === 0) {
              idx = 1;
              firstAt = now;
              return;
            }
            if (i === idx && now - firstAt <= within) {
              idx += 1;
              if (idx === compiled.length) {
                for (const f of Array.from(subs)) f(true, payload);
                queueMicrotask(() => {
                  for (const f of Array.from(subs)) f(false, payload);
                });
                idx = 0;
                firstAt = 0;
              }
              return;
            }
            idx = i === 0 ? 1 : 0;
            firstAt = i === 0 ? now : 0;
          })
        );
        return () => {
          subs.delete(s);
          for (const u of unsubs) u();
        };
      }
    };
  }
  function compileOn(on, when) {
    const onNodes = (Array.isArray(on) ? on : [on]).map(compile);
    const subs = /* @__PURE__ */ new Set();
    return {
      value: () => false,
      // edge-only
      subscribe(s) {
        subs.add(s);
        const unsubs = onNodes.map(
          (n) => n.subscribe((level, payload) => {
            if (!level) return;
            if (when) {
              let pass = false;
              try {
                pass = !!when();
              } catch {
                pass = false;
              }
              if (!pass) return;
            }
            for (const f of Array.from(subs)) f(true, payload);
            queueMicrotask(() => {
              for (const f of Array.from(subs)) f(false, payload);
            });
          })
        );
        return () => {
          subs.delete(s);
          for (const u of unsubs) u();
        };
      }
    };
  }
  function compileModifier(spec) {
    const inner = compile(spec.trigger);
    const subs = /* @__PURE__ */ new Set();
    let lastFireAt = 0;
    let fired = false;
    let debounceTimer = null;
    const emit2 = (payload) => {
      lastFireAt = Date.now();
      fired = true;
      for (const f of Array.from(subs)) f(true, payload);
      queueMicrotask(() => {
        for (const f of Array.from(subs)) f(false, payload);
      });
    };
    const tryFire = (payload) => {
      const now = Date.now();
      if (spec.once && fired) return;
      if (spec.cooldown != null && lastFireAt > 0 && now - lastFireAt < spec.cooldown) return;
      if (spec.throttle != null && lastFireAt > 0 && now - lastFireAt < spec.throttle) return;
      if (spec.debounce != null) {
        if (debounceTimer != null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          emit2(payload);
        }, spec.debounce);
        return;
      }
      emit2(payload);
    };
    return {
      value: () => false,
      subscribe(s) {
        subs.add(s);
        const unsub = inner.subscribe((level, payload) => {
          if (level) tryFire(payload);
        });
        return () => {
          subs.delete(s);
          unsub();
        };
      }
    };
  }
  function compile(node) {
    if (typeof node === "string") return compileLeafString(node);
    if (typeof node === "function") return compileLeafFn(node);
    if ("all" in node) return compileAll(node.all);
    if ("any" in node) return compileAny(node.any);
    if ("seq" in node) return compileSeq(node.seq, node.within);
    if ("on" in node) return compileOn(node.on, node.when);
    if ("trigger" in node) return compileModifier(node);
    throw new Error("[ifttt-compose] unrecognised node shape");
  }
  function compileTrigger(node) {
    const root = compile(node);
    return {
      subscribe(onFire) {
        return root.subscribe((level, payload) => {
          if (level) onFire(payload);
        });
      }
    };
  }
  function substituteAction(template, payload) {
    if (!template || template.indexOf("$") < 0) return template;
    return template.replace(/\$payload(?:\.([\w.]+))?/g, (_m, path) => {
      if (!path) {
        try {
          return JSON.stringify(payload);
        } catch {
          return "";
        }
      }
      const parts = path.split(".");
      let v = payload;
      for (const p of parts) {
        if (v == null) return "";
        v = v[p];
      }
      return v == null ? "" : String(v);
    }).replace(/\$id\b/g, String(payload?.id ?? payload?.pid ?? "")).replace(/\$pid\b/g, String(payload?.pid ?? payload?.id ?? ""));
  }
  var POLL_MS;
  var init_ifttt_compose = __esm({
    "runtime/hooks/ifttt-compose.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ifttt_registry();
      POLL_MS = 50;
    }
  });

  // runtime/hooks/useFileWatch.ts
  function ensureDrainTimer() {
    if (drainTimer != null) return;
    drainTimer = setInterval(() => {
      if (listeners2.size === 0) return;
      const raw = host4().__fswatchDrain?.() ?? "[]";
      if (!raw || raw === "[]") return;
      let events = [];
      try {
        events = JSON.parse(raw);
      } catch {
        return;
      }
      for (const ev of events) {
        const fn = listeners2.get(ev.w);
        if (fn) fn({ watcherId: ev.w, type: ev.t, path: ev.p, size: ev.s, mtimeNs: ev.m });
      }
    }, 100);
  }
  function stopDrainTimerIfIdle() {
    if (listeners2.size > 0) return;
    if (drainTimer != null) {
      clearInterval(drainTimer);
      drainTimer = null;
    }
  }
  function attachWatcher(path, fn, opts = {}) {
    const id = host4().__fswatchAdd?.(
      path,
      opts.recursive ? 1 : 0,
      opts.intervalMs ?? 1e3,
      opts.pattern ?? ""
    ) ?? -1;
    if (id < 0) return () => {
    };
    listeners2.set(id, fn);
    ensureDrainTimer();
    return () => {
      host4().__fswatchRemove?.(id);
      listeners2.delete(id);
      stopDrainTimerIfIdle();
    };
  }
  function registerFsSource(prefix, filter) {
    registerIfttSource(prefix, {
      match(spec) {
        if (!spec.startsWith(prefix)) return null;
        const path = spec.slice(prefix.length);
        if (!path) return null;
        return {
          subscribe(onFire) {
            return attachWatcher(path, (ev) => {
              if (filter && ev.type !== filter) return;
              onFire(ev);
            }, { recursive: true });
          }
        };
      }
    });
  }
  var host4, listeners2, drainTimer;
  var init_useFileWatch = __esm({
    "runtime/hooks/useFileWatch.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ifttt_registry();
      host4 = () => globalThis;
      listeners2 = /* @__PURE__ */ new Map();
      drainTimer = null;
      registerFsSource("fs:changed:", "modified");
      registerFsSource("fs:created:", "created");
      registerFsSource("fs:deleted:", "deleted");
      registerFsSource("fs:any:", null);
    }
  });

  // runtime/hooks/useIFTTT.ts
  var useIFTTT_exports = {};
  __export(useIFTTT_exports, {
    busEmit: () => busEmit,
    busOn: () => busOn,
    dispatchClaudeEvent: () => dispatchClaudeEvent,
    getSharedState: () => getSharedState,
    setSharedState: () => setSharedState,
    useIFTTT: () => useIFTTT
  });
  function busOn(event, fn) {
    return subscribe2(event, fn);
  }
  function busEmit(event, payload) {
    emit(event, payload);
  }
  function getSharedState(key) {
    return state.get(key);
  }
  function setSharedState(key, value) {
    const prev = state.get(key);
    if (prev === value) return;
    state.set(key, value);
    const watchers = stateWatchers.get(key);
    if (watchers) for (const fn of Array.from(watchers)) {
      try {
        fn(value);
      } catch (e) {
        console.error(`[ifttt] state watcher error for '${key}':`, e?.message || e);
      }
    }
  }
  function watchSharedState(key, fn) {
    let set3 = stateWatchers.get(key);
    if (!set3) {
      set3 = /* @__PURE__ */ new Set();
      stateWatchers.set(key, set3);
    }
    set3.add(fn);
    return () => {
      set3.delete(fn);
    };
  }
  function decodeKey(packed) {
    const sym = packed & 65535;
    const mod = packed >> 16 & 65535;
    let key = SDL_KEY_NAMES[sym];
    if (!key) {
      if (sym >= 32 && sym < 127) key = String.fromCharCode(sym).toLowerCase();
      else key = `sdl:${sym}`;
    }
    return {
      key,
      ctrlKey: (mod & SDL_KMOD_CTRL) !== 0,
      shiftKey: (mod & SDL_KMOD_SHIFT) !== 0,
      altKey: (mod & SDL_KMOD_ALT) !== 0,
      metaKey: (mod & SDL_KMOD_GUI) !== 0
    };
  }
  function dispatchClaudeEvent(input) {
    let entry = null;
    if (typeof input === "string") {
      try {
        entry = JSON.parse(input);
      } catch {
        return;
      }
    } else {
      entry = input;
    }
    if (!entry || typeof entry !== "object") return;
    const tool = String(entry.tool ?? "").toLowerCase();
    const phase = String(entry.phase ?? "").toLowerCase();
    emit("system:claude", entry);
    if (tool) emit(`system:claude:${tool}`, entry);
    if (phase) emit(`system:claude:${phase}`, entry);
  }
  function parseKey(spec) {
    const parts = spec.toLowerCase().split("+");
    const key = parts.pop() ?? "";
    const out = { key };
    for (const m of parts) {
      if (m === "ctrl" || m === "control") out.ctrl = true;
      else if (m === "shift") out.shift = true;
      else if (m === "alt" || m === "option") out.alt = true;
      else if (m === "meta" || m === "cmd" || m === "command") out.meta = true;
    }
    return out;
  }
  function keyMatches(ev, spec) {
    const ek = String(ev?.key ?? "").toLowerCase();
    if (ek !== spec.key) return false;
    if (!!spec.ctrl !== !!ev?.ctrlKey) return false;
    if (!!spec.shift !== !!ev?.shiftKey) return false;
    if (!!spec.alt !== !!ev?.altKey) return false;
    if (!!spec.meta !== !!ev?.metaKey) return false;
    return true;
  }
  function coerce(raw) {
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw === "null") return null;
    if (raw === "") return "";
    const n = Number(raw);
    if (!Number.isNaN(n) && /^[+-]?\d+(\.\d+)?$/.test(raw)) return n;
    return raw;
  }
  function runStringAction(action, payload) {
    const resolved = substituteAction(action, payload);
    if (!dispatchAction(resolved, payload)) {
      console.warn(`[ifttt] unknown action '${resolved}'`);
    }
  }
  function useIFTTT(trigger, action) {
    const [, forceTick] = (0, import_react2.useState)(0);
    const counterRef = (0, import_react2.useRef)(0);
    const lastRef = (0, import_react2.useRef)(void 0);
    const lastAtRef = (0, import_react2.useRef)(0);
    const actionRef = (0, import_react2.useRef)(action);
    actionRef.current = action;
    const fire = (event) => {
      counterRef.current += 1;
      lastRef.current = event;
      lastAtRef.current = Date.now();
      const a = actionRef.current;
      if (typeof a === "function") a(event);
      else runStringAction(a, event);
      forceTick((n) => n + 1 & 65535);
    };
    const fireRef = (0, import_react2.useRef)(fire);
    fireRef.current = fire;
    const isFnTrigger = typeof trigger === "function";
    const prevCondRef = (0, import_react2.useRef)(false);
    (0, import_react2.useEffect)(() => {
      if (!isFnTrigger) {
        prevCondRef.current = false;
        return;
      }
      let cur = false;
      try {
        cur = !!trigger();
      } catch {
        cur = false;
      }
      if (cur && !prevCondRef.current) fireRef.current(void 0);
      prevCondRef.current = cur;
    });
    const composeKey = (() => {
      if (typeof trigger === "string") return `s:${trigger}`;
      if (typeof trigger === "function") return null;
      try {
        return `c:${JSON.stringify(trigger)}`;
      } catch {
        return null;
      }
    })();
    (0, import_react2.useEffect)(() => {
      if (typeof trigger === "function") return;
      let sub;
      if (typeof trigger === "string") {
        sub = resolveTrigger(trigger);
        if (!sub) {
          console.warn(`[ifttt] no source for trigger '${trigger}'`);
          return;
        }
      } else if (isComposable(trigger)) {
        sub = compileTrigger(trigger);
      } else {
        return;
      }
      return sub.subscribe((ev) => fireRef.current(ev));
    }, [composeKey]);
    return {
      fired: counterRef.current,
      lastEvent: lastRef.current,
      lastFiredAt: lastAtRef.current,
      fire
    };
  }
  var import_react2, state, stateWatchers, SDL_KMOD_SHIFT, SDL_KMOD_CTRL, SDL_KMOD_ALT, SDL_KMOD_GUI, SDL_KEY_NAMES, G;
  var init_useIFTTT = __esm({
    "runtime/hooks/useIFTTT.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      import_react2 = __toESM(require_react(), 1);
      init_clipboard();
      init_ffi();
      init_ifttt_registry();
      init_ifttt_compose();
      init_process();
      init_useFileWatch();
      state = /* @__PURE__ */ new Map();
      stateWatchers = /* @__PURE__ */ new Map();
      SDL_KMOD_SHIFT = 3;
      SDL_KMOD_CTRL = 192;
      SDL_KMOD_ALT = 768;
      SDL_KMOD_GUI = 3072;
      SDL_KEY_NAMES = {
        8: "backspace",
        9: "tab",
        13: "enter",
        27: "escape",
        32: "space",
        127: "delete",
        // Arrow keys (SDL3 scancode | 0x40000000)
        1073741904: "left",
        1073741906: "up",
        1073741903: "right",
        1073741905: "down",
        // Function keys
        1073741882: "f1",
        1073741883: "f2",
        1073741884: "f3",
        1073741885: "f4",
        1073741886: "f5",
        1073741887: "f6",
        1073741888: "f7",
        1073741889: "f8",
        1073741890: "f9",
        1073741891: "f10",
        1073741892: "f11",
        1073741893: "f12",
        // Editing / navigation
        1073741897: "insert",
        1073741898: "home",
        1073741901: "end",
        1073741899: "pageup",
        1073741902: "pagedown"
      };
      G = globalThis;
      if (!G.__ifttt_handlers_installed) {
        G.__ifttt_handlers_installed = true;
        G.__ifttt_onKeyDown = (packed) => emit("__keydown", decodeKey(packed));
        G.__ifttt_onKeyUp = (packed) => emit("__keyup", decodeKey(packed));
        G.__ifttt_onClipboardChange = () => {
          let text = "";
          try {
            text = get3();
          } catch {
          }
          emit("system:clipboard", text);
        };
        G.__ifttt_onSystemFocus = (gained) => {
          emit(gained ? "system:focus" : "system:blur", { at: Date.now() });
        };
        G.__ifttt_onSystemDrop = () => {
          let path = "";
          try {
            path = String(G.__sys_drop_path?.() ?? "");
          } catch {
          }
          emit("system:fileDropped", path);
        };
        G.__ifttt_onSystemCursor = (x, y, dx, dy) => {
          emit("system:cursor:move", { x, y, dx, dy });
        };
        G.__ifttt_onSystemSlowFrame = (ms) => emit("system:slowFrame", { ms });
        G.__ifttt_onSystemHang = (count) => emit("system:hang", { count });
        G.__ifttt_onSystemRam = (used, total) => {
          const percent = total > 0 ? used / total * 100 : 0;
          emit("system:ram", { used, total, percent });
        };
        G.__ifttt_onSystemVram = (used, total) => {
          const percent = total > 0 ? used / total * 100 : 0;
          emit("system:vram", { used, total, percent });
        };
        G.__ifttt_onSystemResize = (w, h2) => {
          emit("system:resize", { w, h: h2 });
        };
      }
      registerIfttSource("mount", {
        match(spec) {
          if (spec !== "mount") return null;
          return {
            subscribe(onFire) {
              onFire({ at: Date.now() });
              return () => {
              };
            }
          };
        }
      });
      registerIfttSource("click", {
        match(spec) {
          if (spec !== "click") return null;
          return { subscribe(onFire) {
            return subscribe2("__click", onFire);
          } };
        }
      });
      registerIfttSource("key:up:", {
        match(spec) {
          if (!spec.startsWith("key:up:")) return null;
          const ks = parseKey(spec.slice("key:up:".length));
          return {
            subscribe(onFire) {
              return subscribe2("__keyup", (ev) => {
                if (keyMatches(ev, ks)) onFire(ev);
              });
            }
          };
        }
      });
      registerIfttSource("key:", {
        match(spec) {
          if (!spec.startsWith("key:")) return null;
          const ks = parseKey(spec.slice("key:".length));
          return {
            subscribe(onFire) {
              return subscribe2("__keydown", (ev) => {
                if (keyMatches(ev, ks)) onFire(ev);
              });
            }
          };
        }
      });
      registerIfttSource("timer:every:", {
        match(spec) {
          if (!spec.startsWith("timer:every:")) return null;
          const ms = Math.max(1, Number(spec.slice("timer:every:".length)) || 0);
          return {
            subscribe(onFire) {
              const id = setInterval(() => onFire({ at: Date.now(), interval: ms }), ms);
              return () => clearInterval(id);
            }
          };
        }
      });
      registerIfttSource("timer:once:", {
        match(spec) {
          if (!spec.startsWith("timer:once:")) return null;
          const ms = Math.max(0, Number(spec.slice("timer:once:".length)) || 0);
          return {
            subscribe(onFire) {
              const id = setTimeout(() => onFire({ at: Date.now(), delay: ms }), ms);
              return () => clearTimeout(id);
            }
          };
        }
      });
      registerIfttSource("state:", {
        match(spec) {
          if (!spec.startsWith("state:")) return null;
          const rest = spec.slice("state:".length);
          const colon = rest.indexOf(":");
          const key = colon < 0 ? rest : rest.slice(0, colon);
          const expected = coerce(colon < 0 ? "" : rest.slice(colon + 1));
          return {
            subscribe(onFire) {
              if (getSharedState(key) === expected) onFire(getSharedState(key));
              return watchSharedState(key, (v) => {
                if (v === expected) onFire(v);
              });
            }
          };
        }
      });
      setIfttFallback({
        match(spec) {
          return { subscribe(onFire) {
            return subscribe2(spec, onFire);
          } };
        }
      });
      registerIfttAction("state:set:", (rest, _payload) => {
        const colon = rest.indexOf(":");
        const key = colon < 0 ? rest : rest.slice(0, colon);
        const raw = colon < 0 ? "" : rest.slice(colon + 1);
        setSharedState(key, coerce(raw));
      });
      registerIfttAction("state:toggle:", (rest, _payload) => {
        setSharedState(rest, !getSharedState(rest));
      });
      registerIfttAction("send:", (rest, payload) => {
        emit(rest, payload);
      });
      registerIfttAction("log:", (rest, payload) => {
        console.log("[ifttt]", rest, payload ?? "");
      });
      registerIfttAction("clipboard:", (rest, _payload) => {
        set2(rest);
      });
    }
  });

  // runtime/cartridge_entry.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/isolated_tests/input_lab/index.tsx
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

  // cart/app/isolated_tests/input_lab/index.tsx
  var import_react6 = __toESM(require_react());
  init_primitives();
  init_router();

  // runtime/hooks/index.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  init_fs();
  init_http();
  init_process();
  init_localstore();
  init_clipboard();
  init_websocket();
  init_useFileWatch();
  init_ffi();
  function installBrowserShims() {
    const httpMod = (init_http(), __toCommonJS(http_exports));
    httpMod.installFetchShim();
    httpMod.installEventSourceShim();
    (init_localstore(), __toCommonJS(localstore_exports)).installLocalStorageShim();
    (init_websocket(), __toCommonJS(websocket_exports)).installWebSocketShim();
    installResizeBridge();
  }
  var _resizeBridgeInstalled = false;
  function installResizeBridge() {
    if (_resizeBridgeInstalled) return;
    _resizeBridgeInstalled = true;
    const themeMod = (init_theme(), __toCommonJS(theme_exports));
    const ifttt = (init_useIFTTT(), __toCommonJS(useIFTTT_exports));
    const host5 = globalThis;
    let initialW = 0;
    try {
      if (typeof host5.__viewport_width === "function") {
        initialW = Number(host5.__viewport_width()) || 0;
      } else if (typeof host5.innerWidth === "number") {
        initialW = host5.innerWidth;
      }
    } catch {
    }
    if (initialW > 0) themeMod.setViewportWidth(initialW);
    ifttt.busOn("system:resize", (payload) => {
      const w = typeof payload?.w === "number" ? payload.w : 0;
      if (w > 0) themeMod.setViewportWidth(w);
    });
    if (typeof host5.addEventListener === "function") {
      try {
        host5.addEventListener("resize", () => {
          const w = typeof host5.innerWidth === "number" ? host5.innerWidth : 0;
          if (w > 0) themeMod.setViewportWidth(w);
        });
      } catch {
      }
    }
  }

  // runtime/tooltip/Tooltip.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react4 = __toESM(require_react(), 1);
  init_primitives();

  // runtime/tooltip/useAutoFlip.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react3 = __toESM(require_react(), 1);
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function chooseSide(anchor, side, tip, viewport, gap) {
    const space = {
      top: anchor.y - gap,
      bottom: viewport.height - (anchor.y + anchor.height) - gap,
      left: anchor.x - gap,
      right: viewport.width - (anchor.x + anchor.width) - gap
    };
    const fits = (picked) => {
      if (picked === "top") return space.top >= tip.height;
      if (picked === "bottom") return space.bottom >= tip.height;
      if (picked === "left") return space.left >= tip.width;
      return space.right >= tip.width;
    };
    if (fits(side)) return side;
    const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
    if (fits(opposite[side])) return opposite[side];
    return ["top", "bottom", "left", "right"].sort((a, b) => {
      const score = (picked) => {
        if (picked === "top") return space.top - tip.height;
        if (picked === "bottom") return space.bottom - tip.height;
        if (picked === "left") return space.left - tip.width;
        return space.right - tip.width;
      };
      return score(b) - score(a);
    })[0];
  }
  function useAutoFlip(props) {
    return (0, import_react3.useMemo)(() => {
      const anchor = props.anchor;
      const viewport = props.viewport;
      const gap = props.gap ?? 8;
      const padding = props.padding ?? 8;
      const side = props.side || "top";
      const size = props.size;
      if (!anchor || viewport.width <= 0 || viewport.height <= 0) {
        return {
          side,
          left: padding,
          top: padding,
          maxWidth: Math.max(0, viewport.width - padding * 2)
        };
      }
      const actualSide = chooseSide(anchor, side, size, viewport, gap);
      let left = anchor.x;
      let top = anchor.y;
      if (actualSide === "top") {
        left = anchor.x + anchor.width / 2 - size.width / 2;
        top = anchor.y - size.height - gap;
      } else if (actualSide === "bottom") {
        left = anchor.x + anchor.width / 2 - size.width / 2;
        top = anchor.y + anchor.height + gap;
      } else if (actualSide === "left") {
        left = anchor.x - size.width - gap;
        top = anchor.y + anchor.height / 2 - size.height / 2;
      } else {
        left = anchor.x + anchor.width + gap;
        top = anchor.y + anchor.height / 2 - size.height / 2;
      }
      left = clamp(left, padding, Math.max(padding, viewport.width - size.width - padding));
      top = clamp(top, padding, Math.max(padding, viewport.height - size.height - padding));
      return {
        side: actualSide,
        left,
        top,
        maxWidth: Math.max(0, viewport.width - padding * 2)
      };
    }, [props.anchor, props.gap, props.padding, props.side, props.size, props.viewport.height, props.viewport.width]);
  }

  // runtime/tooltip/Tooltip.tsx
  var TooltipContext = (0, import_react4.createContext)(null);
  var PRESETS = {
    "sweatshop-ui": {
      minWidth: 120,
      maxWidth: 320,
      paddingX: 8,
      paddingY: 5,
      gap: 8,
      radius: 6,
      borderColor: "#30363d",
      backgroundColor: "#161b22",
      textColor: "#f0f6fc",
      dimColor: "#8b949e",
      shortcutBg: "#0d1117",
      shortcutBorder: "#30363d",
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 }
    },
    "sweatshop-chart": {
      minWidth: 140,
      maxWidth: 260,
      paddingX: 10,
      paddingY: 10,
      gap: 6,
      radius: 12,
      borderColor: "#30363d",
      backgroundColor: "#161b22",
      textColor: "#f0f6fc",
      dimColor: "#8b949e",
      shadowColor: "rgba(0,0,0,0.32)",
      shadowOpacity: 0.28,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 }
    },
    "component-gallery-chart": {
      minWidth: 120,
      maxWidth: 240,
      paddingX: 8,
      paddingY: 8,
      gap: 4,
      radius: 6,
      borderColor: "#364151",
      backgroundColor: "#202631",
      textColor: "#edf2f7",
      dimColor: "#9aa6b7",
      staticSurfaceOverlay: true
    }
  };
  function getMousePoint() {
    const host5 = globalThis;
    return {
      x: typeof host5.getMouseX === "function" ? Number(host5.getMouseX()) : 0,
      y: typeof host5.getMouseY === "function" ? Number(host5.getMouseY()) : 0
    };
  }
  function useFade(target, durationMs = 120) {
    const [value, setValue] = (0, import_react4.useState)(target ? 1 : 0);
    (0, import_react4.useEffect)(() => {
      if (durationMs <= 0) {
        setValue(target ? 1 : 0);
        return;
      }
      const start = value;
      const goal = target ? 1 : 0;
      if (start === goal) return;
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const t = Math.max(0, Math.min(1, elapsed / durationMs));
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(start + (goal - start) * eased);
        if (t >= 1) clearInterval(timer);
      }, 16);
      return () => clearInterval(timer);
    }, [durationMs, target]);
    return value;
  }
  function useCursorPoint(active) {
    const [point, setPoint] = (0, import_react4.useState)(() => getMousePoint());
    (0, import_react4.useEffect)(() => {
      if (!active) return;
      setPoint(getMousePoint());
      const timer = setInterval(() => setPoint(getMousePoint()), 16);
      return () => clearInterval(timer);
    }, [active]);
    return point;
  }
  function getViewport() {
    const host5 = globalThis;
    const width = typeof host5?.innerWidth === "number" ? host5.innerWidth : typeof host5?.__viewportWidth === "number" ? host5.__viewportWidth : 0;
    const height = typeof host5?.innerHeight === "number" ? host5.innerHeight : typeof host5?.__viewportHeight === "number" ? host5.__viewportHeight : 0;
    return { width, height };
  }
  function tooltipPreset(variant) {
    return PRESETS[variant || "sweatshop-ui"];
  }
  function estimateSize(content) {
    const preset = tooltipPreset(content.variant);
    const title = content.title || content.label || "";
    const rows = content.rows || [];
    const shortcut = content.shortcut || "";
    let width = Math.max(preset.minWidth, 20 + title.length * 6 + (shortcut ? shortcut.length * 6 + 24 : 0));
    for (const row of rows) width = Math.max(width, 28 + row.label.length * 5 + row.value.length * 6);
    width = Math.min(preset.maxWidth, width);
    const titleLines = Math.max(1, Math.ceil(title.length / 32));
    const height = preset.paddingY * 2 + titleLines * 14 + (rows.length > 0 ? rows.length * 16 + preset.gap : 0);
    return { width, height };
  }
  function ShortcutChip(props) {
    return /* @__PURE__ */ __jsx(
      Box,
      {
        style: {
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: props.preset.shortcutBorder || props.preset.borderColor,
          backgroundColor: props.preset.shortcutBg || props.preset.backgroundColor
        }
      },
      /* @__PURE__ */ __jsx(Text, { fontSize: 8, color: props.preset.dimColor, style: { fontWeight: "bold" } }, props.chord)
    );
  }
  function TooltipCard(props) {
    const preset = tooltipPreset(props.variant);
    const rows = props.rows || [];
    const title = props.title || props.label;
    return /* @__PURE__ */ __jsx(
      Box,
      {
        style: {
          minWidth: preset.minWidth,
          maxWidth: preset.maxWidth,
          paddingLeft: preset.paddingX,
          paddingRight: preset.paddingX,
          paddingTop: preset.paddingY,
          paddingBottom: preset.paddingY,
          gap: preset.gap,
          borderRadius: preset.radius,
          borderWidth: 1,
          borderColor: preset.borderColor,
          backgroundColor: preset.backgroundColor,
          pointerEvents: "none",
          shadowColor: preset.shadowColor,
          shadowOpacity: preset.shadowOpacity,
          shadowRadius: preset.shadowRadius,
          shadowOffset: preset.shadowOffset,
          ...props.style || {}
        }
      },
      title ? rows.length > 0 ? /* @__PURE__ */ __jsx(Text, { fontSize: 10, color: preset.textColor, style: { fontWeight: "bold" } }, title) : /* @__PURE__ */ __jsx(Row, { style: { gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" } }, /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: preset.textColor, style: { fontWeight: "bold", flexShrink: 1 } }, title), props.shortcut ? /* @__PURE__ */ __jsx(ShortcutChip, { chord: props.shortcut, preset }) : null) : null,
      rows.map((row) => /* @__PURE__ */ __jsx(Row, { key: row.label, style: { gap: 6, alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ __jsx(Row, { style: { gap: 6, alignItems: "center" } }, row.color ? /* @__PURE__ */ __jsx(Box, { style: { width: 8, height: 8, borderRadius: 4, backgroundColor: row.color } }) : null, /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: preset.dimColor }, row.label)), /* @__PURE__ */ __jsx(Text, { fontSize: 9, color: preset.textColor, style: { fontWeight: "bold" } }, row.value)))
    );
  }
  function pointPlacement(point, size, viewport, offsetX, offsetY) {
    const padding = 8;
    let left = point.x + offsetX;
    let top = point.y + offsetY;
    if (left + size.width > viewport.width - padding) left = Math.max(padding, point.x - size.width - offsetX);
    if (top + size.height > viewport.height - padding) top = Math.max(padding, point.y - size.height - offsetY);
    left = Math.max(padding, Math.min(left, Math.max(padding, viewport.width - size.width - padding)));
    top = Math.max(padding, Math.min(top, Math.max(padding, viewport.height - size.height - padding)));
    return { left, top, maxWidth: Math.max(0, viewport.width - padding * 2) };
  }
  function TooltipOverlay(props) {
    const visible = !!props.active;
    const opacity = useFade(visible, 120);
    const active = props.active;
    const size = active ? estimateSize(active) : { width: 0, height: 0 };
    const cursor = useCursorPoint(visible);
    const rectPlacement = useAutoFlip({
      anchor: active && active.anchor.kind === "rect" ? active.anchor.rect : null,
      side: active && active.anchor.kind === "rect" ? active.anchor.side : void 0,
      size,
      viewport: props.viewport
    });
    const placement = (0, import_react4.useMemo)(() => {
      if (!active) return { left: 0, top: 0, maxWidth: 0 };
      if (active.anchor.kind === "rect") return rectPlacement;
      if (active.anchor.kind === "cursor") {
        return pointPlacement(cursor, size, props.viewport, active.anchor.offsetX ?? 14, active.anchor.offsetY ?? 14);
      }
      return pointPlacement({ x: active.anchor.x, y: active.anchor.y }, size, props.viewport, active.anchor.offsetX ?? 0, active.anchor.offsetY ?? 0);
    }, [active, cursor, props.viewport, rectPlacement, size]);
    if (!active || opacity <= 0.01) return null;
    return /* @__PURE__ */ __jsx(
      Box,
      {
        staticSurfaceOverlay: active.staticSurfaceOverlay ?? tooltipPreset(active.variant).staticSurfaceOverlay,
        style: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 1e4, pointerEvents: "none", overflow: "visible" }
      },
      /* @__PURE__ */ __jsx(
        Box,
        {
          style: {
            position: "absolute",
            left: placement.left,
            top: placement.top,
            maxWidth: placement.maxWidth,
            opacity
          }
        },
        /* @__PURE__ */ __jsx(TooltipCard, { ...active })
      )
    );
  }
  function TooltipRoot(props) {
    const [viewport, setViewport] = (0, import_react4.useState)(getViewport());
    const [active, setActive] = (0, import_react4.useState)(null);
    (0, import_react4.useEffect)(() => {
      const host5 = globalThis;
      const target = typeof host5?.addEventListener === "function" ? host5 : typeof window !== "undefined" ? window : null;
      if (!target || typeof target.addEventListener !== "function") return;
      const update = () => setViewport(getViewport());
      update();
      target.addEventListener("resize", update);
      return () => target.removeEventListener("resize", update);
    }, []);
    const setActiveForSource = (0, import_react4.useCallback)((sourceId, payload) => {
      setActive((current) => {
        if (!payload) return current?.sourceId === sourceId ? null : current;
        return { ...payload, sourceId };
      });
    }, []);
    const value = (0, import_react4.useMemo)(() => ({ setActive: setActiveForSource }), [setActiveForSource]);
    return /* @__PURE__ */ __jsx(TooltipContext.Provider, { value }, /* @__PURE__ */ __jsx(Box, { style: { position: "relative", width: "100%", height: "100%", overflow: "visible" } }, props.children, /* @__PURE__ */ __jsx(TooltipOverlay, { active, viewport })));
  }

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
  var listeners3 = /* @__PURE__ */ new Set();
  function readPersisted(key) {
    try {
      const host5 = globalThis;
      if (typeof host5.__store_get === "function") {
        const value = host5.__store_get(key);
        if (typeof value === "string") return value;
      }
    } catch (_error) {
    }
    return null;
  }
  function writePersisted(key, value) {
    try {
      const host5 = globalThis;
      if (typeof host5.__store_set === "function") host5.__store_set(key, value);
    } catch (_error) {
    }
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
  function notifyListeners() {
    logGalleryTheme("notify listeners", { count: listeners3.size, activeThemeId: activeGalleryThemeId });
    for (const listener of listeners3) listener();
  }
  function getActiveGalleryThemeId() {
    return activeGalleryThemeId;
  }
  function getActiveGalleryTheme() {
    return GALLERY_THEME_OPTIONS_BY_ID.get(activeGalleryThemeId) || GALLERY_THEME_OPTIONS[0] || null;
  }
  function applyGalleryTheme(id) {
    if (!GALLERY_THEME_OPTIONS_BY_ID.has(id)) {
      logGalleryTheme("apply ignored: unknown theme", {
        id,
        available: GALLERY_THEME_OPTIONS.map((option) => option.id)
      });
      return;
    }
    if (activeGalleryThemeId === id) {
      logGalleryTheme("apply ignored: already active", { id });
      return;
    }
    const previous = activeGalleryThemeId;
    activeGalleryThemeId = id;
    logGalleryTheme("apply theme", { previous, next: id });
    writePersisted(STORE_KEY, id);
    pushGalleryThemeToRuntime(GALLERY_THEME_OPTIONS_BY_ID.get(id) || null);
    notifyListeners();
  }
  pushGalleryThemeToRuntime(getActiveGalleryTheme());

  // runtime/easing.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }
  var PI = Math.PI;
  var c1 = 1.70158;
  var c2 = c1 * 1.525;
  var c3 = c1 + 1;
  var c4 = 2 * PI / 3;
  var c5 = 2 * PI / 4.5;
  var n1 = 7.5625;
  var d1 = 2.75;
  function bounceOut(t) {
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) {
      t -= 1.5 / d1;
      return n1 * t * t + 0.75;
    }
    if (t < 2.5 / d1) {
      t -= 2.25 / d1;
      return n1 * t * t + 0.9375;
    }
    {
      t -= 2.625 / d1;
      return n1 * t * t + 0.984375;
    }
  }
  var linear = (t) => clamp01(t);
  var easeInSine = (t) => {
    t = clamp01(t);
    return 1 - Math.cos(t * PI / 2);
  };
  var easeOutSine = (t) => {
    t = clamp01(t);
    return Math.sin(t * PI / 2);
  };
  var easeInOutSine = (t) => {
    t = clamp01(t);
    return -(Math.cos(PI * t) - 1) / 2;
  };
  var easeInQuad = (t) => {
    t = clamp01(t);
    return t * t;
  };
  var easeOutQuad = (t) => {
    t = clamp01(t);
    return 1 - (1 - t) * (1 - t);
  };
  var easeInOutQuad = (t) => {
    t = clamp01(t);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };
  var easeInCubic = (t) => {
    t = clamp01(t);
    return t * t * t;
  };
  var easeOutCubic = (t) => {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  };
  var easeInOutCubic = (t) => {
    t = clamp01(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var easeInQuart = (t) => {
    t = clamp01(t);
    return t * t * t * t;
  };
  var easeOutQuart = (t) => {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 4);
  };
  var easeInOutQuart = (t) => {
    t = clamp01(t);
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  };
  var easeInQuint = (t) => {
    t = clamp01(t);
    return t * t * t * t * t;
  };
  var easeOutQuint = (t) => {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 5);
  };
  var easeInOutQuint = (t) => {
    t = clamp01(t);
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  };
  var easeInExpo = (t) => {
    t = clamp01(t);
    return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
  };
  var easeOutExpo = (t) => {
    t = clamp01(t);
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  };
  var easeInOutExpo = (t) => {
    t = clamp01(t);
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  };
  var easeInCirc = (t) => {
    t = clamp01(t);
    return 1 - Math.sqrt(1 - t * t);
  };
  var easeOutCirc = (t) => {
    t = clamp01(t);
    return Math.sqrt(1 - Math.pow(t - 1, 2));
  };
  var easeInOutCirc = (t) => {
    t = clamp01(t);
    return t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
  };
  var easeInBack = (t) => {
    t = clamp01(t);
    return c3 * t * t * t - c1 * t * t;
  };
  var easeOutBack = (t) => {
    t = clamp01(t);
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  var easeInOutBack = (t) => {
    t = clamp01(t);
    return t < 0.5 ? Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  };
  var easeInElastic = (t) => {
    t = clamp01(t);
    if (t === 0) return 0;
    if (t === 1) return 1;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  };
  var easeOutElastic = (t) => {
    t = clamp01(t);
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };
  var easeInOutElastic = (t) => {
    t = clamp01(t);
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2 : Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5) / 2 + 1;
  };
  var easeInBounce = (t) => {
    t = clamp01(t);
    return 1 - bounceOut(1 - t);
  };
  var easeOutBounce = (t) => {
    t = clamp01(t);
    return bounceOut(t);
  };
  var easeInOutBounce = (t) => {
    t = clamp01(t);
    return t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2;
  };
  var EASINGS = {
    linear,
    easeInSine,
    easeOutSine,
    easeInOutSine,
    easeInQuad,
    easeOutQuad,
    easeInOutQuad,
    easeInCubic,
    easeOutCubic,
    easeInOutCubic,
    easeInQuart,
    easeOutQuart,
    easeInOutQuart,
    easeInQuint,
    easeOutQuint,
    easeInOutQuint,
    easeInExpo,
    easeOutExpo,
    easeInOutExpo,
    easeInCirc,
    easeOutCirc,
    easeInOutCirc,
    easeInBack,
    easeOutBack,
    easeInOutBack,
    easeInElastic,
    easeOutElastic,
    easeInOutElastic,
    easeInBounce,
    easeOutBounce,
    easeInOutBounce
  };
  var EASING_NAMES = Object.keys(EASINGS);

  // cart/app/InputStrip.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var import_react5 = __toESM(require_react());
  init_primitives();
  init_theme();
  init_useIFTTT();

  // cart/app/gallery/components/command-composer/CommandComposerHeader.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // runtime/icons/icons.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var ChevronRight = [[9, 18, 15, 12, 9, 6]];
  var FileText = [[6, 22, 5.74, 21.98, 5.48, 21.93, 5.23, 21.85, 5, 21.73, 4.78, 21.59, 4.59, 21.41, 4.41, 21.22, 4.27, 21, 4.15, 20.77, 4.07, 20.52, 4.02, 20.26, 4, 20, 4, 4, 4.02, 3.74, 4.07, 3.48, 4.15, 3.23, 4.27, 3, 4.41, 2.78, 4.59, 2.59, 4.78, 2.41, 5, 2.27, 5.23, 2.15, 5.48, 2.07, 5.74, 2.02, 6, 2, 14, 2, 14.16, 2, 14.31, 2.02, 14.47, 2.05, 14.62, 2.08, 14.77, 2.13, 14.92, 2.18, 15.07, 2.25, 15.21, 2.32, 15.34, 2.41, 15.47, 2.5, 15.59, 2.6, 15.7, 2.71, 19.29, 6.29, 19.4, 6.41, 19.5, 6.53, 19.59, 6.66, 19.68, 6.79, 19.75, 6.93, 19.82, 7.08, 19.87, 7.22, 19.92, 7.38, 19.95, 7.53, 19.98, 7.68, 20, 7.84, 20, 8, 20, 20, 19.98, 20.26, 19.93, 20.52, 19.85, 20.77, 19.73, 21, 19.59, 21.22, 19.41, 21.41, 19.22, 21.59, 19, 21.73, 18.77, 21.85, 18.52, 21.93, 18.26, 21.98, 18, 22, 6, 22], [14, 2, 14, 7, 14.01, 7.13, 14.03, 7.26, 14.08, 7.38, 14.13, 7.5, 14.21, 7.61, 14.29, 7.71, 14.39, 7.79, 14.5, 7.87, 14.62, 7.92, 14.74, 7.97, 14.87, 7.99, 15, 8, 20, 8], [10, 9, 8, 9], [16, 13, 8, 13], [16, 17, 8, 17]];
  var File = [[6, 22, 5.74, 21.98, 5.48, 21.93, 5.23, 21.85, 5, 21.73, 4.78, 21.59, 4.59, 21.41, 4.41, 21.22, 4.27, 21, 4.15, 20.77, 4.07, 20.52, 4.02, 20.26, 4, 20, 4, 4, 4.02, 3.74, 4.07, 3.48, 4.15, 3.23, 4.27, 3, 4.41, 2.78, 4.59, 2.59, 4.78, 2.41, 5, 2.27, 5.23, 2.15, 5.48, 2.07, 5.74, 2.02, 6, 2, 14, 2, 14.16, 2, 14.31, 2.02, 14.47, 2.05, 14.62, 2.08, 14.77, 2.13, 14.92, 2.18, 15.07, 2.25, 15.21, 2.32, 15.34, 2.41, 15.47, 2.5, 15.59, 2.6, 15.7, 2.71, 19.29, 6.29, 19.4, 6.41, 19.5, 6.53, 19.59, 6.66, 19.68, 6.79, 19.75, 6.93, 19.82, 7.08, 19.87, 7.22, 19.92, 7.38, 19.95, 7.53, 19.98, 7.68, 20, 7.84, 20, 8, 20, 20, 19.98, 20.26, 19.93, 20.52, 19.85, 20.77, 19.73, 21, 19.59, 21.22, 19.41, 21.41, 19.22, 21.59, 19, 21.73, 18.77, 21.85, 18.52, 21.93, 18.26, 21.98, 18, 22, 6, 22], [14, 2, 14, 7, 14.01, 7.13, 14.03, 7.26, 14.08, 7.38, 14.13, 7.5, 14.21, 7.61, 14.29, 7.71, 14.39, 7.79, 14.5, 7.87, 14.62, 7.92, 14.74, 7.97, 14.87, 7.99, 15, 8, 20, 8]];
  var GitBranch = [[15, 6, 13.83, 6.08, 12.67, 6.31, 11.56, 6.69, 10.5, 7.21, 9.52, 7.86, 8.64, 8.64, 7.86, 9.52, 7.21, 10.5, 6.69, 11.56, 6.31, 12.67, 6.08, 13.83, 6, 15, 6, 3], [21, 6, 20.95, 6.52, 20.82, 7.03, 20.6, 7.5, 20.3, 7.93, 19.93, 8.3, 19.5, 8.6, 19.03, 8.82, 18.52, 8.95, 18, 9, 17.48, 8.95, 16.97, 8.82, 16.5, 8.6, 16.07, 8.3, 15.7, 7.93, 15.4, 7.5, 15.18, 7.03, 15.05, 6.52, 15, 6, 15.05, 5.48, 15.18, 4.97, 15.4, 4.5, 15.7, 4.07, 16.07, 3.7, 16.5, 3.4, 16.97, 3.18, 17.48, 3.05, 18, 3, 18.52, 3.05, 19.03, 3.18, 19.5, 3.4, 19.93, 3.7, 20.3, 4.07, 20.6, 4.5, 20.82, 4.97, 20.95, 5.48, 21, 6], [9, 18, 8.95, 18.52, 8.82, 19.03, 8.6, 19.5, 8.3, 19.93, 7.93, 20.3, 7.5, 20.6, 7.03, 20.82, 6.52, 20.95, 6, 21, 5.48, 20.95, 4.97, 20.82, 4.5, 20.6, 4.07, 20.3, 3.7, 19.93, 3.4, 19.5, 3.18, 19.03, 3.05, 18.52, 3, 18, 3.05, 17.48, 3.18, 16.97, 3.4, 16.5, 3.7, 16.07, 4.07, 15.7, 4.5, 15.4, 4.97, 15.18, 5.48, 15.05, 6, 15, 6.52, 15.05, 7.03, 15.18, 7.5, 15.4, 7.93, 15.7, 8.3, 16.07, 8.6, 16.5, 8.82, 16.97, 8.95, 17.48, 9, 18]];
  var Image2 = [[5, 3, 19, 3, 19.26, 3.02, 19.52, 3.07, 19.77, 3.15, 20, 3.27, 20.22, 3.41, 20.41, 3.59, 20.59, 3.78, 20.73, 4, 20.85, 4.23, 20.93, 4.48, 20.98, 4.74, 21, 5, 21, 19, 20.98, 19.26, 20.93, 19.52, 20.85, 19.77, 20.73, 20, 20.59, 20.22, 20.41, 20.41, 20.22, 20.59, 20, 20.73, 19.77, 20.85, 19.52, 20.93, 19.26, 20.98, 19, 21, 5, 21, 4.74, 20.98, 4.48, 20.93, 4.23, 20.85, 4, 20.73, 3.78, 20.59, 3.59, 20.41, 3.41, 20.22, 3.27, 20, 3.15, 19.77, 3.07, 19.52, 3.02, 19.26, 3, 19, 3, 5, 3.02, 4.74, 3.07, 4.48, 3.15, 4.23, 3.27, 4, 3.41, 3.78, 3.59, 3.59, 3.78, 3.41, 4, 3.27, 4.23, 3.15, 4.48, 3.07, 4.74, 3.02, 5, 3], [11, 9, 10.97, 9.35, 10.88, 9.68, 10.73, 10, 10.53, 10.29, 10.29, 10.53, 10, 10.73, 9.68, 10.88, 9.35, 10.97, 9, 11, 8.65, 10.97, 8.32, 10.88, 8, 10.73, 7.71, 10.53, 7.47, 10.29, 7.27, 10, 7.12, 9.68, 7.03, 9.35, 7, 9, 7.03, 8.65, 7.12, 8.32, 7.27, 8, 7.47, 7.71, 7.71, 7.47, 8, 7.27, 8.32, 7.12, 8.65, 7.03, 9, 7, 9.35, 7.03, 9.68, 7.12, 10, 7.27, 10.29, 7.47, 10.53, 7.71, 10.73, 8, 10.88, 8.32, 10.97, 8.65, 11, 9], [21, 15, 17.91, 11.91, 17.72, 11.74, 17.5, 11.6, 17.27, 11.48, 17.02, 11.4, 16.76, 11.35, 16.5, 11.33, 16.24, 11.35, 15.98, 11.4, 15.73, 11.48, 15.5, 11.6, 15.28, 11.74, 15.09, 11.91, 6, 21]];

  // cart/app/gallery/components/command-composer/CommandComposerChip.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  function textForTone(tone) {
    if (tone === "success") return classifiers.CommandComposerSuccessText;
    if (tone === "warn") return classifiers.CommandComposerWarnText;
    if (tone === "hot") return classifiers.CommandComposerHotText;
    if (tone === "accent") return classifiers.CommandComposerTokenText;
    return classifiers.CommandComposerMutedText;
  }
  function frameForTone(tone) {
    if (tone === "success") return classifiers.CommandComposerChipSuccess;
    if (tone === "hot" || tone === "accent") return classifiers.CommandComposerChipAccent;
    return classifiers.CommandComposerChip;
  }
  function colorForTone(tone) {
    if (tone === "success") return "theme:ok";
    if (tone === "warn") return "theme:warn";
    if (tone === "hot") return "theme:accentHot";
    if (tone === "accent") return "theme:blue";
    return "theme:inkDim";
  }
  function iconForChip(chip) {
    if (chip.prefix === "\u25A3") return chip.label.endsWith(".png") ? Image2 : File;
    if (chip.prefix === "\u2630") return FileText;
    if (chip.prefix === "\u2301") return GitBranch;
    return null;
  }
  function CommandComposerChip({ chip }) {
    const Frame = frameForTone(chip.tone);
    const Label = textForTone(chip.tone);
    const icon = iconForChip(chip);
    const color = colorForTone(chip.tone);
    return /* @__PURE__ */ __jsx(Frame, null, icon ? /* @__PURE__ */ __jsx(classifiers.CommandComposerInlineIconSlot, null, /* @__PURE__ */ __jsx(Icon, { icon, size: 12, color, strokeWidth: 2.1 })) : null, chip.prefix && !icon ? /* @__PURE__ */ __jsx(classifiers.CommandComposerMutedText, null, chip.prefix) : null, /* @__PURE__ */ __jsx(Label, null, chip.label));
  }

  // cart/app/gallery/components/command-composer/CommandComposerHeader.tsx
  function ComposerDividerIcon() {
    return /* @__PURE__ */ __jsx(classifiers.CommandComposerToolbarIconSlot, null, /* @__PURE__ */ __jsx(Icon, { icon: ChevronRight, size: 12, color: "theme:inkDimmer", strokeWidth: 2.2 }));
  }
  function CommandComposerHeader({ row }) {
    if (row.attachments.length === 0) return null;
    return /* @__PURE__ */ __jsx(classifiers.CommandComposerTopbar, null, /* @__PURE__ */ __jsx(classifiers.CommandComposerTopCluster, null, /* @__PURE__ */ __jsx(classifiers.CommandComposerMetaText, null, row.attachLabel), /* @__PURE__ */ __jsx(ComposerDividerIcon, null), row.attachments.map((attachment) => /* @__PURE__ */ __jsx(CommandComposerChip, { key: attachment.id, chip: attachment }))));
  }

  // cart/app/gallery/components/command-composer/CommandComposerFooter.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();

  // cart/app/gallery/components/command-composer/CommandComposerShortcut.tsx
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  function CommandComposerKeycap({ value }) {
    return /* @__PURE__ */ __jsx(classifiers.CommandComposerKeycap, null, /* @__PURE__ */ __jsx(classifiers.CommandComposerKeycapText, null, value));
  }
  function CommandComposerShortcutHint({ shortcut }) {
    return /* @__PURE__ */ __jsx(classifiers.CommandComposerShortcutGroup, null, /* @__PURE__ */ __jsx(CommandComposerKeycap, { value: shortcut.key }), shortcut.joiner ? /* @__PURE__ */ __jsx(classifiers.CommandComposerMutedText, null, shortcut.joiner) : null, shortcut.secondaryKey ? /* @__PURE__ */ __jsx(CommandComposerKeycap, { value: shortcut.secondaryKey }) : null, /* @__PURE__ */ __jsx(classifiers.CommandComposerShortcutText, null, shortcut.label));
  }

  // cart/app/gallery/components/command-composer/CommandComposerFooter.tsx
  function CommandComposerFooter({ row }) {
    return /* @__PURE__ */ __jsx(classifiers.CommandComposerFooter, null, /* @__PURE__ */ __jsx(classifiers.CommandComposerFooterShortcuts, null, row.leftShortcuts.map((shortcut) => /* @__PURE__ */ __jsx(CommandComposerShortcutHint, { key: shortcut.id, shortcut }))), /* @__PURE__ */ __jsx(classifiers.Spacer, null), /* @__PURE__ */ __jsx(CommandComposerShortcutHint, { shortcut: row.executeShortcut }));
  }

  // cart/app/tokens.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var TOKENS = {
    home: { type: "route", path: "/", label: "Home" },
    about: { type: "route", path: "/about", label: "About" },
    settings: { type: "route", path: "/settings", label: "Settings" },
    character: { type: "route", path: "/character", label: "Character" }
  };
  var TOKEN_RE = /@([A-Za-z][A-Za-z0-9_-]*)/g;
  function resolveTokens2(text) {
    const out = [];
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      const key = m[1].toLowerCase();
      const tok = TOKENS[key];
      if (!tok) continue;
      out.push({
        raw: m[0],
        start: m.index,
        end: m.index + m[0].length,
        token: tok
      });
    }
    return out;
  }

  // cart/app/chat/store.ts
  init_jsx_shim();
  init_ambient();
  init_ambient_primitives();
  var _asker = null;
  function askAssistant(text) {
    if (!_asker) {
      return Promise.reject(new Error("chat: AssistantChatProvider not mounted"));
    }
    return _asker(text);
  }

  // cart/app/InputStrip.tsx
  var LEFT_SHORTCUTS = [
    { id: "tag-file", key: "@", label: "tag file" },
    { id: "variable", key: "{}", label: "variable" },
    { id: "command", key: "/", label: "command" }
  ];
  var EXECUTE_SHORTCUT = {
    id: "execute",
    key: "\u2318",
    secondaryKey: "enter",
    joiner: "+",
    label: "execute"
  };
  function tokenToChip(m) {
    return {
      id: `chip:${m.raw}`,
      prefix: "@",
      label: m.token.label,
      tone: "accent"
    };
  }
  function InputStrip() {
    const bp = useBreakpoint();
    const compact = bp === "sm";
    const [draft, setDraft] = (0, import_react5.useState)("");
    const draftRef = (0, import_react5.useRef)("");
    draftRef.current = draft;
    const matches = resolveTokens2(draft);
    const submit = () => {
      const text = draftRef.current.trim();
      if (!text) return;
      const tokens = resolveTokens2(text);
      for (const m of tokens) {
        if (m.token.type === "route") busEmit("app:navigate", m.token.path);
      }
      void askAssistant(text).catch(() => {
      });
      setDraft("");
      draftRef.current = "";
    };
    const attachments = [];
    const hasAttachments = attachments.length > 0;
    const row = {
      id: "app-input-strip",
      attachLabel: "ATTACHED",
      attachments,
      prompt: [],
      branch: { id: "branch", label: "", tone: "success" },
      leftShortcuts: LEFT_SHORTCUTS,
      executeShortcut: EXECUTE_SHORTCUT,
      modeGlyph: "",
      sendLabel: "SEND"
    };
    return /* @__PURE__ */ __jsx(classifiers.CommandComposerFrame, { style: compact || hasAttachments ? {} : { minHeight: 166 } }, compact ? null : /* @__PURE__ */ __jsx(CommandComposerHeader, { row }), /* @__PURE__ */ __jsx(classifiers.CommandComposerMain, null, /* @__PURE__ */ __jsx(classifiers.CommandComposerPromptRows, null, matches.length > 0 ? /* @__PURE__ */ __jsx(classifiers.CommandComposerPromptFlow, null, matches.map((m) => /* @__PURE__ */ __jsx(CommandComposerChip, { key: m.raw, chip: tokenToChip(m) }))) : null, /* @__PURE__ */ __jsx(classifiers.CommandComposerPromptFlow, null, /* @__PURE__ */ __jsx(
      TextInput,
      {
        value: draft,
        onChangeText: setDraft,
        onSubmit: submit,
        placeholder: "Ask, or @-mention a place to open\u2026",
        style: {
          flexGrow: 1,
          flexBasis: 0,
          minHeight: 24,
          fontSize: 14,
          color: "theme:ink",
          backgroundColor: "transparent",
          borderWidth: 0
        }
      }
    ))), /* @__PURE__ */ __jsx(classifiers.CommandComposerActionRow, { style: { justifyContent: "flex-end" } }, /* @__PURE__ */ __jsx(classifiers.CommandComposerShortcutGroup, null, /* @__PURE__ */ __jsx(classifiers.CommandComposerSend, { onPress: submit }, /* @__PURE__ */ __jsx(classifiers.CommandComposerActionText, null, row.sendLabel))))), compact ? null : /* @__PURE__ */ __jsx(CommandComposerFooter, { row }));
  }

  // cart/app/isolated_tests/input_lab/index.tsx
  applyGalleryTheme(getActiveGalleryThemeId());
  installBrowserShims();
  var STAGE_W = 1280;
  var STAGE_H = 860;
  var DURATION_MS = 700;
  var SIDEBAR_W = 360;
  var MENU_H = 220;
  var CHAT_FOCAL = { left: (STAGE_W - 640) / 2, top: 80, width: 640, height: 700 };
  var CHAT_DOCKED = { left: 16, top: MENU_H + 16, width: SIDEBAR_W, height: STAGE_H - MENU_H - 32 };
  var MENU_RECT = { left: 16, top: 16, width: SIDEBAR_W, height: MENU_H - 16 };
  var APP_RECT = { left: SIDEBAR_W + 32, top: 16, width: STAGE_W - SIDEBAR_W - 48, height: STAGE_H - 32 };
  var lerp = (a, b, t) => a + (b - a) * t;
  var lerpRect = (a, b, t) => ({
    left: lerp(a.left, b.left, t),
    top: lerp(a.top, b.top, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t)
  });
  var easeTween = (p) => EASINGS.easeInOutCubic(p);
  var easeSpring = (p) => EASINGS.easeOutBack(p);
  var nowMs = () => {
    const g2 = globalThis;
    return g2?.performance?.now ? g2.performance.now() : Date.now();
  };
  function usePhaseTimeline(phase) {
    const targetPhase = phase === "activity" ? 1 : 0;
    const stateRef = (0, import_react6.useRef)({ from: targetPhase, to: targetPhase, start: 0 });
    const [, force] = (0, import_react6.useState)(0);
    (0, import_react6.useEffect)(() => {
      const prev = stateRef.current;
      const elapsed2 = prev.start === 0 ? DURATION_MS : nowMs() - prev.start;
      const p = Math.min(1, elapsed2 / DURATION_MS);
      const currentPhase = prev.from + (prev.to - prev.from) * easeTween(p);
      stateRef.current = { from: currentPhase, to: targetPhase, start: nowMs() };
      const g2 = globalThis;
      const sched = g2.requestAnimationFrame ? g2.requestAnimationFrame.bind(g2) : (fn) => setTimeout(fn, 16);
      const cancel = g2.cancelAnimationFrame ? g2.cancelAnimationFrame.bind(g2) : clearTimeout;
      let raf;
      const tick = () => {
        force((n) => n + 1 | 0);
        const e = nowMs() - stateRef.current.start;
        if (e < DURATION_MS) raf = sched(tick);
      };
      raf = sched(tick);
      return () => cancel(raf);
    }, [phase]);
    const s = stateRef.current;
    const elapsed = s.start === 0 ? DURATION_MS : nowMs() - s.start;
    const rawP = Math.min(1, elapsed / DURATION_MS);
    const t = s.from + (s.to - s.from) * easeTween(rawP);
    return { t, fromPhase: s.from, toPhase: s.to };
  }
  var MOCK = [
    { who: "user", text: "Help me set up a small build pipeline for the embed worker." },
    { who: "assistant", text: "Sure \u2014 start by mapping the current ingest flow. What does the worker pool look like today?" },
    { who: "user", text: "N zig threads, one shared model. JobQueue feeds them." },
    { who: "assistant", text: "Good. Are we batching commits to pgvector or one row per chunk?" },
    { who: "user", text: "One per chunk. Should we batch?" },
    { who: "assistant", text: "Yes \u2014 bundle into ~64-row inserts. Open the activity view and we can wire it." }
  ];
  function ChatBubble({ who, text }) {
    const isUser = who === "user";
    return /* @__PURE__ */ __jsx(Box, { style: {
      flexDirection: "row",
      justifyContent: isUser ? "flex-end" : "flex-start",
      paddingTop: 4,
      paddingBottom: 4
    } }, /* @__PURE__ */ __jsx(Box, { style: {
      maxWidth: "82%",
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 8,
      paddingBottom: 8,
      borderRadius: 10,
      backgroundColor: isUser ? "theme:accent" : "theme:bg2",
      borderWidth: 1,
      borderColor: isUser ? "theme:accent" : "theme:rule"
    } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 13, color: "theme:ink" } }, text)));
  }
  function ChatPanel() {
    return /* @__PURE__ */ __jsx(Box, { style: {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: 12,
      overflow: "hidden"
    } }, /* @__PURE__ */ __jsx(Box, { style: {
      flexGrow: 1,
      flexBasis: 0,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 4
    } }, MOCK.map((m, i) => /* @__PURE__ */ __jsx(ChatBubble, { key: i, who: m.who, text: m.text }))), /* @__PURE__ */ __jsx(Box, { style: { borderTopWidth: 1, borderTopColor: "theme:rule" } }, /* @__PURE__ */ __jsx(InputStrip, null)));
  }
  var MENU_ITEMS = ["Home", "Files", "Memory", "Settings"];
  function SideMenu({ opacity, scale }) {
    return /* @__PURE__ */ __jsx(Box, { style: {
      width: "100%",
      height: "100%",
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: 12,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 14,
      paddingBottom: 14,
      opacity,
      transform: [{ scale }]
    } }, /* @__PURE__ */ __jsx(Text, { style: {
      fontSize: 11,
      fontWeight: 700,
      color: "theme:inkDim",
      letterSpacing: 1,
      marginBottom: 10,
      paddingLeft: 8
    } }, "MENU"), MENU_ITEMS.map((item) => /* @__PURE__ */ __jsx(Pressable, { key: item, onPress: () => {
    } }, /* @__PURE__ */ __jsx(Box, { style: {
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 8,
      paddingBottom: 8,
      borderRadius: 6
    } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 13, color: "theme:ink" } }, item)))));
  }
  function AppWindow({ opacity, scale }) {
    return /* @__PURE__ */ __jsx(Box, { style: {
      width: "100%",
      height: "100%",
      backgroundColor: "theme:bg2",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: 12,
      opacity,
      transform: [{ scale }],
      overflow: "hidden",
      flexDirection: "column"
    } }, /* @__PURE__ */ __jsx(Box, { style: {
      flexDirection: "row",
      alignItems: "center",
      height: 36,
      paddingLeft: 14,
      paddingRight: 14,
      borderBottomWidth: 1,
      borderBottomColor: "theme:rule",
      backgroundColor: "theme:bg1"
    } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 12, fontWeight: 700, color: "theme:ink" } }, "Activity \u2014 embed pipeline")), /* @__PURE__ */ __jsx(Box, { style: { paddingLeft: 24, paddingRight: 24, paddingTop: 24, paddingBottom: 24, gap: 12 } }, /* @__PURE__ */ __jsx(Text, { style: { fontSize: 14, color: "theme:ink" } }, "Worker pool: 4 threads"), /* @__PURE__ */ __jsx(Text, { style: { fontSize: 14, color: "theme:ink" } }, "Queue depth: 1,283 files"), /* @__PURE__ */ __jsx(Text, { style: { fontSize: 14, color: "theme:ink" } }, "Throughput: 64 chunks/s"), /* @__PURE__ */ __jsx(Box, { style: {
      height: 240,
      marginTop: 12,
      backgroundColor: "theme:bg1",
      borderWidth: 1,
      borderColor: "theme:rule",
      borderRadius: 8
    } })));
  }
  function Stage() {
    const [phase, setPhase] = (0, import_react6.useState)("focal");
    const { t, fromPhase, toPhase } = usePhaseTimeline(phase);
    const chatRect = lerpRect(CHAT_FOCAL, CHAT_DOCKED, t);
    const isEntering = toPhase >= fromPhase;
    const scale = 0.94 + 0.06 * (isEntering ? easeSpring(t) : easeTween(t));
    return /* @__PURE__ */ __jsx(Box, { style: { width: "100%", height: "100%", position: "relative", backgroundColor: "theme:bg" } }, /* @__PURE__ */ __jsx(Box, { style: { position: "absolute", right: 16, top: 16, zIndex: 10 } }, /* @__PURE__ */ __jsx(
      Pressable,
      {
        onPress: () => setPhase(phase === "focal" ? "activity" : "focal"),
        style: {
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 8,
          backgroundColor: "theme:accent"
        }
      },
      /* @__PURE__ */ __jsx(Text, { style: { fontSize: 13, fontWeight: 700, color: "theme:ink" } }, phase === "focal" ? "Start activity" : "Back to chat")
    )), t > 0.01 ? /* @__PURE__ */ __jsx(Box, { style: {
      position: "absolute",
      left: APP_RECT.left,
      top: APP_RECT.top,
      width: APP_RECT.width,
      height: APP_RECT.height
    } }, /* @__PURE__ */ __jsx(AppWindow, { opacity: t, scale })) : null, t > 0.01 ? /* @__PURE__ */ __jsx(Box, { style: {
      position: "absolute",
      left: MENU_RECT.left,
      top: MENU_RECT.top,
      width: MENU_RECT.width,
      height: MENU_RECT.height
    } }, /* @__PURE__ */ __jsx(SideMenu, { opacity: t, scale })) : null, /* @__PURE__ */ __jsx(Box, { style: {
      position: "absolute",
      left: chatRect.left,
      top: chatRect.top,
      width: chatRect.width,
      height: chatRect.height
    } }, /* @__PURE__ */ __jsx(ChatPanel, null)));
  }
  function App() {
    return /* @__PURE__ */ __jsx(TooltipRoot, null, /* @__PURE__ */ __jsx(Router, { initialPath: "/" }, /* @__PURE__ */ __jsx(Stage, null)));
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
