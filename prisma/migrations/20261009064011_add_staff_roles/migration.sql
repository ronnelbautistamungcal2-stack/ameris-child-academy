-- AlterEnum
-- New staff roles from the 2026-10-02 client requests. Kept in their own
-- migration: Postgres cannot use a new enum value in the transaction that adds it.
ALTER TYPE "Role" ADD VALUE 'KITCHEN_STAFF';
ALTER TYPE "Role" ADD VALUE 'HR_STAFF';
ALTER TYPE "Role" ADD VALUE 'STUDENT_SUPPORT';
