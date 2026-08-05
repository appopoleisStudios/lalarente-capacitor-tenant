import { useState } from 'react';
import type { VendorEvidence } from '../types/admin';
import { EVIDENCE_STAGE_LABELS, EVIDENCE_EVENT_LABELS } from '../lib/evidenceLabels';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * Photo evidence strip + event timeline for a disputed vendor payment.
 * Collapsible so the dispute queue stays scannable until an admin opens it.
 */
export default function EvidenceGallery({ evidence }: { evidence?: VendorEvidence | null }) {
  const [open, setOpen] = useState(false);

  const photos = evidence?.photos ?? [];
  const timeline = evidence?.timeline ?? [];

  if (photos.length === 0 && timeline.length === 0) {
    return (
      <p className="text-xs text-slate-400">No photo evidence or event history for this job.</p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
        aria-expanded={open}
      >
        <span>
          📷 {photos.length} photo{photos.length !== 1 ? 's' : ''} · {timeline.length} event
          {timeline.length !== 1 ? 's' : ''}
        </span>
        <span>{open ? '▲ Hide evidence' : '▼ Show evidence'}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-3">
          {photos.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Photos</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((p, i) => (
                  <a
                    key={`${p.stage}-${i}`}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <img
                      src={p.url}
                      alt={`${EVIDENCE_STAGE_LABELS[p.stage] || p.stage} photo ${i + 1}`}
                      className="h-16 w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="px-1.5 py-1">
                      <p className="truncate text-[9px] font-medium text-slate-600">
                        {EVIDENCE_STAGE_LABELS[p.stage] || p.stage}
                      </p>
                      <p className="truncate text-[9px] text-slate-400">{fmtDate(p.at)}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Event history</p>
              <ol className="border-l border-slate-200 pl-3">
                {timeline.map((t, i) => (
                  <li key={i} className="relative mb-2 last:mb-0">
                    <span className="absolute -left-[17px] top-0.5 h-2 w-2 rounded-full bg-blue-500" />
                    <p className="text-[11px] font-medium text-slate-700">
                      {EVIDENCE_EVENT_LABELS[t.event] || t.event}
                    </p>
                    {t.note && <p className="text-[11px] text-slate-500">{t.note}</p>}
                    <p className="text-[10px] text-slate-400">{fmtDate(t.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
