"use client"

import { useSyncExternalStore } from "react"
import { RESTAURANT, todayIn } from "./floor-data"
import { HostStand } from "./host-stand"

const subscribe = () => () => {}

/** Today's date depends on the visitor's clock, so render the stand on the client only. */
export function Stand() {
  const today = useSyncExternalStore(
    subscribe,
    () => todayIn(RESTAURANT.timeZone),
    () => null
  )
  if (!today) return <p className="md-loading">Setting the floor…</p>
  return <HostStand today={today} />
}
