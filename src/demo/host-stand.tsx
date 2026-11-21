"use client"

import { Button } from "@ui-sdk/react/button"
import {
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  DatePickerTrigger,
} from "@ui-sdk/react/date-picker"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog"
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { Tabs, TabsIndicator, TabsList, TabsTab } from "@ui-sdk/react/tabs"
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
  UtensilsCrossedIcon,
} from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { AgentToolName, FloorContext } from "@/agent/tools"
import { AgentPanel, type AgentCall, type LogEntry } from "./agent-panel"
import { ALLOWED_ACTIONS, getAgent } from "./agent"
import { AskHost, type ToolResult } from "./ask-host"
import {
  RESTAURANT,
  SERVICE_CLOCK_START,
  TABLES,
  addDays,
  checkSeating,
  course,
  createService,
  displayStatus,
  formatDate,
  formatTime,
  nextReservation,
  serviceKey,
  tableDef,
  tableId,
  turnMinutes,
  type Seating,
  type ServiceName,
  type ServiceState,
} from "./floor-data"
import { FloorPlan, Legend } from "./floor-plan"

type Sort = "recent" | "longest" | "size"
type Target = "controls" | "floor" | "waitlist" | "reservations" | "inspector"
type PartyRef = { kind: "waitlist" | "reservation"; id: string }

const SIZE_OPTIONS = [
  { value: "any", label: "Any size" },
  ...[2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: `${n} guests` })),
]
const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "longest", label: "Longest wait" },
  { value: "size", label: "Largest party" },
]
const STATUS_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "cleaning", label: "Cleaning" },
  { value: "seated", label: "Seated" },
]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const norm = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** FLIP: animate list rows from their old position when the order changes. */
function useReorderAnimation(order: string) {
  const container = useRef<HTMLDivElement>(null)
  const rects = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const rows = root.querySelectorAll<HTMLElement>("[data-flip]")
    const next = new Map<string, number>()
    for (const row of rows) {
      const key = row.dataset.flip ?? ""
      const top = row.getBoundingClientRect().top
      next.set(key, top)
      const previous = rects.current.get(key)
      if (previous !== undefined && previous !== top && !reducedMotion()) {
        row.animate([{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }], {
          duration: 320,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        })
      }
    }
    rects.current = next
  }, [order])
  return container
}

