// Mock restaurant for one service at a time. Everything lives on the client.

export const RESTAURANT = {
  name: "Atelier Nord",
  city: "Cluj-Napoca",
  timeZone: "Europe/Bucharest",
} as const

export type Zone = "Window" | "Main" | "Terrace" | "Bar"
export type ServiceName = "lunch" | "dinner"
export type TableStatus = "free" | "reserved" | "seated" | "cleaning"
export type Mode = "live" | "ended" | "planning"

export type TableDef = {
  n: number
  seats: 2 | 4 | 6 | 8
  zone: Zone
  /** Center and size in floor units (1000 × 640). */
  x: number
  y: number
  w: number
  h: number
  round?: boolean
  features: string[]
}

export const FLOOR = { width: 1000, height: 640 } as const

export const ZONES: { zone: Zone; x: number; y: number; w: number; h: number }[] = [
  { zone: "Window", x: 20, y: 20, w: 190, h: 600 },
  { zone: "Main", x: 230, y: 20, w: 360, h: 600 },
  { zone: "Bar", x: 610, y: 20, w: 370, h: 270 },
  { zone: "Terrace", x: 610, y: 310, w: 370, h: 310 },
]

export const TABLES: TableDef[] = [
  { n: 1, seats: 2, zone: "Window", x: 115, y: 85, w: 58, h: 58, round: true, features: ["window", "quiet corner"] },
  { n: 2, seats: 6, zone: "Window", x: 115, y: 220, w: 78, h: 128, features: ["window"] },
  { n: 3, seats: 6, zone: "Window", x: 115, y: 385, w: 78, h: 128, features: ["window", "best view"] },
  { n: 4, seats: 2, zone: "Window", x: 115, y: 545, w: 58, h: 58, round: true, features: ["window"] },
  { n: 5, seats: 4, zone: "Main", x: 315, y: 95, w: 76, h: 76, features: ["step-free", "near entrance"] },
  { n: 6, seats: 4, zone: "Main", x: 505, y: 95, w: 76, h: 76, features: [] },
  { n: 7, seats: 4, zone: "Main", x: 325, y: 240, w: 76, h: 76, features: ["joins table 8"] },
  { n: 8, seats: 4, zone: "Main", x: 403, y: 240, w: 76, h: 76, features: ["joins table 7"] },
  { n: 12, seats: 4, zone: "Main", x: 525, y: 240, w: 76, h: 76, features: ["booth"] },
  { n: 9, seats: 8, zone: "Main", x: 410, y: 395, w: 230, h: 78, features: ["long table"] },
  { n: 10, seats: 2, zone: "Main", x: 330, y: 545, w: 58, h: 58, round: true, features: ["step-free", "near entrance", "joins table 11"] },
  { n: 11, seats: 2, zone: "Main", x: 390, y: 545, w: 58, h: 58, round: true, features: ["joins table 10"] },
  { n: 17, seats: 2, zone: "Bar", x: 700, y: 195, w: 58, h: 58, round: true, features: ["high-top", "bar view"] },
  { n: 18, seats: 2, zone: "Bar", x: 840, y: 195, w: 58, h: 58, round: true, features: ["high-top", "bar view"] },
  { n: 13, seats: 2, zone: "Terrace", x: 690, y: 395, w: 58, h: 58, round: true, features: ["heater"] },
  { n: 14, seats: 4, zone: "Terrace", x: 860, y: 395, w: 76, h: 76, features: ["step-free", "heater", "garden view"] },
  { n: 15, seats: 4, zone: "Terrace", x: 690, y: 545, w: 76, h: 76, features: ["heater"] },
  { n: 16, seats: 6, zone: "Terrace", x: 860, y: 545, w: 128, h: 78, features: ["heater", "garden view"] },
]

/** Pairs that can be pushed together. */
export const MERGES: [number, number][] = [
  [7, 8],
  [10, 11],
]

export const tableId = (n: number) => `t${n}`
export const tableNumber = (id: string) => Number(id.replace(/^t/, ""))
export const tableDef = (n: number) => TABLES.find((table) => table.n === n)

