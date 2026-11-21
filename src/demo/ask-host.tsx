"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai"
import { ArrowUpIcon, LoaderIcon, SparklesIcon, SquareIcon } from "lucide-react"
import { useRef, useState } from "react"
import type { AgentToolName, FloorContext } from "@/agent/tools"

export type ToolResult = { ok: boolean; error?: string; note?: string }

const MAX_TOOL_CALLS = 10

export const EXAMPLES = [
  "Seat the party of 6 by the window and free table 12 for 21:00",
  "Who's been waiting longest? Seat them at the best free table",
  "Move the birthday to the terrace",
  "Merge 7 and 8 for a party of 8",
]

function friendly(error: Error | undefined): string | null {
  if (!error) return null
  try {
    const parsed = JSON.parse(error.message) as { error?: string }
    if (parsed.error) return parsed.error
  } catch {}
  return error.message || "The host hit an error. Try again."
}

export function AskHost({
  getFloor,
  runTool,
  onStart,
  onDone,
}: {
  getFloor: () => FloorContext
  runTool: (name: AgentToolName, input: Record<string, unknown>) => Promise<ToolResult>
  onStart: () => void
  onDone: () => void
}) {
  const [input, setInput] = useState("")
  const toolCalls = useRef(0)

  const { messages, sendMessage, addToolOutput, status, error, stop, clearError } = useChat<UIMessage>({
    id: "maitre-d-agent",
    transport: new DefaultChatTransport({
      api: "/api/agent",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages: messages.slice(-40), floor: getFloor() },
      }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return
      const name = toolCall.toolName as AgentToolName
      toolCalls.current++
      if (toolCalls.current > MAX_TOOL_CALLS) {
        addToolOutput({
          tool: name,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: "Step budget for this request is used up. Answer with what you have.",
        })
        return
      }
      const result = await runTool(name, (toolCall.input ?? {}) as Record<string, unknown>)
      // Let React commit the change before the next request reads the floor.
      await new Promise((resolve) => setTimeout(resolve, 150))
      addToolOutput({ tool: name, toolCallId: toolCall.toolCallId, output: result })
    },
    onFinish: ({ message }) => {
      const done = message.parts.some((part) => part.type === "text" && part.text.trim())
      if (done) onDone()
    },
    onError: () => onDone(),
  })

  const busy = status === "submitted" || status === "streaming"
  const lastUser = messages.findLastIndex((message) => message.role === "user")
  const lastAnswer = messages
    .slice(lastUser + 1)
    .reverse()
    .find((message) => message.role === "assistant" && message.parts.some((part) => part.type === "text" && part.text.trim()))
  const answer = lastAnswer?.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim()
  const errorText = friendly(error)

  function ask(text: string) {
    const question = text.trim()
    if (!question || busy) return
    clearError()
    toolCalls.current = 0
    onStart()
    setInput("")
    void sendMessage({ text: question })
  }

  return (
    <section className="md-ask" aria-label="Ask the host" data-agent-hidden="">
      <form
        className="md-ask-form"
        onSubmit={(event) => {
          event.preventDefault()
          ask(input)
        }}
      >
        <SparklesIcon aria-hidden="true" size={15} className="md-ask-icon" />
        <input
          className="md-ask-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the host: “seat the Okafors by the window”"
          maxLength={400}
          aria-label="Ask the host"
        />
        {busy ? (
          <button type="button" className="md-button md-button-secondary" onClick={() => void stop()}>
            <SquareIcon aria-hidden="true" size={13} /> Stop
          </button>
        ) : (
          <button type="submit" className="md-button md-button-primary" disabled={!input.trim()}>
            <ArrowUpIcon aria-hidden="true" size={14} /> Ask
          </button>
        )}
      </form>
      <div className="md-chips" role="group" aria-label="Example requests">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="md-chip" onClick={() => ask(example)} disabled={busy}>
            {example}
          </button>
        ))}
      </div>
      <div className="md-ask-out" aria-live="polite">
        {errorText ? (
          <p className="md-error">{errorText}</p>
        ) : busy && !answer ? (
          <p className="md-muted md-small">
            <LoaderIcon aria-hidden="true" size={12} className="md-spin" /> Working the floor…
          </p>
        ) : answer ? (
          <p className="md-ask-answer">{answer}</p>
        ) : (
          <p className="md-muted md-small">
            A real model through Vercel AI Gateway. It works only through the allow-listed UI SDK controls, and you
            can watch every step.
          </p>
        )}
      </div>
    </section>
  )
}
