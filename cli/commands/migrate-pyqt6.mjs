/**
 * migrate-pyqt6.mjs -- PyQt6/PySide6 -> ReactJIT migration
 *
 * Converts a PyQt6 (or PySide6/PyQt5) application to a ReactJIT TSX component.
 * Handles:
 *
 *   Widgets:    QLabel->Text, QPushButton->Pressable, QLineEdit->TextInput,
 *               QFrame/QWidget->Box, QScrollArea->ScrollView, QListWidget->ScrollView,
 *               QCheckBox/QRadioButton->Pressable, QSlider->slider Box,
 *               QDialog/QMessageBox->Modal, QMenuBar->menu bar Box,
 *               QTabWidget->tabbed Box, QProgressBar->animated Box,
 *               QComboBox->dropdown, QToolBar->toolbar Box
 *
 *   Layout:     QVBoxLayout->column, QHBoxLayout->row,
 *               QGridLayout->nested row/col Boxes,
 *               QFormLayout->form rows (label + input pairs),
 *               addStretch->flexGrow spacer
 *
 *   State:      self.var->useState, pyqtSignal->event handlers
 *
 *   Signals:    signal.connect(slot)->onClick/onTextInput/etc.
 *
 *   Styling:    setStyleSheet->style objects, QFont->fontSize/fontFamily,
 *               QPalette->backgroundColor/color, setFixedSize->width/height,
 *               QSizePolicy.Expanding->flexGrow
 *
 *   Functions:  Python->JavaScript (best-effort, needs review)
 *
 * Usage:
 *   rjit migrate-pyqt6 <app.py>                    # convert, print to stdout
 *   rjit migrate-pyqt6 <app.py> --output out.tsx   # write to file
 *   rjit migrate-pyqt6 <app.py> --dry-run          # show analysis only
 *   rjit migrate-pyqt6 <app.py> --scaffold [name]  # convert + create a new project
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { deriveProjectName, capitalize, formatStyleObj, formatStyleAttr, indent } from '../lib/migration-core.mjs';
import { scaffoldProject } from './init.mjs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WIDGET MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WIDGET_MAP = {
  // Core widgets
  'QLabel':           { component: 'Text',       type: 'text' },
  'QPushButton':      { component: 'Pressable',  type: 'button' },
  'QLineEdit':        { component: 'TextInput',  type: 'input' },
  'QTextEdit':        { component: 'TextInput',  type: 'multiline' },
  'QPlainTextEdit':   { component: 'TextInput',  type: 'multiline' },
  'QFrame':           { component: 'Box',        type: 'container' },
  'QWidget':          { component: 'Box',        type: 'container' },
  'QGroupBox':        { component: 'Box',        type: 'container', hasLabel: true },
  'QScrollArea':      { component: 'ScrollView', type: 'scroll' },
  'QListWidget':      { component: 'ScrollView', type: 'list' },
  'QListView':        { component: 'ScrollView', type: 'list' },
  'QTableWidget':     { component: 'ScrollView', type: 'table' },
  'QTableView':       { component: 'ScrollView', type: 'table' },
  'QTreeWidget':      { component: 'ScrollView', type: 'tree' },
  'QTreeView':        { component: 'ScrollView', type: 'tree' },
  'QComboBox':        { component: 'Box',        type: 'dropdown' },
  'QCheckBox':        { component: 'Pressable',  type: 'checkbox' },
  'QRadioButton':     { component: 'Pressable',  type: 'radio' },
  'QSlider':          { component: 'Box',        type: 'slider' },
  'QProgressBar':     { component: 'Box',        type: 'progressbar' },
  'QSpinBox':         { component: 'TextInput',  type: 'input' },
  'QDoubleSpinBox':   { component: 'TextInput',  type: 'input' },
  'QDial':            { component: 'Box',        type: 'slider' },
  'QTabWidget':       { component: 'Box',        type: 'notebook' },
  'QStackedWidget':   { component: 'Box',        type: 'container' },
  'QSplitter':        { component: 'Box',        type: 'container' },
  'QToolBar':         { component: 'Box',        type: 'toolbar' },
  'QMenuBar':         { component: 'Box',        type: 'menu' },
  'QMenu':            { component: 'Box',        type: 'menu' },
  'QAction':          { component: null,         type: 'action' },
  'QStatusBar':       { component: 'Box',        type: 'statusbar' },
  'QDockWidget':      { component: 'Box',        type: 'container' },
  'QDialog':          { component: 'Modal',      type: 'modal' },
  'QMessageBox':      { component: 'Modal',      type: 'modal' },
  'QFileDialog':      { component: null,         type: 'skip' },
  'QColorDialog':     { component: null,         type: 'skip' },
  'QFontDialog':      { component: null,         type: 'skip' },
  'QInputDialog':     { component: 'Modal',      type: 'modal' },
  'QToolButton':      { component: 'Pressable',  type: 'button' },
  'QLCDNumber':       { component: 'Text',       type: 'text' },
  'QCalendarWidget':  { component: 'Box',        type: 'container' },
  'QDateEdit':        { component: 'TextInput',  type: 'input' },
  'QTimeEdit':        { component: 'TextInput',  type: 'input' },
  'QDateTimeEdit':    { component: 'TextInput',  type: 'input' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIGNAL MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SIGNAL_MAP = {
  'clicked':             'onClick',
  'pressed':             'onPressIn',
  'released':            'onPressOut',
  'toggled':             'onClick',
  'textChanged':         'onTextInput',
  'textEdited':          'onTextInput',
  'returnPressed':       'onKeyDown',
  'currentIndexChanged': 'onClick',
  'currentTextChanged':  'onTextInput',
  'valueChanged':        'onClick',
  'stateChanged':        'onClick',
  'itemClicked':         'onClick',
  'itemDoubleClicked':   'onClick',
  'itemSelectionChanged':'onClick',
  'cellClicked':         'onClick',
  'cellDoubleClicked':   'onClick',
  'triggered':           'onClick',
  'activated':           'onClick',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QT NAMED COLORS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const QT_COLORS = {
  // Qt.GlobalColor names
  'Qt.white':       '#ffffff', 'Qt.black':       '#000000',
  'Qt.red':         '#ff0000', 'Qt.green':       '#00ff00',
  'Qt.blue':        '#0000ff', 'Qt.yellow':      '#ffff00',
  'Qt.cyan':        '#00ffff', 'Qt.magenta':     '#ff00ff',
  'Qt.gray':        '#808080', 'Qt.darkRed':     '#800000',
  'Qt.darkGreen':   '#008000', 'Qt.darkBlue':    '#000080',
  'Qt.darkCyan':    '#008080', 'Qt.darkMagenta': '#800080',
  'Qt.darkYellow':  '#808000', 'Qt.darkGray':    '#404040',
  'Qt.lightGray':   '#c0c0c0', 'Qt.transparent': 'transparent',

  // GlobalColor enum (PySide6 / PyQt6 enum style)
  'GlobalColor.white':       '#ffffff', 'GlobalColor.black':       '#000000',
  'GlobalColor.red':         '#ff0000', 'GlobalColor.green':       '#00ff00',
  'GlobalColor.blue':        '#0000ff', 'GlobalColor.yellow':      '#ffff00',
  'GlobalColor.cyan':        '#00ffff', 'GlobalColor.magenta':     '#ff00ff',
  'GlobalColor.gray':        '#808080', 'GlobalColor.darkRed':     '#800000',
  'GlobalColor.darkGreen':   '#008000', 'GlobalColor.darkBlue':    '#000080',
  'GlobalColor.darkCyan':    '#008080', 'GlobalColor.darkMagenta': '#800080',
  'GlobalColor.darkYellow':  '#808000', 'GlobalColor.darkGray':    '#404040',
  'GlobalColor.lightGray':   '#c0c0c0', 'GlobalColor.transparent': 'transparent',

  // Bare color names (common CSS/Qt overlap)
  'white':     '#ffffff', 'black':     '#000000',
  'red':       '#ff0000', 'green':     '#00ff00',
  'blue':      '#0000ff', 'yellow':    '#ffff00',
  'cyan':      '#00ffff', 'magenta':   '#ff00ff',
  'gray':      '#808080', 'grey':      '#808080',
  'orange':    '#ffa500', 'purple':    '#800080',
  'pink':      '#ffc0cb', 'brown':     '#a52a2a',
  'navy':      '#000080', 'teal':      '#008080',
  'transparent': 'transparent',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CSS PROPERTY MAPPING (for setStyleSheet parsing)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CSS_PROP_MAP = {
  'background-color':  'backgroundColor',
  'background':        'backgroundColor',
  'color':             'color',
  'font-size':         'fontSize',
  'font-family':       'fontFamily',
  'font-weight':       'fontWeight',
  'font-style':        'fontStyle',
  'border':            '_border',       // needs special handling
  'border-width':      'borderWidth',
  'border-color':      'borderColor',
  'border-radius':     'borderRadius',
  'border-style':      '_borderStyle',  // stored but not directly used
  'border-top':        '_borderTop',
  'border-bottom':     '_borderBottom',
  'border-left':       '_borderLeft',
  'border-right':      '_borderRight',
  'padding':           '_padding',      // needs special handling
  'padding-top':       'paddingTop',
  'padding-bottom':    'paddingBottom',
  'padding-left':      'paddingLeft',
  'padding-right':     'paddingRight',
  'margin':            '_margin',       // needs special handling
  'margin-top':        'marginTop',
  'margin-bottom':     'marginBottom',
  'margin-left':       'marginLeft',
  'margin-right':      'marginRight',
  'min-width':         'minWidth',
  'min-height':        'minHeight',
  'max-width':         'maxWidth',
  'max-height':        'maxHeight',
  'width':             'width',
  'height':            'height',
  'opacity':           'opacity',
  'text-align':        'textAlign',
  'text-decoration':   'textDecorationLine',
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PYTHON SOURCE PARSER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse a PyQt6/PySide6 Python source file into a structured representation.
 * Returns: { widgets, signals, layouts, functions, classes, windowConfig, imports, rawLines, warnings }
 */