export type SeatedParty = {
  name: string
  size: number
  seatedAt: number
  group: number[]
}

export type TableState = {
  status: "free" | "seated" | "cleaning"
  party?: SeatedParty
}

export type WaitParty = {
  id: string
  name: string
  size: number
  joinedAt: number
  quoted: number
  notes: string[]
}

export type Reservation = {
  id: string
  name: string
  size: number
  time: number
  tables: number[]
  status: "booked" | "seated" | "unassigned" | "done"
  notes: string[]
}

export type ServiceState = {
  mode: Mode
  tables: Record<number, TableState>
  waitlist: WaitParty[]
  reservations: Reservation[]
}

export const SERVICE_HOURS: Record<ServiceName, [number, number]> = {
  lunch: [12 * 60, 15 * 60],
  dinner: [18 * 60, 23 * 60],
}

/** Tonight's dinner runs on a simulated clock that starts at 20:15 and ticks in real time. */
export const SERVICE_CLOCK_START = 20 * 60 + 15

export const hm = (h: number, m = 0) => h * 60 + m

export function formatTime(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** How long a party usually holds a table. */
export function turnMinutes(size: number): number {
  return size <= 2 ? 90 : size <= 4 ? 105 : 120
}

export function course(seatedAt: number, clock: number): string {
  const elapsed = clock - seatedAt
  if (elapsed < 15) return "Just seated"
  if (elapsed < 40) return "Starters"
  if (elapsed < 75) return "Mains"
  if (elapsed < 100) return "Dessert"
  return "Check dropped"
}

export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export function localTime(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(now)
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`)
  )
}

export const serviceKey = (date: string, service: ServiceName) => `${date}:${service}`

function freeTables(): Record<number, TableState> {
  return Object.fromEntries(TABLES.map((table) => [table.n, { status: "free" as const }]))
}

function tonight(): ServiceState {
  const tables = freeTables()
  const seat = (n: number[], name: string, size: number, seatedAt: number) => {
    for (const table of n) tables[table] = { status: "seated", party: { name, size, seatedAt, group: n } }
  }
  seat([1], "Dumitru", 2, hm(19, 40))
  seat([5], "Rusu", 4, hm(19, 55))
  seat([9], "Avram", 8, hm(19, 30))
  seat([11], "Lee", 2, hm(19, 50))
  seat([12], "Marin", 3, hm(18, 50))
  seat([17], "Nagy", 2, hm(20, 5))
  tables[4] = { status: "cleaning" }

  const start = SERVICE_CLOCK_START
  return {
    mode: "live",
    tables,
    waitlist: [
      { id: "w-okafor", name: "Okafor", size: 6, joinedAt: start - 18, quoted: 20, notes: ["asked for a window"] },
      { id: "w-pop", name: "Pop", size: 2, joinedAt: start - 34, quoted: 25, notes: ["accessible seating", "uses a wheelchair"] },
      { id: "w-chen", name: "Chen", size: 4, joinedAt: start - 22, quoted: 15, notes: ["bar is fine"] },
      { id: "w-brennan", name: "Brennan", size: 8, joinedAt: start - 12, quoted: 30, notes: ["high chair"] },
      { id: "w-varga", name: "Varga", size: 2, joinedAt: start - 6, quoted: 10, notes: ["anniversary"] },
    ],
    reservations: [
      { id: "r-marin", name: "Marin", size: 3, time: hm(18, 45), tables: [12], status: "seated", notes: [] },
      { id: "r-avram", name: "Avram", size: 8, time: hm(19, 30), tables: [9], status: "seated", notes: ["regulars"] },
      { id: "r-rusu", name: "Rusu", size: 4, time: hm(19, 45), tables: [5], status: "seated", notes: [] },
      { id: "r-moldovan", name: "Moldovan", size: 4, time: hm(20, 30), tables: [6], status: "booked", notes: ["birthday", "cake at 21:30"] },
      { id: "r-haddad", name: "Haddad", size: 6, time: hm(20, 45), tables: [2], status: "booked", notes: ["window request"] },
      { id: "r-ionescu", name: "Ionescu", size: 4, time: hm(21, 0), tables: [12], status: "booked", notes: ["nut allergy"] },
      { id: "r-weber", name: "Weber", size: 2, time: hm(21, 15), tables: [13], status: "booked", notes: ["terrace, heaters on"] },
      { id: "r-sandu", name: "Sandu", size: 4, time: hm(21, 30), tables: [15], status: "booked", notes: [] },
      { id: "r-florea", name: "Florea", size: 2, time: hm(22, 0), tables: [18], status: "booked", notes: ["high chair"] },
    ],
  }
}

const NAMES = [
  "Popescu", "Ionescu", "Kiss", "Moreau", "Rossi", "Novak", "Schmidt", "Lungu", "Silva", "Tanaka",
  "Petrescu", "Horvath", "Costa", "Dobre", "Müller", "Garcia", "Stan", "Ferreira", "Kowalski", "Barbu",
]
const NOTES = ["birthday", "high chair", "accessible seating", "window request", "anniversary", "gluten-free", "terrace if warm"]

function rng(seed: string) {
  let value = 2166136261
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return () => {
    value = Math.imul(value ^ (value >>> 15), 2246822507)
    value = Math.imul(value ^ (value >>> 13), 3266489909)
    value ^= value >>> 16
    return (value >>> 0) / 4294967296
  }
}

function generated(date: string, service: ServiceName, mode: Mode): ServiceState {
  const random = rng(`${date}:${service}`)
  const [open, close] = SERVICE_HOURS[service]
  const count = 8 + Math.floor(random() * 5)
  const reservations: Reservation[] = []
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    let name = NAMES[Math.floor(random() * NAMES.length)] ?? "Guest"
    if (used.has(name)) name = `${name} ${String.fromCharCode(65 + i)}.`
    used.add(name)
    const size = [2, 2, 2, 4, 4, 4, 6, 3, 5, 8][Math.floor(random() * 10)] ?? 2
    const time = open + Math.floor(random() * ((close - open - 60) / 15)) * 15
    const notes = random() < 0.35 ? [NOTES[Math.floor(random() * NOTES.length)] ?? "birthday"] : []
    reservations.push({ id: `r-${i}`, name, size, time, tables: [], status: "unassigned", notes })
  }
  reservations.sort((a, b) => a.time - b.time)
  for (const reservation of reservations) {
    if (random() < 0.12) continue
    const fit = TABLES.filter((table) => table.seats >= reservation.size && table.seats - reservation.size < 3).find(
      (table) =>
        !reservations.some(
          (other) =>
            other !== reservation &&
            other.tables.includes(table.n) &&
            overlaps(other.time, turnMinutes(other.size), reservation.time, turnMinutes(reservation.size))
        )
    )
    if (fit) {
      reservation.tables = [fit.n]
      reservation.status = mode === "ended" ? "done" : "booked"
    }
  }
  return { mode, tables: freeTables(), waitlist: [], reservations }
}

export function createService(date: string, service: ServiceName, today: string): ServiceState {
  if (date === today && service === "dinner") return tonight()
  return generated(date, service, date === today ? "ended" : "planning")
}

export function overlaps(aStart: number, aLength: number, bStart: number, bLength: number): boolean {
  return aStart < bStart + bLength && bStart < aStart + aLength
}

/** What the floor plan shows for a table. */
export function displayStatus(state: ServiceState, n: number, clock: number): TableStatus {
  const table = state.tables[n]
  if (table?.status === "seated" || table?.status === "cleaning") return table.status
  const held = state.reservations.some(
    (reservation) =>
      reservation.status === "booked" &&
      reservation.tables.includes(n) &&
      (state.mode !== "live" || (reservation.time - clock <= 60 && reservation.time + 20 >= clock))
  )
  return held ? "reserved" : "free"
}

export function nextReservation(state: ServiceState, n: number, clock: number): Reservation | undefined {
  return state.reservations
    .filter(
      (reservation) =>
        reservation.status === "booked" &&
        reservation.tables.includes(n) &&
        (state.mode !== "live" || reservation.time + 20 >= clock)
    )
    .sort((a, b) => a.time - b.time)[0]
}

export type Seating = {
  kind: "waitlist" | "reservation"
  id: string
  name: string
  size: number
  notes: string[]
  /** When the party would use the table. */
  start: number
}

export type Check = { ok: boolean; problems: string[]; warnings: string[]; seats: number }

/** Validate putting a party on tables, now (seat) or at its reservation time (assign). */
export function checkSeating(
  state: ServiceState,
  party: Seating,
  tables: number[],
  clock: number,
  mode: "seat" | "assign"
): Check {
  const problems: string[] = []
  const warnings: string[] = []
  const seats = tables.reduce((sum, n) => sum + (tableDef(n)?.seats ?? 0), 0)
  if (tables.length === 0) problems.push("Pick at least one table.")
  if (tables.length > 2) problems.push("Only two tables can be pushed together.")
  if (tables.length === 2) {
    const [a = 0, b = 0] = [...tables].sort((x, y) => x - y)
    if (!MERGES.some(([x, y]) => x === a && y === b)) problems.push(`Tables ${a} and ${b} can't be pushed together. Mergeable: 7 + 8, 10 + 11.`)
  }
  if (tables.length && seats < party.size) problems.push(`${seats} seats for a party of ${party.size}.`)
  if (tables.length && seats - party.size >= 4) warnings.push(`${seats - party.size} empty seats.`)

  if (state.mode === "ended") problems.push("This service has ended.")
  if (mode === "seat" && state.mode === "planning") problems.push("You can only seat guests during a live service. Assign a table instead.")
  if (mode === "assign" && party.kind === "waitlist") problems.push("Walk-ins are seated, not assigned.")

  const start = mode === "seat" ? clock : party.start
  const length = turnMinutes(party.size)
  for (const n of tables) {
    const table = state.tables[n]
    if (mode === "seat" && table?.status === "seated" && table.party?.name !== party.name) {
      problems.push(`Table ${n} is occupied by ${table.party?.name ?? "another party"}.`)
    }
    if (mode === "seat" && table?.status === "cleaning") problems.push(`Table ${n} is still being cleaned.`)
    if (mode === "assign" && state.mode === "live" && table?.status === "seated" && table.party) {
      const frees = table.party.seatedAt + turnMinutes(table.party.size)
      if (frees > start + 10) warnings.push(`Table ${n} is expected to free up around ${formatTime(frees)}.`)
    }
    for (const reservation of state.reservations) {
      if (reservation.id === party.id || reservation.status !== "booked" || !reservation.tables.includes(n)) continue
      if (overlaps(start, length, reservation.time, turnMinutes(reservation.size))) {
        problems.push(`Table ${n} is held for ${reservation.name} at ${formatTime(reservation.time)}.`)
      }
    }
  }
  return { ok: problems.length === 0, problems, warnings, seats }
}

