ALTER TABLE "Task"
ADD COLUMN "clientId" TEXT;

CREATE INDEX "Task_userId_clientId_idx" ON "Task"("userId", "clientId");

CREATE UNIQUE INDEX "Task_userId_clientId_key" ON "Task"("userId", "clientId");
