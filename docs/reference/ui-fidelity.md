# Don't improve it

Meemaw.tv is built for non-technical viewers. Its interface deliberately follows the conventions that a decade of mainstream streaming apps has taught everyone: a hero billboard, poster rows, hover cards, a detail modal, a dark full-screen player. That familiarity is the entire UX strategy. It's also the accessibility strategy. The pattern is already large-type, high-contrast, and living-room-tested, and deviating from what viewers already know creates unfamiliarity, which is the real accessibility risk for the people this app serves.

So the bar for UI work is fidelity, not novelty. **The app as it ships is the reference.** Fixes that bring a surface closer to the established pattern are welcome; "improvements" are declined, however good they are.

## Deliberate departures

The interface departs from the standard streaming pattern in exactly these places, each on purpose:

| Departure | Why |
|---|---|
| **Colors**: the primary accent is pink; nothing else is recolored | founding design rule (see §Theming map below) |
| **Logo**: a "MEEMAW.TV" text wordmark in `primary`, in the classic streaming-logotype manner | founding design rule |
| **Footer**: no link grid (dead links are a "nothing happens" trap for non-technical viewers); three short lines instead | do not "restore" a grid |
| **Switch Streams**: a manual stream-override menu in the player; mainstream apps have no such control | the automatic pick sometimes disappoints, and the viewer needs a way out |
| **Meemaw voice + loader**: two-register copy with visible error codes, and a branded animated loader on loading surfaces | see [coding-standards.md](../coding-standards.md) §Errors |

Anything not on this list follows the pattern viewers already know. A new departure needs a maintainer-approved issue before any code, not after.

## Theming map

Every brand color is a `--color-*` token in `src/app/globals.css`; components never use raw hex. The app is dark-only; there is no light mode. The whole scheme is these ten values; swap them to re-theme a deploy.

| Token | Value | Role |
|---|---|---|
| `--color-background` | `#141414` | page canvas |
| `--color-background-elevated` | `#181818` | cards, modal, elevated surfaces |
| `--color-primary` | `#e6067a` | the app's one accent: logo, primary buttons, active states, progress/seek bars, avatar accents |
| `--color-primary-hover` | `#c10565` | hover state for `primary` |
| `--color-primary-soft` | `#f472b6` | small accents where full `primary` is too loud |
| `--color-foreground` | `#ffffff` | text |
| `--color-muted` | `#b3b3b3` | secondary text |
| `--color-muted-dark` | `#808080` | dimmest text (metadata, small print) |
| `--color-background-input` | `#333333` | dark filled form inputs (sign-in) |
| `--color-error` | `#e87c03` | the orange error box on sign-in failures |

Rule of thumb: *`primary` is the only accent; change nothing else.* White stays white: the Play button is deliberately white with black text, because that's the convention viewers expect. Typography: the app self-hosts Roboto (base) and Bebas Neue (display) via `next/font`.

## The fidelity bar (for contributors)

- **Match the established behavior.** The existing surfaces define it: hover timings, modal transitions, keyboard and pointer behavior, copy placement. When in doubt, mirror what the app already does elsewhere.
- **Say what you matched.** PRs that touch UI say which surface and behavior they replicated or corrected, so review can check fidelity instead of taste.
- **Departures need sign-off first.** If it isn't in the table above, it follows the standard pattern, or it arrives with a maintainer-approved issue behind it.
