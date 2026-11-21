import {
  AccessibilityIcon,
  BabyIcon,
  CakeIcon,
  CircleAlertIcon,
  FlameIcon,
  HeartIcon,
  LeafIcon,
  PanelTopIcon,
  StarIcon,
  WheatOffIcon,
  WineIcon,
  type LucideIcon,
} from "lucide-react"

const RULES: [RegExp, LucideIcon, string][] = [
  [/birthday|cake/i, CakeIcon, "celebration"],
  [/accessible|wheelchair|step-free/i, AccessibilityIcon, "access"],
  [/high chair/i, BabyIcon, "family"],
  [/anniversary/i, HeartIcon, "celebration"],
  [/allergy|gluten/i, WheatOffIcon, "dietary"],
  [/window/i, PanelTopIcon, "seating"],
  [/terrace|heater/i, FlameIcon, "seating"],
  [/bar/i, WineIcon, "seating"],
  [/regular/i, StarIcon, "vip"],
  [/garden/i, LeafIcon, "seating"],
]

/** A guest note as a small icon tag. Decorative: rows carry a screen-reader summary. */
export function NoteTag({ note }: { note: string }) {
  const rule = RULES.find(([test]) => test.test(note))
  const Icon = rule?.[1] ?? CircleAlertIcon
  return (
    <span className="md-tag" data-kind={rule?.[2] ?? "other"}>
      <Icon aria-hidden="true" size={11} strokeWidth={2} />
      {note}
    </span>
  )
}
