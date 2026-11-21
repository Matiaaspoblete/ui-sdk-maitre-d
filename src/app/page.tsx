import { RESTAURANT } from "@/demo/floor-data"
import { Stand } from "@/demo/stand"
import "./host.css"

export default function Home() {
  return (
    <main className="md">
      <header className="md-masthead">
        <div className="md-masthead-inner">
          <div className="md-brand">
            <svg className="md-brand-mark" aria-hidden="true" viewBox="0 0 32 32" width="30" height="30">
              <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
              <path
                d="M16 25V13m0 0c-3.5-.4-6-3-6-6.5 3.5 0 6 2.6 6 6.5Zm0 0c3.5-.4 6-3 6-6.5-3.5 0-6 2.6-6 6.5Zm0 4c-2.4-.2-4.2-2-4.2-4.4 2.4 0 4.2 1.8 4.2 4.4Zm0 0c2.4-.2 4.2-2 4.2-4.4-2.4 0-4.2 1.8-4.2 4.4Z"
                fill="currentColor"
              />
            </svg>
            <span>
              <span className="md-wordmark">{RESTAURANT.name}</span>
              <span className="md-brand-kind">
                {RESTAURANT.kind} · {RESTAURANT.city}
              </span>
            </span>
          </div>
          <p className="md-tagline">{RESTAURANT.tagline}</p>
          <span className="md-masthead-role">Host stand</span>
        </div>
      </header>
      <Stand />
      <footer className="md-footer">
        <p>
          Livada is fictional: the guests, bookings and service clock are a demo, and everything resets when you
          reload.
        </p>
        <p>
          Built with{" "}
          <a href="https://ui-sdk.dev" target="_blank" rel="noreferrer">
            UI SDK
          </a>{" "}
          and the AI SDK ·{" "}
          <a href="https://github.com/Matiaaspoblete/ui-sdk-maitre-d" target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      </footer>
    </main>
  )
}
