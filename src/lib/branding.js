export const defaultBranding = {
  font_family: 'Inter',
  button_style: 'rounded',
  glass_opacity: 0.7,
};

function hexToHsl(value) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : '4f46e5';
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  let saturation = 0;
  const lightness = (maximum + minimum) / 2;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }
  return `${Math.round((hue * 60 + 360) % 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function applyBranding(settings = {}) {
  const root = document.documentElement;
  const primary = typeof settings.primary_color === 'string' ? settings.primary_color : '#4f46e5';
  const accent = typeof settings.accent_color === 'string' ? settings.accent_color : '#f59e0b';
  const fonts = { Inter: '"Inter", sans-serif', Arial: 'Arial, sans-serif', Georgia: 'Georgia, serif' };
  const radii = { rounded: '0.75rem', pill: '9999px', square: '0.25rem' };
  const opacity = Number(settings.glass_opacity);
  root.style.setProperty('--primary', hexToHsl(primary));
  root.style.setProperty('--ring', hexToHsl(primary));
  root.style.setProperty('--sidebar-background', hexToHsl(primary));
  root.style.setProperty('--accent', hexToHsl(accent));
  root.style.setProperty('--uce-font-family', fonts[settings.font_family] || fonts.Inter);
  root.style.setProperty('--uce-button-radius', radii[settings.button_style] || radii.rounded);
  root.style.setProperty('--uce-glass-opacity', String(Number.isFinite(opacity) ? Math.min(0.95, Math.max(0.35, opacity)) : 0.7));
  root.style.setProperty(
    '--uce-body-background',
    settings.background_url ? `url("${settings.background_url.replaceAll('"', '')}")` : 'none',
  );
}
