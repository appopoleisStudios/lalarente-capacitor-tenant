/** Plane #94–#97 — lookup + how_this_app_works (no full-context dump). */

export const LALA_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup',
      description:
        "Fetch THIS user's live LalaRente rows. Call before quoting money, dates, statuses, or job names. Do not invent values.",
      parameters: {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'lease',
                'payments',
                'arrears',
                'maintenance',
                'invoices',
                'quotes',
                'purchase_orders',
                'earnings',
                'properties',
              ],
            },
            description: 'Which slices to load. Pick only what the question needs.',
          },
        },
        required: ['topics'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'how_this_app_works',
      description:
        'Explain where to tap in the app (screens/tabs). Use when the user asks how to do something, not for their live numbers.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: [
              'late_rent',
              'pay_rent',
              'pay_vendor',
              'maintenance',
              'invoices',
              'quotes',
              'earnings',
              'lease',
              'screening',
              'lala',
            ],
          },
        },
        required: ['topic'],
      },
    },
  },
];

const SECTION_HEADINGS: Record<string, string[]> = {
  lease: ['LEASES:', 'ACTIVE LEASES:', 'Lease:'],
  payments: ['RENT PAYMENTS:', 'RENT COLLECTIONS:', 'VENDOR PAYMENTS'],
  arrears: ['ARREARS:'],
  maintenance: ['MAINTENANCE'],
  invoices: ['MAINTENANCE INVOICES'],
  quotes: ['QUOTES'],
  purchase_orders: ['PURCHASE ORDERS:'],
  earnings: ['EARNINGS:'],
  properties: ['PROPERTIES:'],
};

export function filterContextByTopics(full: string, topics: string[]): string {
  const wanted = topics.filter((t) => t in SECTION_HEADINGS);
  if (!wanted.length) {
    return 'lookup: pass topics from lease, payments, arrears, maintenance, invoices, quotes, purchase_orders, earnings, properties.';
  }
  const blocks = full.split('\n\n');
  const kept = blocks.filter((block) => {
    const head = block.slice(0, 80);
    return wanted.some((topic) =>
      SECTION_HEADINGS[topic].some((label) => head.includes(label) || block.startsWith(label))
    );
  });
  return kept.length ? kept.join('\n\n') : `No rows for topics: ${wanted.join(', ')}.`;
}

export function howThisAppWorks(role: string, topic: string): string {
  const tenantNav =
    'Tenant tabs are only Home, Search, Payments, Profile, Lala AI. There is no Vendor Payments tab — pay a vendor from Payments.';
  const guides: Record<string, Record<string, string>> = {
    late_rent: {
      tenant:
        'This is how LalaRente behaves, not legal advice. Late rent ladder in-app: friendly reminder after 7 days overdue, formal demand at 14, breach notice at 21 plus a CPA cure window. Interest is only the rate recorded on YOUR lease (lookup lease/arrears) — never invent a rate. Pay from the Payments tab.',
      owner:
        'Same in-app ladder: 7-day friendly, 14-day demand, 21-day breach + cure. Open Arrears on the owner side. Quote recorded lease interest_on_arrears_rate from lookup; do not invent Prescribed Rate figures.',
      vendor: 'Vendors do not run the late-rent process.',
    },
    pay_rent: {
      tenant: `${tenantNav} Pay rent: Payments tab → rent invoice → PayFast checkout.`,
      owner:
        'Rent collection: Rent roll / invoices on the owner dashboard. Tenants pay in their Payments tab.',
      vendor: 'Vendors do not collect rent.',
    },
    pay_vendor: {
      tenant: `${tenantNav} Pay a plumber/vendor invoice from Payments (money hub), not a sixth tab.`,
      owner:
        'Owner-paid vendor invoices: approve on the invoice screen, then pay from owner payments/invoice flow.',
      vendor:
        'You get paid via Earnings after the payer completes PayFast. Bank details: Profile → Earnings & Banking.',
    },
    maintenance: {
      tenant:
        'Report a repair from Home shortcuts → Maintenance (not a tab). Confirm completed work from Reports / verify screen. After 3 rejections the job opens a three-party mediation thread.',
      owner:
        'Maintenance tab: create job, vendor directory, quotes, PO, closure, invoice. Vendor directory is a hidden maintenance screen, not a new tab.',
      vendor: 'Open requests → quote. Assigned jobs → photos → request closure → submit invoice.',
    },
    invoices: {
      tenant:
        'Approve or reject a vendor invoice from the job’s invoice screen. If you disagree, use the in-app maintenance chat, confirm you tried to resolve it there, then escalate to LalaRente — admin decides. Vendor communication stays in the app; do not call, email, or use WhatsApp. This is not a rent payment dispute.',
      owner:
        'Use the in-app maintenance chat from owner invoice approval, confirm both sides tried to resolve it there, then escalate if needed. Vendor communication stays in the app; do not call, email, or use WhatsApp. Admin Invoice cases on the web panel resolve disputed invoices.',
      vendor:
        'Submit the invoice from the job. Use the in-app maintenance chat with the payer; both must confirm they tried to resolve it there before escalation.',
    },
    quotes: {
      tenant:
        'Tenants do not accept quotes; the owner does. You can browse vendors when reporting maintenance.',
      owner: 'Review quotes on the job; accept to issue a purchase order.',
      vendor: 'Submit price + duration from the open request / job detail.',
    },
    earnings: {
      tenant: 'Not applicable.',
      owner: 'Vendor payouts are vendor-side (Earnings & Banking).',
      vendor: 'Earnings & Banking: totals, pending payout, bank details.',
    },
    lease: {
      tenant: 'Lease, renew, end-early live under Home tenancy shortcuts (not a tab).',
      owner:
        'Create/send lease from applications; renewals and early termination from lease screens.',
      vendor: 'Vendors have no lease screen.',
    },
    screening: {
      tenant:
        'Credit/background/ID badges are owner-side. LalaRente does not run TPN/TransUnion/Onfido from the app yet. Owners can mark checks complete after reviewing documents offline.',
      owner:
        'FICA / application screening: mark identity, credit, and background complete or failed after you review documents yourself. No bureau is connected. Do not tell tenants a credit check ran in-app.',
      vendor: 'Not applicable.',
    },
    lala: {
      tenant:
        'Lala AI tab: ask about YOUR lease, rent, jobs. Lala looks up live rows; it cannot pay money or run credit checks.',
      owner:
        'Lala AI tab: ask about properties, rent, maintenance. Confirm any money action yourself in the app.',
      vendor: 'Lala AI tab: jobs, quotes, earnings. It cannot change payouts.',
    },
  };
  const byTopic = guides[topic];
  if (!byTopic) return 'Unknown how_this_app_works topic.';
  return byTopic[role] || byTopic.tenant;
}
