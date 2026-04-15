"use client";

import { AlertTriangle, BatteryCharging, ShieldCheck, Zap } from "lucide-react";

import type { UsageNote } from "@/types/ev-map";

type EvUsageNotesPanelProps = {
  notes: UsageNote[];
};

export function EvUsageNotesPanel({ notes }: EvUsageNotesPanelProps) {
  return (
    <section className="rounded-[2.5rem] bg-white/85 p-6 shadow-[0_30px_56px_rgba(38,50,56,0.1)] backdrop-blur-xl md:p-10">
      <div className="mb-10 max-w-4xl">
        <h2 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Usage & Safety{" "}
          <span className="text-emerald-700 italic">Protocol</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
          Ensuring every charging session is efficient, sustainable, and secure.
          Follow these refined notes before and during charging.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-[2rem] bg-slate-100/85 p-6 lg:col-span-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">
              Tips for using charging stations
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {notes.slice(0, 4).map((note, index) => (
              <article key={note.id} className="rounded-3xl bg-white/85 p-5">
                <p className="text-[11px] font-bold tracking-[0.12em] text-emerald-700 uppercase">
                  Tip {index + 1}
                </p>
                <h4 className="mt-2 text-base font-bold text-slate-900">
                  {note.title}
                </h4>
                <p className="mt-2 text-sm text-slate-600">
                  {note.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-emerald-50/80 p-6 lg:col-span-4">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <BatteryCharging className="h-5 w-5" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            EV Battery maintenance
          </h3>
          <div className="mt-5 space-y-4">
            {notes.slice(0, 3).map((note, index) => (
              <div key={note.id} className="flex gap-3">
                <span className="text-base font-black text-emerald-700">
                  0{index + 1}
                </span>
                <p className="text-sm text-slate-700">{note.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-[2.3rem] bg-slate-900 px-6 py-8 text-white md:px-10 md:py-10">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-[10px] font-black tracking-[0.22em] text-emerald-300 uppercase">
            <ShieldCheck className="h-3.5 w-3.5" />
            Safety standard v2.4
          </p>
          <h3 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Safety guidelines during charging
          </h3>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Critical safety measures to observe at high-voltage charging
            installations.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {notes.slice(0, 3).map((note, index) => (
            <article
              key={note.id}
              className="rounded-3xl border border-slate-700 bg-slate-800/70 p-5"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                {index % 2 === 0 ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
              </div>
              <h4 className="text-base font-bold text-white">{note.title}</h4>
              <p className="mt-2 text-sm text-slate-300">{note.description}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
