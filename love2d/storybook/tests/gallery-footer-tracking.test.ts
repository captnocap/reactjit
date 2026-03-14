// Gallery footer toolbar tracking test.
//
// Checks whether the footer toolbar is within the root bounds at each viewport.
// The content wrapper (overflow:hidden) clips internal overflow, so we just need
// to verify: footer.bottom <= root.bottom
//
// Run:
//   cd storybook && rjit build && rjit test tests/gallery-footer-tracking.test.ts --timeout=120
// Report:
//   cat /tmp/gallery-footer-report.txt

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

type QueryNode = {
  id: number;
  type: string;
  debugName: string;
  props: Record<string, any>;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const bridge = (globalThis as any).__rjitBridge as RpcBridge | undefined;

function requireBridge(): RpcBridge {
  if (!bridge) throw new Error('Missing __rjitBridge');
  return bridge;
}

async function setViewport(width: number, height: number): Promise<void> {
  await requireBridge().rpc('window:setSize', { width, height });
  await page.wait(3);
}

async function queryByTestId(testId: string): Promise<QueryNode | null> {
  const results = await requireBridge().rpc<QueryNode[]>('test:query', {
    props: { testId },
  });
  return results && results[0] ? results[0] : null;
}

async function writeFile(path: string, content: string): Promise<void> {
  await requireBridge().rpc('test:writeFile', { path, content });
}

function n(v: number): string {
  return String(Math.round(v * 10) / 10);
}

const SWEEP = [
  { w: 480,  h: 600  },
  { w: 640,  h: 480  },
  { w: 640,  h: 900  },
  { w: 800,  h: 600  },
  { w: 900,  h: 675  },
  { w: 1024, h: 768  },
  { w: 1024, h: 900  },
  { w: 1280, h: 720  },
  { w: 1280, h: 960  },
  { w: 1366, h: 768  },
  { w: 1440, h: 900  },
  { w: 1440, h: 960  },
  { w: 1600, h: 900  },
  { w: 1920, h: 1080 },
  { w: 2560, h: 1440 },
  { w: 3840, h: 2160 },
];

const SECTIONS = [
  'gallery-root',
  'gallery-content',
  'gallery-header1',
  'gallery-header2',
  'gallery-info-row',
  'gallery-preview',
  'gallery-divider-bar',
  'gallery-tab-grid',
  'gallery-footer-toolbar',
];

test('Footer toolbar breakpoint crawl', async () => {
  await setViewport(1024, 768);
  const check = await queryByTestId('gallery-footer-toolbar');
  if (!check) {
    throw new Error('gallery-footer-toolbar NOT FOUND. testId not reaching Lua nodes.');
  }

  const lines: string[] = [];
  const log = (s: string) => lines.push(s);

  log('GALLERY FOOTER TOOLBAR — BREAKPOINT CRAWL');
  log('='.repeat(105));
  log('');
  log('Check: is footer.bottom <= root.bottom? (i.e. footer visible within root bounds)');
  log('');

  log(
    'Viewport'.padEnd(14) + '| ' +
    'rootY'.padEnd(8) + '| ' +
    'rootBot'.padEnd(9) + '| ' +
    'contentH'.padEnd(10) + '| ' +
    'footerY'.padEnd(9) + '| ' +
    'footerBot'.padEnd(11) + '| ' +
    'footerH'.padEnd(9) + '| ' +
    'overshoot'.padEnd(11) + '| ' +
    'status'
  );
  log('-'.repeat(105));

  type Row = {
    vp: { w: number; h: number };
    rootY: number;
    rootBot: number;
    contentH: number;
    footerY: number;
    footerBot: number;
    footerH: number;
    overshoot: number;
    fits: boolean;
  };

  const rows: Row[] = [];
  let prevFits: boolean | null = null;
  const flips: string[] = [];

  for (const vp of SWEEP) {
    await setViewport(vp.w, vp.h);

    const root = await queryByTestId('gallery-root');
    const content = await queryByTestId('gallery-content');
    const footer = await queryByTestId('gallery-footer-toolbar');

    const rootY = root ? root.y : 0;
    const rootBot = root ? root.y + root.h : vp.h;
    const contentH = content ? content.h : 0;
    const footerY = footer ? footer.y : -1;
    const footerH = footer ? footer.h : 0;
    const footerBot = footer ? footer.y + footer.h : -1;

    // Footer fits if its bottom edge is within the root's bottom edge (1px tolerance)
    const overshoot = Math.max(0, footerBot - rootBot);
    const fits = footer !== null && overshoot <= 1;

    rows.push({ vp, rootY, rootBot, contentH, footerY, footerBot, footerH, overshoot, fits });

    if (prevFits !== null && prevFits !== fits) {
      const prev = rows[rows.length - 2];
      flips.push(
        `${prev.vp.w}x${prev.vp.h} (${prevFits ? 'OK' : 'OVER'}) -> ` +
        `${vp.w}x${vp.h} (${fits ? 'OK' : 'OVER'}) ` +
        `rootBot: ${n(prev.rootBot)}->${n(rootBot)}  footerBot: ${n(prev.footerBot)}->${n(footerBot)}`
      );
    }
    prevFits = fits;
  }

  let fitsCount = 0;
  let overflowCount = 0;

  for (const r of rows) {
    const vpStr = `${r.vp.w}x${r.vp.h}`.padEnd(13);
    const rootYStr = n(r.rootY).padEnd(7);
    const rootBotStr = n(r.rootBot).padEnd(8);
    const contentStr = n(r.contentH).padEnd(9);
    const fYStr = n(r.footerY).padEnd(8);
    const fBotStr = n(r.footerBot).padEnd(10);
    const fHStr = n(r.footerH).padEnd(8);
    const overStr = n(r.overshoot).padEnd(10);
    const status = r.fits ? 'OK' : 'OVERFLOW <<<';

    log(`${vpStr} | ${rootYStr} | ${rootBotStr} | ${contentStr} | ${fYStr} | ${fBotStr} | ${fHStr} | ${overStr} | ${status}`);
    if (r.fits) fitsCount++;
    else overflowCount++;
  }

  log('');
  log(`Summary: ${fitsCount} fit, ${overflowCount} overflow, ${flips.length} flips`);

  if (flips.length > 0) {
    log('');
    log(`VISIBILITY FLIPS (${flips.length}):`);
    for (const f of flips) log(`  ${f}`);
  }

  // Detail for overflows
  if (overflowCount > 0) {
    log('');
    log('OVERFLOW DETAIL — full section breakdown');
    log('='.repeat(105));
    for (const r of rows.filter(r => !r.fits).slice(0, 8)) {
      await setViewport(r.vp.w, r.vp.h);
      log('');
      log(`--- ${r.vp.w}x${r.vp.h}  rootBot=${n(r.rootBot)}  footerBot=${n(r.footerBot)}  overshoot=${n(r.overshoot)} ---`);
      for (const tid of SECTIONS) {
        const node = await queryByTestId(tid);
        if (node) {
          const bot = node.y + node.h;
          const tag = bot > r.rootBot + 1 ? ' <<< EXCEEDS ROOT' : '';
          log(`  ${tid.padEnd(28)} y=${n(node.y).padEnd(8)} h=${n(node.h).padEnd(8)} bot=${n(bot).padEnd(8)}${tag}`);
        } else {
          log(`  ${tid.padEnd(28)} NOT FOUND`);
        }
      }
    }
  }

  const report = lines.join('\n');
  await writeFile('/tmp/gallery-footer-report.txt', report);

  // Summary for test runner
  const offVps = rows.filter(r => !r.fits).slice(0, 4).map(r => `${r.vp.w}x${r.vp.h}(+${n(r.overshoot)})`).join(', ');
  const flipNote = flips.length > 0 ? ` ${flips.length} flips.` : '';

  if (overflowCount > 0) {
    throw new Error(
      `${fitsCount} fit, ${overflowCount} overflow.${flipNote} Offscreen: ${offVps}. Report: /tmp/gallery-footer-report.txt`
    );
  }

  // If all pass, still write report but don't throw
});
