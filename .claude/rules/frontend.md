---
paths:
    - *.tsx,*.ts
---

# React Best Practices

## Rule Zero: Defaults, Not Dogma

Every rule in this file is a strong default, not an absolute. If a clearly better approach for a specific situation conflicts with a rule here, do not silently follow the rule and do not silently break it — pause, explain the tradeoff to the developer, and let them decide. When in doubt, always consult the developer.

## State Management Hierarchy

Pick the lowest rung that works:

1. **`useState`** — simple, local data. The default.
2. **Lift to a parent** — when components share state and the tree is shallow (roughly ≤2 layers) or the data flow is very clear.
3. **Context** — genuinely global state (`src/contexts/`).
4. **Jotai atoms** — very complex state domains with many interdependent pieces. Add jotai as a dependency only when a feature actually reaches this rung.

The gap between rungs 2 and 3 (state shared across a deeper tree that isn't complex or global) is situational: propose the approach you think fits and verify it with the developer before building.

## Component Structure and Order

Inside a component, declarations follow this order:

1. Router hooks (Wouter `useLocation`, `useParams`) and context reads
2. Refs, then ref-dependent hooks
3. State, including stateful custom hooks (e.g. `Storage` persistence, `useUrlState`)
4. Derived values as plain consts — never mirrored into state
5. Named handler functions
6. `useEffect` hooks
7. One return statement per component; branch with conditional rendering inside it

```typescript
type ProfileCardProps = {
    initialName: string;
    onSaved: (name: string) => void;
};

export default function ProfileCard({ initialName, onSaved }: ProfileCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [name, setName] = useState(initialName);
    const isDirty = name !== initialName;

    const saveName = () => {
        onSaved(name);
    };

    useEffect(() => {
        document.title = name;
    }, [name]);

    return (
        <div ref={cardRef}>
            {isDirty ? <button onClick={saveName}>Save</button> : <h1>{name}</h1>}
        </div>
    );
}
```

### Props Typing

- Every component gets a named `type ComponentNameProps = { ... }` above it, destructured in the signature.
- Use `PropsWithChildren<{ ... }>` when the component takes children.
- Wrappers around native elements extend the native props: `InputHTMLAttributes<HTMLInputElement> & { ... }`.
- Tiny same-file subcomponents may type props inline.

### Splitting Components

Split by concern, not line count. A 400-line component doing one cohesive job is fine; a 150-line component doing three jobs is not. Extract when:

- a chunk has its own state + markup and can take a clean props interface,
- JSX nesting makes the structure hard to follow, or
- a section is reused elsewhere.

Where the extracted piece goes when it has a single parent:

- Parent is a **page** → a sibling file inside that page's folder (e.g. `src/pages/Home/`).
- Parent is a **component** → tiny pieces (under ~30 lines) stay in the same file below the parent; anything bigger gets its own sibling file in the feature folder.

### Conditional Rendering

`&&`, ternaries, and chained ternaries are all acceptable. The one hard rule: the left side of `&&` in JSX must not be a renderable falsy value — coerce it (`!!items.length && <List />`), so a stray `0` never renders.

### Event Handlers

- Single line or short multi-line functions used in one place go inline in the JSX — it keeps the function visibly tied to its element: `onClick={() => setIsOpen(!isOpen)}`.
- Large multi-line and shared functions are declared above the JSX as named functions; they describe a larger concept that should stand alone.
- Callback props are named `onXxx` (`onDismissClicked`, `onSlotSelected`).

### List Keys

Use a stable id or business key. An array index is only acceptable for truly static lists — never reordered, filtered, or mutated.

## Hooks

### Rules of Hooks

Call hooks only at the top level of a function component or custom hook — never inside conditions, loops, event handlers, other hooks' callbacks, or after an early return. React tracks hooks by call order; breaking the order breaks the component. Never return early before the hooks are done, because it makes it easy for the next developer to accidentally break the rules of hooks.

Reference: [React Hooks Rules](https://react.dev/warnings/invalid-hook-call-warning)

### Don't Overuse useEffect

Effects are for synchronizing with something _outside_ React — browser APIs, third-party widgets, the network. If an effect only adjusts state based on other state, you don't need it.

Syncing state with an effect is banned:

```typescript
function BadComponent() {
    const [count, setCount] = useState(0);
    const [label, setLabel] = useState("");
    useEffect(() => {
        setLabel(`Clicked ${count} times`);
    }, [count]);
    return <button onClick={() => setCount(count + 1)}>{label}</button>;
}
```

Derive it during render instead:

```typescript
function GoodComponent() {
    const [count, setCount] = useState(0);
    const label = `Clicked ${count} times`;
    return <button onClick={() => setCount(count + 1)}>{label}</button>;
}
```

When multiple states (or a state plus a side effect like analytics) must always change together, don't sync them with an effect — wrap the updates in one function and call it from the handlers. If state should only change through that helper, rename the setters (`changeState` instead of `setState`) so the next developer doesn't use them directly.

This applies to data fetching too. A fetch triggered by a user action is a side effect of that action, not something to "sync" to state with an effect. Don't write `useEffect(() => { fetchFor(filter) }, [filter])` keyed on a `useState` you set in an `onChange` — put the state update and the fetch in the same handler:

```typescript
const onFilterChanged = (value: string) => {
    setFilter(value);
    fetch(`/api/things?filter=${value}`).then(/* ... */);
};
```

For a fetch that should be debounced (e.g. a search box firing on every keystroke), do **not** hand-roll `setTimeout`/`clearTimeout` — use a shared `useDebounce` helper in `src/utils/` (add one there if it doesn't exist yet) and call it from the same handler.

### Writing Effects

- Any effect that adds a listener, timer, or subscription must return a cleanup function. No exceptions.
- Simple or related concerns may share one effect (two data loads on mount is fine). Complex or unrelated concerns get separate effects.
- We are not strict about `exhaustive-deps`. Only add a dependency if the effect should actually re-run when it changes. Clean, intentional code beats lint compliance here; a targeted `eslint-disable-next-line react-hooks/exhaustive-deps` is the sanctioned tool when the dependency list is intentionally incomplete.
- Keep dependency arrays simple. No complex expressions or type checks inline — narrow to a simple const above the effect:

```typescript
const isVerified = data?.status === "active" && !!data.verifiedAt;

useEffect(() => {
    if (!isVerified) return;
}, [data?.id, isVerified]);
```

### Derived State

Anything computable from existing props or state is a plain `const` in the render body — never mirrored into `useState`, never synced with an effect. Initializing state from a prop is only allowed when the component genuinely owns the value from then on; name the prop `initialX` to make that explicit.

### Memoization

`useMemo`/`useCallback` only when a specific, demonstrated performance need exists — never by default. Since comments are banned, the need must be evident from the code and the situation (a measurably hot path, a reference-stability requirement); if it wouldn't be obvious to the next developer, that's a Rule Zero moment.

### Custom Hooks

- Extract a hook only when the logic is shared by 2+ components. Single-use logic stays in its component, regardless of size.
- Shared hooks live next to their consumers when those share a feature folder; `src/utils/` is for app-wide hooks.

### Refs

Refs are an escape hatch for what React can't express: focus, scroll, measurement, media elements, third-party DOM libraries, and stable mutable values that must not trigger renders (timers, connections). Don't touch DOM state that React renders. Using refs to bypass state for high-frequency updates (e.g. drag positions) is occasionally justified — check with the developer first.

## Data Fetching

- Use `fetch`; there is no axios here.
- Add a loading state only when it matters to the user: the request is slow enough that pending UI is relevant, or you need to disable a button to prevent double submits.
- Pending UI: a simple spinner for small components; a pulsing skeleton only for large components that occupy a significant portion of the screen and take a moment to load.

## Error Handling

Do not be overly aggressive about handling errors. The app is expected to work; if something breaks, we fix it rather than hide it.

- Code paths that should never fail under normal conditions get **no** try/catch — let the error surface so we know to fix it.
- try/catch only where failure is expected: third-party APIs and the network, or operations that intentionally emit errors. Then decide per feature whether to hide the broken piece or show a message.

## TypeScript

- `any`, `as` casts, and `!` non-null assertions are banned in new code. If something seems untypeable without them, that's a Rule Zero moment — pause and discuss. `unknown` plus narrowing is the escape hatch.
- Interfaces only for types that have or will need inheritance; `type` for everything else.

## Code Comments

Zero code comments. Code explains itself through descriptive names and structure; if something seems to need a comment, restructure or rename until it doesn't. The only exceptions are functional pragmas: triple-slash directives, shebangs, and targeted `eslint-disable-next-line` lines that change lint behavior.

## Modal Button Layout

When a modal has both a primary and secondary button:

- `flex flex-col gap-3 sm:flex-row` on the button container
- Primary button first in the DOM with `sm:order-2` — on top (mobile), on the right (desktop)
- Secondary button second — below (mobile), on the left (desktop)
- Both buttons use `grow justify-center py-3 sm:w-0` for equal sizing

```tsx
<div className="flex flex-col gap-3 sm:flex-row">
    <PrimaryButton className="grow justify-center py-3 sm:order-2 sm:w-0">
        Confirm
    </PrimaryButton>
    <SecondaryButton className="grow justify-center py-3 sm:w-0">
        Cancel
    </SecondaryButton>
</div>
```

# Frontend and Design

- Only use colors from the project's design tokens (Tailwind theme / CSS custom properties). Never non-computed inline styles, arbitrary hex values, or non-branded colors.
- Follow the design system in the workspace design guide: Open Sans, comfortable spacing, `rounded-md`, no shadows, minimal animation (`duration-100`), `max-w-7xl` containers.
- Compose conditional Tailwind classes with the `classNames()` helper in `src/utils/classNames.ts`.
- Follow all lint rules in `eslint.config.js`.
- Use existing components before building new ones.
- Accessibility is not optional: semantic HTML, ARIA labels on interactive elements, keyboard navigation, visible focus states, WCAG AA contrast.

# Commands to run

- `npm run lint` fixes and reports lint errors; `npm run lint:check` verifies without modifying
- `npm run format` / `npm run format:check` for Prettier
- `npm run build` must pass before work is considered done
- `npm run test:e2e` runs the Playwright suite, where the project has one
