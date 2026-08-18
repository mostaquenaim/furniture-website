-- CreateTable
CREATE TABLE "BlackListToken" (
    "id" SERIAL NOT NULL,
    "jti" TEXT NOT NULL,
    "expiry" INTEGER NOT NULL,

    CONSTRAINT "BlackListToken_pkey" PRIMARY KEY ("id")
);
