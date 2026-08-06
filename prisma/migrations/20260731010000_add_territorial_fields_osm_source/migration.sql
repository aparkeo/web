-- AlterTable
ALTER TABLE "parking_spots" ADD COLUMN     "community" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE INDEX "parking_spots_community_idx" ON "parking_spots"("community");

-- CreateIndex
CREATE INDEX "parking_spots_province_idx" ON "parking_spots"("province");

-- CreateIndex
CREATE UNIQUE INDEX "parking_spots_source_externalId_key" ON "parking_spots"("source", "externalId");

