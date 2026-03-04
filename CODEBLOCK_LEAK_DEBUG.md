SAFE WITH INTRINSIC WIDTH
---
`import { usePackage } from '@reactjit/package'
import { PackageProvider } from '@reactjit/package'`


`import { usePackage } from '@reactjit/package'
import { PackageProvider } from '@reactjit/package'
import { CacheManager } from '@reactjit/package'`


`import { usePackage } from '@reactjit/package'
import { PackageProvider } from '@reactjit/package'
import { CacheManager } from '@reactjit/package'
import { Registry } from '@reactjit/package'`


`import { usePackage } from '@reactjit/package'
import { PackageProvider } from '@reactjit/package'
import { CacheManager } from '@reactjit/package'
import { Registry } from '@reactjit/package'
import { Resolver } from '@reactjit/package'`

`import { usePackage } from '@reactjit/package'
import { PackageProvider } from '@reactjit/package'
import { CacheManager } from '@reactjit/package'
import { Registry } from '@reactjit/package'
import { Resolver } from '@reactjit/package'
import { Validator } from '@reactjit/package'`



-----

SAFE ( WITH OR WITHOUT INTRINSIC WIDTH )
const CODE_A = `line one of block A
line two of block A
line three of block A
line four of block A
line five of block A
line six of block A
line seven of block A
line eight of block A
line nine of block A
line ten of block A`;

const CODE_B = `line one of block B
line two of block B
line three of block B
line four of block B
line five of block B
line six of block B
line seven of block B
line eight of block B
line nine of block B
line ten of block B`;

const CODE_C = `line one of block C
line two of block C
line three of block C
line four of block C
line five of block C
line six of block C
line seven of block C
line eight of block C
line nine of block C
line ten of block C`;

const CODE_D = `line one of block D
line two of block D
line three of block D
line four of block D
line five of block D
line six of block D
line seven of block D
line eight of block D
line nine of block D
line ten of block D`;

const CODE_E = `line one of block E
line two of block E
line three of block E
line four of block E
line five of block E
line six of block E
line seven of block E
line eight of block E
line nine of block E
line ten of block E`;

const CODE_F = `line one of block F
line two of block F
line three of block F
line four of block F
line five of block F
line six of block F
line seven of block F
line eight of block F
line nine of block F
line ten of block F`;

const CODE_G = `line one of block G
line two of block G
line three of block G
line four of block G
line five of block G
line six of block G
line seven of block G
line eight of block G
line nine of block G
line ten of block G`;

const CODE_H = `line one of block H
line two of block H
line three of block H
line four of block H
line five of block H
line six of block H
line seven of block H
line eight of block H
line nine of block H
line ten of block H`;

const CODE_I = `line one of block I
line two of block I
line three of block I
line four of block I
line five of block I
line six of block I
line seven of block I
line eight of block I
line nine of block I
line ten of block I`;

const CODE_J = `line one of block J
line two of block J
line three of block J
line four of block J
line five of block J
line six of block J
line seven of block J
line eight of block J
line nine of block J
line ten of block J`;








SAFE:
Adding the header + hero + first INSTALL row before the  
  test blocks.  

  ● PROVIDER row added (code left, text right).

CALLOUT

    

BAD CODE RIGHT HERE

