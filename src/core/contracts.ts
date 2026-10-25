import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  ModalSubmitInteraction,
  PermissionResolvable,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from 'discord.js';
import type { Config } from '../config.ts';
import type { Logger } from './logger.ts';
import type { Registry } from './registry.ts';

export interface Services {
  readonly client: Client;
  readonly config: Config;
  readonly logger: Logger;
  readonly registry: Registry;
}

export interface HandlerContext extends Services {
  readonly requestId: string;
  /** Süre aşımı/kapanış için kooperatif iptal; fetch vb. işlemlere iletin. */
  readonly signal: AbortSignal;
}

export interface Policy {
  readonly guildOnly?: boolean;
  readonly userPermissions?: PermissionResolvable;
  readonly botPermissions?: PermissionResolvable;
  readonly cooldownMs?: number;
}

export interface Command extends Policy {
  readonly data: { toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  /** Varsayılan: hemen deferReply. Modal açmak için manual kullanın. */
  readonly acknowledgement?: 'defer' | 'manual';
  readonly ephemeral?: boolean;
  execute(interaction: ChatInputCommandInteraction, context: HandlerContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, context: HandlerContext): Promise<void>;
}

export interface ComponentInteractions {
  button: ButtonInteraction;
  select: StringSelectMenuInteraction;
  modal: ModalSubmitInteraction;
}

export interface Component<K extends keyof ComponentInteractions> extends Policy {
  readonly kind: K;
  /** customId'nin ilk ':' öncesindeki bölümü; örnek: profile:123456... */
  readonly key: string;
  readonly acknowledgement?: 'reply' | 'update' | 'manual';
  readonly ephemeral?: boolean;
  execute(interaction: ComponentInteractions[K], context: HandlerContext): Promise<void>;
}

export type AnyComponent = {
  [K in keyof ComponentInteractions]: Component<K>;
}[keyof ComponentInteractions];

export interface BotEvent {
  readonly name: keyof ClientEvents;
  bind(services: Services): () => void;
}

export interface BotModule {
  readonly name: string;
  readonly commands?: readonly Command[];
  readonly components?: readonly AnyComponent[];
  readonly events?: readonly BotEvent[];
}
