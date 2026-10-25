import type { BotModule } from '../core/contracts.ts';
import { exampleModule } from './example/index.ts';
import { systemModule } from './system/index.ts';

/** Modülleri açıkça eklemek deterministik yükleme ve derleme güvencesi sağlar. */
export const modules: readonly BotModule[] = [systemModule, exampleModule];
