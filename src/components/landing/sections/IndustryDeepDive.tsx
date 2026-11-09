import { Reveal, RevealText } from '@/components/landing/Motion'
import type { IndustryLanding } from '@/lib/industryLandings'

/**
 * Iparági landing egyedi szakmai blokkja (`IndustryLanding.deepDive`): címke, cím, bevezető és
 * egy nap története időbélyeges jelenetekben (idővonal). Ez adja az oldal saját, csak rá jellemző tartalmát.
 */
export function IndustryDeepDive({ data }: { data: NonNullable<IndustryLanding['deepDive']> }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-5 lg:py-28">
      <div className="mb-10 grid gap-6 lg:mb-12 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
        <div className="flex flex-col gap-5">
          <Reveal>
            <span className="inline-flex items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]">{data.label}</span>
          </Reveal>
          <RevealText text={data.title} delay={0.1} className="font-semibold text-[clamp(2rem,4.2vw,52px)] leading-[0.98] tracking-[-0.05em] text-brand-ink" />
        </div>
        <Reveal delay={0.25} className="text-[17px] leading-[1.65] text-brand-ink/65">{data.intro}</Reveal>
      </div>
      {/* egy nap története: bal oldalt az időpont, jobbra a jelenet, köztük függőleges vonal */}
      <ol className="relative rounded-[24px] bg-white p-6 lg:p-10">
        {data.scenes.map((sc, i) => (
          <Reveal key={sc.time + sc.title} delay={i * 0.05}>
            <li className="relative grid gap-2 pb-8 last:pb-0 sm:grid-cols-[150px_1fr] sm:gap-8">
              <span className="font-mono text-[13px] font-medium text-brand-ink/45 sm:pt-1">{sc.time}</span>
              <div className="relative border-l border-black/[0.08] pl-6">
                <span aria-hidden className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-brand-ink" />
                <h3 className="text-[clamp(1.15rem,1.6vw,21px)] font-semibold tracking-[-0.03em] text-brand-ink">{sc.title}</h3>
                <p className="mt-1.5 max-w-2xl text-[15.5px] leading-[1.65] text-brand-ink/60">{sc.body}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}
