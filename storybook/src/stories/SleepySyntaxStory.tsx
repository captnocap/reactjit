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

const VARIANT_COLORS: Record<string, Record<string, string>> = {
  primary: { bg: '#3B82F6', text: '#FFFFFF' },
  secondary: { bg: '#6B7280', text: '#FFFFFF' },
  ghost: { bg: 'transparent', text: '#3B82F6' },
  danger: { bg: '#EF4444', text: '#FFFFFF' },
  success: { bg: '#10B981', text: '#FFFFFF' },
  warning: { bg: '#F59E0B', text: '#1F2937' },
  dark: { bg: '#1F2937', text: '#F9FAFB' },
};

function SleepyRenderer({ node, depth = 0 }: { node: SleepyNode; depth?: number }) {
  const c = useThemeColors();

  if (node.type === 'text') {
    return (
      <Text style={{ color: c.text, fontSize: 14 }}>{node.value || ''}</Text>
    );
  }

  if (node.type === 'api') {
    return (
      <Box style={{ backgroundColor: '#DBEAFE', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ color: '#1D4ED8', fontSize: 12, fontFamily: 'monospace' }}>{node.value || 'api.?'}</Text>
      </Box>
    );
  }

  const n = node.name.toLowerCase();
  const variant = node.variant ? VARIANT_COLORS[node.variant] : undefined;

  // Text elements
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(n)) {
    const sizes: Record<string, number> = { h1: 28, h2: 24, h3: 20, h4: 18, h5: 16, h6: 14 };
    const textContent = node.children.length > 0 && node.children[0].type === 'text'
      ? node.children[0].value : n.toUpperCase();
    return (
      <Text style={{ color: c.text, fontSize: sizes[n] || 16, fontWeight: 'bold' }}>
        {textContent}
      </Text>
    );
  }

  if (n === 'p' || n === 'span' || n === 'text') {
    const textContent = node.children.length > 0 && node.children[0].type === 'text'
      ? node.children[0].value : node.children.length > 0 && node.children[0].type === 'api'
      ? node.children[0].value : 'Text';
    return (
      <Text style={{ color: c.muted, fontSize: 14 }}>{textContent}</Text>
    );
  }

  // Interactive elements
  if (n === 'button') {
    const bg = variant?.bg || c.primary;
    const fg = variant?.text || '#FFFFFF';
    const label = node.children.length > 0 && node.children[0].type === 'text'
      ? node.children[0].value : node.children.length > 0
      ? node.children[0].name : 'Button';
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

  if (n === 'input' || n === 'textarea') {
    const placeholder = node.children.length > 0 && node.children[0].type === 'text'
      ? node.children[0].value : n === 'textarea' ? 'Enter text...' : 'Input...';
    return (
      <Box style={{
        borderWidth: 1, borderColor: c.border, borderRadius: 6,
        paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
        height: n === 'textarea' ? 80 : undefined,
      }}>
        <Text style={{ color: c.muted, fontSize: 14 }}>{placeholder}</Text>
      </Box>
    );
  }

  // Media
  if (n === 'img' || n === 'image') {
    const isAvatar = node.variant === 'avatar';
    return (
      <Box style={{
        width: isAvatar ? 48 : 120, height: isAvatar ? 48 : 80,
        backgroundColor: '#E5E7EB', borderRadius: isAvatar ? 24 : 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: '#9CA3AF', fontSize: 10 }}>IMG</Text>
      </Box>
    );
  }

  // Layout containers
  const isRow = n === 'row';
  const isColumn = n === 'column' || n === 'col';
  const isCard = n === 'card';
  const isSection = n === 'section' || n === 'panel' || n === 'box' || n === 'div' || n === 'container';
  const isModal = n === 'modal';
  const isNav = n === 'nav' || n === 'navbar' || n === 'header' || n === 'footer' || n === 'sidebar';
  const isList = n === 'list' || node.name === 'list';
  const isGroup = node.type === 'group';
  const isForEach = n === 'foreach';
  const isTabs = n === 'tabs';
  const isGrid = n === 'grid' || n === 'masonry';

  // forEach just renders its template with a badge
  if (isForEach) {
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

  // Container rendering
  if (isCard || isSection || isRow || isColumn || isModal || isNav || isList || isGroup || isTabs || isGrid) {
    const containerStyle: Record<string, unknown> = {
      gap: 8,
      padding: (isCard || isModal || isSection) ? 12 : isNav ? 10 : 4,
      flexDirection: (isRow || isNav || isTabs || isGrid) ? 'row' : 'column',
    };

    if (isCard) {
      containerStyle.backgroundColor = variant?.bg || c.bgElevated;
      containerStyle.borderRadius = 10;
      containerStyle.borderWidth = 1;
      containerStyle.borderColor = c.border;
    } else if (isModal) {
      containerStyle.backgroundColor = c.bgElevated;
      containerStyle.borderRadius = 12;
      containerStyle.borderWidth = 1;
      containerStyle.borderColor = c.border;
      containerStyle.padding = 20;
    } else if (isNav) {
      containerStyle.backgroundColor = c.surface;
      containerStyle.paddingLeft = 16; containerStyle.paddingRight = 16;
      containerStyle.alignItems = 'center';
    } else if (isGrid) {
      containerStyle.flexWrap = 'wrap';
    }

    return (
      <Box style={containerStyle}>
        {node.children.map((child, i) => (
          <SleepyRenderer key={i} node={child} depth={depth + 1} />
        ))}
      </Box>
    );
  }

  // Fallback: unknown element with children
  if (node.children.length > 0) {
    return (
      <Box style={{ gap: 6, padding: 4 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1 }}>
            <Text style={{ color: c.muted, fontSize: 10, fontFamily: 'monospace' }}>{`<${node.name}${node.variant ? `$${node.variant}` : ''}>`}</Text>
          </Box>
        </Box>
        {node.children.map((child, i) => (
          <SleepyRenderer key={i} node={child} depth={depth + 1} />
        ))}
      </Box>
    );
  }

  // Leaf element
  return (
    <Box style={{ backgroundColor: c.surface, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
      <Text style={{ color: c.text, fontSize: 13 }}>{node.name}{node.variant ? `$${node.variant}` : ''}</Text>
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
    label: 'Card',
    code: `{card:(column:[
  img$avatar:api.user.avatar,
  h3:"Jane Doe",
  p:"Software Engineer",
  button$primary:"Follow"
])}`,
  },
  {
    label: 'Nav + Content',
    code: `{column:(
  nav:(row:[h3:"MyApp", button$ghost:"Home", button$ghost:"About", button$ghost:"Contact"]),
  card:(column:[
    h2:"Welcome",
    p:"Put the thing inside the other thing.",
    row:[button$primary:"Get Started", button$secondary:"Learn More"]
  ])
)}`,
  },
  {
    label: 'Login Form',
    code: `{card:(column:[
  h2:"Sign In",
  input:"Email",
  input:"Password",
  button$primary:"Log In",
  p:"Forgot password?"
])}`,
  },
  {
    label: 'Dashboard',
    code: `{column:(
  nav:(row:[h3:"Dashboard", button$ghost:"Settings"]),
  row:[
    card:(column:[h4:"Users", h2:"1,234", p:"12% increase"]),
    card:(column:[h4:"Revenue", h2:"$45.6K", p:"8% increase"]),
    card:(column:[h4:"Orders", h2:"567", p:"3% decrease"])
  ],
  card:(column:[
    h3:"Recent Activity",
    forEach:api.activities:[
      row:[p:api.activity.title, p:api.activity.time]
    ]
  ])
)}`,
  },
  {
    label: 'Chat',
    code: `{column:(
  nav:(row:[h3:"Messages", button$ghost:"New"]),
  card:(column:[
    forEach:api.messages:[
      row:[img$avatar:api.msg.avatar, column:[p:api.msg.sender, p:api.msg.text]]
    ]
  ]),
  row:[input:"Type a message...", button$primary:"Send"]
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
          <Box style={{ flexGrow: 1, padding: 0 }}>
            <TextInput
              key={inputKey}
              defaultValue={code}
              onLiveChange={handleChange}
              liveChangeDebounce={150}
              multiline
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
          ['{} root', '() group', '[] list', ': nest'],
          ['$ variant', 'api. data', '// comment', 'forEach: loop'],
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