function preferenceMisses(party: Seating, tables: number[]): number {
  const defs = tables.map((n) => tableDef(n)).filter((d): d is TableDef => Boolean(d))
  const notes = party.notes.join(" ").toLowerCase()
  let misses = 0
  const has = (test: (d: TableDef) => boolean) => defs.some(test)
  if (/window/.test(notes) && !has((d) => d.zone === "Window")) misses++
  if (/accessible|wheelchair|step-free/.test(notes) && !defs.every((d) => d.features.includes("step-free"))) misses += 3
  if (/birthday|terrace/.test(notes) && !has((d) => d.zone === "Terrace")) misses++
  if (/high chair/.test(notes) && has((d) => d.zone === "Bar")) misses += 2
  return misses
}

/** Up to three valid table options for a party, best first: fewest empty seats, then notes. */
export function suggestTables(state: ServiceState, party: Seating, clock: number, mode: "seat" | "assign"): string[] {
  const options: number[][] = [...TABLES.map((t) => [t.n]), ...MERGES.map((pair) => [...pair])]
  return options
    .map((tables) => ({ tables, check: checkSeating(state, party, tables, clock, mode) }))
    .filter((option) => option.check.ok)
    .map((option) => ({
      label: option.tables.join("+"),
      score: (option.check.seats - party.size) + 3 * preferenceMisses(party, option.tables) + (option.tables.length - 1),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((option) => option.label)
}
