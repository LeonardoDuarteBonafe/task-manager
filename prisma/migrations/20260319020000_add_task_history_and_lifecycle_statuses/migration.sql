-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'CANCELED';
ALTER TYPE "TaskStatus" ADD VALUE 'ABORTED';

-- CreateEnum
CREATE TYPE "TaskHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'ENDED', 'CANCELED', 'ABORTED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "canceledAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "abortedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskHistory" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "TaskHistoryAction" NOT NULL,
    "metadata" JSONB,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskHistory_taskId_actedAt_idx" ON "TaskHistory"("taskId", "actedAt");
CREATE INDEX "TaskHistory_userId_actedAt_idx" ON "TaskHistory"("userId", "actedAt");

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
