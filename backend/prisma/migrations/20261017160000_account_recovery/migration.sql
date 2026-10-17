-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanAppeal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bannedAt" TIMESTAMPTZ(3) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "response" VARCHAR(1000),
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordReset_userId_createdAt_idx" ON "PasswordReset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- CreateIndex
CREATE INDEX "BanAppeal_status_createdAt_id_idx" ON "BanAppeal"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "BanAppeal_userId_createdAt_idx" ON "BanAppeal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BanAppeal_reviewerId_idx" ON "BanAppeal"("reviewerId");

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanAppeal" ADD CONSTRAINT "BanAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanAppeal" ADD CONSTRAINT "BanAppeal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE UNIQUE INDEX "BanAppeal_one_pending_per_user" ON "BanAppeal"("userId") WHERE "status" = 'PENDING';
ALTER TABLE "BanAppeal" ADD CONSTRAINT "BanAppeal_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','STALE'));
