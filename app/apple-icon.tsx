import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

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
          background: '#1d2125',
          borderRadius: 38,
        }}
      >
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: 28,
            background: 'linear-gradient(135deg, #0c66e4 0%, #579dff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 20,
          }}
        >
          <div style={{ width: 20, height: 74, borderRadius: 6, background: '#ffffff' }} />
          <div style={{ width: 20, height: 52, borderRadius: 6, background: 'rgba(255,255,255,0.85)' }} />
          <div style={{ width: 20, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.7)' }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
