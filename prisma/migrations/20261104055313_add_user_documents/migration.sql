-- CreateEnum
CREATE TYPE "UserDocumentType" AS ENUM ('PROFILE_PHOTO', 'ID_CARD');

-- DropForeignKey
ALTER TABLE "ShowSeat" DROP CONSTRAINT "ShowSeat_holdId_showId_same_show_fkey";

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" "UserDocumentType" NOT NULL,
    "objectKey" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDocument_objectKey_key" ON "UserDocument"("objectKey");

-- CreateIndex
CREATE INDEX "UserDocument_userId_idx" ON "UserDocument"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDocument_userId_type_key" ON "UserDocument"("userId", "type");

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
