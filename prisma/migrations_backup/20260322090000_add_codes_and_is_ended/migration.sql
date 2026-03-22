ALTER TABLE "Task"
ADD COLUMN "taskCode" INTEGER,
ADD COLUMN "isEnded" BOOLEAN NOT NULL DEFAULT false;

WITH numbered_tasks AS (
  SELECT id, "userId", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", id) AS next_code
  FROM "Task"
)
UPDATE "Task" t
SET "taskCode" = numbered_tasks.next_code
FROM numbered_tasks
WHERE t.id = numbered_tasks.id;

ALTER TABLE "Task"
ALTER COLUMN "taskCode" SET NOT NULL;

CREATE UNIQUE INDEX "Task_userId_taskCode_key" ON "Task"("userId", "taskCode");

UPDATE "Task"
SET "isEnded" = true
WHERE status IN ('ENDED', 'CANCELED', 'ABORTED');

ALTER TABLE "TaskOccurrence"
ADD COLUMN "recurrenceCode" INTEGER,
ADD COLUMN "isEnded" BOOLEAN NOT NULL DEFAULT false;

WITH numbered_occurrences AS (
  SELECT id, "userId", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", id) AS next_code
  FROM "TaskOccurrence"
)
UPDATE "TaskOccurrence" o
SET "recurrenceCode" = numbered_occurrences.next_code
FROM numbered_occurrences
WHERE o.id = numbered_occurrences.id;

ALTER TABLE "TaskOccurrence"
ALTER COLUMN "recurrenceCode" SET NOT NULL;

CREATE UNIQUE INDEX "TaskOccurrence_userId_recurrenceCode_key" ON "TaskOccurrence"("userId", "recurrenceCode");

UPDATE "TaskOccurrence"
SET "isEnded" = true
WHERE status IN ('COMPLETED', 'IGNORED');