export function HostStand({ today }: { today: string }) {
  const [loadedAt] = useState(() => Date.now())
  const [tick, setTick] = useState(0)
  const [date, setDate] = useState<string>(today)
  const [service, setService] = useState<ServiceName>("dinner")
  const [services, setServices] = useState<Record<string, ServiceState>>({})
  const [partySize, setPartySize] = useState("any")
  const [sort, setSort] = useState<Sort>("recent")
  const [party, setParty] = useState<PartyRef | null>(null)
  const [tables, setTables] = useState<number[]>([])
  const [considered, setConsidered] = useState<number[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const logSeq = useRef(0)

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now() - loadedAt), 15_000)
    return () => clearInterval(id)
  }, [loadedAt])
  useEffect(() => {
    getAgent()
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const key = serviceKey(date, service)
  const state = services[key] ?? createService(date, service, today)
  const clock = state.mode === "live" ? SERVICE_CLOCK_START + Math.floor(tick / 60_000) : 0
  const sizeFilter = partySize === "any" ? null : Number(partySize)

  function update(fn: (draft: ServiceState) => ServiceState) {
    setServices((all) => ({ ...all, [key]: fn(all[key] ?? createService(date, service, today)) }))
  }

  const waitlist = [...state.waitlist].sort((a, b) =>
    sort === "recent" ? b.joinedAt - a.joinedAt : sort === "longest" ? a.joinedAt - b.joinedAt : b.size - a.size
  )
  const reservations = [...state.reservations].sort((a, b) => a.time - b.time)
  const waitOrder = waitlist.map((w) => w.id).join(",")
  const waitRef = useReorderAnimation(waitOrder)

  const seating: Seating | null = (() => {
    if (!party) return null
    if (party.kind === "waitlist") {
      const w = state.waitlist.find((item) => item.id === party.id)
      return w ? { kind: "waitlist", id: w.id, name: w.name, size: w.size, notes: w.notes, start: clock } : null
    }
    const r = state.reservations.find((item) => item.id === party.id)
    return r ? { kind: "reservation", id: r.id, name: r.name, size: r.size, notes: r.notes, start: r.time } : null
  })()
  const seatCheck = seating ? checkSeating(state, seating, tables, clock, "seat") : null
  const assignCheck = seating?.kind === "reservation" ? checkSeating(state, seating, tables, clock, "assign") : null
  const problems =
    seating?.kind === "reservation"
      ? assignCheck?.ok || seatCheck?.ok
        ? []
        : (assignCheck?.problems ?? [])
      : (seatCheck?.problems ?? [])

  function changeService(next: ServiceName) {
    setService(next)
    setParty(null)
    setTables([])
  }
  function changeDate(next: string) {
    setDate(next)
    setParty(null)
    setTables([])
  }

  function applySeating(mode: "seat" | "assign") {
    if (!seating) return
    const chosen = [...tables]
    update((draft) => {
      if (mode === "assign") {
        return {
          ...draft,
          reservations: draft.reservations.map((r) =>
            r.id === seating.id ? { ...r, tables: chosen, status: "booked" as const } : r
          ),
        }
      }
      const nextTables = { ...draft.tables }
      for (const n of chosen) {
        nextTables[n] = { status: "seated", party: { name: seating.name, size: seating.size, seatedAt: clock, group: chosen } }
      }
      return {
        ...draft,
        tables: nextTables,
        waitlist: draft.waitlist.filter((w) => w.id !== seating.id),
        reservations: draft.reservations.map((r) =>
          r.id === seating.id ? { ...r, tables: chosen, status: "seated" as const } : r
        ),
      }
    })
    setToast(
      mode === "seat"
        ? `Seated ${seating.name} (${seating.size}) at table ${chosen.join(" + ")}`
        : `${seating.name} moved to table ${chosen.join(" + ")} for ${formatTime(seating.start)}`
    )
    setDialogOpen(false)
    setParty(null)
  }

  function setTableStatus(n: number, status: "free" | "cleaning") {
    update((draft) => {
      const current = draft.tables[n]
      const group = current?.party?.group ?? [n]
      const leaving = current?.party?.name
      const nextTables = { ...draft.tables }
      for (const t of group) nextTables[t] = { status }
      return {
        ...draft,
        tables: nextTables,
        reservations: draft.reservations.map((r) =>
          leaving && r.status === "seated" && r.name === leaving ? { ...r, status: "done" as const } : r
        ),
      }
    })
  }

  // ---- Agent: each tool becomes visible UI SDK steps -------------------------

  const context: FloorContext = {
    restaurant: RESTAURANT.name,
    today,
    date,
    dateRange: [today, addDays(today, 13)],
    service,
    mode: state.mode,
    clock: state.mode === "live" ? formatTime(clock) : null,
    partySize,
    waitlistSort: sort,
    selectedParty: seating?.name ?? null,
    selectedTables: tables,
    tables: TABLES.map((t) => {
      const ts = state.tables[t.n]
      const next = nextReservation(state, t.n, clock)
      return {
        n: t.n,
        seats: t.seats,
        zone: t.zone,
        features: t.features.slice(0, 6),
        status: displayStatus(state, t.n, clock),
        party:
          ts?.status === "seated" && ts.party
            ? `${ts.party.name} (${ts.party.size}) since ${formatTime(ts.party.seatedAt)}, ${course(ts.party.seatedAt, clock)}, frees ~${formatTime(ts.party.seatedAt + turnMinutes(ts.party.size))}`
            : null,
        next: next ? `${next.name} (${next.size}) at ${formatTime(next.time)}` : null,
      }
    }),
    waitlist: waitlist.map((w) => ({
      name: w.name,
      size: w.size,
      waiting: Math.max(0, clock - w.joinedAt),
      quoted: w.quoted,
      notes: w.notes.slice(0, 6),
    })),
    reservations: reservations.slice(0, 30).map((r) => ({
      name: r.name,
      size: r.size,
      time: formatTime(r.time),
      tables: r.tables,
      status: r.status,
      notes: r.notes.slice(0, 6),
    })),
  }
  const contextRef = useRef(context)
  useEffect(() => {
    contextRef.current = context
  })
  const stateRef = useRef({ state, seating, tables, clock })
  useEffect(() => {
    stateRef.current = { state, seating, tables, clock }
  })

  async function step(text: string, nextTarget: Target | null, calls: AgentCall[], visual = false): Promise<ToolResult> {
    const id = `s-${logSeq.current++}`
    setTarget(nextTarget)
    setLog((entries) => [...entries, { id, text, calls, state: "running", visual }])
    await sleep(visual ? 250 : 350)
    let error: string | undefined
    for (const [index, call] of calls.entries()) {
      if (index > 0) await sleep(call.action === "press" ? 900 : 420)
      const result = await getAgent().act({ steps: [call] })
      if (!result.ok) {
        error = result.error?.message ?? "The step failed."
        break
      }
    }
    setLog((entries) => entries.map((e) => (e.id === id ? { ...e, state: error ? "failed" : "done", error } : e)))
    await sleep(250)
    setTarget(null)
    return error ? { ok: false, error } : { ok: true }
  }

  async function fail(text: string, error: string): Promise<ToolResult> {
    const id = `s-${logSeq.current++}`
    setLog((entries) => [...entries, { id, text, calls: [], state: "failed", error }])
    return { ok: false, error }
  }

  async function runTool(name: AgentToolName, input: Record<string, unknown>): Promise<ToolResult> {
    setRunning(true)
    const now = stateRef.current
    switch (name) {
      case "consider_tables": {
        const list = (input.tables as number[]).filter((n) => tableDef(n))
        setConsidered(list)
        setTarget("floor")
        const result = await step(`Considering ${list.map((n) => `table ${n}`).join(", ")}: ${String(input.why ?? "")}`, "floor", [], true)
        await sleep(700)
        return result
      }
      case "set_service":
        return step(`Switch to ${String(input.service)}`, "controls", [
          { ref: "Service", action: "setValue", args: [input.service] },
        ])
      case "set_date":
        return step(`Pick ${String(input.date)}`, "controls", [{ ref: "Date", action: "setValue", args: [input.date] }])
      case "set_party_size":
        return step(`Party size: ${String(input.size)}`, "controls", [
          { ref: "Party size", action: "setValue", args: [input.size] },
        ])
      case "sort_waitlist": {
        const label = SORT_OPTIONS.find((o) => o.value === input.by)?.label ?? String(input.by)
        return step(`Sort the waitlist: ${label.toLowerCase()}`, "waitlist", [
          { ref: "Sort by", action: "setValue", args: [input.by] },
        ])
      }
      case "select_party": {
        const query = norm(String(input.name))
        const w = now.state.waitlist.find((item) => norm(item.name).includes(query) || query.includes(norm(item.name)))
        if (w) return step(`Select ${w.name}, party of ${w.size}`, "waitlist", [{ ref: "Waitlist", action: "setValue", args: [w.id] }])
        const r = now.state.reservations.find(
          (item) => item.status !== "done" && (norm(item.name).includes(query) || query.includes(norm(item.name)))
        )
        if (r)
          return step(`Select ${r.name}'s ${formatTime(r.time)} reservation`, "reservations", [
            { ref: "Reservations", action: "setValue", args: [r.id] },
          ])
        const names = [...now.state.waitlist.map((x) => x.name), ...now.state.reservations.map((x) => x.name)]
        return fail(`Find “${String(input.name)}”`, `No party named “${String(input.name)}”. Parties: ${names.join(", ")}.`)
      }
      case "select_tables": {
        const list = (input.tables as number[]).filter((n) => tableDef(n))
        if (!list.length) return fail("Select tables", "Those tables aren't on this floor (1–18).")
        setConsidered((c) => c.filter((n) => !list.includes(n)))
        return step(`Pick table ${list.join(" + ")}`, "floor", [
          { ref: "Floor plan", action: "setValue", args: [list.map(tableId)] },
        ])
      }
      case "seat": {
        const mode = input.mode === "assign" ? "assign" : "seat"
        const { seating: s, tables: chosen, state: st, clock: c } = now
        if (!s) return fail("Review seating", "Select a party first.")
        if (!chosen.length) return fail("Review seating", "Select a table first.")
        const check = checkSeating(st, s, chosen, c, mode)
        if (!check.ok) {
          const result = await step(`Review ${s.name} at table ${chosen.join(" + ")}`, "inspector", [
            { ref: "Review seating", action: "press" },
          ])
          await sleep(1400)
          setDialogOpen(false)
          return { ok: false, error: result.error ?? check.problems.join(" ") }
        }
        const button = mode === "seat" ? "Seat now" : "Assign table"
        const done = await step(
          mode === "seat"
            ? `Seat ${s.name} (${s.size}) at table ${chosen.join(" + ")}`
            : `Move ${s.name} to table ${chosen.join(" + ")} for ${formatTime(s.start)}`,
          "inspector",
          [
            { ref: "Review seating", action: "press" },
            { ref: "Confirm seating", action: "press", args: [button] },
          ]
        )
        return done.ok
          ? {
              ok: true,
              note:
                mode === "seat"
                  ? `${s.name} (${s.size}) is seated at table ${chosen.join(" + ")}. If that was the request, answer now.`
                  : `${s.name} now holds table ${chosen.join(" + ")} at ${formatTime(s.start)}. If that was the request, answer now.`,
            }
          : done
      }
      case "set_table_status": {
        const n = Number(input.table)
        if (!tableDef(n)) return fail(`Table ${n}`, "That table isn't on this floor.")
        const status = input.status === "cleaning" ? "cleaning" : "free"
        const done = await step(`Mark table ${n} ${status === "free" ? "free" : "for cleaning"}`, "inspector", [
          { ref: "Floor plan", action: "setValue", args: [[tableId(n)]] },
          { ref: "Table status", action: "setValue", args: [status] },
        ])
        return done.ok ? { ok: true, note: `Table ${n} is now ${status}.` } : done
      }
    }
  }

  // Dev-only hook so the tool path can be exercised without a model.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as { __runTool?: typeof runTool; __snapshot?: () => unknown }
    w.__runTool = runTool
    w.__snapshot = () => getAgent().snapshot()
  })

  // ---- Render ---------------------------------------------------------------

  const single = tables.length === 1 ? tables[0] : undefined
  const singleState = single !== undefined ? state.tables[single] : undefined
  const selectedDefs = tables.map((n) => tableDef(n)).filter((d) => d !== undefined)
  const seatsSelected = selectedDefs.reduce((sum, d) => sum + d.seats, 0)
  const counts = TABLES.reduce(
    (acc, t) => {
      acc[displayStatus(state, t.n, clock)]++
      return acc
    },
    { free: 0, reserved: 0, seated: 0, cleaning: 0 }
  )
  const covers = TABLES.reduce((sum, t) => {
    const p = state.tables[t.n]?.party
    return sum + (p && p.group[0] === t.n ? p.size : 0)
  }, 0)

  return (
    <div className="md-stand">
      <section className="md-hero">
        <div>
          <p className="md-eyebrow">
            <span className="md-pill">UI SDK beta</span>
            <span className="md-muted">
              {RESTAURANT.name} · {RESTAURANT.city} · mock data
            </span>
          </p>
          <h1 className="md-title">The maître d&apos; is an agent.</h1>
          <p className="md-lede">
            A host stand built with Vercel&apos;s UI SDK. You can run the floor with the keyboard; the agent runs the
            same components through <code>createAgent</code>, step by step, where you can see it.
          </p>
        </div>
      </section>

      <AskHost
        getFloor={() => contextRef.current}
        runTool={runTool}
        onStart={() => {
          setLog([])
          setConsidered([])
          setRunning(true)
        }}
        onDone={() => {
          setRunning(false)
          setConsidered([])
          setTarget(null)
        }}
      />

      <section className="md-controls" aria-label="Filters" data-agent-target={target === "controls" || undefined}>
        <Tabs value={service} onValueChange={(value) => value && changeService(value as ServiceName)}>
          <TabsList aria-label="Service" className="md-tabs">
            <TabsTab value="lunch" className="md-tab">
              <SunIcon aria-hidden="true" size={14} />
              Lunch
            </TabsTab>
            <TabsTab value="dinner" className="md-tab">
              <MoonIcon aria-hidden="true" size={14} />
              Dinner
            </TabsTab>
            <TabsIndicator className="md-tab-indicator" />
          </TabsList>
        </Tabs>

        <div className="md-field">
          <DatePicker
            value={date}
            onValueChange={(value) => typeof value === "string" && changeDate(value)}
            min={today}
            max={addDays(today, 13)}
            locale="en-GB"
          >
            <div className="md-input-row">
              <DatePickerInput className="md-input" aria-label="Date" />
              <DatePickerTrigger className="md-icon-button" aria-label="Open calendar">
                <CalendarIcon aria-hidden="true" size={14} />
              </DatePickerTrigger>
            </div>
            <DatePickerContent className="md-popup md-calendar" sideOffset={6} align="start">
              <div className="md-calendar-head">
                <CalendarPrevious className="md-icon-button" aria-label="Previous month">
                  <ChevronLeftIcon aria-hidden="true" size={14} />
                </CalendarPrevious>
                <CalendarHeading className="md-calendar-title" />
                <CalendarNext className="md-icon-button" aria-label="Next month">
                  <ChevronRightIcon aria-hidden="true" size={14} />
                </CalendarNext>
              </div>
              <CalendarGrid className="md-calendar-grid">
                <CalendarWeekdays>{(index) => <CalendarWeekday index={index} className="md-weekday" />}</CalendarWeekdays>
                <CalendarWeeks>{(cell) => <CalendarDay value={cell.date} className="md-day" />}</CalendarWeeks>
              </CalendarGrid>
            </DatePickerContent>
          </DatePicker>
        </div>

        <div className="md-field md-field-inline">
          <Select value={partySize} onValueChange={(value) => setPartySize((value as string | null) ?? "any")} items={SIZE_OPTIONS}>
            <SelectLabel className="md-label">Party size</SelectLabel>
            <SelectTrigger className="md-input md-select">
              <UsersIcon aria-hidden="true" size={14} />
              <SelectValue />
              <ChevronDownIcon aria-hidden="true" size={14} />
            </SelectTrigger>
            <SelectContent className="md-popup md-options" sideOffset={6} align="start">
              {SIZE_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value} className="md-option">
                  {item.label}
                  <SelectItemIndicator className="md-check">
                    <CheckIcon aria-hidden="true" size={14} />
                  </SelectItemIndicator>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="md-clock md-mono" aria-live="off">
          <ClockIcon aria-hidden="true" size={14} />
          {state.mode === "live" ? (
            <>
              {formatTime(clock)} <span className="md-muted">service clock</span>
            </>
          ) : state.mode === "ended" ? (
            <span className="md-muted">Service ended</span>
          ) : (
            <span className="md-muted">Planning · {formatDate(date)}</span>
          )}
        </p>
      </section>

      <div className="md-grid">
        <div className="md-main">
          <section className="md-card md-floor-card" aria-labelledby="md-floor-title" data-agent-target={target === "floor" || undefined}>
            <div className="md-card-head">
              <h2 id="md-floor-title" className="md-card-title">
                <UtensilsCrossedIcon aria-hidden="true" size={15} />
                Floor · {formatDate(date)} · {service === "dinner" ? "Dinner" : "Lunch"}
              </h2>
              <span className="md-muted md-small md-mono">
                {counts.free} free · {counts.reserved} held · {counts.seated} seated · {covers} covers
              </span>
            </div>
            <div className="md-floor-scroll">
              <FloorPlan
                state={state}
                clock={clock}
                selected={tables}
                onSelect={setTables}
                considered={considered}
                partySize={sizeFilter}
                agentPicking={running}
              />
            </div>
            <div className="md-floor-foot">
              <Legend />
              <span className="md-muted md-small">Arrows move, Space selects, ⌘/Ctrl adds a table.</span>
            </div>
          </section>

          <section className="md-card md-inspector" aria-label="Selection" data-agent-target={target === "inspector" || undefined}>
            <div className="md-inspector-body">
              <div>
                <p className="md-label">Party</p>
                <p className="md-strong">
                  {seating ? (
                    <>
                      {seating.name} <span className="md-muted">· {seating.size} guests</span>
                    </>
                  ) : (
                    <span className="md-muted">Pick from the waitlist or reservations</span>
                  )}
                </p>
              </div>
              <div>
                <p className="md-label">Tables</p>
                <p className="md-strong">
                  {tables.length ? (
                    <>
                      {tables.join(" + ")}{" "}
                      <span className="md-muted">
                        · {seatsSelected} seats · {[...new Set(selectedDefs.map((d) => d.zone))].join(", ")}
                      </span>
                    </>
                  ) : (
                    <span className="md-muted">Pick on the floor plan</span>
                  )}
                </p>
              </div>
              {single !== undefined && (
                <div className="md-field">
                  <Select
                    value={singleState?.status ?? "free"}
                    onValueChange={(value) =>
                      (value === "free" || value === "cleaning") && setTableStatus(single, value)
                    }
                    items={STATUS_OPTIONS}
                  >
                    <SelectLabel className="md-label">Table status</SelectLabel>
                    <SelectTrigger className="md-input md-select md-select-sm">
                      <SelectValue />
                      <ChevronDownIcon aria-hidden="true" size={14} />
                    </SelectTrigger>
                    <SelectContent className="md-popup md-options" sideOffset={6} align="start">
                      {STATUS_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value} className="md-option" disabled={item.value === "seated"}>
                          {item.label}
                          <SelectItemIndicator className="md-check">
                            <CheckIcon aria-hidden="true" size={14} />
                          </SelectItemIndicator>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger className="md-button md-button-primary" disabled={!seating || tables.length === 0}>
                Review seating
              </DialogTrigger>
              <DialogBackdrop className="md-backdrop" />
              <DialogContent className="md-dialog">
                <DialogTitle className="md-dialog-title">Confirm seating</DialogTitle>
                <DialogDescription className="md-muted">
                  {seating
                    ? `${seating.name}, party of ${seating.size}${seating.kind === "reservation" ? `, booked ${formatTime(seating.start)}` : ", walk-in"}`
                    : "Nothing selected"}
                </DialogDescription>
                {seating && (
                  <div className="md-dialog-body">
                    <div className="md-dialog-tables" aria-hidden="true">
                      {selectedDefs.map((d) => (
                        <span key={d.n} className="md-dialog-table">
                          <strong>{d.n}</strong>
                          <span>
                            {d.seats} · {d.zone}
                          </span>
                        </span>
                      ))}
                    </div>
                    <p className="md-small">
                      Table {tables.join(" + ")} · {seatsSelected} seats · {selectedDefs.map((d) => d.zone).join(", ")}
                      {tables.length === 2 ? " · pushed together" : ""}
                    </p>
                    {seating.notes.length > 0 && (
                      <ul className="md-notes">
                        {seating.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    )}
                    {problems.map((problem) => (
                      <p key={problem} className="md-warn" data-tone="red">
                        <AlertTriangleIcon aria-hidden="true" size={13} /> {problem}
                      </p>
                    ))}
                    {seating.kind === "reservation" && assignCheck?.ok && !seatCheck?.ok && state.mode === "live" && (
                      <p className="md-small md-muted">Can&apos;t seat now: {seatCheck?.problems[0]}</p>
                    )}
                    {[...new Set([...(seatCheck?.warnings ?? []), ...(assignCheck?.warnings ?? [])])].map((warning) => (
                      <p key={warning} className="md-warn">
                        <AlertTriangleIcon aria-hidden="true" size={13} /> {warning}
                      </p>
                    ))}
                  </div>
                )}
                <div className="md-dialog-actions">
                  <DialogClose className="md-button md-button-secondary">Cancel</DialogClose>
                  {seating?.kind === "reservation" && (
                    <Button
                      className="md-button md-button-secondary"
                      disabled={!assignCheck?.ok}
                      onClick={() => applySeating("assign")}
                    >
                      Assign table
                    </Button>
                  )}
                  <Button className="md-button md-button-primary" disabled={!seatCheck?.ok} onClick={() => applySeating("seat")}>
                    Seat now
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </section>
        </div>

        <aside className="md-side">
          <section className="md-card" aria-labelledby="md-wait-title" data-agent-target={target === "waitlist" || undefined}>
            <div className="md-card-head">
              <h2 id="md-wait-title" className="md-card-title">
                Waitlist <span className="md-count">{waitlist.length}</span>
              </h2>
              <Select value={sort} onValueChange={(value) => value && setSort(value as Sort)} items={SORT_OPTIONS}>
                <SelectLabel className="md-sr">Sort by</SelectLabel>
                <SelectTrigger className="md-input md-select md-select-sm">
                  <SelectValue />
                  <ChevronDownIcon aria-hidden="true" size={13} />
                </SelectTrigger>
                <SelectContent className="md-popup md-options" sideOffset={6} align="end">
                  {SORT_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value} className="md-option">
                      {item.label}
                      <SelectItemIndicator className="md-check">
                        <CheckIcon aria-hidden="true" size={14} />
                      </SelectItemIndicator>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {waitlist.length === 0 ? (
              <p className="md-empty">
                {state.mode === "live" ? "Nobody waiting." : "The waitlist opens during service."}
              </p>
            ) : (
              <div ref={waitRef}>
                <Listbox
                  aria-label="Waitlist"
                  className="md-list"
                  value={party?.kind === "waitlist" ? party.id : null}
                  onValueChange={(value) => setParty(value ? { kind: "waitlist", id: value as string } : null)}
                >
                  {waitlist.map((w) => {
                    const waited = Math.max(0, clock - w.joinedAt)
                    const late = waited > w.quoted
                    return (
                      <ListboxItem key={w.id} value={w.id} label={w.name} className="md-row" data-flip={w.id}>
                        <span className="md-sr">
                          {`${w.name}, party of ${w.size}, waiting ${waited} min, quoted ${w.quoted}${w.notes.length ? `, ${w.notes.join(", ")}` : ""}`}
                        </span>
                        <span className="md-row-main" aria-hidden="true">
                          <span className="md-strong">{w.name}</span>
                          <span className="md-size">
                            <UsersIcon aria-hidden="true" size={12} />
                            {w.size}
                          </span>
                        </span>
                        <span className="md-row-meta" aria-hidden="true">
                          <span className="md-mono" data-late={late || undefined}>
                            {waited} min
                          </span>
                          <span className="md-muted"> / {w.quoted} quoted</span>
                        </span>
                        {w.notes.length > 0 && (
                          <span className="md-tags" aria-hidden="true">
                            {w.notes.map((note) => (
                              <span key={note} className="md-tag">
                                {note}
                              </span>
                            ))}
                          </span>
                        )}
                      </ListboxItem>
                    )
                  })}
                </Listbox>
              </div>
            )}
          </section>

          <section className="md-card" aria-labelledby="md-res-title" data-agent-target={target === "reservations" || undefined}>
            <div className="md-card-head">
              <h2 id="md-res-title" className="md-card-title">
                Reservations <span className="md-count">{reservations.length}</span>
              </h2>
              <span className="md-muted md-small">{service === "dinner" ? "Dinner" : "Lunch"}</span>
            </div>
            <Listbox
              aria-label="Reservations"
              className="md-list md-timeline"
              value={party?.kind === "reservation" ? party.id : null}
              onValueChange={(value) => setParty(value ? { kind: "reservation", id: value as string } : null)}
            >
              {reservations.map((r) => (
                <ListboxItem key={r.id} value={r.id} label={r.name} className="md-row md-res" data-status={r.status}>
                  <span className="md-sr">
                    {`${r.name}, party of ${r.size}, ${formatTime(r.time)}, ${
                      r.status === "unassigned" ? "needs a table" : `${r.status} table ${r.tables.join(" and ")}`
                    }${r.notes.length ? `, ${r.notes.join(", ")}` : ""}`}
                  </span>
                  <span className="md-res-time md-mono" aria-hidden="true">{formatTime(r.time)}</span>
                  <span className="md-res-dot" aria-hidden="true" />
                  <span className="md-res-body" aria-hidden="true">
                    <span className="md-row-main">
                      <span className="md-strong">{r.name}</span>
                      <span className="md-size">
                        <UsersIcon aria-hidden="true" size={12} />
                        {r.size}
                      </span>
                    </span>
                    <span className="md-row-meta md-muted">
                      {r.status === "unassigned"
                        ? "Needs a table"
                        : `${r.status === "seated" ? "Seated" : r.status === "done" ? "Done" : "Table"} ${r.tables.join(" + ")}`}
                      {r.notes.length > 0 ? ` · ${r.notes.join(", ")}` : ""}
                    </span>
                  </span>
                </ListboxItem>
              ))}
            </Listbox>
          </section>

          <AgentPanel log={log} running={running} allowed={ALLOWED_ACTIONS} />
        </aside>
      </div>

      <div className="md-toast" role="status" data-show={toast ? "" : undefined}>
        {toast}
      </div>
    </div>
  )
}
