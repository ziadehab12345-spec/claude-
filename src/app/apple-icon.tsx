import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * The home-screen icon on iOS.
 *
 * Generated rather than committed as a binary: Apple touch icons must be
 * raster, and Next's apple-icon convention rejects SVG, so the brand mark is
 * redrawn here at the size iOS wants. No rounded corners — iOS applies its own
 * mask and a pre-rounded icon ends up double-rounded.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0d10',
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M32 13.5 L45.5 50 H38.6 L32 30.4 L25.4 50 H18.5 Z" fill="#c9a765" />
          <rect x="18.5" y="43.2" width="27" height="3.4" rx="1.7" fill="#c9a765" opacity="0.55" />
        </svg>
      </div>
    ),
    size,
  );
}