● Update(storybook/src/stories/Layout2Story.tsx)
  ⎿  Added 23 lines
      265                                                  
      266          <Box style={{ height: 1,         
           flexShrink: 0, backgroundColor: c.border        
            }} />                                        
      267                                                  
      268 +        {/* ── Row 3: BASIC USAGE ── */}      
      269 +        <Box style={{                    
      270 +          flexDirection: 'row',          
      271 +          paddingLeft: 28,               
      272 +          paddingRight: 28,              
      273 +          paddingTop: 20,                
      274 +          paddingBottom: 20,             
      275 +          gap: 24,                       
      276 +          alignItems: 'flex-start',      
      277 +        }}>                              
      278 +          <Box style={{ flexGrow: 1,     
          +flexBasis: 0, gap: 8, paddingTop: 4 }}>  
      279 +            <Text style={{ color:        
          +c.muted, fontSize: 8, fontWeight:        
          +'bold', letterSpacing: 1 }}>             
      280 +              {'BASIC USAGE'}            
      281 +            </Text>                      
      282 +            <Text style={{ color:        
          +c.text, fontSize: 10 }}>                 
      283 +              {'Destructure state for    
          +loading, error, and data. The hook       
          +handles the lifecycle — you just read.'} 
      284 +            </Text>                      
      285 +          </Box>                         
      286 +          <CodeBlock language="tsx"      
          +fontSize={9} code={BASIC_CODE} />        
      287 +        </Box>                           
      288 +                                         
      289 +        <Box style={{ height: 1,         
          +flexShrink: 0, backgroundColor: c.border 
          + }} />                                   
      290 +                                         
      291          {/* ── Test blocks ── */}
      292          {ALL_CODES.map((code, i) => (
      293       





















# CodeBlock Layout Leak — Debug Log








## The Problem
Layout2Story crashes/leaks when CodeBlocks are placed in flex rows.
The leak is tied to the intrinsic width reporting path in `estimateIntrinsicMain` (layout.lua).

## Key Files
- `lua/layout.lua` ~line 582 — `estimateIntrinsicMain` CodeBlock branch
- `lua/layout.lua` ~line 928 — fit-content sizing in `layoutNode`
- `lua/layout.lua` ~line 1674 — `_flexW` signaling + debug print
- `lua/codeblock.lua` ~line 233 — `CodeBlock.measure(node, includeWidth)`
- `storybook/src/stories/Layout2Story.tsx` — test file (stripped for bisection)
- `storybook/src/stories/Layout2Story.tsx._broken` — backup of full zigzag version

## What We Know
1. Without intrinsic width fix: CodeBlocks render at 3px wide, but NO leak
2. With intrinsic width fix (`measured.width + padMain`): proper width, BUT leaks
3. The leak happens even with 5-line / ~165-char strings — it's NOT about string size
4. Blank lines are NOT specifically the trigger
5. Earlier bisection results that showed size thresholds were likely HMR contamination

## What's Been Tried

### Attempt 1: codeblock.lua per-frame allocation fixes
- Pointer fast-paths in `ensureLines` and `checkChurn`
- Pre-computed color constants (module-level)
- Per-node color cache for string bg/border
- Scissor state: table → 4 locals
- Measure result table reuse (`entry._measureResult`)
- **Result: DID NOT FIX the leak** (good optimizations but not the cause)

### Attempt 2: Bisection by string size
- Stripped Layout2Story to header+footer, added parts back
- CodeBlocks with no intrinsic width (3px) = stable
- CodeBlocks with intrinsic width = leak regardless of size
- Earlier tests showed 5 lines stable / 7 lines crash, but this was inconsistent
- Latest test: even 5 lines leaks with intrinsic width enabled
- **Result: Size is NOT the variable — intrinsic width reporting itself is the cause**

### Attempt 3: Debug logging at _flexW signal point
- Added print at layout.lua ~1674 when `_flexW` is set on CodeBlock
- **Result: Not yet tested — leak crashes before output is visible**

## Current Hypothesis
The call to `CodeBlockModule.measure(node, isRow)` inside `estimateIntrinsicMain`
is called every frame during flex distribution. This may be:
- Allocating new tables per frame
- Triggering re-measurement that invalidates caches
- Creating a feedback loop between flex width assignment and fit-content sizing

## Next Steps to Try
- [ ] Disable intrinsic width, confirm stable (baseline)
- [ ] Return a FIXED constant (e.g., 300) from estimateIntrinsicMain for CodeBlock width instead of calling measure — isolate whether measure() itself leaks or the flex feedback loop leaks
- [ ] If fixed constant works: the oscillation between flex and fit-content is the cause
- [ ] If fixed constant leaks: something in the estimateIntrinsicMain→flex→layoutNode path allocates per frame
- [ ] Try caching the intrinsic width on the node itself so measure() is only called once





















const BASIC_CODE = `const [state, actions] = usePackage('user-prefs')
// Reactive - re-renders when data changes
if (state.loading) return <Spinner />
if (state.error) return <Error msg={state.error} />
return <Settings data={state.data} />`;




 {/* ── Row 3: BASIC USAGE ── */}                         
  <Box style={{
    flexDirection: 'row',                                  
    paddingLeft: 28,                                     
    paddingRight: 28,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 24,
    alignItems: 'flex-start',
  }}>
    <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8,
  paddingTop: 4 }}>
      <Text style={{ color: c.muted, fontSize: 8,
  fontWeight: 'bold', letterSpacing: 1 }}>
        {'BASIC USAGE'}
      </Text>
      <Text style={{ color: c.text, fontSize: 10 }}>
        {'Destructure state for loading, error, and data.
  The hook handles the lifecycle — you just read.'}
      </Text>
    </Box>
    <CodeBlock language="tsx" fontSize={9} 
  code={BASIC_CODE} />
  </Box>

  <Box style={{ height: 1, flexShrink: 0, backgroundColor: 
  c.border }} />