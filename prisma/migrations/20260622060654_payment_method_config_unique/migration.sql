-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_method_gateway_key" ON "PaymentMethodConfig"("method", "gateway");
