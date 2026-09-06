import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const alt = 'أهل كايرو — Ahl Cairo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The link preview card.
 *
 * Deliberately typographic. The office's photography is stock, and a stock
 * photo in a link preview reads as a template; the wordmark and the phone
 * number are what a guest actually needs to recognise.
 *
 * The Arabic font is bundled because Satori cannot shape Arabic with its
 * default font — it fails on the ligature substitution the script needs. The
 * file is subset to just the characters drawn below, 9KB rather than 434KB.
 */
export default async function OpengraphImage() {
  const kufi = await readFile(path.join(process.cwd(), 'src/assets/og-arabic.ttf'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '76px 88px',
          background: '#0b0d10',
          backgroundImage:
            'radial-gradient(ellipse at 22% 12%, rgba(201,167,101,0.30), transparent 58%)',
        }}
      >
        <div style={{ display: 'flex', color: '#c9a765', fontSize: 24, letterSpacing: 8 }}>
          CAIRO · EGYPT
        </div>

        <div
          style={{
            display: 'flex',
            color: '#fbf9f6',
            fontSize: 96,
            marginTop: 26,
            fontFamily: 'Kufi',
            // Explicit, so the layout does not depend on Satori inferring
            // direction from the script.
            direction: 'rtl',
          }}
        >
          أهل كايرو
        </div>
        <div style={{ display: 'flex', color: '#fbf9f6', fontSize: 58, marginTop: 6 }}>
          Ahl Cairo
        </div>

        <div
          style={{
            display: 'flex',
            color: '#cdd4dc',
            fontSize: 30,
            marginTop: 30,
            fontFamily: 'Kufi',
            direction: 'rtl',
          }}
        >
          استقبال مطار وسيارات وإقامة
        </div>
        <div style={{ display: 'flex', color: '#7b8794', fontSize: 27, marginTop: 8 }}>
          Airport fast track · Chauffeured cars · Private residences
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', width: 56, height: 3, background: '#c9a765' }} />
          <div style={{ display: 'flex', color: '#c9a765', fontSize: 30, letterSpacing: 2 }}>
            +20 122 233 2929
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Kufi', data: kufi, weight: 700, style: 'normal' }],
    },
  );
}
