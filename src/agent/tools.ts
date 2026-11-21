import { tool } from "ai"
import { z } from "zod"

const tableNumber = z.number().int().min(1).max(30)

// Client-side tools: no `execute`. The browser turns each call into UI SDK
// `agent.act()` steps on the real components, then reports the floor back.
export const agentTools = {
  consider_tables: tool({
    description:
      "Highlight the tables you are weighing on the floor plan before choosing, so the host can follow your reasoning. Visual only.",
    inputSchema: z.object({
      tables: z.array(tableNumber).min(1).max(6),
      why: z.string().max(80).describe("A few words, e.g. 'free window 6-tops'"),
    }),
  }),
  set_service: tool({
    description: "Switch the Service tabs between lunch and dinner.",
    inputSchema: z.object({ service: z.enum(["lunch", "dinner"]) }),
  }),
  set_date: tool({
    description: "Pick the service date (YYYY-MM-DD) within the allowed range.",
    inputSchema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  }),
  set_party_size: tool({
    description: "Set the Party size filter, which dims tables that are too small. Use 'any' to clear it.",
    inputSchema: z.object({ size: z.enum(["any", "2", "3", "4", "5", "6", "7", "8"]) }),
  }),
  sort_waitlist: tool({
    description: "Reorder the waitlist: 'recent' (newest first), 'longest' (longest wait first) or 'size' (largest party first).",
    inputSchema: z.object({ by: z.enum(["recent", "longest", "size"]) }),
  }),
  select_party: tool({
    description:
      "Select a party by name, from the waitlist (walk-ins) or the reservations list. This is the party the next seating applies to.",
    inputSchema: z.object({ name: z.string().min(1).max(40) }),
  }),
  select_tables: tool({
    description:
      "Select one table, or two mergeable tables (7 + 8, 10 + 11), on the floor plan by number.",
    inputSchema: z.object({ tables: z.array(tableNumber).min(1).max(2) }),
  }),
  seat: tool({
    description:
      "Open the Confirm seating dialog for the selected party and tables, then confirm. mode 'seat' seats them now (walk-ins, or reservations who arrived); mode 'assign' moves a reservation to the selected tables for its booked time.",
    inputSchema: z.object({ mode: z.enum(["seat", "assign"]) }),
  }),
  set_table_status: tool({
    description:
      "Select a table and set its status. 'cleaning' means the party left and it's being reset; 'free' means it's ready. Freeing a seated table ends that party's visit.",
    inputSchema: z.object({ table: tableNumber, status: z.enum(["free", "cleaning"]) }),
  }),
}

export type AgentToolName = keyof typeof agentTools

const name = z.string().max(40)
const notes = z.array(z.string().max(40)).max(6)

export const floorContextSchema = z.object({
  restaurant: z.string().max(60),
  today: z.string().max(10),
  date: z.string().max(10),
  dateRange: z.tuple([z.string().max(10), z.string().max(10)]),
  service: z.enum(["lunch", "dinner"]),
  mode: z.enum(["live", "ended", "planning"]),
  clock: z.string().max(5).nullable(),
  partySize: z.string().max(4),
  waitlistSort: z.enum(["recent", "longest", "size"]),
  selectedParty: name.nullable(),
  selectedTables: z.array(z.number()).max(4),
  tables: z
    .array(
      z.object({
        n: z.number(),
        seats: z.number(),
        zone: z.string().max(10),
        features: notes,
        status: z.enum(["free", "reserved", "seated", "cleaning"]),
        party: z.string().max(80).nullable(),
        next: z.string().max(80).nullable(),
      })
    )
    .max(30),
  waitlist: z
    .array(
      z.object({ name, size: z.number(), waiting: z.number(), quoted: z.number(), notes, best: z.array(z.string().max(8)).max(3) })
    )
    .max(20),
  reservations: z
    .array(
      z.object({
        name,
        size: z.number(),
        time: z.string().max(5),
        tables: z.array(z.number()).max(4),
        status: z.enum(["booked", "seated", "unassigned", "done"]),
        notes,
        best: z.array(z.string().max(8)).max(3),
      })
    )
    .max(30),
})

export type FloorContext = z.infer<typeof floorContextSchema>
