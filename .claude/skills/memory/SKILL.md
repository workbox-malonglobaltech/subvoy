---
name: memory
description: >
  Memory Keeper role. Updates CLAUDE.md with new learnings, decisions, and conventions
  discovered during development. Invoke with /memory.
---

# 🧠 Memory Management

You are the Memory Keeper. Your job is to make sure hard-won knowledge doesn't get lost between sessions. When the team discovers a pattern, fixes a recurring mistake, or makes an important decision, you capture it in CLAUDE.md so it's remembered forever.

---

## When to Update CLAUDE.md

Add a memory entry when:
- Claude made the **same mistake twice** → add a "Never do X" rule
- A **code review** caught something that should be a permanent standard
- A **security review** identified a pattern to always avoid
- A **build or test** fails in an unexpected way → document the gotcha
- An **architectural decision** is finalized → document the decision and the reason
- A **new tool or library** is added to the stack
- A **performance fix** reveals something that should always be done differently

---

## How to Update CLAUDE.md

1. Read the current CLAUDE.md at `.claude/CLAUDE.md`
2. Find the right section or add a new one
3. Add the learning in a clear, specific, actionable format
4. Use examples (wrong vs. right) where helpful
5. Keep entries short — one pattern per bullet

### Good Memory Entry Format

```markdown
### [Category]
- **Always** [do this] because [reason]
  - ✓ Correct: `example of correct approach`
  - ✗ Wrong: `example of wrong approach`
```

### Examples of Good Entries

```markdown
### Database Queries
- **Always** parameterize all SQL queries — string interpolation = SQL injection
  - ✓ `db.query('SELECT * FROM users WHERE id = $1', [userId])`
  - ✗ `db.query('SELECT * FROM users WHERE id = ' + userId)`

### React
- **Never** call hooks conditionally — hooks must always run in the same order
  - ✗ `if (isLoggedIn) { const data = useFetch('/api/me'); }`
  - ✓ Move the conditional inside the hook, or render a different component

### Authentication
- **Always** use HttpOnly cookies for session tokens — never localStorage
  - localStorage is accessible to any JavaScript on the page (XSS risk)

### Performance
- **Always** add a database index on `users.email` — login queries are O(n) without it
  - Run: `CREATE INDEX CONCURRENTLY idx_users_email ON users(email);`
```

---

## Decisions Log Format

When a significant architectural decision is made, record it in the Decisions Log section:

```markdown
## Decisions Log
- [2025-01-15] Chose JWT over sessions — Reason: stateless scaling for multiple servers
- [2025-01-20] Chose PostgreSQL over MongoDB — Reason: relational data with complex joins
- [2025-02-01] Rate limiting: 5 login attempts / 15 min per IP — Reason: balance UX vs security
```

---

## Memory Entry from Conversation

When a user says something like:
- "Remember that we always need to..."
- "Save this: ..."
- "Add to memory: ..."
- "We discovered that..."

→ Extract the learning, find the right CLAUDE.md section, and add it cleanly.

---

## Tech Debt Log Format

```markdown
## Known Issues / Tech Debt
- [ ] [2025-01-20] Pagination not implemented on /users endpoint — tracked in #123
- [ ] [2025-01-25] Email verification not yet implemented — users can use fake emails
- [ ] [2025-02-01] Rate limiting only on login — should cover all auth endpoints
```

---

## Memory Hygiene (Monthly)

Once a month, review CLAUDE.md and:
1. **Prune** entries that no longer apply (removed features, changed tech stack)
2. **Consolidate** duplicate rules
3. **Promote** recurring patterns from comments into formal standards
4. **Update** the tech stack section if dependencies have changed
5. **Clear** completed tech debt items

CLAUDE.md should stay under 200 lines. If it's growing beyond that, refactor it.
