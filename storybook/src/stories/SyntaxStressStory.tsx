import React from 'react';
import { Box, Text, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// Every snippet has a comment + unterminated block comment to hit the fixed bug paths

const JS_CODE = `// Single-line comment
const x = 42;
/* block comment */
const fn = (a, b) => a + b;
/* unterminated block
const dead = true;`;

const TS_CODE = `// TypeScript generics
interface Props<T> {
  data: T;
  /* inline block */
  onChange: (val: T) => void;
}
/* unterminated
type X = string;`;

const TSX_CODE = `// JSX with comments
const App = () => {
  /* block */ return <Div className="x" />
}
// trailing comment`;

const PYTHON_CODE = `# This is a comment
def hello(name: str) -> str:
    """docstring here"""
    return f"Hello {name}"
# another comment`;

const LUA_CODE = `-- Single line comment
local function greet(name)
  --[[ block comment ]]
  return "Hello " .. name
end
-- trailing`;

const RUBY_CODE = `# Ruby comment
class Greeter
  def initialize(name)
    @name = name
  end
  # method comment
end`;

const CSS_CODE = `/* CSS block comment */
.container {
  display: flex;
  /* nested comment */
  gap: 8px;
}
// sass-style comment`;

const HTML_CODE = `<!-- HTML comment -->
<div class="wrapper">
  <h1>Title</h1>
  <!-- another comment -->
  <!DOCTYPE html>
</div>`;

const RUST_CODE = `// Rust line comment
fn main() {
    /* block comment */
    let x: i32 = 42;
    /// doc comment
    println!("{}", x);
}
/* unterminated
let y = 0;`;

const GO_CODE = `// Go line comment
func main() {
    /* block comment */
    x := 42
    fmt.Println(x)
}
/* unterminated
var y int`;

const C_CODE = `// C line comment
#include <stdio.h>
int main() {
    /* block comment */
    printf("hello\\n");
    return 0;
}
/* unterminated
int x;`;

const JAVA_CODE = `// Java line comment
public class Main {
    /* block comment */
    public static void main(String[] args) {
        System.out.println("hello");
    }
}
/* unterminated
int x;`;

const SQL_CODE = `-- SQL line comment
SELECT * FROM users
WHERE active = true
# mysql comment
/* block comment */
ORDER BY name;
/* unterminated
AND deleted = false;`;

const SWIFT_CODE = `// Swift line comment
func greet(name: String) -> String {
    /* block comment */
    return "Hello \\(name)"
}
/* unterminated
let x = 0`;

const YAML_CODE = `# YAML comment
server:
  host: localhost
  port: 8080
  # nested comment
  debug: true`;

const JSON_CODE = `{
  "name": "test",
  "version": "1.0.0",
  "scripts": {
    "build": "rjit build",
    "dev": "rjit dev"
  }
}`;

const ALL_LANGS: Array<{ lang: string; code: string }> = [
  { lang: 'js', code: JS_CODE },
  { lang: 'ts', code: TS_CODE },
  { lang: 'tsx', code: TSX_CODE },
  { lang: 'python', code: PYTHON_CODE },
  { lang: 'lua', code: LUA_CODE },
  { lang: 'ruby', code: RUBY_CODE },
  { lang: 'css', code: CSS_CODE },
  { lang: 'html', code: HTML_CODE },
  { lang: 'rust', code: RUST_CODE },
  { lang: 'go', code: GO_CODE },
  { lang: 'c', code: C_CODE },
  { lang: 'java', code: JAVA_CODE },
  { lang: 'sql', code: SQL_CODE },
  { lang: 'swift', code: SWIFT_CODE },
  { lang: 'yaml', code: YAML_CODE },
  { lang: 'json', code: JSON_CODE },
];

export function SyntaxStressStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      <Box style={{
        flexShrink: 0,
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
      }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>
          {'Syntax Stress Test — 16 Languages'}
        </Text>
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Every snippet has comments that previously caused infinite tokenizer loops.'}
        </Text>
      </Box>
      <ScrollView style={{ flexGrow: 1 }}>
        {ALL_LANGS.map((item, i) => (
          <Box key={i} style={{
            flexDirection: 'row',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 14,
            paddingBottom: 14,
            gap: 20,
            alignItems: 'flex-start',
            borderBottomWidth: 1,
            borderColor: c.border,
          }}>
            <Box style={{ width: 60, paddingTop: 4 }}>
              <Text style={{ color: c.primary, fontSize: 11, fontWeight: 'bold' }}>
                {item.lang}
              </Text>
            </Box>
            <Box style={{ flexGrow: 1 }}>
              <CodeBlock language={item.lang} fontSize={9} code={item.code} />
            </Box>
          </Box>
        ))}
      </ScrollView>
    </Box>
  );
}
