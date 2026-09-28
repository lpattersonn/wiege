import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

import { bodoniEm } from '@/components/pen/metrics';
import { loopPath, penSeed } from '@/components/pen/pen';

import { rockerSvg, svgDataUri } from './_og/brand';

/**
 * The default share image (1200×630), monochrome: the Bodoni wordmark with its
 * rocker, the pitch in Atkinson, and one key word on an inverted cover with a
 * pen loop — the signature. Fonts are static subsets in src/app/_og (OFL).
 */
export const alt = 'Wiege: real news from the last four hours, turned into reading practice for ages 12 to 15.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const fontDir = join(process.cwd(), 'src/app/_og');
const [bodoni, atkinson700, atkinson400] = await Promise.all([
  readFile(join(fontDir, 'bodoni-moda-900.ttf')),
  readFile(join(fontDir, 'atkinson-hyperlegible-next-700.ttf')),
  readFile(join(fontDir, 'atkinson-hyperlegible-next-400.ttf')),
]);

const WORD = 'rehearse';
const CARD_W = 480;
const CARD_PAD = 36;
const WORD_EM = bodoniEm(WORD, { weight: 900, tracking: -0.025 });
/** Fit the word (plus its loop's side insets) to the card's inner width, like the site's covers. */
const WORD_SIZE = Math.floor((CARD_W - 2 * CARD_PAD) / (WORD_EM + 0.34));

function coverLoop(): string {
  // Word box: width = em × size, height = 0.9 × size; loop insets from DESIGN §8.4.
  const em = WORD_EM;
  const lx = 0.17;
  const lt = 0.06;
  const lb = 0.04;
  const w = (em + 2 * lx) * WORD_SIZE;
  const h = (0.9 + lt + lb) * WORD_SIZE;
  const g = loopPath(penSeed('loop', WORD, 'og'), w / h);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="${g.viewBox}" preserveAspectRatio="none">` +
    g.d.map((d) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('') +
    `</svg>`
  );
}

export default function OpengraphImage() {
  const loopW = Math.round((WORD_EM + 0.34) * WORD_SIZE);
  const loopH = Math.round(1.0 * WORD_SIZE);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#FFFFFF', color: '#000000', padding: 72, fontFamily: 'Atkinson' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 560 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', fontFamily: 'Bodoni', fontSize: 112, lineHeight: 1, letterSpacing: '-0.01em' }}>Wiege</div>
            <img src={svgDataUri(rockerSvg(396, 34, 8, '#000000'))} width={396} height={34} alt="" style={{ marginTop: -6, marginLeft: -11 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.005em' }}>
              Real news from the last four hours, turned into reading practice for ages 12 to 15.
            </div>
            <div style={{ display: 'flex', marginTop: 24, fontSize: 28, fontWeight: 400, color: '#404040' }}>Free. No sign-up. Your progress stays on your device.</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            marginLeft: 'auto',
            width: CARD_W,
            height: 486,
            background: '#000000',
            color: '#FFFFFF',
            borderRadius: 4,
            padding: CARD_PAD,
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', position: 'relative', fontFamily: 'Bodoni', fontSize: WORD_SIZE, lineHeight: 0.9, letterSpacing: '-0.025em' }}>
            {WORD}
            <img
              src={svgDataUri(coverLoop())}
              width={loopW}
              height={loopH}
              alt=""
              style={{ position: 'absolute', left: -0.17 * WORD_SIZE, top: -0.06 * WORD_SIZE }}
            />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Bodoni', data: bodoni, weight: 900, style: 'normal' },
        { name: 'Atkinson', data: atkinson700, weight: 700, style: 'normal' },
        { name: 'Atkinson', data: atkinson400, weight: 400, style: 'normal' },
      ],
    },
  );
}
