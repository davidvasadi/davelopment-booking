import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  blocklist: ['[-:.]'],
  theme: {
    extend: {
      colors: {
        // Schedulio landing brand-paletta (a kapott design-referenciából).
        // Külön névtér, hogy ne ütközzön a shadcn `accent`/`primary` tokenekkel.
        brand: {
          ink: '#3B3B3B',
          accent: '#FFD85F',
          surface: '#ffffff',
          bg: '#F5F5F5',
        },
        // ===== davelopment-design rendszer — az ÚJ admin paletta.
        // A CSS-változókra mutat (globals.css). Migráció közben a shadcn tokenek
        // mellett él; ahogy egy oldal átáll, a régi hivatkozások törlődnek.
        ink: {
          DEFAULT: 'var(--dav-text)',       // fő szöveg
          soft: 'var(--dav-text-muted)',    // halvány
          soft2: 'var(--dav-text-muted2)',
          dark: 'var(--dav-ink)',           // sötét kártya/pill háttér
        },
        gold: 'var(--dav-accent)',
        // ===== UI-alap (2026-10-31) — a /backstage/design mintaoldal palettája. Közvetlen hex (nem
        // CSS-változó), hogy az áttetszőség-módosító (`bg-ui-dark/40`) is működjön. Új / átállított
        // kód CSAK ezeket használja; kézzel írt szín nem kerülhet komponensbe.
        ui: {
          dark: '#383838',
          yellow: '#FFD85F',
          grey: '#B6B6B6',
          text: '#383838',
          muted: '#828282',
          cell: '#EEEEEE',
          divider: 'rgba(120,110,70,.22)',
          ok: { DEFAULT: '#4F7F12', bg: '#E4F0D6', dot: '#74AA19' },
          warn: { DEFAULT: '#9A5A16', bg: '#FBE7D3', dot: '#E2872E' },
          bad: { DEFAULT: '#B0453F', bg: '#FDE2DD', dot: '#C0564A' },
          neutral: { DEFAULT: '#5E5E5E', bg: '#ECECEC' },
        },
        paper: 'var(--dav-paper)',
        line: {
          DEFAULT: 'var(--dav-line)',
          strong: 'var(--dav-line-strong)',
        },
        ok: { DEFAULT: 'var(--dav-ok)', bg: 'var(--dav-ok-bg)', fill: 'var(--dav-ok-fill)' },
        warn: { DEFAULT: 'var(--dav-warn)', bg: 'var(--dav-warn-bg)' },
        bad: { DEFAULT: 'var(--dav-bad)', bg: 'var(--dav-bad-bg)' },
        'track-off': 'var(--dav-track-off)',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontSize: {
        // UI-alap betű-skála (8 lépés) — a mintaoldal szerint.
        'ui-label': ['11px', { lineHeight: '1.4' }],
        'ui-meta': ['12px', { lineHeight: '1.45' }],
        'ui-body': ['13px', { lineHeight: '1.5' }],
        'ui-row': ['15px', { lineHeight: '1.4' }],
        'ui-title': ['19px', { lineHeight: '1.3' }],
        'ui-sub': ['26px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'ui-num': ['34px', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'ui-page': ['42px', { lineHeight: '1', letterSpacing: '-0.03em' }],
        // davelopment-design betűméret-skála — lásd globals.css komment (audit-alapú, 11 lépés).
        'dav-2xs': ['var(--dav-fs-2xs)', { lineHeight: '1.4' }],
        'dav-xs': ['var(--dav-fs-xs)', { lineHeight: '1.4' }],
        'dav-sm': ['var(--dav-fs-sm)', { lineHeight: '1.45' }],
        'dav-base': ['var(--dav-fs-base)', { lineHeight: '1.5' }],
        'dav-md': ['var(--dav-fs-md)', { lineHeight: '1.5' }],
        'dav-lg': ['var(--dav-fs-lg)', { lineHeight: '1.4' }],
        'dav-xl': ['var(--dav-fs-xl)', { lineHeight: '1.3' }],
        'dav-2xl': ['var(--dav-fs-2xl)', { lineHeight: '1.25' }],
        'dav-display-sm': ['var(--dav-fs-display-sm)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'dav-display': ['var(--dav-fs-display)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'dav-display-lg': ['var(--dav-fs-display-lg)', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        // UI-alap lekerekítések: konténer / kártya / kártyán belüli elem / vezérlő (+ rounded-full = pill).
        'ui-container': '34px',
        'ui-card': '26px',
        'ui-inner': '18px',
        'ui-control': '14px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // davelopment-design lekerekítések
        'dav-container': 'var(--dav-r-container)', // 34px külső konténer
        'dav-lg': 'var(--dav-r-lg)',               // 26px nagy kártya
        'dav-md': 'var(--dav-r-md)',               // 18px közepes
        'dav-chip': 'var(--dav-r-chip)',           // 14px kis vezérlő (chip, mező, kis gomb)
        'dav-sm': 'var(--dav-r-sm)',                // 12px legkisebb (ikon-doboz, badge)
        'dav-pill': 'var(--dav-r-pill)',           // 30px pill/chip
      },
      boxShadow: {
        // UI-alap árnyékok: kártya / lebegő (eszköztár, mentés-sáv) / popup.
        'ui-float': '0 18px 40px -16px rgba(0,0,0,.5)',
        'ui-popup': '0 40px 90px -30px rgba(0,0,0,.45)',
        'dav-card': 'var(--dav-shadow-card)',
        'dav-container': 'var(--dav-shadow-container)',
      },
      backgroundImage: {
        'ui-page': 'var(--ui-page-bg)',
        'dav-container': 'var(--dav-container-gradient)',
      },
      keyframes: {
        grain: {
          '0%, 100%': { transform: 'translate(0,0)' },
          '10%':  { transform: 'translate(-2%,-3%)' },
          '20%':  { transform: 'translate(3%,1%)' },
          '30%':  { transform: 'translate(-1%,4%)' },
          '40%':  { transform: 'translate(3%,-2%)' },
          '50%':  { transform: 'translate(-3%,1%)' },
          '60%':  { transform: 'translate(2%,3%)' },
          '70%':  { transform: 'translate(-1%,-3%)' },
          '80%':  { transform: 'translate(3%,2%)' },
          '90%':  { transform: 'translate(-2%,4%)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // Lágy lélegző lüktetés a sürgős foglalás-badge-ekhez
        'soft-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        // Belépő reveal: fade + enyhe felúszás, amikor egy elem a nézetbe kerül
        reveal: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Fade-only reveal: felúszás NÉLKÜL (diagram-blokkokhoz, hogy rajzolás közben ne
        // ugorjon a helyére a konténer — a recharts entry-animációval ütközne).
        'reveal-fade': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        // Szalag: a ki nem férő egysoros szöveg oda-vissza végiggördül (kit Marquee). A cél a doboz (100cqw) és a szöveg
        // (100%) különbsége — ha elfér, 0, vagyis nem mozdul.
        // Rezgés: ütköző nap jelzése (pl. „+ Beosztás” előnézet — beteg / szabadság, ahová nem kerül műszak)
        'ui-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%, 55%': { transform: 'translateX(-3px)' },
          '35%, 75%': { transform: 'translateX(3px)' },
        },
        'ui-marquee': {
          '0%, 20%': { transform: 'translateX(0)' },
          '80%, 100%': { transform: 'translateX(min(0px, calc(100cqw - 100%)))' },
        },
      },
      animation: {
        grain: 'grain 0.5s steps(1) infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'soft-pulse': 'soft-pulse 1.6s ease-in-out infinite',
        reveal: 'reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'reveal-fade': 'reveal-fade 0.5s ease-out both',
        'ui-marquee': 'ui-marquee 7s ease-in-out infinite alternate',
        'ui-shake': 'ui-shake 0.45s ease-in-out 2',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        geist: ['var(--font-geist)', 'sans-serif'],
        martian: ['var(--font-martian)', 'monospace'],
        // davelopment-design fő tipográfia
        onest: ['var(--font-onest)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
