import { ApplicationCommandType, Events } from 'discord.js';
import type {
  AnyComponent,
  BotEvent,
  BotModule,
  Command,
  ComponentInteractions,
} from './contracts.ts';

/** Başlangıçta doğrulanır; istek yolunda dosya taraması/dinamik import yapılmaz. */
export class Registry {
  readonly commands: ReadonlyMap<string, Command>;
  readonly components: ReadonlyMap<string, AnyComponent>;
  readonly events: readonly BotEvent[];

  constructor(modules: readonly BotModule[], commandList: readonly Command[] = []) {
    const names = new Set<string>();
    const commands = new Map<string, Command>();
    const components = new Map<string, AnyComponent>();
    const events: BotEvent[] = [];
    for (const command of commandList) {
      const data = command.data.toJSON();
      if (!data.name || commands.has(data.name))
        throw new Error(`Tekrarlanan/geçersiz komut: ${data.name}`);
      if (data.type !== undefined && Number(data.type) !== Number(ApplicationCommandType.ChatInput))
        throw new Error('Yalnızca slash komutları desteklenir.');
      this.validatePolicy(command);
      commands.set(data.name, command);
    }
    for (const module of modules) {
      if (!module.name || names.has(module.name))
        throw new Error(`Tekrarlanan/geçersiz modül: ${module.name}`);
      names.add(module.name);
      for (const component of module.components ?? []) {
        if (!/^[a-z][a-z0-9_-]{0,31}$/.test(component.key))
          throw new Error(`Geçersiz bileşen anahtarı: ${component.key}`);
        if (component.kind === 'modal' && component.acknowledgement === 'update')
          throw new Error('Modal için update onayı desteklenmiyor.');
        this.validatePolicy(component);
        const id = `${component.kind}:${component.key}`;
        if (components.has(id)) throw new Error(`Tekrarlanan bileşen: ${id}`);
        components.set(id, component);
      }
      for (const event of module.events ?? []) {
        if (String(event.name) === String(Events.InteractionCreate))
          throw new Error(
            'interactionCreate çekirdek tarafından yönetilir; component/command kaydedin.',
          );
        events.push(event);
      }
    }
    this.commands = commands;
    this.components = components;
    this.events = Object.freeze(events);
  }

  component<K extends keyof ComponentInteractions>(
    kind: K,
    customId: string,
  ): AnyComponent | undefined {
    return this.components.get(`${kind}:${customId.split(':', 1)[0] ?? ''}`);
  }

  private validatePolicy(policy: { cooldownMs?: number }): void {
    if (
      policy.cooldownMs !== undefined &&
      (!Number.isSafeInteger(policy.cooldownMs) ||
        policy.cooldownMs < 0 ||
        policy.cooldownMs > 86_400_000)
    ) {
      throw new Error('cooldownMs, 0–86400000 aralığında tam sayı olmalı.');
    }
  }
}
