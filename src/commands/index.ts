import type { Command } from '../core/contracts.ts';
import { example } from './example.ts';
import { help } from './system/help.ts';
import { info } from './system/info.ts';
import { ping } from './system/ping.ts';
import { server } from './system/server.ts';

/** Bütün slash komutları bu klasörde bulunur ve bu listeden kaydedilir. */
export const commands: readonly Command[] = [ping, info, help, server, example];