export function parsePyQt6Source(source) {
  const lines = source.split('\n');
  const result = {
    widgets: [],       // { name, widgetType, parent, args, line }
    signals: [],       // { widget, signal, slot, line }
    layouts: [],       // { widget, layoutType, children, line }
    functions: [],     // { name, body, args, line }
    classes: [],       // { name, parent, methods, line }
    windowConfig: {},  // title, geometry, etc.
    imports: [],
    rawLines: lines,
    warnings: [],
  };

  // Track imported widget names so we know what's available
  const importedNames = new Set();
  let isPyQt5 = false;
  let isPySide6 = false;

  // ── Pass 1: Parse imports ──────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // from PyQt6.QtWidgets import QLabel, QPushButton, ...
    const pyqt6Widgets = line.match(/^from\s+PyQt6\.QtWidgets\s+import\s+(.+)/);
    if (pyqt6Widgets) {
      const names = pyqt6Widgets[1].split(',').map(s => s.trim());
      for (const n of names) importedNames.add(n);
      result.imports.push(line);
      continue;
    }

    // from PyQt6.QtCore import ...
    const pyqt6Core = line.match(/^from\s+PyQt6\.QtCore\s+import\s+(.+)/);
    if (pyqt6Core) {
      result.imports.push(line);
      continue;
    }

    // from PyQt6.QtGui import ...
    const pyqt6Gui = line.match(/^from\s+PyQt6\.QtGui\s+import\s+(.+)/);
    if (pyqt6Gui) {
      result.imports.push(line);
      continue;
    }

    // from PyQt6 import ... (catch-all)
    if (/^from\s+PyQt6\b/.test(line) || /^import\s+PyQt6\b/.test(line)) {
      result.imports.push(line);
      continue;
    }

    // PyQt5 support (warn but still parse)
    if (/^from\s+PyQt5\b/.test(line) || /^import\s+PyQt5\b/.test(line)) {
      isPyQt5 = true;
      result.imports.push(line);
      const pyqt5Widgets = line.match(/^from\s+PyQt5\.QtWidgets\s+import\s+(.+)/);
      if (pyqt5Widgets) {
        const names = pyqt5Widgets[1].split(',').map(s => s.trim());
        for (const n of names) importedNames.add(n);
      }
      continue;
    }

    // PySide6 support
    if (/^from\s+PySide6\b/.test(line) || /^import\s+PySide6\b/.test(line)) {
      isPySide6 = true;
      result.imports.push(line);
      const pysideWidgets = line.match(/^from\s+PySide6\.QtWidgets\s+import\s+(.+)/);
      if (pysideWidgets) {
        const names = pysideWidgets[1].split(',').map(s => s.trim());
        for (const n of names) importedNames.add(n);
      }
      continue;
    }

    // PySide2 support
    if (/^from\s+PySide2\b/.test(line) || /^import\s+PySide2\b/.test(line)) {
      isPyQt5 = true; // PySide2 has same API shape as PyQt5
      result.imports.push(line);
      const pyside2Widgets = line.match(/^from\s+PySide2\.QtWidgets\s+import\s+(.+)/);
      if (pyside2Widgets) {
        const names = pyside2Widgets[1].split(',').map(s => s.trim());
        for (const n of names) importedNames.add(n);
      }
      continue;
    }

    // Non-Qt imports (skip silently)
    if (/^import\s+/.test(line) || /^from\s+/.test(line)) {
      continue;
    }
  }

  if (isPyQt5) {
    result.warnings.push('PyQt5/PySide2 detected -- some enum patterns differ from PyQt6; review generated code');
  }
  if (isPySide6) {
    result.warnings.push('PySide6 detected -- signal/slot syntax may differ slightly; review generated code');
  }

  // ── Pass 2: Parse classes, methods, widgets, signals, layouts ──

  // First, identify class boundaries
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const classMatch = trimmed.match(/^class\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (classMatch) {
      result.classes.push({
        name: classMatch[1],
        parent: classMatch[2].trim(),
        methods: [],
        line: i,
      });
    }
  }

  // Parse methods and their bodies within classes, plus top-level functions
  let currentFunction = null;
  let functionBody = [];
  let functionIndent = 0;
  let currentClass = null;
  let classIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineIndent = line.length - line.trimStart().length;

    // Skip comments and empty lines inside function collection
    if (trimmed.startsWith('#') || trimmed === '') {
      if (currentFunction && lineIndent > functionIndent) {
        functionBody.push(trimmed);
      }
      continue;
    }

    // Track class boundaries
    const classMatch = trimmed.match(/^class\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (classMatch) {
      // Save previous function
      if (currentFunction) {
        saveFunction(result, currentFunction, functionBody, currentClass);
        currentFunction = null;
        functionBody = [];
      }
      currentClass = classMatch[1];
      classIndent = lineIndent;
      continue;
    }

    // Detect if we've left the class scope
    if (currentClass && lineIndent <= classIndent && trimmed !== '' && !trimmed.startsWith('#')) {
      if (!trimmed.match(/^class\s+/) && !trimmed.match(/^def\s+/)) {
        currentClass = null;
      }
    }

    // Function/method definitions
    const funcMatch = trimmed.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*(?:->.*)?:/);
    if (funcMatch) {
      // Save previous function
      if (currentFunction) {
        saveFunction(result, currentFunction, functionBody, currentClass);
      }
      currentFunction = { name: funcMatch[1], args: funcMatch[2], line: i, className: currentClass };
      functionBody = [];
      functionIndent = lineIndent;
      continue;
    }

    // Collect function body lines
    if (currentFunction && lineIndent > functionIndent) {
      functionBody.push(trimmed);
      // Also parse the body line for widgets, signals, layouts, and config
      parsePyQt6Line(trimmed, i, result, importedNames);
    } else if (currentFunction && lineIndent <= functionIndent && trimmed !== '') {
      // Function ended
      saveFunction(result, currentFunction, functionBody, currentClass);
      currentFunction = null;
      functionBody = [];
      // Parse this line too (it's outside the function)
      parsePyQt6Line(trimmed, i, result, importedNames);
    } else if (!currentFunction) {
      // Top-level code
      parsePyQt6Line(trimmed, i, result, importedNames);
    }
  }

  // Save last function
  if (currentFunction) {
    saveFunction(result, currentFunction, functionBody, currentClass);
  }

  return result;
}


/**
 * Save a parsed function/method to the result structure.
 */
function saveFunction(result, fn, body, className) {
  const funcObj = {
    name: fn.name,
    args: fn.args,
    body: body.join('\n'),
    line: fn.line,
    className: className || null,
  };

  // Add to class methods if applicable
  if (className) {
    const cls = result.classes.find(c => c.name === className);
    if (cls) cls.methods.push(funcObj);
  }

  result.functions.push(funcObj);
}


/**
 * Parse a single Python line for PyQt6 patterns:
 * widget creation, signal connections, layout operations, window config.
 */
