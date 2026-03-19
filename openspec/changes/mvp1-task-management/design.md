# Design

## Overview
The MVP1 will be built as a PWA using Next.js and React.

## Domain model
- Task
- TaskOccurrence
- TaskOccurrenceHistory
- User

## Key decisions
- A task is the recurring definition
- An occurrence is the executable scheduled instance
- Overdue occurrences can still be completed
- Ending a task stops future occurrences and notifications
- Dashboard prioritizes overdue occurrences

## Notes
Offline sync is part of MVP1 only in a basic form.