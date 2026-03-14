import React, { useState } from 'react';
import { Box, Text, Pressable, TextInput, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── SleepySyntax Parser ─────────────────────────────────────────────
// Tokenizer + recursive descent parser for .sleepy notation.
// Grammar:
//   root      = '{' identifier ':' content '}'
//   content   = group | list | literal | apiRef
//   group     = '(' pair (',' pair)* ')'
//   list      = '[' content (',' content)* ']'
//   pair      = identifier (':' content)?
//   literal   = '"' chars '"' | identifier
//   apiRef    = 'api.' dotted.path

type TokenType = 'lbrace' | 'rbrace' | 'lparen' | 'rparen' | 'lbracket' | 'rbracket'
  | 'colon' | 'comma' | 'string' | 'ident' | 'api' | 'eof';

interface Token { type: TokenType; value: string; pos: number }

interface SleepyNode {
  type: 'element' | 'text' | 'api' | 'group';
  name: string;
  variant?: string;
  children: SleepyNode[];
  value?: string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if ('{})([]:,'.includes(ch)) {
      const map: Record<string, TokenType> = {
        '{': 'lbrace', '}': 'rbrace', '(': 'lparen', ')': 'rparen',
        '[': 'lbracket', ']': 'rbracket', ':': 'colon', ',': 'comma'
      };
      tokens.push({ type: map[ch], value: ch, pos: i });
      i++; continue;
    }
    if (ch === '"' || ch === "'") {
      const q = ch;
      let s = '';
      i++;
      while (i < src.length && src[i] !== q) { s += src[i]; i++; }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: s, pos: i });
      continue;
    }
    // identifier or api ref
    let word = '';
    const start = i;
    while (i < src.length && /[a-zA-Z0-9_.$\-]/.test(src[i])) { word += src[i]; i++; }
    if (word.length > 0) {
      if (word.startsWith('api.')) {
        tokens.push({ type: 'api', value: word, pos: start });
      } else {
        tokens.push({ type: 'ident', value: word, pos: start });
      }
      continue;
    }
    i++; // skip unknown
  }
  tokens.push({ type: 'eof', value: '', pos: i });
  return tokens;
}

function parse(src: string): SleepyNode | null {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos] || { type: 'eof' as TokenType, value: '', pos: 0 };
  const eat = (t?: TokenType) => {
    const tok = tokens[pos];
    if (t && tok.type !== t) return null;
    pos++;
    return tok;
  };

  function parseRoot(): SleepyNode | null {
    if (peek().type === 'lbrace') {
      eat('lbrace');
      const node = parsePair();
      eat('rbrace');
      return node;
    }
    // Allow bare content without braces
    return parsePair();
  }

  function parsePair(): SleepyNode | null {
    if (peek().type === 'string') {
      const t = eat('string')!;
      return { type: 'text', name: 'text', children: [], value: t.value };
    }
    if (peek().type === 'api') {
      const t = eat('api')!;
      return { type: 'api', name: 'api', children: [], value: t.value };
    }
    if (peek().type === 'ident') {
      const t = eat('ident')!;
      let name = t.value;
      let variant: string | undefined;
      // Handle $variant in the name itself
      if (name.includes('$')) {
        const parts = name.split('$');
        name = parts[0];
        variant = parts[1];
      }
      if (peek().type === 'colon') {
        eat('colon');
        const child = parseContent();
        if (child) {
          // Handle name:api.ref:template pattern (forEach:api.items:[...])
          if (child.type === 'api' && peek().type === 'colon') {
            eat('colon');
            const template = parseContent();
            const children = [child];
            if (template) children.push(...(template.type === 'group' ? template.children : [template]));
            const node: SleepyNode = { type: 'element', name, children, variant };
            return node;
          }
          const node: SleepyNode = { type: 'element', name, children: child.type === 'group' ? child.children : [child] };
          if (variant) node.variant = variant;
          return node;
        }
        return { type: 'element', name, children: [], variant };
      }
      return { type: 'element', name, children: [], variant };
    }
    return parseContent();
  }

  function parseContent(): SleepyNode | null {
    const t = peek();
    if (t.type === 'lparen') return parseGroup();
    if (t.type === 'lbracket') return parseList();
    if (t.type === 'string') {
      const s = eat('string')!;
      return { type: 'text', name: 'text', children: [], value: s.value };
    }
    if (t.type === 'api') {
      const s = eat('api')!;
      return { type: 'api', name: 'api', children: [], value: s.value };
    }
    if (t.type === 'ident') return parsePair();
    return null;
  }

  function parseGroup(): SleepyNode {
    eat('lparen');
    const children: SleepyNode[] = [];
    while (peek().type !== 'rparen' && peek().type !== 'eof') {
      const before = pos;
      const child = parsePair();
      if (child) children.push(child);
      if (peek().type === 'comma') eat('comma');
      if (pos === before) pos++; // safety: skip unparseable token to prevent infinite loop
    }
    eat('rparen');
    return { type: 'group', name: 'group', children };
  }

  function parseList(): SleepyNode {
    eat('lbracket');
    const children: SleepyNode[] = [];
    while (peek().type !== 'rbracket' && peek().type !== 'eof') {
      const before = pos;
      const child = parsePair();
      if (child) children.push(child);
      if (peek().type === 'comma') eat('comma');
      if (pos === before) pos++; // safety: skip unparseable token to prevent infinite loop
    }
    eat('rbracket');
    return { type: 'group', name: 'list', children };
  }

  return parseRoot();
}

