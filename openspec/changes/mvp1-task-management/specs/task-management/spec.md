# task-management Specification Delta

## ADDED Requirements

### Requirement: Create recurring tasks
The system SHALL allow the user to create a task with title, optional notes, time, recurrence type, optional end date, and notification repeat interval.

#### Scenario: Create daily recurring task
- GIVEN an authenticated user
- WHEN the user creates a task with daily recurrence at 08:00
- THEN the system creates a recurring task definition
- AND schedules future occurrences according to the recurrence rules

#### Scenario: Create weekly recurring task
- GIVEN an authenticated user
- WHEN the user creates a task for Tuesday and Saturday at 19:00
- THEN the system schedules occurrences only on those weekdays

### Requirement: Show overdue and upcoming tasks
The system SHALL display overdue occurrences before upcoming occurrences on the dashboard.

#### Scenario: Show overdue tasks first
- GIVEN the user has overdue pending occurrences
- WHEN the user opens the dashboard
- THEN overdue occurrences are shown first
- AND they are ordered from oldest to newest

#### Scenario: Show upcoming tasks
- GIVEN the user has future occurrences
- WHEN the user opens the dashboard
- THEN upcoming occurrences are shown after overdue occurrences
- AND they are ordered from nearest to farthest

### Requirement: Complete overdue occurrence
The system SHALL allow a user to complete an overdue occurrence after its scheduled time.

#### Scenario: Complete overdue task
- GIVEN an occurrence is overdue and still pending
- WHEN the user marks the occurrence as completed
- THEN the system accepts the completion
- AND records the actual completion time
- AND stops further notifications for that occurrence

### Requirement: Ignore occurrence
The system SHALL allow a user to ignore a single occurrence.

#### Scenario: Ignore one occurrence
- GIVEN an occurrence is pending
- WHEN the user marks it as ignored
- THEN the system closes only that occurrence
- AND keeps the recurring task active

### Requirement: End recurring task
The system SHALL allow a user to end a recurring task so that future occurrences and future notifications stop.

#### Scenario: End task
- GIVEN an active recurring task
- WHEN the user confirms task ending
- THEN the task is marked as ended
- AND the system stops generating new occurrences
- AND the system stops future notifications