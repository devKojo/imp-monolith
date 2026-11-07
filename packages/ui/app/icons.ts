/**
 * The one icon set (UI-FND-06, ADR-F006): inline SVG, 24 x 24 grid, 2 px round strokes, no icon
 * fonts. Add an icon here (and nowhere else) before using it. Icons are decorative unless given a
 * label; see UiIcon.
 */
export type IconDef = { d: string[]; fill?: boolean };

const stroke = (...d: string[]): IconDef => ({ d });

export const icons = {
  check: stroke('M20 6 9 17l-5-5'),
  x: stroke('M18 6 6 18M6 6l12 12'),
  plus: stroke('M12 5v14M5 12h14'),
  minus: stroke('M5 12h14'),
  pencil: stroke('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'),
  eye: stroke(
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  ),
  clock: stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'),
  pause: stroke('M8 5v14M16 5v14'),
  'pause-shield': stroke('M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z', 'M10 9v6M14 9v6'),
  shield: stroke('M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z'),
  box: stroke('M21 8v13H3V8', 'M1 3h22v5H1Z', 'M10 12h4'),
  dot: { d: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'], fill: true },
  'alert-triangle': stroke(
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    'M12 9v4M12 17h.01',
  ),
  info: stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16v-4M12 8h.01'),
  'alert-circle': stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 8v4M12 16h.01'),
  'check-circle': stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8 12l3 3 5-6'),
  'x-circle': stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M15 9l-6 6M9 9l6 6'),
  'chevron-down': stroke('m6 9 6 6 6-6'),
  'chevron-up': stroke('m18 15-6-6-6 6'),
  'chevron-left': stroke('m15 18-6-6 6-6'),
  'chevron-right': stroke('m9 18 6-6-6-6'),
  'arrow-up': stroke('M12 19V5M5 12l7-7 7 7'),
  'arrow-down': stroke('M12 5v14M19 12l-7 7-7-7'),
  upload: stroke('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5M12 3v12'),
  download: stroke('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5M12 15V3'),
  copy: stroke('M9 9h11v11H9Z', 'M5 15H4V4h11v1'),
  lock: stroke('M5 11h14v10H5Z', 'M8 11V7a4 4 0 0 1 8 0v4'),
  search: stroke('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3'),
  bell: stroke('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'),
  help: stroke(
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  ),
  menu: stroke('M4 6h16M4 12h16M4 18h16'),
  trash: stroke('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6', 'M10 11v6M14 11v6'),
  globe: stroke(
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18',
  ),
  external: stroke('M18 13v6H5V6h6M15 3h6v6M10 14 21 3'),
  user: stroke('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'),
  share: stroke('M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14'),
  refresh: stroke(
    'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5',
    'M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  ),
  'wifi-off': stroke(
    'M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5a15 15 0 0 1 11.3 3.8M5 12.9a10 10 0 0 1 5.2-2.7M12 20h.01',
  ),
  // Added for the auth, onboarding and discovery screens.
  'eye-off': stroke(
    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
    'M1 1l22 22',
  ),
  mail: stroke(
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'm22 6-10 7L2 6',
  ),
  building: stroke('M3 21h18M5 21V7l8-4v18M19 21V11l-6-4', 'M9 9v.01M9 12v.01M9 15v.01M9 18v.01'),
  gift: stroke(
    'M20 12v10H4V12M2 7h20v5H2zM12 22V7',
    'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  ),
  zap: stroke('M13 2 3 14h9l-1 8 10-12h-9z'),
  'arrow-right': stroke('M5 12h14M12 5l7 7-7 7'),
  filter: stroke('M22 3H2l8 9.46V19l4 2v-8.54z'),
  'shield-check': stroke('M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z', 'm9 12 2 2 4-4'),
  'clipboard-list': stroke(
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9z',
    'M9 12h6M9 16h6',
  ),
  'bar-chart': stroke('M12 20V10M18 20V4M6 20v-4'),
  trophy: stroke(
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16',
    'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  ),
  'log-in': stroke('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3'),
  'log-out': stroke('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'),
  circle: stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'),
  loader: stroke('M21 12a9 9 0 1 1-6.22-8.56'),
  ticket: stroke(
    'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z',
    'M13 5v2M13 11v2M13 17v2',
  ),
  cash: stroke(
    'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M6 12h.01M18 12h.01',
  ),
  timer: stroke('M10 2h4M12 14l3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z'),
  rocket: stroke(
    'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z',
    'm12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z',
    'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  ),
  users: stroke(
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ),
  'trending-up': stroke('M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'),
  sliders: stroke('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'),
  grid: stroke('M3 3h7v7H3ZM14 3h7v7h-7ZM14 14h7v7h-7ZM3 14h7v7H3Z'),
  calendar: stroke(
    'M8 2v4M16 2v4M3 10h18',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  ),
  sparkles: stroke('m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z', 'M19 3v4M21 5h-4'),
  wand: stroke(
    'M3 21 15 9M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M12.2 6.2 11 5',
  ),
  cpu: stroke(
    'M6 6h12v12H6ZM9 9h6v6H9Z',
    'M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2',
  ),
  'more-vertical': stroke('M12 6h.01M12 12h.01M12 18h.01'),
  star: stroke('m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2l-5-4.9 6.9-1Z'),
  cloud: stroke('M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12.5 3.5 3.5 0 0 0 6 19Z'),
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof icons;
