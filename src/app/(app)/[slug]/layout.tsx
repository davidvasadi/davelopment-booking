import { ForceLightTheme } from '@/components/ForceLightTheme'

/**
 * A publikus [slug] aloldalak (profil, /book, /cancel, /feltetelek) mindig
 * világosak — a látogató rendszer-dark-módja ne befolyásolja a foglaló-felületet.
 * (A dashboard/admin marad dark-aware a (app) layout globális providere alatt.)
 */
export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return <ForceLightTheme>{children}</ForceLightTheme>
}
