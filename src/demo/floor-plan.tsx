"use client"

import { Listbox, ListboxItem } from "@ui-sdk/react/listbox"
import type { CSSProperties } from "react"
import {
  FLOOR,
  MERGES,
  TABLES,
  ZONES,
  course,
  displayStatus,
  formatTime,
  nextReservation,
  tableDef,
  tableId,
  tableNumber,
  type ServiceState,
  type TableDef,
  type TableStatus,
} from "./floor-data"

const pct = (value: number, of: number) => `${(value / of) * 100}%`

function box(x: number, y: number, w: number, h: number): CSSProperties {
  return {
    left: pct(x - w / 2, FLOOR.width),
    top: pct(y - h / 2, FLOOR.height),
    width: pct(w, FLOOR.width),
    height: pct(h, FLOOR.height),
  }
}

/** Chair positions as percentages of the table's own box. */
function chairs(table: TableDef): { left: string; top: string }[] {
  const out: { left: string; top: string }[] = []
  const along = (count: number, fixed: "top" | "bottom" | "left" | "right") => {
    for (let i = 0; i < count; i++) {
      const t = `${((i + 1) / (count + 1)) * 100}%`
      if (fixed === "top") out.push({ left: t, top: "-17%" })
      if (fixed === "bottom") out.push({ left: t, top: "117%" })
      if (fixed === "left") out.push({ left: "-17%", top: t })
      if (fixed === "right") out.push({ left: "117%", top: t })
    }
  }
  const tall = table.h > table.w
  if (table.seats === 2) {
    along(1, tall ? "left" : "top")
    along(1, tall ? "right" : "bottom")
  } else if (table.seats === 4) {
    along(1, "top")
    along(1, "bottom")
    along(1, "left")
    along(1, "right")
  } else {
    const side = (table.seats - 2) / 2
    if (tall) {
      along(side, "left")
      along(side, "right")
      along(1, "top")
      along(1, "bottom")
    } else {
      along(side, "top")
      along(side, "bottom")
      along(1, "left")
      along(1, "right")
    }
  }
  return out
}

const STATUS_LABEL: Record<TableStatus, string> = {
  free: "Free",
  reserved: "Reserved",
  seated: "Seated",
  cleaning: "Cleaning",
}

export function fitsParty(table: TableDef, size: number | null): boolean {
  if (size === null || table.seats >= size) return true
  return MERGES.some(
    ([a, b]) => (a === table.n || b === table.n) && (tableDef(a)?.seats ?? 0) + (tableDef(b)?.seats ?? 0) >= size
  )
}

export function FloorPlan({
  state,
  clock,
  selected,
  onSelect,
  considered,
  partySize,
  agentPicking,
}: {
  state: ServiceState
  clock: number
  selected: number[]
  onSelect: (tables: number[]) => void
  considered: number[]
  partySize: number | null
  agentPicking: boolean
}) {
  // Outlines for tables pushed together: seated groups and a selected pair.
  const groups: number[][] = []
  for (const table of TABLES) {
    const group = state.tables[table.n]?.party?.group
    if (group && group.length > 1 && group[0] === table.n) groups.push(group)
  }
  if (selected.length === 2 && !groups.some((g) => g.join() === selected.join())) groups.push(selected)

  return (
    <div className="md-floor" data-mode={state.mode}>
      <div className="md-floor-layer" aria-hidden="true">
        {ZONES.map((zone) => (
          <div
            key={zone.zone}
            className="md-zone"
            data-zone={zone.zone}
            style={box(zone.x + zone.w / 2, zone.y + zone.h / 2, zone.w, zone.h)}
          >
            <span>{zone.zone}</span>
          </div>
        ))}
        <div className="md-bar-counter" style={box(795, 62, 330, 34)} />
        <div className="md-window-glass" style={box(26, 320, 4, 560)} />
        <div className="md-door" style={box(410, 628, 90, 6)}>
          <span>Entrance</span>
        </div>
        {groups.map((group) => {
          const defs = group.map((n) => tableDef(n)).filter((d): d is TableDef => Boolean(d))
          const left = Math.min(...defs.map((d) => d.x - d.w / 2)) - 22
          const right = Math.max(...defs.map((d) => d.x + d.w / 2)) + 22
          const top = Math.min(...defs.map((d) => d.y - d.h / 2)) - 22
          const bottom = Math.max(...defs.map((d) => d.y + d.h / 2)) + 22
          return (
            <div
              key={group.join("+")}
              className="md-merge"
              style={box((left + right) / 2, (top + bottom) / 2, right - left, bottom - top)}
            />
          )
        })}
      </div>

      <Listbox
        multiple
        aria-label="Floor plan"
        className="md-floor-tables"
        value={selected.map(tableId)}
        onValueChange={(value) => onSelect((value as string[]).map(tableNumber).sort((a, b) => a - b))}
      >
        {TABLES.map((table) => {
          const status = displayStatus(state, table.n, clock)
          const party = state.tables[table.n]?.party
          const next = nextReservation(state, table.n, clock)
          const detail =
            status === "seated" && party
              ? table.round
                ? party.name
                : `${party.name} · ${course(party.seatedAt, clock)}`
              : status === "reserved" && next
                ? table.round
                  ? formatTime(next.time)
                  : `${next.name} ${formatTime(next.time)}`
                : status === "cleaning"
                  ? "Resetting"
                  : table.round
                    ? `${table.seats} top`
                    : `${table.seats} seats`
          const description = [
            `Table ${table.n}`,
            `${table.seats} seats`,
            table.zone,
            STATUS_LABEL[status],
            status === "seated" && party ? `${party.name}, party of ${party.size}` : null,
            next ? `next ${next.name} at ${formatTime(next.time)}` : null,
          ]
            .filter(Boolean)
            .join(", ")
          return (
            <ListboxItem
              key={table.n}
              value={tableId(table.n)}
              label={`Table ${table.n}`}
              className="md-table"
              data-status={status}
              data-round={table.round || undefined}
              data-considered={considered.includes(table.n) || undefined}
              data-picked={(agentPicking && selected.includes(table.n)) || undefined}
              data-dim={!fitsParty(table, partySize) || undefined}
              style={box(table.x, table.y, table.w, table.h)}
            >
              <span className="md-sr">{description}</span>
              <span className="md-chairs" aria-hidden="true">
                {chairs(table).map((chair, index) => (
                  <span key={index} className="md-chair" style={chair} />
                ))}
              </span>
              <span className="md-table-n" aria-hidden="true">
                {table.n}
              </span>
              <span className="md-table-detail" aria-hidden="true">
                {detail}
              </span>
            </ListboxItem>
          )
        })}
      </Listbox>
    </div>
  )
}

export function Legend() {
  return (
    <ul className="md-legend" aria-label="Legend">
      {(Object.keys(STATUS_LABEL) as TableStatus[]).map((status) => (
        <li key={status}>
          <span className="md-legend-dot" data-status={status} aria-hidden="true" />
          {STATUS_LABEL[status]}
        </li>
      ))}
    </ul>
  )
}
