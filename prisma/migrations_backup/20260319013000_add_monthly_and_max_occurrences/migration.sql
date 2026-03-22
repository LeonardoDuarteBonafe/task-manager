-- AlterEnum
ALTER TYPE "RecurrenceType" ADD VALUE 'MONTHLY';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "maxOccurrences" INTEGER;
