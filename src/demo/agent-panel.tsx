"use client"

import { BotIcon, CheckIcon, EyeIcon, LoaderIcon, XIcon } from "lucide-react"

export type AgentCall = { ref: string; action: string; args?: unknown[] }

export type LogEntry = {
  id: string
  text: string
  calls: AgentCall[]
  state: "running" | "done" | "failed"
  error?: string
  visual?: boolean
}

function formatCall(call: AgentCall): string {
  const args = call.args?.length ? `, args: ${JSON.stringify(call.args)}` : ""
  return `{ ref: "${call.ref}", action: "${call.action}"${args} }`
}

export function AgentPanel({
  log,
  running,
  allowed,
}: {
  log: LogEntry[]
  running: boolean
  allowed: readonly { label: string; action: string }[]
}) {
  return (
    <section className="md-card md-agent" aria-label="Agent steps" data-agent-hidden="">
      <div className="md-card-head">
        <span className="md-card-title">
          <BotIcon aria-hidden="true" size={15} />
          agent.act()
        </span>
        <span className="md-pill" data-live={running || undefined}>
          {running ? "running" : log.length ? "idle" : "ready"}
        </span>
      </div>
      {log.length === 0 ? (
        <div className="md-agent-empty">
          <p className="md-muted md-small">Allow-list: the bridge refuses anything else.</p>
          <ul className="md-allow">
            {allowed.map((rule) => (
              <li key={rule.label} className="md-mono md-small">
                <span>{rule.action}</span> {rule.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="md-log" aria-live="polite">
          {log.map((entry) => (
            <li key={entry.id} data-state={entry.state}>
              <span className="md-log-icon" aria-hidden="true">
                {entry.state === "running" ? (
                  <LoaderIcon size={13} className="md-spin" />
                ) : entry.state === "failed" ? (
                  <XIcon size={13} />
                ) : entry.visual ? (
                  <EyeIcon size={13} />
                ) : (
                  <CheckIcon size={13} />
                )}
              </span>
              <div>
                <p>{entry.text}</p>
                {entry.calls.map((call, index) => (
                  <code key={index}>{formatCall(call)}</code>
                ))}
                {entry.error && <p className="md-error">{entry.error}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
