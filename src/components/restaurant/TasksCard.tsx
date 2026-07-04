'use client'

import { useState } from 'react'
import { Check, Plus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Task } from '@/payload/payload-types'

/**
 * „Mai feladatok" ÉLŐ kártya — Crextio „Onboarding Task" sötét kártya ritmusban:
 * fejléc N/összes + rácsos progress, alatta sor-checkboxok. A tulaj feladatot vehet fel
 * (POST) és pipálhat (PATCH) / törölhet (DELETE) a /api/tasks-on át. Az `restaurantId`
 * scope-olja a hívásokat.
 */
export function TasksCard({ restaurantId, initial }: { restaurantId: string; initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const done = tasks.filter((t) => t.done).length
  const total = tasks.length

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ restaurantId, title: t }),
      })
      const data = (await res.json().catch(() => null)) as { task?: Task; error?: string } | null
      if (!res.ok || !data?.task) throw new Error(data?.error ?? 'hiba')
      setTasks((prev) => [...prev, data.task!])
      setTitle('')
    } catch {
      toast.error('Nem sikerült hozzáadni')
    } finally {
      setAdding(false)
    }
  }

  async function toggle(task: Task) {
    setBusy(String(task.id))
    const next = !task.done
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, done: next } : x)))
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
        body: JSON.stringify({ id: task.id, done: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, done: !next } : x)))
      toast.error('Hiba történt')
    } finally {
      setBusy(null)
    }
  }

  async function remove(task: Task) {
    setBusy(String(task.id))
    const prev = tasks
    setTasks((p) => p.filter((x) => x.id !== task.id))
    try {
      const res = await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(prev)
      toast.error('Nem sikerült törölni')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative h-full">
      {/* réteges „polc" a tetőn (Crextio Onboarding Task) */}
      <div className="pointer-events-none absolute inset-x-4 -top-2 h-9 rounded-[24px] bg-[#33322e]" />
      <div className="relative z-[1] flex h-full flex-col rounded-[26px] bg-ink-dark p-[22px] text-white shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)]">
      <div className="flex items-center justify-between gap-2.5">
        <div className="text-[18px] font-medium">Mai feladatok</div>
        <div className="whitespace-nowrap text-[26px] font-light">
          {done}<span className="text-white/40">/{total}</span>
        </div>
      </div>

      {/* Feladat-sorok — Crextio „Onboarding Task": bal ikon-kör + cím/idő + jobb pipa-kör
          (NEM flex-1, hogy a lista+add fent legyen, az üres tér alul — mint a referencián) */}
      <div className="no-scrollbar mt-3 max-h-[260px] overflow-y-auto" data-lenis-prevent>
        {tasks.length === 0 && (
          <p className="py-6 text-center text-sm text-white/40">Nincs teendő. Vegyél fel egyet lent.</p>
        )}
        {tasks.map((task, idx) => {
          const busyRow = busy === String(task.id)
          const timeLabel = task.due_date
            ? new Date(task.due_date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
            : null
          return (
            <div key={task.id} className="group flex items-center gap-3 border-b border-[#2c2b27] py-[11px] last:border-0">
              {/* BAL: pipálós (gold) kör — toggle */}
              <button
                type="button"
                onClick={() => toggle(task)}
                disabled={busyRow}
                aria-label={task.done ? 'Nem kész' : 'Kész'}
                className="shrink-0"
              >
                {busyRow ? (
                  <Loader2 className="h-[24px] w-[24px] animate-spin text-white/50" />
                ) : task.done ? (
                  <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-gold">
                    <Check className="h-4 w-4 text-ink-dark" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="block h-[24px] w-[24px] rounded-full border-2 border-[#3a3934] transition-colors hover:border-white/40" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[14px] font-medium ${task.done ? 'text-[#8a8880] line-through' : 'text-white'}`}>{task.title}</div>
                {timeLabel ? <div className="text-[11px] font-medium text-[#6a6860]">{timeLabel}</div> : null}
              </div>
              {/* JOBB: törlés X */}
              <button
                type="button"
                onClick={() => remove(task)}
                aria-label="Törlés"
                className="shrink-0 text-white/20 opacity-0 transition-opacity hover:text-white/60 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Hozzáadás — tiszta sor a referencia ritmusában (bal ikon-kör + input + gold +) */}
      <form onSubmit={addTask} className="mt-1 flex items-center gap-3 border-t border-[#2c2b27] pt-3">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#33322e] text-[#cfccc2]">
          <Plus className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Új feladat…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/35 focus:outline-none"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          aria-label="Hozzáadás"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gold text-ink-dark transition-opacity disabled:opacity-40"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </button>
      </form>
      </div>
    </div>
  )
}
