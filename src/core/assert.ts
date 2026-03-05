// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Type-Safety Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Exhaustive switch guard.  Place in the `default` case of a switch over a
 * discriminated union — TypeScript will produce a compile error if any variant
 * is unhandled, because the remaining type won't be assignable to `never`.
 */
export function assertNever(value: never): never {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Unhandled discriminant: ${(value as { tag?: string }).tag ?? value}`);
}
