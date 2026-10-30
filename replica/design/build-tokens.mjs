// Generates tokens.css (custom properties, light + dark) and tailwind.css
// (Tailwind v4 @theme mapping) from tokens.json. Rerun after every token change:
//   node replica/design/build-tokens.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));
const { dark, ...light } = t.color;

const decls = (obj) => Object.entries(obj).map(([k, v]) => `  --t-${k}: ${v};`).join('\n');
const darkDecls = decls(dark).replace(/^/gm, '  ');

const css = `/* Generated from tokens.json by build-tokens.mjs. Do not edit by hand. */
:root {
${decls(light)}
  color-scheme: light;

  --t-font-display: ${t.font.display};
  --t-font-sans: ${t.font.sans};
  --t-font-mono: ${t.font.mono};

${Object.entries(t.type).map(([k, v]) => `  --t-text-${k}: ${v.size / 16}rem;\n  --t-text-${k}-line: ${+(v.line / v.size).toFixed(4)};\n  --t-text-${k}-weight: ${v.weight};`).join('\n')}

${Object.entries(t.radius).map(([k, v]) => `  --t-radius-${k}: ${v === 999 ? '9999px' : v + 'px'};`).join('\n')}

${Object.entries(t.shadow).map(([k, v]) => `  --t-shadow-${k}: ${v};`).join('\n')}

  --t-duration-fast: ${t.motion.fast};
  --t-duration-base: ${t.motion.base};
  --t-ease: ${t.motion.ease};

  --t-column: ${t.layout.column}px;
  --t-gutter: ${t.layout.gutter}px;
  --t-header: ${t.layout['header-height']}px;
  --t-tap: ${t.layout['tap-target']}px;
}

/* Dark: follows the OS unless the user picked a theme (data-theme on <html>). */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkDecls}
    color-scheme: dark;
  }
}
/* Not limited to :root, so a panel can force a theme (the /design page shows both side by side). */
[data-theme="dark"] {
${decls(dark)}
  color-scheme: dark;
}
:root [data-theme="light"] {
${decls(light)}
  color-scheme: light;
}

@media (prefers-reduced-motion: reduce) {
  :root { --t-duration-fast: 0ms; --t-duration-base: 0ms; }
}
`;

// Tailwind v4: map every role into the theme so components write bg-surface text-muted,
// never raw hex. "inline" makes utilities reference the variables, so dark mode just works.
const tw = `/* Generated from tokens.json by build-tokens.mjs. Do not edit by hand.
   Import after tailwindcss:  @import "tailwindcss"; @import "./tokens.css"; @import "./tailwind.css"; */
@theme inline {
  --color-*: initial;
${Object.keys(light).map((k) => `  --color-${k}: var(--t-${k});`).join('\n')}

  --font-display: var(--t-font-display);
  --font-sans: var(--t-font-sans);
  --font-mono: var(--t-font-mono);

  --text-*: initial;
${Object.keys(t.type).map((k) => `  --text-${k}: var(--t-text-${k});\n  --text-${k}--line-height: var(--t-text-${k}-line);\n  --text-${k}--font-weight: var(--t-text-${k}-weight);`).join('\n')}

  --radius-*: initial;
${Object.keys(t.radius).map((k) => `  --radius-${k}: var(--t-radius-${k});`).join('\n')}

  --shadow-*: initial;
${Object.keys(t.shadow).map((k) => `  --shadow-${k}: var(--t-shadow-${k});`).join('\n')}

  --spacing: 4px;
  --breakpoint-sm: ${t.layout.breakpoints.sm}px;
  --breakpoint-md: ${t.layout.breakpoints.md}px;
  --container-column: var(--t-column);
  --ease-out: var(--t-ease);
}

/* dark: matches an explicit dark choice, or the OS setting when the user has not picked light */
@custom-variant dark {
  &:where([data-theme=dark], [data-theme=dark] *) { @slot; }
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme=light]) *) { @slot; }
  }
}
`;

writeFileSync(join(here, 'tokens.css'), css);
writeFileSync(join(here, 'tailwind.css'), tw);
// The app keeps its own copy so it builds without reaching outside web/.
const app = join(here, '..', '..', 'web', 'src', 'styles');
if (existsSync(join(app, '..'))) {
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, 'tokens.css'), css);
  writeFileSync(join(app, 'tailwind.css'), tw);
}
console.log('wrote tokens.css and tailwind.css');