// ── SleepyNode → ReactJIT Renderer ─────────────────────────────────
// Primitives: box, text, pressable, input, image, scroll
// Variants via $: box$card, box$row, text$h1, pressable$primary, image$avatar, etc.

// Box variants
const BOX_VARIANTS: Record<string, Record<string, unknown>> = {
  card: { borderRadius: 10, borderWidth: 1 },
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  nav: { flexDirection: 'row', alignItems: 'center' },
  modal: { borderRadius: 12, borderWidth: 1, padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  center: { justifyContent: 'center', alignItems: 'center' },
};

// Text variants
const TEXT_VARIANTS: Record<string, Record<string, unknown>> = {
  h1: { fontSize: 28, fontWeight: 'bold' },
  h2: { fontSize: 24, fontWeight: 'bold' },
  h3: { fontSize: 20, fontWeight: 'bold' },
  h4: { fontSize: 18, fontWeight: 'bold' },
  h5: { fontSize: 16, fontWeight: 'bold' },
  h6: { fontSize: 14, fontWeight: 'bold' },
  muted: { opacity: 0.6 },
  mono: { fontFamily: 'monospace' },
  small: { fontSize: 11 },
  lg: { fontSize: 18 },
  xl: { fontSize: 24 },
};

// Pressable variants
const PRESSABLE_VARIANTS: Record<string, { bg: string; fg: string }> = {
  primary: { bg: '#3B82F6', fg: '#FFFFFF' },
  secondary: { bg: '#6B7280', fg: '#FFFFFF' },
  ghost: { bg: 'transparent', fg: '#3B82F6' },
  danger: { bg: '#EF4444', fg: '#FFFFFF' },
  success: { bg: '#10B981', fg: '#FFFFFF' },
  warning: { bg: '#F59E0B', fg: '#1F2937' },
};

// Image variants
const IMAGE_VARIANTS: Record<string, Record<string, unknown>> = {
  avatar: { width: 48, height: 48, borderRadius: 24 },
  thumb: { width: 64, height: 64, borderRadius: 6 },
  cover: { width: '100%', height: 160, borderRadius: 8 },
};

function getTextChild(node: SleepyNode): string {
  if (node.children.length > 0 && node.children[0].type === 'text') return node.children[0].value || '';
  if (node.children.length > 0 && node.children[0].type === 'api') return node.children[0].value || '';
  return '';
}

function SleepyRenderer({ node, depth = 0 }: { node: SleepyNode; depth?: number }) {
  const c = useThemeColors();

  // Literal string
  if (node.type === 'text') {
    return <Text style={{ color: c.text, fontSize: 14 }}>{node.value || ''}</Text>;
  }

  // Data binding placeholder
  if (node.type === 'api') {
    return (
      <Box style={{ backgroundColor: '#DBEAFE', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ color: '#1D4ED8', fontSize: 12, fontFamily: 'monospace' }}>{node.value || 'api.?'}</Text>
      </Box>
    );
  }

  const n = node.name.toLowerCase();
  const v = node.variant;

  // ── box ──────────────────────────────────────────────────────────
  if (n === 'box') {
    const variantStyle = v ? BOX_VARIANTS[v] || {} : {};
    const isCard = v === 'card' || v === 'modal';
    return (
      <Box style={{
        gap: 8,
        padding: isCard ? 12 : 4,
        flexDirection: 'column' as const,
        ...(isCard ? { backgroundColor: c.bgElevated, borderColor: c.border } : {}),
        ...(v === 'nav' ? { backgroundColor: c.surface, paddingLeft: 16, paddingRight: 16 } : {}),
        ...variantStyle,
      }}>
        {node.children.map((child, i) => (
          <SleepyRenderer key={i} node={child} depth={depth + 1} />
        ))}
      </Box>
    );
  }

  // ── text ─────────────────────────────────────────────────────────
  if (n === 'text') {
    const variantStyle = v ? TEXT_VARIANTS[v] || {} : {};
    const content = getTextChild(node) || 'Text';
    return (
      <Text style={{ color: c.text, fontSize: 14, ...variantStyle }}>
        {content}
      </Text>
    );
  }

  // ── pressable ────────────────────────────────────────────────────
  if (n === 'pressable') {
    const pv = v ? PRESSABLE_VARIANTS[v] : undefined;
    const bg = pv?.bg || c.primary;
    const fg = pv?.fg || '#FFFFFF';
    const label = getTextChild(node) || 'Press';
    return (
      <Pressable
        style={({ hovered }: { hovered: boolean }) => ({
          backgroundColor: bg,
          paddingLeft: 16, paddingRight: 16,
          paddingTop: 8, paddingBottom: 8,
          borderRadius: 6,
          opacity: hovered ? 0.85 : 1,
        })}
      >
        <Text style={{ color: fg, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      </Pressable>
    );
  }

  // ── input ────────────────────────────────────────────────────────
  if (n === 'input') {
    const placeholder = getTextChild(node) || 'Input...';
    const isMultiline = v === 'multiline';
    return (
      <Box style={{
        borderWidth: 1, borderColor: c.border, borderRadius: 6,
        paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
        height: isMultiline ? 80 : undefined,
      }}>
        <Text style={{ color: c.muted, fontSize: 14 }}>{placeholder}</Text>
      </Box>
    );
  }

  // ── image ────────────────────────────────────────────────────────
  if (n === 'image') {
    const iv = v ? IMAGE_VARIANTS[v] || {} : {};
    const defaultSize = { width: 120, height: 80, borderRadius: 8 };
    return (
      <Box style={{
        backgroundColor: '#E5E7EB',
        justifyContent: 'center', alignItems: 'center',
        ...defaultSize, ...iv,
      }}>
        <Text style={{ color: '#9CA3AF', fontSize: 10 }}>IMG</Text>
      </Box>
    );
  }

  // ── scroll ───────────────────────────────────────────────────────
  if (n === 'scroll') {
    return (
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 8 }}>
          {node.children.map((child, i) => (
            <SleepyRenderer key={i} node={child} depth={depth + 1} />
          ))}
        </Box>
      </ScrollView>
    );
  }

  // ── forEach ──────────────────────────────────────────────────────
  if (n === 'foreach') {
    return (
      <Box style={{ gap: 4 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Box style={{ backgroundColor: '#8B5CF6', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
            <Text style={{ color: '#FFF', fontSize: 10 }}>forEach</Text>
          </Box>
          {node.children[0]?.type === 'api' && (
            <Text style={{ color: '#8B5CF6', fontSize: 11, fontFamily: 'monospace' }}>{node.children[0].value}</Text>
          )}
        </Box>
        {node.children.slice(node.children[0]?.type === 'api' ? 1 : 0).map((child, i) => (
          <SleepyRenderer key={i} node={child} depth={depth + 1} />
        ))}
      </Box>
    );
  }

  // ── group/list (structural, from parser) ─────────────────────────
  if (node.type === 'group' || node.name === 'list') {
    return (
      <Box style={{ gap: 8, flexDirection: 'column' }}>
        {node.children.map((child, i) => (
          <SleepyRenderer key={i} node={child} depth={depth + 1} />
        ))}
      </Box>
    );
  }

  // ── unknown element with children ────────────────────────────────
  if (node.children.length > 0) {
    return (
      <Box style={{ gap: 6, padding: 4 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1 }}>
            <Text style={{ color: c.muted, fontSize: 10, fontFamily: 'monospace' }}>{`<${node.name}${v ? `$${v}` : ''}>`}</Text>
          </Box>
        </Box>
        {node.children.map((child, i) => (
          <SleepyRenderer key={i} node={child} depth={depth + 1} />
        ))}
      </Box>
    );
  }

  // ── unknown leaf ─────────────────────────────────────────────────
  return (
    <Box style={{ backgroundColor: c.surface, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
      <Text style={{ color: c.text, fontSize: 13 }}>{node.name}{v ? `$${v}` : ''}</Text>
    </Box>
  );
}

// ── Error Display ───────────────────────────────────────────────────

function ParseError({ message }: { message: string }) {
  return (
    <Box style={{ padding: 20, justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
      <Text style={{ color: '#EF4444', fontSize: 14, fontFamily: 'monospace' }}>{message}</Text>
    </Box>
  );
}

// ── Example snippets ────────────────────────────────────────────────

const EXAMPLES: { label: string; code: string }[] = [
  {
    label: 'Profile',
    code: `{box$card:(
  image$avatar:api.user.avatar,
  text$h3:"Jane Doe",
  text:"Software Engineer",
  pressable$primary:"Follow"
)}`,
  },
  {
    label: 'Nav + Content',
    code: `{box:(
  box$nav:[text$h3:"MyApp", pressable$ghost:"Home", pressable$ghost:"About", pressable$ghost:"Contact"],
  box$card:(
    text$h2:"Welcome",
    text:"Put the thing inside the other thing.",
    box$row:[pressable$primary:"Get Started", pressable$secondary:"Learn More"]
  )
)}`,
  },
  {
    label: 'Login',
    code: `{box$card:(
  text$h2:"Sign In",
  input:"Email",
  input:"Password",
  pressable$primary:"Log In",
  text$muted:"Forgot password?"
)}`,
  },
  {
    label: 'Dashboard',
    code: `{box:(
  box$nav:[text$h3:"Dashboard", pressable$ghost:"Settings"],
  box$row:[
    box$card:(text$h5:"Users", text$h2:"1,234", text$muted:"12% increase"),
    box$card:(text$h5:"Revenue", text$h2:"$45.6K", text$muted:"8% increase"),
    box$card:(text$h5:"Orders", text$h2:"567", text$muted:"3% decrease")
  ],
  box$card:(
    text$h3:"Recent Activity",
    forEach:api.activities:[
      box$row:[text:api.activity.title, text$muted:api.activity.time]
    ]
  )
)}`,
  },
  {
    label: 'Chat',
    code: `{box:(
  box$nav:[text$h3:"Messages", pressable$ghost:"New"],
  box$card:(
    forEach:api.messages:[
      box$row:[image$avatar:api.msg.avatar, box:(text:api.msg.sender, text$muted:api.msg.text)]
    ]
  ),
  box$row:[input:"Type a message...", pressable$primary:"Send"]
)}`,
  },
];

// ── Main Story ──────────────────────────────────────────────────────

export function SleepySyntaxStory() {
  const c = useThemeColors();
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [inputKey, setInputKey] = useState(0);

  // Guard against controlled TextInput feedback loop — only update if truly different
  const handleChange = (text: string) => {
    if (text !== code) setCode(text);
  };

  const loadExample = (ex: typeof EXAMPLES[number]) => {
    setCode(ex.code);
    setInputKey((k) => k + 1); // force TextInput remount with new defaultValue
  };

  // Derive AST from code during render
  let ast: SleepyNode | null = null;
  let parseError: string | null = null;
  try {
    ast = parse(code);
    if (!ast) parseError = 'Could not parse input';
  } catch (e: unknown) {
    parseError = e instanceof Error ? e.message : 'Parse error';
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: c.border,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: 'bold' }}>SleepySyntax</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>visual builder</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          {EXAMPLES.map((ex) => (
            <Pressable
              key={ex.label}
              onPress={() => loadExample(ex)}
              style={({ hovered }: { hovered: boolean }) => ({
                backgroundColor: hovered ? c.surface : c.bgElevated,
                paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 5,
                borderWidth: 1, borderColor: c.border,
              })}
            >
              <Text style={{ color: c.text, fontSize: 12 }}>{ex.label}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>

      {/* Split Pane */}
      <Box style={{ flexDirection: 'row', flexGrow: 1 }}>
        {/* Left: Code Editor */}
        <Box style={{ width: '50%', borderRightWidth: 1, borderColor: c.border, flexDirection: 'column' }}>
          <Box style={{
            paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.surface,
          }}>
            <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'monospace' }}>editor.sleepy</Text>
          </Box>
          <Box style={{ flexGrow: 1 }}>
            <TextInput
              key={inputKey}
              defaultValue={code}
              onChange={handleChange}
              live
              multiline
              syntaxHighlight
              syntaxLanguage="sleepy"
              style={{
                width: '100%', height: '100%',
                backgroundColor: c.bgElevated,
                color: c.text,
                fontSize: 13,
                fontFamily: 'monospace',
                padding: 16,
                lineHeight: 20,
              }}
            />
          </Box>
        </Box>

        {/* Right: Live Preview */}
        <Box style={{ width: '50%', flexDirection: 'column' }}>
          <Box style={{
            paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.surface,
          }}>
            <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'monospace' }}>preview</Text>
          </Box>
          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ padding: 20, gap: 8 }}>
              {parseError ? (
                <ParseError message={parseError} />
              ) : ast ? (
                <SleepyRenderer node={ast} />
              ) : (
                <Text style={{ color: c.muted, fontSize: 14 }}>Type some .sleepy syntax to see it render</Text>
              )}
            </Box>
          </ScrollView>
        </Box>
      </Box>

      {/* Footer: Syntax Cheatsheet */}
      <Box style={{
        flexDirection: 'row', gap: 20, paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10,
        borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface,
      }}>
        {[
          ['box', 'text', 'pressable', 'input', 'image', 'scroll'],
          ['{} root', '() group', '[] list', ': nest', '$ variant', 'api. bind'],
        ].map((row, ri) => (
          <Box key={ri} style={{ flexDirection: 'row', gap: 12 }}>
            {row.map((item) => (
              <Text key={item} style={{ color: c.muted, fontSize: 11, fontFamily: 'monospace' }}>{item}</Text>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
