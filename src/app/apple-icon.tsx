import { ImageResponse } from 'next/og';

import { appIconSvg, svgDataUri } from './_og/brand';

/** Apple touch icon: full-bleed black square, white Bodoni W and the rocker (iOS rounds the corners). */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <img src={svgDataUri(appIconSvg(0))} width={180} height={180} alt="" />
    ),
    size,
  );
}
