import { Stand } from "@/demo/stand"
import "./host.css"

export default function Home() {
  return (
    <main className="md">
      <header className="md-nav">
        <span className="md-brand">
          <svg aria-hidden="true" viewBox="0 0 76 65" width="16" height="14">
            <path d="M37.5 0 75 65H0z" fill="currentColor" />
          </svg>
          <span className="md-slash" aria-hidden="true">/</span>
          maître d&apos;
          <span className="md-slash" aria-hidden="true">/</span>
          <span className="md-muted">ui-sdk demo</span>
        </span>
        <a className="md-link" href="https://ui-sdk.dev/docs" target="_blank" rel="noreferrer">
          ui-sdk.dev/docs ↗
        </a>
      </header>
      <Stand />
      <footer className="md-footer">
        Fictional restaurant, guests and bookings. State lives in your browser; reload to reset. Built with{" "}
        <a href="https://ui-sdk.dev" target="_blank" rel="noreferrer">
          UI SDK
        </a>
        , the AI SDK and Vercel AI Gateway.{" "}
        <a href="https://github.com/Matiaaspoblete/ui-sdk-maitre-d" target="_blank" rel="noreferrer">
          Source
        </a>
      </footer>
    </main>
  )
}
