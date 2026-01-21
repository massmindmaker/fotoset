# OpenSpec Workflow for AI Coding Assistants

This project uses **OpenSpec** for spec-driven development. Follow these instructions when working on features.

## Directory Structure

```
openspec/
├── specs/           # Source of truth - current system specifications
│   ├── auth/        # Authentication specs
│   ├── payments/    # Payment system specs
│   ├── generation/  # AI generation specs
│   └── referrals/   # Referral system specs
├── changes/         # Proposed updates (work in progress)
└── project.md       # Project conventions and context
```

## Workflow

### 1. Creating a Proposal

When starting new work:

```
/openspec:proposal <description>
```

Or manually create a change folder:
```
openspec/changes/<change-name>/
├── proposal.md     # Why and what is changing
├── tasks.md        # Implementation checklist
├── design.md       # Technical decisions (optional)
└── specs/          # Delta files for spec modifications
```

### 2. Implementing Changes

Apply the approved proposal:
```
/openspec:apply <change-name>
```

Work through tasks in `tasks.md`, checking them off as completed.

### 3. Archiving Completed Work

After implementation is verified:
```
/openspec:archive <change-name>
```

This merges spec deltas into `openspec/specs/` and archives the change.

## Spec Format

Use this structure for requirements:

```markdown
### Requirement: <Name>

The system SHALL/MUST <behavior>.

#### Scenario: <scenario-name>
- GIVEN <precondition>
- WHEN <action>
- THEN <expected result>
```

## Delta Format

When modifying specs, use:

```markdown
## ADDED Requirements
### Requirement: New Feature
...

## MODIFIED Requirements
### Requirement: Existing Feature (was: Old Name)
...

## REMOVED Requirements
### Requirement: Deprecated Feature
```

## Commands Reference

| Command | Purpose |
|---------|---------|
| `/openspec:proposal <desc>` | Create new change proposal |
| `/openspec:apply <name>` | Begin implementation |
| `/openspec:archive <name>` | Archive completed work |
| `openspec list` | View active changes |
| `openspec show <change>` | Display change details |
| `openspec validate <change>` | Check spec formatting |

## Best Practices

1. **Always propose before implementing** - Get alignment on specs first
2. **Keep deltas focused** - One feature per change folder
3. **Write scenarios** - Every requirement needs test scenarios
4. **Archive promptly** - Don't let changes linger
5. **Reference project.md** - Follow established conventions
