import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Schedulio landing brand-paletta (a kapott design-referenciából).
        // Külön névtér, hogy ne ütközzön a shadcn `accent`/`primary` tokenekkel.
        brand: {
          ink: '#191314',
          accent: '#ecf95a',
          surface: '#f4f4f4',
          bg: '#F4F2EE',
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
        paper: 'var(--dav-paper)',
        line: {
          DEFAULT: 'var(--dav-line)',
          strong: 'var(--dav-line-strong)',
        },
        ok: { DEFAULT: 'var(--dav-ok)', bg: 'var(--dav-ok-bg)' },
        warn: { DEFAULT: 'var(--dav-warn)', bg: 'var(--dav-warn-bg)' },
        bad: { DEFAULT: 'var(--dav-bad)', bg: 'var(--dav-bad-bg)' },
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
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // davelopment-design lekerekítések
        'dav-container': 'var(--dav-r-container)', // 34px külső konténer
        'dav-lg': 'var(--dav-r-lg)',               // 26px nagy kártya
        'dav-md': 'var(--dav-r-md)',               // 18px közepes
        'dav-pill': 'var(--dav-r-pill)',           // 30px pill/chip
      },
      boxShadow: {
        'dav-card': 'var(--dav-shadow-card)',
        'dav-container': 'var(--dav-shadow-container)',
      },
      backgroundImage: {
        'dav-container': 'var(--dav-container-gradient)',
      },
      keyframes: {
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'soft-pulse': 'soft-pulse 1.6s ease-in-out infinite',
        reveal: 'reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'reveal-fade': 'reveal-fade 0.5s ease-out both',
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
