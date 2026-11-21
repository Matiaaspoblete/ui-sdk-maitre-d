import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai"
import { z } from "zod"
import { agentTools, floorContextSchema, type FloorContext } from "@/agent/tools"

export const maxDuration = 30

const AGENT_MODEL = process.env.AGENT_MODEL ?? "openai/gpt-4.1-mini"
const TIME_ZONE = "Europe/Bucharest"

// Abuse limits. In-memory per instance: good enough for a demo, swap for
// Upstash/Redis or Vercel Firewall rate limiting if this ever gets real traffic.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PROMPTS_PER_WINDOW = 8 // new questions per IP
const MAX_REQUESTS_PER_WINDOW = 60 // incl. tool round-trips per IP
const MAX_REQUESTS_PER_DAY = 1500 // whole instance
const MAX_TOOL_CALLS_PER_PROMPT = 10
const MAX_PROMPT_CHARS = 400
const MAX_MESSAGES = 40

const hits = new Map<string, { prompts: number[]; requests: number[] }>()
let day = { key: "", count: 0 }

function limited(ip: string, isPrompt: boolean): string | null {
  const now = Date.now()
  const todayKey = new Date(now).toISOString().slice(0, 10)
  if (day.key !== todayKey) day = { key: todayKey, count: 0 }
  if (day.count >= MAX_REQUESTS_PER_DAY) return "The demo host hit its daily budget. Try again tomorrow."

  const entry = hits.get(ip) ?? { prompts: [], requests: [] }
  entry.prompts = entry.prompts.filter((t) => now - t < WINDOW_MS)
  entry.requests = entry.requests.filter((t) => now - t < WINDOW_MS)
  if (isPrompt && entry.prompts.length >= MAX_PROMPTS_PER_WINDOW) {
    return "You're asking faster than this demo allows. Wait a few minutes and try again."
  }
  if (entry.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    return "Too many agent steps in a short time. Wait a few minutes and try again."
  }
  if (isPrompt) entry.prompts.push(now)
  entry.requests.push(now)
  day.count++
  hits.set(ip, entry)
  if (hits.size > 5000) hits.clear()
  return null
}

const bodySchema = z.object({
  messages: z
    .array(z.custom<UIMessage>((value) => typeof value === "object" && value !== null))
    .min(1)
    .max(MAX_MESSAGES),
  floor: floorContextSchema,
})

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status })
}

function textOf(message: UIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")
}

const list = (items: string[]) => (items.length ? items.join(", ") : "—")

function systemPrompt(floor: FloorContext): string {
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date())
  const tables = floor.tables
    .map(
      (t) =>
        `- Table ${t.n} | ${t.seats} seats | ${t.zone} | ${t.status}${t.party ? ` | ${t.party}` : ""}${t.next ? ` | next: ${t.next}` : ""} | ${list(t.features)}`
    )
    .join("\n")
  const waitlist = floor.waitlist
    .map((w) => `- ${w.name} | party of ${w.size} | waiting ${w.waiting} min (quoted ${w.quoted}) | ${list(w.notes)}`)
    .join("\n")
  const reservations = floor.reservations
    .map(
      (r) =>
        `- ${r.time} ${r.name} | party of ${r.size} | ${r.status}${r.tables.length ? ` on table ${r.tables.join(" + ")}` : " (no table)"} | ${list(r.notes)}`
    )
    .join("\n")

  return `You are the maître d' agent for ${floor.restaurant}, a restaurant in Cluj-Napoca. You run the host stand by operating the real UI through the provided tools; the host watches every step on screen. Don't chat: act, then answer in one or two short sentences saying what you did.

Rules:
- Use as few tool calls as possible. Each tool returns the updated floor.
- Before choosing tables, call consider_tables once with your 1-4 candidates, then select_party, select_tables and seat.
- A party needs enough seats; avoid wasting big tables on small parties. Only 7 + 8 and 10 + 11 can be merged (select both).
- Respect notes: window requests go to Window tables, "accessible" or wheelchair needs a step-free table, birthdays and "terrace" requests suit the Terrace.
- "Free table N for HH:MM" means: if a party is seated there and finishing, set it to cleaning so it's ready for the reservation at that time; if another reservation blocks it, move that one.
- "Move" a reservation = select_party, select_tables, seat with mode "assign". Walk-ins on the waitlist are seated with mode "seat".
- "Best free table" = free (not reserved, seated or cleaning) table that fits the party with the fewest empty seats and matches its notes.
- If a tool returns an error, fix the cause (e.g. pick another table) and retry once; otherwise explain briefly.
- Never invent parties or tables. Refuse anything outside running this floor.

Time: the real local time in Cluj-Napoca is ${now} (Europe/Bucharest) and today is ${floor.today}. ${floor.mode === "live" ? `Tonight's dinner runs on the demo's service clock, now ${floor.clock}; use the service clock for waits and "now".` : floor.mode === "ended" ? "This service has ended: nothing can be seated or assigned." : "This is a future service (planning view): reservations can be assigned to tables, nobody can be seated."}

Current view:
- date ${floor.date} (allowed ${floor.dateRange[0]} to ${floor.dateRange[1]}), service ${floor.service}, mode ${floor.mode}
- party size filter: ${floor.partySize}; waitlist sorted by: ${floor.waitlistSort}
- selected party: ${floor.selectedParty ?? "none"}; selected tables: ${floor.selectedTables.join(" + ") || "none"}

Tables:
${tables}

Waitlist:
${waitlist || "(empty)"}

Reservations:
${reservations || "(none)"}`
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  console.error("Agent route error:", message)
  if (/credit|billing|payment|insufficient|quota/i.test(message)) {
    return "The AI Gateway for this demo is out of credits. Try again later."
  }
  if (/oidc|unauthori[sz]ed|authentication|api key|401|403/i.test(message)) {
    return "The host can't reach the AI Gateway (authentication isn't set up for this deployment)."
  }
  if (/rate|429|too many/i.test(message)) {
    return "The model provider is busy right now. Try again in a moment."
  }
  return "The host hit an error. Try again."
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return fail(400, "That request didn't look right. Reload the page and try again.")
  }

  const { messages, floor } = body
  const last = messages.at(-1)
  const isPrompt = last?.role === "user"
  if (isPrompt && textOf(last).length > MAX_PROMPT_CHARS) {
    return fail(413, `Keep requests under ${MAX_PROMPT_CHARS} characters.`)
  }

  const lastUser = messages.findLastIndex((message) => message.role === "user")
  const toolCalls = messages
    .slice(lastUser + 1)
    .flatMap((message) => message.parts)
    .filter((part) => part.type.startsWith("tool-")).length
  if (toolCalls >= MAX_TOOL_CALLS_PER_PROMPT) {
    return fail(429, "The host took too many steps for one request. Try something more specific.")
  }

  const blocked = limited(ip, isPrompt)
  if (blocked) return fail(429, blocked)

  try {
    const result = streamText({
      model: AGENT_MODEL,
      system: systemPrompt(floor),
      messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES), { tools: agentTools }),
      tools: agentTools,
      stopWhen: stepCountIs(1),
      maxOutputTokens: 400,
      temperature: 0,
    })
    return result.toUIMessageStreamResponse({
      onError: friendlyError,
      messageMetadata: ({ part }) => (part.type === "start" ? { model: AGENT_MODEL } : undefined),
    })
  } catch (error) {
    return fail(500, friendlyError(error))
  }
}
