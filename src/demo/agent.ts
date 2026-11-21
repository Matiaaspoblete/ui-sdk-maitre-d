"use client"

import { createAgent } from "@ui-sdk/react/agent"

type Agent = ReturnType<typeof createAgent>

/** Every control the host agent may touch, and how. The bridge refuses anything else. */
export const ALLOWED_ACTIONS = [
  { label: "Service", action: "setValue" },
  { label: "Date", action: "setValue" },
  { label: "Party size", action: "setValue" },
  { label: "Sort by", action: "setValue" },
  { label: "Waitlist", action: "setValue" },
  { label: "Reservations", action: "setValue" },
  { label: "Floor plan", action: "setValue" },
  { label: "Table status", action: "setValue" },
  { label: "Review seating", action: "press" },
  { label: "Confirm seating", action: "press" },
] as const

let agent: Agent | null = null

export function getAgent(): Agent {
  agent ??= createAgent({
    allow: (step) => {
      const ok =
        step.confirm === undefined &&
        ALLOWED_ACTIONS.some((rule) => rule.label === step.label && rule.action === step.action)
      if (!ok && process.env.NODE_ENV !== "production") console.warn("agent refused", step)
      return ok
    },
  })
  return agent
}
