import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  // Fase 2 modules (see src/modules/README.md):
  // IndexerModule, SmartMoneyModule, BridgeTrackingModule, StreamModule
})
export class AppModule {}