function parsePyQt6Line(trimmed, lineNum, result, importedNames) {
  // ── Widget creation: self.label = QLabel("Hello") or label = QLabel("Hello") ──
  for (const widgetType of Object.keys(WIDGET_MAP)) {
    // Match: self.name = WidgetType(...) or name = WidgetType(...)
    const selfPattern = new RegExp(`^self\\.(\\w+)\\s*=\\s*${widgetType}\\s*\\((.*)\\)\\s*$`);
    const barePattern = new RegExp(`^(\\w+)\\s*=\\s*${widgetType}\\s*\\((.*)\\)\\s*$`);

    let m = trimmed.match(selfPattern) || trimmed.match(barePattern);
    if (m) {
      const args = parseCallArgs(m[2]);
      result.widgets.push({
        name: m[1],
        widgetType: widgetType,
        parent: args.positional[0] || null,  // first positional arg is usually the parent
        args: args,
        line: lineNum,
      });
      return;
    }
  }

  // ── Layout creation: layout = QVBoxLayout() or self.layout = QHBoxLayout(self) ──
  const layoutTypes = ['QVBoxLayout', 'QHBoxLayout', 'QGridLayout', 'QFormLayout'];
  for (const lt of layoutTypes) {
    const selfLayoutPat = new RegExp(`^self\\.(\\w+)\\s*=\\s*${lt}\\s*\\((.*)\\)\\s*$`);
    const bareLayoutPat = new RegExp(`^(\\w+)\\s*=\\s*${lt}\\s*\\((.*)\\)\\s*$`);
    let m = trimmed.match(selfLayoutPat) || trimmed.match(bareLayoutPat);
    if (m) {
      result.layouts.push({
        name: m[1],
        layoutType: lt,
        children: [],   // populated later from addWidget calls
        stretches: [],   // populated from addStretch calls
        spacing: null,
        margins: null,
        line: lineNum,
      });
      return;
    }
  }

  // ── setLayout: self.setLayout(layout) or widget.setLayout(layout) ──
  const setLayoutMatch = trimmed.match(/^(?:self\.)?(\w+)?\.?setLayout\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  if (setLayoutMatch) {
    const widgetName = setLayoutMatch[1] || '_root';
    const layoutName = setLayoutMatch[2];
    const layout = result.layouts.find(l => l.name === layoutName);
    if (layout) {
      layout.owner = widgetName;
    }
    return;
  }

  // ── setCentralWidget: self.setCentralWidget(widget) ──
  const centralMatch = trimmed.match(/^self\.setCentralWidget\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  if (centralMatch) {
    result.windowConfig._centralWidget = centralMatch[1];
    return;
  }

  // ── layout.addWidget(widget) or layout.addWidget(widget, row, col) ──
  const addWidgetMatch = trimmed.match(/^(?:self\.)?(\w+)\.addWidget\s*\((.+)\)/);
  if (addWidgetMatch) {
    const layoutName = addWidgetMatch[1];
    const args = parseCallArgs(addWidgetMatch[2]);
    const widgetRef = (args.positional[0] || '').replace(/^self\./, '');
    const layout = result.layouts.find(l => l.name === layoutName);
    if (layout) {
      if (layout.layoutType === 'QGridLayout' && args.positional.length >= 3) {
        layout.children.push({
          widget: widgetRef,
          row: parseInt(args.positional[1]) || 0,
          col: parseInt(args.positional[2]) || 0,
          rowSpan: args.positional[3] ? parseInt(args.positional[3]) : 1,
          colSpan: args.positional[4] ? parseInt(args.positional[4]) : 1,
        });
      } else {
        layout.children.push({ widget: widgetRef, order: layout.children.length });
      }
    }
    return;
  }

  // ── layout.addLayout(sublayout) ──
  const addLayoutMatch = trimmed.match(/^(?:self\.)?(\w+)\.addLayout\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  if (addLayoutMatch) {
    const parentLayout = addLayoutMatch[1];
    const childLayout = addLayoutMatch[2];
    const layout = result.layouts.find(l => l.name === parentLayout);
    if (layout) {
      layout.children.push({ layout: childLayout, order: layout.children.length });
    }
    return;
  }

  // ── layout.addStretch(n) ──
  const addStretchMatch = trimmed.match(/^(?:self\.)?(\w+)\.addStretch\s*\(\s*(\d*)\s*\)/);
  if (addStretchMatch) {
    const layoutName = addStretchMatch[1];
    const factor = parseInt(addStretchMatch[2]) || 1;
    const layout = result.layouts.find(l => l.name === layoutName);
    if (layout) {
      layout.stretches.push({ order: layout.children.length, factor });
      layout.children.push({ stretch: true, factor, order: layout.children.length });
    }
    return;
  }

  // ── layout.setSpacing(n) ──
  const spacingMatch = trimmed.match(/^(?:self\.)?(\w+)\.setSpacing\s*\(\s*(\d+)\s*\)/);
  if (spacingMatch) {
    const layout = result.layouts.find(l => l.name === spacingMatch[1]);
    if (layout) layout.spacing = parseInt(spacingMatch[2]);
    return;
  }

  // ── layout.setContentsMargins(l, t, r, b) ──
  const marginsMatch = trimmed.match(/^(?:self\.)?(\w+)\.setContentsMargins\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (marginsMatch) {
    const layout = result.layouts.find(l => l.name === marginsMatch[1]);
    if (layout) {
      layout.margins = {
        left: parseInt(marginsMatch[2]),
        top: parseInt(marginsMatch[3]),
        right: parseInt(marginsMatch[4]),
        bottom: parseInt(marginsMatch[5]),
      };
    }
    return;
  }

  // ── layout.addRow(label, widget) for QFormLayout ──
  const addRowMatch = trimmed.match(/^(?:self\.)?(\w+)\.addRow\s*\((.+)\)/);
  if (addRowMatch) {
    const layoutName = addRowMatch[1];
    const args = parseCallArgs(addRowMatch[2]);
    const layout = result.layouts.find(l => l.name === layoutName);
    if (layout && layout.layoutType === 'QFormLayout') {
      const label = args.positional[0] || '';
      const widget = (args.positional[1] || '').replace(/^self\./, '');
      layout.children.push({
        formLabel: stripPythonString(label),
        widget: widget,
        order: layout.children.length,
      });
    }
    return;
  }

  // ── Signal connections: self.button.clicked.connect(self.on_click) ──
  const signalMatch = trimmed.match(/^(?:self\.)?(\w+)\.(\w+)\.connect\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  if (signalMatch) {
    result.signals.push({
      widget: signalMatch[1],
      signal: signalMatch[2],
      slot: signalMatch[3],
      line: lineNum,
    });
    return;
  }

  // ── Lambda signal connection: self.button.clicked.connect(lambda: self.do_thing()) ──
  const lambdaSignalMatch = trimmed.match(/^(?:self\.)?(\w+)\.(\w+)\.connect\s*\(\s*lambda\s*:?\s*(.+)\s*\)/);
  if (lambdaSignalMatch) {
    result.signals.push({
      widget: lambdaSignalMatch[1],
      signal: lambdaSignalMatch[2],
      slot: `() => { ${convertPythonExpr(lambdaSignalMatch[3])} }`,
      isLambda: true,
      line: lineNum,
    });
    return;
  }

  // ── Window configuration ──

  // self.setWindowTitle("Title")
  const titleMatch = trimmed.match(/^self\.setWindowTitle\s*\(\s*['"](.*?)['"]\s*\)/);
  if (titleMatch) {
    result.windowConfig.title = titleMatch[1];
    return;
  }

  // self.setGeometry(x, y, w, h)
  const geoMatch = trimmed.match(/^self\.setGeometry\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (geoMatch) {
    result.windowConfig.x = parseInt(geoMatch[1]);
    result.windowConfig.y = parseInt(geoMatch[2]);
    result.windowConfig.width = parseInt(geoMatch[3]);
    result.windowConfig.height = parseInt(geoMatch[4]);
    return;
  }

  // self.resize(w, h)
  const resizeMatch = trimmed.match(/^self\.resize\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (resizeMatch) {
    result.windowConfig.width = parseInt(resizeMatch[1]);
    result.windowConfig.height = parseInt(resizeMatch[2]);
    return;
  }

  // self.setFixedSize(w, h)
  const fixedSizeMatch = trimmed.match(/^self\.setFixedSize\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (fixedSizeMatch) {
    result.windowConfig.width = parseInt(fixedSizeMatch[1]);
    result.windowConfig.height = parseInt(fixedSizeMatch[2]);
    result.windowConfig.fixed = true;
    return;
  }

  // self.setMinimumSize(w, h)
  const minSizeMatch = trimmed.match(/^self\.setMinimumSize\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (minSizeMatch) {
    result.windowConfig.minWidth = parseInt(minSizeMatch[1]);
    result.windowConfig.minHeight = parseInt(minSizeMatch[2]);
    return;
  }

  // self.setStyleSheet("...") — on the window itself
  const windowStyleMatch = trimmed.match(/^self\.setStyleSheet\s*\(\s*(['"])([\s\S]*?)\1\s*\)/);
  if (windowStyleMatch) {
    result.windowConfig._styleSheet = windowStyleMatch[2];
    return;
  }

  // self.setStyleSheet("""...""")
  const windowStyleTriple = trimmed.match(/^self\.setStyleSheet\s*\(\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')\s*\)/);
  if (windowStyleTriple) {
    result.windowConfig._styleSheet = windowStyleTriple[1] || windowStyleTriple[2];
    return;
  }

  // widget.setStyleSheet("...") — on a specific widget
  const widgetStyleMatch = trimmed.match(/^(?:self\.)?(\w+)\.setStyleSheet\s*\(\s*(['"])([\s\S]*?)\2\s*\)/);
  if (widgetStyleMatch) {
    const widget = result.widgets.find(w => w.name === widgetStyleMatch[1]);
    if (widget) {
      widget._styleSheet = widgetStyleMatch[3];
    }
    return;
  }

  // widget.setStyleSheet("""...""")
  const widgetStyleTriple = trimmed.match(/^(?:self\.)?(\w+)\.setStyleSheet\s*\(\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')\s*\)/);
  if (widgetStyleTriple) {
    const widget = result.widgets.find(w => w.name === widgetStyleTriple[1]);
    if (widget) {
      widget._styleSheet = widgetStyleTriple[2] || widgetStyleTriple[3];
    }
    return;
  }

  // widget.setFont(QFont("Arial", 14))
  const fontMatch = trimmed.match(/^(?:self\.)?(\w+)\.setFont\s*\(\s*QFont\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*(\d+))?\s*\)\s*\)/);
  if (fontMatch) {
    const widget = result.widgets.find(w => w.name === fontMatch[1]);
    if (widget) {
      if (!widget._fontOverride) widget._fontOverride = {};
      widget._fontOverride.family = fontMatch[2];
      if (fontMatch[3]) widget._fontOverride.size = parseInt(fontMatch[3]);
    }
    return;
  }

  // widget.setText("...")
  const setTextMatch = trimmed.match(/^(?:self\.)?(\w+)\.setText\s*\(\s*['"](.*?)['"]\s*\)/);
  if (setTextMatch) {
    const widget = result.widgets.find(w => w.name === setTextMatch[1]);
    if (widget) {
      widget._setText = setTextMatch[2];
    }
    return;
  }

  // widget.setPlaceholderText("...")
  const placeholderMatch = trimmed.match(/^(?:self\.)?(\w+)\.setPlaceholderText\s*\(\s*['"](.*?)['"]\s*\)/);
  if (placeholderMatch) {
    const widget = result.widgets.find(w => w.name === placeholderMatch[1]);
    if (widget) {
      widget._placeholder = placeholderMatch[2];
    }
    return;
  }

  // widget.setToolTip("...")
  const tooltipMatch = trimmed.match(/^(?:self\.)?(\w+)\.setToolTip\s*\(\s*['"](.*?)['"]\s*\)/);
  if (tooltipMatch) {
    const widget = result.widgets.find(w => w.name === tooltipMatch[1]);
    if (widget) {
      widget._tooltip = tooltipMatch[2];
    }
    return;
  }

  // widget.setFixedSize(w, h)
  const widgetFixedMatch = trimmed.match(/^(?:self\.)?(\w+)\.setFixedSize\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (widgetFixedMatch) {
    const widget = result.widgets.find(w => w.name === widgetFixedMatch[1]);
    if (widget) {
      widget._fixedWidth = parseInt(widgetFixedMatch[2]);
      widget._fixedHeight = parseInt(widgetFixedMatch[3]);
    }
    return;
  }

  // widget.setFixedWidth(w)
  const fixedWMatch = trimmed.match(/^(?:self\.)?(\w+)\.setFixedWidth\s*\(\s*(\d+)\s*\)/);
  if (fixedWMatch) {
    const widget = result.widgets.find(w => w.name === fixedWMatch[1]);
    if (widget) widget._fixedWidth = parseInt(fixedWMatch[2]);
    return;
  }

  // widget.setFixedHeight(h)
  const fixedHMatch = trimmed.match(/^(?:self\.)?(\w+)\.setFixedHeight\s*\(\s*(\d+)\s*\)/);
  if (fixedHMatch) {
    const widget = result.widgets.find(w => w.name === fixedHMatch[1]);
    if (widget) widget._fixedHeight = parseInt(fixedHMatch[2]);
    return;
  }

  // widget.setMinimumSize(w, h) / setMinimumWidth / setMinimumHeight
  const minWSizeMatch = trimmed.match(/^(?:self\.)?(\w+)\.setMinimumWidth\s*\(\s*(\d+)\s*\)/);
  if (minWSizeMatch) {
    const widget = result.widgets.find(w => w.name === minWSizeMatch[1]);
    if (widget) widget._minWidth = parseInt(minWSizeMatch[2]);
    return;
  }
  const minHSizeMatch = trimmed.match(/^(?:self\.)?(\w+)\.setMinimumHeight\s*\(\s*(\d+)\s*\)/);
  if (minHSizeMatch) {
    const widget = result.widgets.find(w => w.name === minHSizeMatch[1]);
    if (widget) widget._minHeight = parseInt(minHSizeMatch[2]);
    return;
  }
  const minSizeWidgetMatch = trimmed.match(/^(?:self\.)?(\w+)\.setMinimumSize\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (minSizeWidgetMatch) {
    const widget = result.widgets.find(w => w.name === minSizeWidgetMatch[1]);
    if (widget) {
      widget._minWidth = parseInt(minSizeWidgetMatch[2]);
      widget._minHeight = parseInt(minSizeWidgetMatch[3]);
    }
    return;
  }

  // widget.setMaximumSize(w, h) / setMaximumWidth / setMaximumHeight
  const maxWSizeMatch = trimmed.match(/^(?:self\.)?(\w+)\.setMaximumWidth\s*\(\s*(\d+)\s*\)/);
  if (maxWSizeMatch) {
    const widget = result.widgets.find(w => w.name === maxWSizeMatch[1]);
    if (widget) widget._maxWidth = parseInt(maxWSizeMatch[2]);
    return;
  }
  const maxHSizeMatch = trimmed.match(/^(?:self\.)?(\w+)\.setMaximumHeight\s*\(\s*(\d+)\s*\)/);
  if (maxHSizeMatch) {
    const widget = result.widgets.find(w => w.name === maxHSizeMatch[1]);
    if (widget) widget._maxHeight = parseInt(maxHSizeMatch[2]);
    return;
  }
  const maxSizeWidgetMatch = trimmed.match(/^(?:self\.)?(\w+)\.setMaximumSize\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (maxSizeWidgetMatch) {
    const widget = result.widgets.find(w => w.name === maxSizeWidgetMatch[1]);
    if (widget) {
      widget._maxWidth = parseInt(maxSizeWidgetMatch[2]);
      widget._maxHeight = parseInt(maxSizeWidgetMatch[3]);
    }
    return;
  }

  // widget.setEnabled(False) / widget.setDisabled(True)
  const enabledMatch = trimmed.match(/^(?:self\.)?(\w+)\.setEnabled\s*\(\s*(True|False)\s*\)/);
  if (enabledMatch) {
    const widget = result.widgets.find(w => w.name === enabledMatch[1]);
    if (widget) widget._disabled = enabledMatch[2] === 'False';
    return;
  }
  const disabledMatch = trimmed.match(/^(?:self\.)?(\w+)\.setDisabled\s*\(\s*(True|False)\s*\)/);
  if (disabledMatch) {
    const widget = result.widgets.find(w => w.name === disabledMatch[1]);
    if (widget) widget._disabled = disabledMatch[2] === 'True';
    return;
  }

  // widget.setVisible(False) / widget.hide() / widget.show()
  const visibleMatch = trimmed.match(/^(?:self\.)?(\w+)\.setVisible\s*\(\s*(True|False)\s*\)/);
  if (visibleMatch) {
    const widget = result.widgets.find(w => w.name === visibleMatch[1]);
    if (widget) widget._hidden = visibleMatch[2] === 'False';
    return;
  }
  const hideMatch = trimmed.match(/^(?:self\.)?(\w+)\.hide\s*\(\s*\)/);
  if (hideMatch) {
    const widget = result.widgets.find(w => w.name === hideMatch[1]);
    if (widget) widget._hidden = true;
    return;
  }

  // widget.setAlignment(Qt.AlignCenter)
  const alignMatch = trimmed.match(/^(?:self\.)?(\w+)\.setAlignment\s*\(\s*(.+?)\s*\)/);
  if (alignMatch) {
    const widget = result.widgets.find(w => w.name === alignMatch[1]);
    if (widget) widget._alignment = alignMatch[2];
    return;
  }

  // widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
  const sizePolicyMatch = trimmed.match(/^(?:self\.)?(\w+)\.setSizePolicy\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/);
  if (sizePolicyMatch) {
    const widget = result.widgets.find(w => w.name === sizePolicyMatch[1]);
    if (widget) {
      widget._sizePolicyH = sizePolicyMatch[2].trim();
      widget._sizePolicyV = sizePolicyMatch[3].trim();
    }
    return;
  }

  // QAction creation: action = QAction("Name", self)
  const actionMatch = trimmed.match(/^(?:self\.)?(\w+)\s*=\s*QAction\s*\(\s*['"](.*?)['"](?:\s*,\s*(?:self|\w+))?\s*\)/);
  if (actionMatch) {
    result.widgets.push({
      name: actionMatch[1],
      widgetType: 'QAction',
      parent: null,
      args: { positional: [actionMatch[2]], kwargs: {} },
      _actionText: actionMatch[2],
      line: lineNum,
    });
    return;
  }

  // action.triggered.connect(handler) — specifically for QAction signals
  const actionSignalMatch = trimmed.match(/^(?:self\.)?(\w+)\.triggered\.connect\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  if (actionSignalMatch) {
    result.signals.push({
      widget: actionSignalMatch[1],
      signal: 'triggered',
      slot: actionSignalMatch[2],
      line: lineNum,
    });
    return;
  }

  // menubar.addMenu("File") or self.menubar = self.menuBar()
  const menuBarMatch = trimmed.match(/^(?:self\.)?(\w+)\s*=\s*self\.menuBar\s*\(\s*\)/);
  if (menuBarMatch) {
    result.windowConfig._menuBar = menuBarMatch[1];
    return;
  }

  // menu = menubar.addMenu("File")
  const addMenuMatch = trimmed.match(/^(?:self\.)?(\w+)\s*=\s*(?:self\.)?(\w+)\.addMenu\s*\(\s*['"](.*?)['"]\s*\)/);
  if (addMenuMatch) {
    result.widgets.push({
      name: addMenuMatch[1],
      widgetType: 'QMenu',
      parent: addMenuMatch[2],
      args: { positional: [addMenuMatch[3]], kwargs: {} },
      _menuTitle: addMenuMatch[3],
      line: lineNum,
    });
    return;
  }

  // menu.addAction(action)
  const menuAddActionMatch = trimmed.match(/^(?:self\.)?(\w+)\.addAction\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  if (menuAddActionMatch) {
    const menu = result.widgets.find(w => w.name === menuAddActionMatch[1]);
    if (menu) {
      if (!menu._actions) menu._actions = [];
      menu._actions.push(menuAddActionMatch[2]);
    }
    return;
  }

  // menu.addSeparator()
  const menuSepMatch = trimmed.match(/^(?:self\.)?(\w+)\.addSeparator\s*\(\s*\)/);
  if (menuSepMatch) {
    const menu = result.widgets.find(w => w.name === menuSepMatch[1]);
    if (menu) {
      if (!menu._actions) menu._actions = [];
      menu._actions.push('__separator__');
    }
    return;
  }

  // toolbar.addAction(action)
  const toolbarAddMatch = trimmed.match(/^(?:self\.)?(\w+)\.addAction\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  // already handled by menuAddActionMatch above

  // statusbar: self.statusBar().showMessage("Ready")
  const statusBarMatch = trimmed.match(/^self\.statusBar\(\)\.showMessage\s*\(\s*['"](.*?)['"]\s*\)/);
  if (statusBarMatch) {
    result.windowConfig._statusMessage = statusBarMatch[1];
    return;
  }

  // self.statusbar = QStatusBar() or self.setStatusBar(...)
  const setStatusBarMatch = trimmed.match(/^self\.setStatusBar\s*\(\s*(?:self\.)?(\w+)\s*\)/);
  if (setStatusBarMatch) {
    result.windowConfig._statusBar = setStatusBarMatch[1];
    return;
  }

  // Skip mainloop / app.exec / sys.exit
  if (/app\.exec[_(]/.test(trimmed) || /sys\.exit/.test(trimmed) || /\.show\s*\(\s*\)/.test(trimmed)) {
    return;
  }

  // QMessageBox calls
  if (/QMessageBox\./.test(trimmed)) {
    result.warnings.push(`[line ${lineNum + 1}] QMessageBox call -- convert to Modal component`);
    return;
  }

  // QFileDialog calls
  if (/QFileDialog\./.test(trimmed)) {
    result.warnings.push(`[line ${lineNum + 1}] QFileDialog call -- use onFileDrop or custom file picker`);
    return;
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARGUMENT PARSING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse function call arguments into positional and keyword args.
 * Handles nested parens, quotes, and keyword=value patterns.
 */
function parseCallArgs(str) {
  const positional = [];
  const kwargs = {};
  if (!str || !str.trim()) return { positional, kwargs };

  const s = str.trim();
  const parts = splitArgs(s);

  for (const part of parts) {
    const kv = part.match(/^(\w+)\s*=\s*(.+)$/);
    if (kv) {
      kwargs[kv[1]] = kv[2].trim();
    } else {
      positional.push(part.trim());
    }
  }

  return { positional, kwargs };
}


/**
 * Split a comma-separated argument string, respecting nested parens/brackets/quotes.
 */
function splitArgs(s) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inStr = null;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (inStr) {
      current += ch;
      if (ch === '\\') {
        i++;
        if (i < s.length) current += s[i];
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = ch;
      current += ch;
      i++;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') { depth++; current += ch; i++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; current += ch; i++; continue; }

    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}


/**
 * Strip Python string quotes from a value.
 */
function stripPythonString(val) {
  if (!val) return '';
  val = val.trim();
  // Triple-quoted strings
  if (val.startsWith('"""') && val.endsWith('"""')) return val.slice(3, -3);
  if (val.startsWith("'''") && val.endsWith("'''")) return val.slice(3, -3);
  // Single/double quoted
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLE CONVERSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse a Qt CSS stylesheet string into a ReactJIT style object.
 * Handles: "background-color: #333; color: white; font-size: 14px;"
 */
function parseStyleSheet(css) {
  const style = {};
  if (!css) return style;

  // Remove selector blocks (e.g., "QPushButton { ... }") — flatten to just properties
  // For complex selectors we just extract all property:value pairs
  const flattened = css.replace(/[^{]*\{([^}]*)\}/g, '$1').trim();
  const source = flattened || css;

  const declarations = source.split(';').map(s => s.trim()).filter(Boolean);

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;

    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();

    const rjitProp = CSS_PROP_MAP[prop];
    if (!rjitProp) continue;

    // Special handling for shorthand properties
    if (rjitProp === '_border') {
      const borderParts = val.split(/\s+/);
      for (const part of borderParts) {
        if (/^\d+/.test(part)) {
          style.borderWidth = parseInt(part);
        } else if (part.startsWith('#') || part.startsWith('rgb') || QT_COLORS[part]) {
          style.borderColor = resolveQtColor(part);
        }
      }
      continue;
    }

    if (rjitProp === '_padding') {
      const padParts = val.split(/\s+/).map(p => parseInt(p));
      if (padParts.length === 1) {
        style.padding = padParts[0];
      } else if (padParts.length === 2) {
        style.paddingTop = padParts[0]; style.paddingBottom = padParts[0];
        style.paddingLeft = padParts[1]; style.paddingRight = padParts[1];
      } else if (padParts.length === 4) {
        style.paddingTop = padParts[0]; style.paddingRight = padParts[1];
        style.paddingBottom = padParts[2]; style.paddingLeft = padParts[3];
      }
      continue;
    }

    if (rjitProp === '_margin') {
      const marginParts = val.split(/\s+/).map(p => parseInt(p));
      if (marginParts.length === 1) {
        style.margin = marginParts[0];
      } else if (marginParts.length === 2) {
        style.marginTop = marginParts[0]; style.marginBottom = marginParts[0];
        style.marginLeft = marginParts[1]; style.marginRight = marginParts[1];
      } else if (marginParts.length === 4) {
        style.marginTop = marginParts[0]; style.marginRight = marginParts[1];
        style.marginBottom = marginParts[2]; style.marginLeft = marginParts[3];
      }
      continue;
    }

    // Skip internal-only markers
    if (rjitProp.startsWith('_')) continue;

    // Convert the value
    if (['fontSize', 'borderWidth', 'borderRadius', 'width', 'height',
         'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
         'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
         'marginTop', 'marginBottom', 'marginLeft', 'marginRight'].includes(rjitProp)) {
      const num = parseInt(val);
      if (!isNaN(num)) style[rjitProp] = num;
    } else if (rjitProp === 'opacity') {
      const num = parseFloat(val);
      if (!isNaN(num)) style[rjitProp] = num;
    } else if (rjitProp === 'backgroundColor' || rjitProp === 'color' || rjitProp === 'borderColor') {
      style[rjitProp] = resolveQtColor(val);
    } else {
      style[rjitProp] = val;
    }
  }

  return style;
}


/**
 * Resolve a Qt color value to a hex color string.
 */
function resolveQtColor(val) {
  if (!val) return null;
  val = val.trim().replace(/^['"]|['"]$/g, '');
  if (val.startsWith('#') || val.startsWith('rgb') || val === 'transparent') return val;
  if (QT_COLORS[val]) return QT_COLORS[val];
  // Handle Qt.Color or GlobalColor.Color patterns
  if (QT_COLORS[`Qt.${val}`]) return QT_COLORS[`Qt.${val}`];
  return val; // pass through
}


/**
 * Parse Qt alignment flags into ReactJIT style properties.
 */
function parseAlignment(alignStr) {
  if (!alignStr) return {};
  const style = {};
  const s = alignStr.replace(/Qt\.|Qt\.AlignmentFlag\./g, '');

  if (s.includes('AlignCenter') || s.includes('AlignHCenter') && s.includes('AlignVCenter')) {
    style.alignItems = 'center';
    style.justifyContent = 'center';
  } else {
    if (s.includes('AlignHCenter')) style.alignItems = 'center';
    if (s.includes('AlignVCenter')) style.justifyContent = 'center';
    if (s.includes('AlignLeft')) style.alignItems = 'flex-start';
    if (s.includes('AlignRight')) style.alignItems = 'flex-end';
    if (s.includes('AlignTop')) style.justifyContent = 'flex-start';
    if (s.includes('AlignBottom')) style.justifyContent = 'flex-end';
  }

  // For text alignment on Text components
  if (s.includes('AlignCenter') || s.includes('AlignHCenter')) {
    style.textAlign = 'center';
  } else if (s.includes('AlignRight')) {
    style.textAlign = 'right';
  } else if (s.includes('AlignLeft')) {
    style.textAlign = 'left';
  }

  return style;
}


/**
 * Convert a QSizePolicy value to flexGrow/flexShrink hints.
 */
function parseSizePolicy(hPolicy, vPolicy) {
  const style = {};
  const isExpanding = (p) => p && (p.includes('Expanding') || p.includes('MinimumExpanding'));
  if (isExpanding(hPolicy)) style.flexGrow = 1;
  if (isExpanding(vPolicy)) style.flexGrow = 1;
  return style;
}


/**
 * Build a complete ReactJIT style object for a widget.
 */
function buildWidgetStyle(widget, mapping) {
  const style = {};

  // From stylesheet
  if (widget._styleSheet) {
    Object.assign(style, parseStyleSheet(widget._styleSheet));
  }

  // Constructor args (text in first positional for QLabel, QPushButton etc.)
  const firstArg = widget.args?.positional?.[0];
  // text is handled separately, not as style

  // Font overrides
  if (widget._fontOverride) {
    if (widget._fontOverride.family) style.fontFamily = widget._fontOverride.family;
    if (widget._fontOverride.size) style.fontSize = widget._fontOverride.size;
  }

  // Font from constructor kwargs
  if (widget.args?.kwargs?.font) {
    const fontInfo = parseQFont(widget.args.kwargs.font);
    if (fontInfo.family) style.fontFamily = fontInfo.family;
    if (fontInfo.size) style.fontSize = fontInfo.size;
    if (fontInfo.weight) style.fontWeight = fontInfo.weight;
  }

  // Fixed dimensions
  if (widget._fixedWidth) style.width = widget._fixedWidth;
  if (widget._fixedHeight) style.height = widget._fixedHeight;

  // Min/max dimensions
  if (widget._minWidth) style.minWidth = widget._minWidth;
  if (widget._minHeight) style.minHeight = widget._minHeight;
  if (widget._maxWidth) style.maxWidth = widget._maxWidth;
  if (widget._maxHeight) style.maxHeight = widget._maxHeight;

  // Alignment
  if (widget._alignment) {
    Object.assign(style, parseAlignment(widget._alignment));
  }

  // Size policy
  if (widget._sizePolicyH || widget._sizePolicyV) {
    Object.assign(style, parseSizePolicy(widget._sizePolicyH, widget._sizePolicyV));
  }

  // Disabled state
  if (widget._disabled) {
    style.opacity = 0.5;
  }

  // Default border radius for buttons and inputs
  if (['button', 'input', 'dropdown'].includes(mapping.type) && !style.borderRadius) {
    style.borderRadius = 4;
  }

  return style;
}


/**
 * Parse a QFont constructor call: QFont("Arial", 14) or QFont("Arial", 14, QFont.Bold)
 */
function parseQFont(fontStr) {
  const result = {};
  if (!fontStr) return result;

  const m = fontStr.match(/QFont\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*(\d+))?(?:\s*,\s*(.+))?\s*\)/);
  if (m) {
    result.family = m[1];
    if (m[2]) result.size = parseInt(m[2]);
    if (m[3]) {
      const weightStr = m[3].trim();
      if (weightStr.includes('Bold') || weightStr.includes('75')) result.weight = 'bold';
      if (weightStr.includes('Light') || weightStr.includes('25')) result.weight = '300';
    }
  }

  return result;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a complete ReactJIT TSX component from the parsed PyQt6 structure.
 */
export function generateReactJIT(parsed) {
  const components = new Set(['Box']);
  const warnings = [...parsed.warnings];

  // Build lookup maps
  const widgetMap = {};
  for (const w of parsed.widgets) {
    widgetMap[w.name] = w;
  }

  const signalMap = {};
  for (const s of parsed.signals) {
    if (!signalMap[s.widget]) signalMap[s.widget] = [];
    signalMap[s.widget].push(s);
  }

  const layoutMap = {};
  for (const l of parsed.layouts) {
    layoutMap[l.name] = l;
  }

  // Find the root layout (the one set on the central widget or the window itself)
  const rootLayout = findRootLayout(parsed);

  // ── Collect state variables ─────────────────
  // In PyQt6, instance variables (self.x = ...) are potential state vars.
  // We look for widget text/value bindings and tracked instance vars.
  const stateVars = new Set();
  const stateDecls = [];

  // Widgets that might need visibility state (modals, dialogs)
  for (const w of parsed.widgets) {
    const mapping = WIDGET_MAP[w.widgetType];
    if (mapping && mapping.type === 'modal') {
      stateVars.add(`${w.name}Visible`);
      stateDecls.push(`  const [${w.name}Visible, set${capitalize(w.name)}Visible] = useState<boolean>(false);`);
    }
    if (mapping && mapping.type === 'notebook') {
      if (!stateVars.has('activeTab')) {
        stateVars.add('activeTab');
        stateDecls.push(`  const [activeTab, setActiveTab] = useState<number>(0);`);
      }
    }
    if (mapping && (mapping.type === 'checkbox')) {
      stateVars.add(w.name + 'Checked');
      stateDecls.push(`  const [${w.name}Checked, set${capitalize(w.name)}Checked] = useState<boolean>(false);`);
    }
    if (mapping && (mapping.type === 'dropdown')) {
      stateVars.add(w.name + 'Open');
      stateDecls.push(`  const [${w.name}Open, set${capitalize(w.name)}Open] = useState<boolean>(false);`);
      stateVars.add(w.name + 'Value');
      stateDecls.push(`  const [${w.name}Value, set${capitalize(w.name)}Value] = useState<string>('');`);
    }
    if (mapping && (mapping.type === 'input' || mapping.type === 'multiline')) {
      stateVars.add(w.name + 'Text');
      stateDecls.push(`  const [${w.name}Text, set${capitalize(w.name)}Text] = useState<string>('');`);
    }
    if (mapping && (mapping.type === 'slider')) {
      stateVars.add(w.name + 'Value');
      stateDecls.push(`  const [${w.name}Value, set${capitalize(w.name)}Value] = useState<number>(0);`);
    }
    if (mapping && (mapping.type === 'progressbar')) {
      stateVars.add(w.name + 'Progress');
      stateDecls.push(`  const [${w.name}Progress, set${capitalize(w.name)}Progress] = useState<number>(0);`);
    }
    if (mapping && (mapping.type === 'list' || mapping.type === 'table' || mapping.type === 'tree')) {
      if (!stateVars.has(w.name + 'Items')) {
        stateVars.add(w.name + 'Items');
        stateDecls.push(`  const [${w.name}Items, set${capitalize(w.name)}Items] = useState<any[]>([]);`);
      }
    }
  }

  // ── Convert functions ──────────────────────
  const funcDecls = [];
  for (const f of parsed.functions) {
    // Skip __init__ and special methods
    if (f.name === '__init__' || f.name === '__del__' || f.name === '__str__' || f.name === '__repr__') continue;
    // Skip if it's a slot that just configures widgets (we inline those)
    const jsArgs = f.args.replace(/self,?\s*/, '').replace(/:\s*\w+/g, '').trim();
    funcDecls.push(`  // Converted from Python: def ${f.name}(${f.args})`);
    funcDecls.push(`  const ${f.name} = (${jsArgs}) => {`);
    const bodyLines = f.body.split('\n').filter(l => l.trim());
    for (const bl of bodyLines) {
      funcDecls.push(`    ${convertPythonLine(bl, stateVars)}`);
    }
    funcDecls.push(`  };`);
    funcDecls.push('');
  }

  // ── Generate the JSX tree ──────────────────
  const jsxLines = [];

  // Root container style
  const rootStyle = {
    width: "'100%'",
    height: "'100%'",
  };
  if (parsed.windowConfig.width) rootStyle.width = parsed.windowConfig.width;
  if (parsed.windowConfig.height) rootStyle.height = parsed.windowConfig.height;

  // Parse window-level stylesheet
  if (parsed.windowConfig._styleSheet) {
    const windowStyle = parseStyleSheet(parsed.windowConfig._styleSheet);
    if (windowStyle.backgroundColor) rootStyle.backgroundColor = `'${windowStyle.backgroundColor}'`;
    if (windowStyle.color) rootStyle.color = `'${windowStyle.color}'`;
  }

  const rootStyleParts = Object.entries(rootStyle).map(([k, v]) => {
    if (typeof v === 'number') return `${k}: ${v}`;
    if (typeof v === 'string' && v.startsWith("'")) return `${k}: ${v}`;
    return `${k}: ${v}`;
  });

  jsxLines.push(`${indent(2)}<Box style={{ ${rootStyleParts.join(', ')} }}>`);

  // Menu bar (if present)
  if (parsed.windowConfig._menuBar) {
    jsxLines.push(...generateMenuBar(parsed, 3, components, warnings));
  }

  // Main content from layout tree
  if (rootLayout) {
    jsxLines.push(...generateLayoutJSX(rootLayout, parsed, 3, components, warnings, widgetMap, signalMap, layoutMap));
  } else {
    // No layout found -- render widgets in order
    for (const w of parsed.widgets) {
      const mapping = WIDGET_MAP[w.widgetType];
      if (!mapping || !mapping.component) continue;
      if (mapping.type === 'action' || mapping.type === 'skip') continue;
      if (mapping.type === 'menu') continue; // handled by menu bar
      jsxLines.push(...generateWidgetJSX(w, mapping, parsed, 3, components, warnings, signalMap));
    }
  }

  // Status bar (if present)
  if (parsed.windowConfig._statusMessage || parsed.windowConfig._statusBar) {
    jsxLines.push(`${indent(3)}<Box style={{ padding: 4, backgroundColor: '#2a2a2a', borderTopWidth: 1, borderColor: '#444' }}>`);
    jsxLines.push(`${indent(4)}<Text style={{ fontSize: 12, color: '#888' }}>${parsed.windowConfig._statusMessage || 'Ready'}</Text>`);
    jsxLines.push(`${indent(3)}</Box>`);
    components.add('Text');
  }

  jsxLines.push(`${indent(2)}</Box>`);

  // ── Assemble final output ──────────────────
  const output = [];

  const needsUseState = stateDecls.length > 0;
  const needsUseEffect = false; // could be added if timers detected
  const reactHooks = [];
  if (needsUseState) reactHooks.push('useState');
  if (needsUseEffect) reactHooks.push('useEffect');
  const hooksImport = reactHooks.length > 0 ? `, { ${reactHooks.join(', ')} }` : '';

  output.push(`import React${hooksImport} from 'react';`);
  output.push(`import { ${[...components].sort().join(', ')} } from '@reactjit/core';`);
  output.push('');

  // Determine component name
  const componentName = parsed.windowConfig.title
    ? parsed.windowConfig.title.replace(/[^a-zA-Z0-9]/g, '') || 'App'
    : (parsed.classes.length > 0 ? parsed.classes[0].name : 'App');

  if (parsed.windowConfig.title) {
    output.push(`// Migrated from PyQt6: "${parsed.windowConfig.title}"`);
  } else if (parsed.classes.length > 0) {
    output.push(`// Migrated from PyQt6: class ${parsed.classes[0].name}`);
  }
  output.push(`// Original window: ${parsed.windowConfig.width || '?'}x${parsed.windowConfig.height || '?'}`);
  output.push('');

  output.push(`export default function ${componentName}() {`);

  if (stateDecls.length > 0) {
    output.push(...stateDecls);
    output.push('');
  }

  if (funcDecls.length > 0) {
    output.push(...funcDecls);
  }

  output.push('  return (');
  output.push(...jsxLines);
  output.push('  );');
  output.push('}');

  return {
    code: output.join('\n'),
    warnings: [...new Set(warnings)],
    components: [...components],
    stats: {
      widgets: parsed.widgets.length,
      signals: parsed.signals.length,
      layouts: parsed.layouts.length,
      functions: parsed.functions.filter(f => f.name !== '__init__').length,
      classes: parsed.classes.length,
    },
  };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT TREE → JSX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Find the root layout — the one attached to the central widget or window.
 */
function findRootLayout(parsed) {
  // If there's a central widget, find its layout
  if (parsed.windowConfig._centralWidget) {
    const centralWidget = parsed.windowConfig._centralWidget;
    // Find a layout whose owner is the central widget
    const layout = parsed.layouts.find(l => l.owner === centralWidget);
    if (layout) return layout;
  }

  // Find layout whose owner is _root (from self.setLayout)
  const rootLayout = parsed.layouts.find(l => l.owner === '_root');
  if (rootLayout) return rootLayout;

  // Fallback: first layout with no explicit owner or whose owner is self
  if (parsed.layouts.length > 0) {
    return parsed.layouts[0];
  }

  return null;
}


/**
 * Generate JSX for a layout and its children recursively.
 */
function generateLayoutJSX(layout, parsed, depth, components, warnings, widgetMap, signalMap, layoutMap) {
  const out = [];
  const style = {};

  // Layout direction
  if (layout.layoutType === 'QVBoxLayout') {
    // column is default, no need to set
  } else if (layout.layoutType === 'QHBoxLayout') {
    style.flexDirection = 'row';
  } else if (layout.layoutType === 'QGridLayout') {
    // Handled specially below
  } else if (layout.layoutType === 'QFormLayout') {
    // Column of rows
  }

  // Spacing
  if (layout.spacing != null) {
    style.gap = layout.spacing;
  }

  // Margins → padding
  if (layout.margins) {
    style.paddingLeft = layout.margins.left;
    style.paddingTop = layout.margins.top;
    style.paddingRight = layout.margins.right;
    style.paddingBottom = layout.margins.bottom;
  }

  // Grid layout
  if (layout.layoutType === 'QGridLayout') {
    const styleStr = formatStyleAttr({ ...style, flexDirection: undefined });
    out.push(`${indent(depth)}<Box${styleStr || ' style={{ flexDirection: \'column\' }}'}>`);

    // Group children by row
    const rows = {};
    for (const child of layout.children) {
      if (child.stretch) continue;
      if (child.row !== undefined) {
        if (!rows[child.row]) rows[child.row] = [];
        rows[child.row].push(child);
      }
    }

    const sortedRows = Object.keys(rows).map(Number).sort((a, b) => a - b);
    for (const rowIdx of sortedRows) {
      const cols = rows[rowIdx].sort((a, b) => a.col - b.col);
      if (cols.length === 1) {
        const child = cols[0];
        const w = widgetMap[child.widget];
        if (w) {
          const mapping = WIDGET_MAP[w.widgetType];
          if (mapping && mapping.component) {
            out.push(...generateWidgetJSX(w, mapping, parsed, depth + 1, components, warnings, signalMap));
          }
        }
      } else {
        out.push(`${indent(depth + 1)}<Box style={{ flexDirection: 'row', gap: ${layout.spacing || 8} }}>`);
        for (const child of cols) {
          const w = widgetMap[child.widget];
          if (w) {
            const mapping = WIDGET_MAP[w.widgetType];
            if (mapping && mapping.component) {
              out.push(...generateWidgetJSX(w, mapping, parsed, depth + 2, components, warnings, signalMap));
            }
          }
        }
        out.push(`${indent(depth + 1)}</Box>`);
      }
    }

    out.push(`${indent(depth)}</Box>`);
    return out;
  }

  // Form layout
  if (layout.layoutType === 'QFormLayout') {
    out.push(`${indent(depth)}<Box${formatStyleAttr(style) || ' style={{}}'}>`);
    for (const child of layout.children) {
      if (child.formLabel !== undefined) {
        out.push(`${indent(depth + 1)}<Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>`);
        out.push(`${indent(depth + 2)}<Text style={{ minWidth: 100 }}>${child.formLabel}</Text>`);
        components.add('Text');
        const w = widgetMap[child.widget];
        if (w) {
          const mapping = WIDGET_MAP[w.widgetType];
          if (mapping && mapping.component) {
            out.push(...generateWidgetJSX(w, mapping, parsed, depth + 2, components, warnings, signalMap));
          }
        }
        out.push(`${indent(depth + 1)}</Box>`);
      } else if (child.widget) {
        const w = widgetMap[child.widget];
        if (w) {
          const mapping = WIDGET_MAP[w.widgetType];
          if (mapping && mapping.component) {
            out.push(...generateWidgetJSX(w, mapping, parsed, depth + 1, components, warnings, signalMap));
          }
        }
      }
    }
    out.push(`${indent(depth)}</Box>`);
    return out;
  }

  // VBox or HBox layout
  const styleStr = formatStyleAttr(style);
  out.push(`${indent(depth)}<Box${styleStr || ' style={{}}'}>`);

  // Sort children by order
  const sortedChildren = [...layout.children].sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const child of sortedChildren) {
    if (child.stretch) {
      // addStretch() → spacer with flexGrow
      out.push(`${indent(depth + 1)}<Box style={{ flexGrow: ${child.factor || 1} }} />`);
      continue;
    }

    if (child.layout) {
      // Nested layout
      const nestedLayout = layoutMap[child.layout];
      if (nestedLayout) {
        out.push(...generateLayoutJSX(nestedLayout, parsed, depth + 1, components, warnings, widgetMap, signalMap, layoutMap));
      }
      continue;
    }

    if (child.widget) {
      const w = widgetMap[child.widget];
      if (w) {
        const mapping = WIDGET_MAP[w.widgetType];
        if (!mapping || !mapping.component) {
          if (mapping && mapping.type === 'action') continue;
          if (mapping && mapping.type === 'skip') continue;
          warnings.push(`Widget "${w.widgetType}" for "${w.name}" -- no mapping, skipped`);
          continue;
        }
        // If the widget itself has a layout assigned, render its content through that layout
        const widgetLayout = parsed.layouts.find(l => l.owner === w.name);
        if (widgetLayout && mapping.type === 'container') {
          const containerStyle = buildWidgetStyle(w, mapping);
          const containerStyleStr = formatStyleAttr(containerStyle);
          if (mapping.hasLabel) {
            const labelText = getWidgetText(w);
            if (labelText) {
              out.push(`${indent(depth + 1)}{/* ${labelText} */}`);
            }
          }
          out.push(`${indent(depth + 1)}<Box${containerStyleStr || ' style={{}}'}>`);
          out.push(...generateLayoutJSX(widgetLayout, parsed, depth + 2, components, warnings, widgetMap, signalMap, layoutMap));
          out.push(`${indent(depth + 1)}</Box>`);
        } else {
          out.push(...generateWidgetJSX(w, mapping, parsed, depth + 1, components, warnings, signalMap));
        }
      }
      continue;
    }
  }

  out.push(`${indent(depth)}</Box>`);
  return out;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WIDGET → JSX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get the text content for a widget from its constructor args or setText call.
 */
function getWidgetText(widget) {
  if (widget._setText) return widget._setText;
  const firstArg = widget.args?.positional?.[0];
  if (firstArg) {
    // Check if it's a parent reference (another widget or self)
    if (firstArg === 'self' || firstArg.startsWith('self.')) return null;
    return stripPythonString(firstArg);
  }
  return null;
}


/**
 * Generate JSX for a single widget.
 */
function generateWidgetJSX(widget, mapping, parsed, depth, components, warnings, signalMap) {
  const out = [];
  const style = buildWidgetStyle(widget, mapping);
  const signals = signalMap[widget.name] || [];

  // Build event props from signals
  const events = [];
  for (const sig of signals) {
    const rjitEvent = SIGNAL_MAP[sig.signal];
    if (rjitEvent) {
      const handler = sig.isLambda ? sig.slot : sig.slot;
      events.push(`${rjitEvent}={${handler}}`);
    } else {
      warnings.push(`Unknown signal "${sig.signal}" on "${widget.name}"`);
    }
  }
  const evStr = events.length ? ' ' + events.join(' ') : '';

  components.add(mapping.component);

  switch (mapping.type) {
    case 'text': {
      components.add('Text');
      const text = getWidgetText(widget) || '';
      const styleStr = formatStyleAttr(style);
      if (widget._tooltip) {
        out.push(`${indent(depth)}{/* tooltip: ${widget._tooltip} */}`);
      }
      out.push(`${indent(depth)}<Text${styleStr}${evStr}>${text}</Text>`);
      break;
    }

    case 'button': {
      components.add('Pressable');
      components.add('Text');
      const text = getWidgetText(widget) || 'Button';
      const styleStr = formatStyleAttr(style);
      if (widget._tooltip) {
        out.push(`${indent(depth)}{/* tooltip: ${widget._tooltip} */}`);
      }
      out.push(`${indent(depth)}<Pressable${styleStr}${evStr}>`);
      out.push(`${indent(depth + 1)}<Text${style.color ? ` style={{ color: '${style.color}' }}` : ''}>${text}</Text>`);
      out.push(`${indent(depth)}</Pressable>`);
      break;
    }

    case 'input': {
      components.add('TextInput');
      const styleStr = formatStyleAttr(style);
      const placeholder = widget._placeholder ? ` placeholder="${widget._placeholder}"` : '';
      const valueStr = ` value={${widget.name}Text} onTextInput={(e) => set${capitalize(widget.name)}Text(e.text)}`;
      if (widget._tooltip) {
        out.push(`${indent(depth)}{/* tooltip: ${widget._tooltip} */}`);
      }
      out.push(`${indent(depth)}<TextInput${styleStr}${valueStr}${placeholder}${evStr} />`);
      break;
    }

    case 'multiline': {
      components.add('TextInput');
      const styleStr = formatStyleAttr(style);
      const valueStr = ` value={${widget.name}Text} onTextInput={(e) => set${capitalize(widget.name)}Text(e.text)}`;
      out.push(`${indent(depth)}<TextInput${styleStr}${valueStr} multiline${evStr} />`);
      warnings.push(`QTextEdit "${widget.name}" -> TextInput multiline -- rich text features need manual conversion`);
      break;
    }

    case 'container': {
      const styleStr = formatStyleAttr(style);
      if (mapping.hasLabel) {
        const labelText = getWidgetText(widget);
        if (labelText) {
          out.push(`${indent(depth)}{/* ${labelText} */}`);
        }
      }
      out.push(`${indent(depth)}<Box${styleStr}${evStr}>`);
      out.push(`${indent(depth + 1)}{/* Container: ${widget.name} */}`);
      out.push(`${indent(depth)}</Box>`);
      break;
    }

    case 'scroll': {
      components.add('ScrollView');
      const styleStr = formatStyleAttr({ ...style, overflow: 'scroll' });
      out.push(`${indent(depth)}<ScrollView${styleStr}>`);
      out.push(`${indent(depth + 1)}{/* ScrollArea: ${widget.name} */}`);
      out.push(`${indent(depth)}</ScrollView>`);
      break;
    }

    case 'list': {
      components.add('ScrollView');
      components.add('Pressable');
      components.add('Text');
      const styleStr = formatStyleAttr({ ...style, overflow: 'scroll' });
      out.push(`${indent(depth)}<ScrollView${styleStr}>`);
      out.push(`${indent(depth + 1)}{${widget.name}Items.map((item, i) => (`);
      out.push(`${indent(depth + 2)}<Pressable key={i}${evStr || ' onClick={() => {}}'}>`);
      out.push(`${indent(depth + 3)}<Text>{item}</Text>`);
      out.push(`${indent(depth + 2)}</Pressable>`);
      out.push(`${indent(depth + 1)}))}`);
      out.push(`${indent(depth)}</ScrollView>`);
      break;
    }

    case 'table': {
      components.add('ScrollView');
      components.add('Text');
      const styleStr = formatStyleAttr({ ...style, overflow: 'scroll' });
      out.push(`${indent(depth)}<ScrollView${styleStr}>`);
      out.push(`${indent(depth + 1)}{/* TODO: Table "${widget.name}" -- populate with data */}`);
      out.push(`${indent(depth + 1)}{${widget.name}Items.map((row, i) => (`);
      out.push(`${indent(depth + 2)}<Box key={i} style={{ flexDirection: 'row', gap: 16, paddingBottom: 4 }}>`);
      out.push(`${indent(depth + 3)}<Text>{JSON.stringify(row)}</Text>`);
      out.push(`${indent(depth + 2)}</Box>`);
      out.push(`${indent(depth + 1)}))}`);
      out.push(`${indent(depth)}</ScrollView>`);
      break;
    }

    case 'tree': {
      components.add('ScrollView');
      components.add('Text');
      const styleStr = formatStyleAttr({ ...style, overflow: 'scroll' });
      out.push(`${indent(depth)}<ScrollView${styleStr}>`);
      out.push(`${indent(depth + 1)}{/* TODO: Tree "${widget.name}" -- implement tree rendering */}`);
      out.push(`${indent(depth + 1)}{${widget.name}Items.map((item, i) => (`);
      out.push(`${indent(depth + 2)}<Box key={i} style={{ paddingLeft: (item.depth || 0) * 16 }}>`);
      out.push(`${indent(depth + 3)}<Text>{item.label || item}</Text>`);
      out.push(`${indent(depth + 2)}</Box>`);
      out.push(`${indent(depth + 1)}))}`);
      out.push(`${indent(depth)}</ScrollView>`);
      break;
    }

    case 'checkbox': {
      components.add('Pressable');
      components.add('Text');
      const text = getWidgetText(widget) || '';
      const styleStr = formatStyleAttr(style);
      const stateVar = `${widget.name}Checked`;
      out.push(`${indent(depth)}<Pressable${styleStr} onClick={() => set${capitalize(stateVar)}(prev => !prev)}>`);
      out.push(`${indent(depth + 1)}<Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>`);
      out.push(`${indent(depth + 2)}<Box style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#666', borderRadius: 3, backgroundColor: ${stateVar} ? '#3b82f6' : 'transparent' }} />`);
      out.push(`${indent(depth + 2)}<Text>${text}</Text>`);
      out.push(`${indent(depth + 1)}</Box>`);
      out.push(`${indent(depth)}</Pressable>`);
      break;
    }

    case 'radio': {
      components.add('Pressable');
      components.add('Text');
      const text = getWidgetText(widget) || '';
      const styleStr = formatStyleAttr(style);
      out.push(`${indent(depth)}<Pressable${styleStr}${evStr || ` onClick={() => {}}`}>`);
      out.push(`${indent(depth + 1)}<Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>`);
      out.push(`${indent(depth + 2)}<Box style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#666', borderRadius: 9 }} />`);
      out.push(`${indent(depth + 2)}<Text>${text}</Text>`);
      out.push(`${indent(depth + 1)}</Box>`);
      out.push(`${indent(depth)}</Pressable>`);
      break;
    }

    case 'slider': {
      const stateVar = `${widget.name}Value`;
      const orient = widget.args?.kwargs?.orientation;
      const isHoriz = !orient || orient.includes('Horizontal');
      const styleStr = formatStyleAttr({ ...style, flexDirection: isHoriz ? 'row' : 'column', alignItems: 'center', gap: 8 });
      out.push(`${indent(depth)}<Box${styleStr}>`);
      out.push(`${indent(depth + 1)}<Text>{${stateVar}}</Text>`);
      components.add('Text');
      out.push(`${indent(depth + 1)}{/* TODO: implement slider interaction */}`);
      out.push(`${indent(depth + 1)}<Box style={{ ${isHoriz ? 'width: 200, height: 4' : 'width: 4, height: 200'}, backgroundColor: '#444', borderRadius: 2 }}>`);
      out.push(`${indent(depth + 2)}<Box style={{ ${isHoriz ? `width: \`\${${stateVar}}%\`` : `height: \`\${${stateVar}}%\``}, ${isHoriz ? 'height' : 'width'}: '100%', backgroundColor: '#3b82f6', borderRadius: 2 }} />`);
      out.push(`${indent(depth + 1)}</Box>`);
      out.push(`${indent(depth)}</Box>`);
      break;
    }

    case 'progressbar': {
      const stateVar = `${widget.name}Progress`;
      const styleStr = formatStyleAttr({ ...style, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' });
      out.push(`${indent(depth)}<Box${styleStr}>`);
      out.push(`${indent(depth + 1)}<Box style={{ width: \`\${${stateVar}}%\`, height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 }} />`);
      out.push(`${indent(depth)}</Box>`);
      break;
    }

    case 'notebook': {
      components.add('Pressable');
      components.add('Text');
      out.push(`${indent(depth)}{/* TabWidget "${widget.name}" */}`);
      const styleStr = formatStyleAttr(style);
      out.push(`${indent(depth)}<Box${styleStr}>`);
      out.push(`${indent(depth + 1)}<Box style={{ flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderColor: '#444' }}>`);
      out.push(`${indent(depth + 2)}{/* TODO: populate tab labels */}`);
      out.push(`${indent(depth + 2)}{['Tab 1', 'Tab 2'].map((label, i) => (`);
      out.push(`${indent(depth + 3)}<Pressable key={i} onClick={() => setActiveTab(i)} style={{ padding: 8, backgroundColor: activeTab === i ? '#333' : 'transparent' }}>`);
      out.push(`${indent(depth + 4)}<Text style={{ color: activeTab === i ? '#fff' : '#888' }}>{label}</Text>`);
      out.push(`${indent(depth + 3)}</Pressable>`);
      out.push(`${indent(depth + 2)}))}`);
      out.push(`${indent(depth + 1)}</Box>`);
      out.push(`${indent(depth + 1)}{/* Tab content renders here based on activeTab */}`);
      out.push(`${indent(depth)}</Box>`);
      warnings.push(`QTabWidget "${widget.name}" -> manual tab state management needed`);
      break;
    }

    case 'toolbar': {
      components.add('Pressable');
      components.add('Text');
      const actions = widget._actions || [];
      out.push(`${indent(depth)}<Box style={{ flexDirection: 'row', backgroundColor: '#2a2a2a', padding: 4, gap: 4 }}>`);
      for (const actionName of actions) {
        if (actionName === '__separator__') {
          out.push(`${indent(depth + 1)}<Box style={{ width: 1, height: 20, backgroundColor: '#555' }} />`);
        } else {
          const action = parsed.widgets.find(w => w.name === actionName);
          const actionText = action ? (action._actionText || actionName) : actionName;
          const actionSignals = signalMap[actionName] || [];
          const actionHandler = actionSignals.length > 0 ? actionSignals[0].slot : '() => {}';
          out.push(`${indent(depth + 1)}<Pressable onClick={${actionHandler}} style={{ padding: 4, paddingLeft: 8, paddingRight: 8, borderRadius: 3 }}>`);
          out.push(`${indent(depth + 2)}<Text style={{ color: '#ccc', fontSize: 13 }}>${actionText}</Text>`);
          out.push(`${indent(depth + 1)}</Pressable>`);
        }
      }
      if (actions.length === 0) {
        out.push(`${indent(depth + 1)}{/* TODO: add toolbar actions */}`);
      }
      out.push(`${indent(depth)}</Box>`);
      break;
    }

    case 'statusbar': {
      components.add('Text');
      out.push(`${indent(depth)}<Box style={{ padding: 4, backgroundColor: '#2a2a2a', borderTopWidth: 1, borderColor: '#444' }}>`);
      out.push(`${indent(depth + 1)}<Text style={{ fontSize: 12, color: '#888' }}>Ready</Text>`);
      out.push(`${indent(depth)}</Box>`);
      break;
    }

    case 'modal': {
      components.add('Modal');
      components.add('Text');
      const title = getWidgetText(widget) || widget.name;
      out.push(`${indent(depth)}{${widget.name}Visible && (`);
      out.push(`${indent(depth + 1)}<Modal visible={${widget.name}Visible} onClose={() => set${capitalize(widget.name)}Visible(false)}>`);
      out.push(`${indent(depth + 2)}<Text style={{ fontSize: 18, fontWeight: 'bold' }}>${title}</Text>`);
      out.push(`${indent(depth + 1)}</Modal>`);
      out.push(`${indent(depth)})}`);
      break;
    }

    case 'dropdown': {
      components.add('Pressable');
      components.add('Text');
      const styleStr = formatStyleAttr({ ...style, borderWidth: 1, borderColor: '#555', borderRadius: 4, padding: 8 });
      out.push(`${indent(depth)}<Pressable${styleStr} onClick={() => set${capitalize(widget.name)}Open(prev => !prev)}>`);
      out.push(`${indent(depth + 1)}<Text>{${widget.name}Value || 'Select...'}</Text>`);
      out.push(`${indent(depth)}</Pressable>`);
      out.push(`${indent(depth)}{/* TODO: dropdown menu for "${widget.name}" -- render options list when open */}`);
      break;
    }

    case 'menu': {
      // Menus are handled by generateMenuBar, skip individual rendering
      break;
    }

    case 'action': {
      // Actions are rendered inline in menus/toolbars
      break;
    }

    default: {
      const styleStr = formatStyleAttr(style);
      out.push(`${indent(depth)}<Box${styleStr}>`);
      out.push(`${indent(depth + 1)}{/* ${widget.widgetType} "${widget.name}" */}`);
      out.push(`${indent(depth)}</Box>`);
    }
  }

  return out;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MENU BAR GENERATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate JSX for the window menu bar.
 */
function generateMenuBar(parsed, depth, components, warnings) {
  const out = [];
  components.add('Pressable');
  components.add('Text');

  // Find all QMenu widgets that are children of the menubar
  const menus = parsed.widgets.filter(w =>
    w.widgetType === 'QMenu' && (w.parent === parsed.windowConfig._menuBar || w.parent === 'menubar')
  );

  if (menus.length === 0) {
    // No structured menus found, just render a placeholder
    out.push(`${indent(depth)}<Box style={{ flexDirection: 'row', backgroundColor: '#2a2a2a', padding: 4, gap: 2 }}>`);
    out.push(`${indent(depth + 1)}{/* Menu bar -- populate with menu items */}`);
    out.push(`${indent(depth)}</Box>`);
    return out;
  }

  out.push(`${indent(depth)}<Box style={{ flexDirection: 'row', backgroundColor: '#2a2a2a', padding: 4, gap: 2 }}>`);

  for (const menu of menus) {
    const menuTitle = menu._menuTitle || 'Menu';
    out.push(`${indent(depth + 1)}<Pressable style={{ padding: 4, paddingLeft: 12, paddingRight: 12, borderRadius: 3 }}>`);
    out.push(`${indent(depth + 2)}<Text style={{ color: '#ccc', fontSize: 13 }}>${menuTitle}</Text>`);
    out.push(`${indent(depth + 1)}</Pressable>`);
    // Note: dropdown menus need manual implementation
  }

  out.push(`${indent(depth)}</Box>`);

  if (menus.length > 0) {
    warnings.push('Menu bar detected -- dropdown menu rendering needs manual implementation');
  }

  return out;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PYTHON LINE CONVERTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Best-effort conversion of a Python expression to JavaScript.
 * Used for lambda bodies in signal connections.
 */
function convertPythonExpr(expr) {
  let line = expr.trim();
  // self.method() → method()
  line = line.replace(/\bself\./g, '');
  // True/False/None
  line = line.replace(/\bTrue\b/g, 'true');
  line = line.replace(/\bFalse\b/g, 'false');
  line = line.replace(/\bNone\b/g, 'null');
  return line;
}


/**
 * Best-effort conversion of a single Python line to JavaScript.
 * NOT a full transpiler -- handles the most common patterns.
 */
function convertPythonLine(pyLine, stateVars) {
  let line = pyLine.trim();

  // Skip pass, comments
  if (line === 'pass') return '// pass';
  if (line.startsWith('#')) return '/' + line;

  // self.widget.setText("...") → setWidgetText("...")
  const setTextMatch = line.match(/^self\.(\w+)\.setText\s*\(\s*(.+)\s*\)/);
  if (setTextMatch) {
    return `set${capitalize(setTextMatch[1])}Text(${convertPythonExpr(setTextMatch[2])});`;
  }

  // self.widget.setEnabled(...) / setVisible(...) → TODO comment
  if (/self\.\w+\.set(?:Enabled|Visible|Disabled)/.test(line)) {
    return `// TODO: ${convertPythonExpr(line)}`;
  }

  // self.widget.config/configure → TODO comment
  if (/self\.\w+\.(?:config|configure|setStyleSheet)\s*\(/.test(line)) {
    return `// TODO: ${convertPythonExpr(line)}`;
  }

  // self.x = value → setX(value) if x is a known state var
  const selfAssignMatch = line.match(/^self\.(\w+)\s*=\s*(.+)$/);
  if (selfAssignMatch) {
    const varName = selfAssignMatch[1];
    const value = convertPythonExpr(selfAssignMatch[2]);
    // Check if it looks like a state variable
    if (stateVars.has(varName) || stateVars.has(varName + 'Text') || stateVars.has(varName + 'Value')) {
      return `set${capitalize(varName)}(${value});`;
    }
    return `// self.${varName} = ${value};`;
  }

  // Remove self. prefix
  line = line.replace(/\bself\./g, '');

  // if/elif/else
  line = line.replace(/^if\s+(.+):$/, 'if ($1) {');
  line = line.replace(/^elif\s+(.+):$/, '} else if ($1) {');
  line = line.replace(/^else\s*:$/, '} else {');

  // for loop
  line = line.replace(/^for\s+(\w+)\s+in\s+range\((.+)\):$/, 'for (let $1 = 0; $1 < $2; $1++) {');
  line = line.replace(/^for\s+(\w+)\s+in\s+(.+):$/, 'for (const $1 of $2) {');

  // while
  line = line.replace(/^while\s+(.+):$/, 'while ($1) {');

  // return
  line = line.replace(/^return\s+(.+)$/, 'return $1;');

  // print → console.log
  line = line.replace(/\bprint\s*\(/, 'console.log(');

  // len() → .length
  line = line.replace(/\blen\((\w+)\)/g, '$1.length');

  // str() → String()
  line = line.replace(/\bstr\((.+?)\)/g, 'String($1)');

  // int() → parseInt()
  line = line.replace(/\bint\((.+?)\)/g, 'parseInt($1)');

  // float() → parseFloat()
  line = line.replace(/\bfloat\((.+?)\)/g, 'parseFloat($1)');

  // True/False/None → true/false/null
  line = line.replace(/\bTrue\b/g, 'true');
  line = line.replace(/\bFalse\b/g, 'false');
  line = line.replace(/\bNone\b/g, 'null');

  // and/or/not → &&/||/!
  line = line.replace(/(?<=\s|[^a-zA-Z0-9_])and(?=\s)/g, '&&');
  line = line.replace(/(?<=\s|[^a-zA-Z0-9_])or(?=\s)/g, '||');
  line = line.replace(/(?<=^|\s|[^a-zA-Z0-9_])not(?=\s)/g, '!');

  // f-strings: f"Hello {name}" → `Hello ${name}`
  line = line.replace(/f['"](.+?)['"]/g, (match, inner) => {
    return '`' + inner.replace(/\{/g, '${') + '`';
  });

  // .append() → .push()
  line = line.replace(/\.append\(/g, '.push(');

  // .items() → Object.entries()
  line = line.replace(/(\w+)\.items\(\)/g, 'Object.entries($1)');

  // .keys() → Object.keys()
  line = line.replace(/(\w+)\.keys\(\)/g, 'Object.keys($1)');

  // .values() → Object.values()
  line = line.replace(/(\w+)\.values\(\)/g, 'Object.values($1)');

  // Assignment with type hint → let
  line = line.replace(/^(\w+)\s*:\s*\w+\s*=\s*(.+)$/, 'let $1 = $2;');

  // Simple assignment → let
  if (/^\w+\s*=\s*.+$/.test(line) && !line.includes('==') && !line.startsWith('let ') && !line.startsWith('const ')) {
    line = 'let ' + line + ';';
  }

  // Add semicolon if missing
  if (line && !line.endsWith('{') && !line.endsWith('}') && !line.endsWith(';') && !line.startsWith('//') && !line.startsWith('/*')) {
    line += ';';
  }

  return line;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function migratePyQt6Command(args) {
  const helpMode = args.includes('--help') || args.includes('-h');
  const dryRun = args.includes('--dry-run');
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const scaffoldIdx = args.indexOf('--scaffold');
  const scaffoldName = (scaffoldIdx !== -1 && args[scaffoldIdx + 1] && !args[scaffoldIdx + 1].startsWith('-'))
    ? args[scaffoldIdx + 1] : null;
  const scaffoldMode = scaffoldIdx !== -1;

  if (scaffoldMode && outputFile) {
    console.error('  Cannot use --scaffold and --output together.');
    process.exit(1);
  }

  if (helpMode) {
    console.log(`
  rjit migrate-pyqt6 -- Convert PyQt6/PySide6 apps to ReactJIT

  Usage:
    rjit migrate-pyqt6 <app.py>                          Convert and print to stdout
    rjit migrate-pyqt6 <app.py> --output out.tsx          Write to file
    rjit migrate-pyqt6 <app.py> --scaffold [name]         Convert + create a new project
    rjit migrate-pyqt6 <app.py> --dry-run                 Show analysis only

  What it converts:
    Widgets:    QLabel->Text, QPushButton->Pressable, QLineEdit->TextInput, QFrame->Box,
                QListWidget->ScrollView, QCheckBox/QRadioButton->Pressable,
                QSlider->slider Box, QDialog->Modal, QMenuBar->menu bar Box
    Layout:     QVBoxLayout->column, QHBoxLayout->row, QGridLayout->nested rows,
                QFormLayout->form rows, addStretch->flexGrow
    State:      self.var->useState, pyqtSignal->event handlers
    Signals:    signal.connect(slot)->onClick/onTextInput/etc.
    Styling:    setStyleSheet->style objects, QFont->fontSize/fontFamily
    Functions:  Python->JavaScript (best-effort, needs review)
`);
    return;
  }

  const skipArgs = new Set();
  if (outputFile) skipArgs.add(outputFile);
  if (scaffoldName) skipArgs.add(scaffoldName);
  const fileArg = args.find(a => !a.startsWith('-') && !skipArgs.has(a));
  if (!fileArg) {
    console.error('No input file specified. Use --help for usage.');
    process.exit(1);
  }

  let input;
  try {
    input = readFileSync(fileArg, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${fileArg}`);
    process.exit(1);
  }

  // Parse
  const parsed = parsePyQt6Source(input);

  if (dryRun) {
    console.log(`\n  Analysis of ${fileArg}:\n`);
    console.log(`  Window:      ${parsed.windowConfig.title || 'untitled'} (${parsed.windowConfig.width || '?'}x${parsed.windowConfig.height || '?'})`);
    console.log(`  Classes:     ${parsed.classes.length}`);
    console.log(`  Widgets:     ${parsed.widgets.length}`);
    console.log(`  Layouts:     ${parsed.layouts.length}`);
    console.log(`  Signals:     ${parsed.signals.length}`);
    console.log(`  Functions:   ${parsed.functions.length}`);
    if (parsed.classes.length > 0) {
      console.log(`\n  Classes:`);
      for (const c of parsed.classes) {
        console.log(`    ${c.name}(${c.parent}) — ${c.methods.length} methods`);
      }
    }
    console.log(`\n  Widgets:`);
    for (const w of parsed.widgets) {
      const mapping = WIDGET_MAP[w.widgetType];
      console.log(`    ${w.name}: ${w.widgetType} -> ${mapping?.component || '???'}`);
    }
    if (parsed.layouts.length > 0) {
      console.log(`\n  Layouts:`);
      for (const l of parsed.layouts) {
        console.log(`    ${l.name}: ${l.layoutType} (${l.children.length} children${l.owner ? `, owner: ${l.owner}` : ''})`);
      }
    }
    if (parsed.signals.length > 0) {
      console.log(`\n  Signal connections:`);
      for (const s of parsed.signals) {
        const rjitEvent = SIGNAL_MAP[s.signal] || '???';
        console.log(`    ${s.widget}.${s.signal} -> ${s.slot} (${rjitEvent})`);
      }
    }
    if (parsed.warnings.length > 0) {
      console.log(`\n  Warnings:`);
      for (const w of parsed.warnings) {
        console.log(`    ${w}`);
      }
    }
    console.log('');
    return;
  }

  // Generate
  const result = generateReactJIT(parsed);

  // Output
  if (scaffoldMode) {
    const projectName = scaffoldName || deriveProjectName(fileArg);
    const dest = join(process.cwd(), projectName);
    scaffoldProject(dest, { name: projectName, appTsx: result.code });
    console.log(`  Converted ${fileArg} -> ${projectName}/src/App.tsx`);
    console.log(`  ${result.stats.widgets} widgets, ${result.stats.signals} signals, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings) {
        console.log(`    ${w}`);
      }
    }
    console.log(`\n  Next steps:`);
    console.log(`    cd ${projectName}`);
    console.log(`    reactjit dev`);
  } else if (outputFile) {
    writeFileSync(outputFile, result.code, 'utf-8');
    console.log(`  Converted ${fileArg} -> ${outputFile}`);
    console.log(`  ${result.stats.widgets} widgets, ${result.stats.signals} signals, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings) {
        console.log(`    ${w}`);
      }
    }
  } else {
    process.stdout.write(result.code);
    if (process.stderr.isTTY) {
      console.error(`\n--- ${result.stats.widgets} widgets | ${result.components.join(', ')} | ${result.warnings.length} warning(s) ---`);
    }
  }
}
