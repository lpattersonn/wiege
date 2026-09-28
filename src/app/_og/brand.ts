import { ROCKER_D, WORDMARK_W } from '@/components/glyphs/wordmark-outline';

/**
 * Brand marks as standalone SVG strings for generated images (apple icon,
 * Open Graph). They carry their own outlines, so no web font is needed.
 */

/** The app icon: black square, white Bodoni W, the cradle rocker. `radius` 0 = full bleed. */
export function appIconSvg(radius = 0): string {
  const S = 2.5;
  const cap = 75 * S;
  const gap = 20;
  const rockH = 35;
  const top = (512 - (cap + gap + rockH)) / 2;
  const wWidth = WORDMARK_W.width * S;
  const tx = (512 - wWidth) / 2 - S;
  const ty = top - 37.5 * S;
  const rw = wWidth + 75;
  const rx = (512 - rw) / 2;
  const ry = top + cap + gap;
  const p = (x: number, y: number) => `${(rx + (x * rw) / 100).toFixed(1)} ${(ry + (y * rockH) / 10).toFixed(1)}`;
  const rocker = `M${p(1.5, 2.2)}C${p(20, 10.6)} ${p(76, 10.8)} ${p(98.5, 1.4)}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="${radius}" fill="#000"/>` +
    `<path transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${S})" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" d="${WORDMARK_W.d}"/>` +
    `<path d="${rocker}" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** The rocker alone, `width` × `height`, stroke in px. */
export function rockerSvg(width: number, height: number, stroke: number, color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 100 10" preserveAspectRatio="none">` +
    `<path d="${ROCKER_D}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    `</svg>`
  );
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
