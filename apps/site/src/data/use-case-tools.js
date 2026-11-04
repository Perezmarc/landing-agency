/* The tools each use case connects, for its flow diagram (components/
   ToolFlow.astro): where the work ARRIVES (an inbox, a carrier portal …),
   the agent in the middle, and the systems it WORKS IN (the ERP, the
   accounting …). The lines between them are the connections we build.

   Ids only: each tool's name is copy, in every catalog under
   `flow.tools.<id>`, and its picture is one of the kit's icons. Indexed like
   the catalog (useCases.industries[n].cases[i]), which keeps the same order
   in every language; use-cases.test.js holds the shapes to one another. */

/** Each tool's icon (a name in @forge/ui's ICONS). */
export const TOOL_ICON = {
  email: 'mail',
  documents: 'file',
  photos: 'image',
  forms: 'globe',
  einvoice: 'globe',
  clientPortal: 'globe',
  patientPortal: 'globe',
  carriers: 'truck',
  marketplaces: 'store',
  reviews: 'globe',
  insurers: 'globe',
  supplierFiles: 'folder',
  rates: 'file',
  erp: 'database',
  crm: 'users',
  core: 'database',
  pim: 'database',
  property: 'database',
  pms: 'database',
  practice: 'database',
  records: 'folder',
  quality: 'checklist',
  planning: 'calendar',
  calendar: 'calendar',
  scheduling: 'calendar',
  accounting: 'chart',
  warehouse: 'chart',
  billing: 'billing',
  payments: 'billing',
  bank: 'bank',
  store: 'store',
  helpdesk: 'chat',
  teamChat: 'chat',
  channel: 'globe',
  customs: 'shield',
  screening: 'shield',
  idChecks: 'shield',
  fileStore: 'folder',
}

const flow = (from, to) => ({ from, to })

export const TOOLS = [
  [ // manufacturing
    flow(['email', 'documents'], ['erp']),
    flow(['email'], ['erp', 'planning']),
    flow(['documents', 'email'], ['quality', 'erp']),
    flow(['email', 'einvoice', 'documents'], ['erp', 'accounting']),
  ],
  [ // distribution and logistics
    flow(['carriers'], ['erp', 'helpdesk']),
    flow(['carriers', 'rates'], ['accounting']),
    flow(['email', 'photos'], ['carriers', 'fileStore']),
    flow(['erp'], ['customs', 'fileStore']),
  ],
  [ // retail and e-commerce
    flow(['helpdesk', 'photos'], ['store', 'payments']),
    flow(['supplierFiles'], ['pim', 'store']),
    flow(['helpdesk', 'email'], ['store', 'carriers']),
    flow(['marketplaces', 'bank'], ['accounting']),
  ],
  [ // financial services and insurance
    flow(['email', 'clientPortal'], ['screening', 'crm']),
    flow(['email', 'documents'], ['core', 'crm']),
    flow(['email'], ['idChecks', 'core']),
    flow(['core', 'warehouse'], ['fileStore']),
  ],
  [ // professional services
    flow(['email', 'clientPortal'], ['fileStore', 'practice']),
    flow(['bank', 'documents'], ['accounting']),
    flow(['email'], ['practice', 'fileStore']),
    flow(['calendar', 'email', 'fileStore'], ['practice', 'billing']),
  ],
  [ // real estate
    flow(['email', 'photos'], ['property', 'calendar']),
    flow(['bank'], ['property', 'email']),
    flow(['email', 'documents'], ['property', 'accounting']),
    flow(['property', 'accounting'], ['email']),
  ],
  [ // hospitality and travel
    flow(['email', 'forms'], ['pms', 'crm']),
    flow(['email'], ['channel', 'pms']),
    flow(['channel', 'email'], ['accounting', 'pms']),
    flow(['reviews', 'email'], ['reviews', 'teamChat']),
  ],
  [ // private healthcare
    flow(['records'], ['insurers']),
    flow(['email', 'documents'], ['scheduling']),
    flow(['scheduling'], ['insurers', 'accounting']),
    flow(['email', 'patientPortal'], ['scheduling', 'billing']),
  ],
]

/** The homepage's walkthrough: supplier invoices, from the inbox to the payment run. */
export const EXAMPLE_TOOLS = flow(['email', 'documents'], ['erp', 'bank'])
