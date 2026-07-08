import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

/**
 * apps/api — the Fase 2 home for everything stateful:
 * indexing (Helius/Alchemy webhooks → TimescaleDB), smart money PnL,
 * Redis cache + WebSocket fan-out, bridge tracking, BullMQ workers.
 *
 * In Fase 1 the Next.js route handlers cover data proxying (ADR-0002);
 * this service boots with a health check + module skeletons so Fase 2
 * work starts on rails instead of a blank repo.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
