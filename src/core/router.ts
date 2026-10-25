import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { MessageFlags, type Interaction, type RepliableInteraction } from 'discord.js';
import type { AnyComponent, HandlerContext, Policy, Services } from './contracts.ts';
import { Cooldowns } from './cooldowns.ts';
import { UserError } from './errors.ts';
import { logContext } from './logger.ts';
import { reportInteractionError } from './responses.ts';

export class InteractionRouter {
  private readonly services: Services;
  private readonly cooldowns = new Cooldowns();
  private readonly active = new Set<Promise<void>>();
  private readonly shutdown = new AbortController();
  private accepting = true;
  private dropped = 0;
  private nextOverloadLog = 0;

  constructor(services: Services) {
    this.services = services;
  }

  /** Listener void döner; bütün rejection'lar sınırın içinde ele alınır. */
  readonly handle = (interaction: Interaction): void => {
    if (!this.accepting) return;
    // Kapasite doluyken yeni iş/timer/context oluşturma. İstemci başarısız etkileşim
    // gösterir; sınırsız ret yanıtı kuyruğu oluşturulmaz.
    if (this.active.size >= this.services.config.maxConcurrentInteractions) {
      this.dropped++;
      const now = performance.now();
      if (now >= this.nextOverloadLog) {
        this.services.logger.warn('Etkileşim kapasitesi doldu.', {
          dropped: this.dropped,
          pending: this.active.size,
        });
        this.dropped = 0;
        this.nextOverloadLog = now + 30_000;
      }
      return;
    }
    const requestId = randomUUID();
    const job = Promise.resolve()
      .then(() =>
        logContext.run(
          {
            requestId,
            interactionId: interaction.id,
            guildId: interaction.guildId,
            userId: interaction.user.id,
          },
          () => this.dispatch(interaction, requestId),
        ),
      )
      .catch((error: unknown) => {
        this.services.logger.error('Etkileşim sınırında beklenmeyen hata.', { requestId, error });
      });
    this.active.add(job);
    void job.then(() => {
      this.active.delete(job);
    });
  };

  get pending(): number {
    return this.active.size;
  }

  async drain(timeoutMs: number): Promise<boolean> {
    this.accepting = false;
    this.shutdown.abort(new Error('Bot kapanıyor.'));
    const timer = new AbortController();
    try {
      return await Promise.race([
        Promise.allSettled([...this.active]).then(() => true),
        delay(timeoutMs, false, { signal: timer.signal }),
      ]);
    } finally {
      timer.abort();
      this.cooldowns.clear();
    }
  }

  private async dispatch(interaction: Interaction, requestId: string): Promise<void> {
    const started = performance.now();
    // Ayrı timer'ları nihayetinde temizleriz; autocomplete daha kısa bütçe kullanır.
    const deadline = new AbortController();
    const timeout = setTimeout(
      () => deadline.abort(new Error('İşlem süresi aşıldı.')),
      interaction.isAutocomplete() ? 2_000 : this.services.config.handlerTimeoutMs,
    );
    timeout.unref();
    const context: HandlerContext = {
      ...this.services,
      requestId,
      signal: AbortSignal.any([this.shutdown.signal, deadline.signal]),
    };
    try {
      context.signal.throwIfAborted();
      if (interaction.isAutocomplete()) {
        const command = this.services.registry.commands.get(interaction.commandName);
        if (command?.autocomplete) {
          this.enforce(interaction, command, `autocomplete:${interaction.commandName}`, false);
          await command.autocomplete(interaction, context);
        }
        if (!interaction.responded) await interaction.respond([]);
      } else if (interaction.isChatInputCommand()) {
        const command = this.services.registry.commands.get(interaction.commandName);
        if (!command)
          throw new UserError(
            'Bu komut artık mevcut değil. Komut listesini yenileyin.',
            'UNKNOWN_COMMAND',
          );
        this.enforce(interaction, command, `command:${interaction.commandName}`);
        if (command.acknowledgement !== 'manual') {
          await interaction.deferReply(
            command.ephemeral === false ? {} : { flags: MessageFlags.Ephemeral },
          );
        }
        context.signal.throwIfAborted();
        await command.execute(interaction, context);
      } else if (
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isModalSubmit()
      ) {
        const kind = interaction.isButton()
          ? 'button'
          : interaction.isStringSelectMenu()
            ? 'select'
            : 'modal';
        const component = this.services.registry.component(kind, interaction.customId);
        if (!component)
          throw new UserError('Bu bileşen artık kullanılamıyor.', 'UNKNOWN_COMPONENT');
        this.enforce(interaction, component, `${kind}:${component.key}`);
        await this.runComponent(interaction, component, context);
      } else if (interaction.isRepliable()) {
        throw new UserError('Bu etkileşim türü desteklenmiyor.', 'UNSUPPORTED_INTERACTION');
      }
      context.signal.throwIfAborted();
      if (
        interaction.isRepliable() &&
        !interaction.replied &&
        (!interaction.deferred || interaction.ephemeral !== null)
      ) {
        throw new Error('Handler etkileşime nihai yanıt vermeden tamamlandı.');
      }
    } catch (error) {
      if (interaction.isAutocomplete()) {
        this.services.logger.warn('Autocomplete başarısız.', { error });
        if (!interaction.responded) {
          try {
            await interaction.respond([]);
          } catch (responseError) {
            this.services.logger.warn('Autocomplete yanıtlanamadı.', { error: responseError });
          }
        }
      } else if (interaction.isRepliable()) {
        await reportInteractionError(interaction, error, requestId, this.services.logger);
      } else {
        this.services.logger.error('Desteklenmeyen etkileşim başarısız.', { error });
      }
    } finally {
      clearTimeout(timeout);
      this.services.logger.debug('Etkileşim tamamlandı.', {
        durationMs: Math.round(performance.now() - started),
      });
    }
  }

  private enforce(
    interaction: Pick<
      RepliableInteraction,
      'guildId' | 'memberPermissions' | 'appPermissions' | 'user'
    >,
    policy: Policy,
    route: string,
    consumeCooldown = true,
  ): void {
    if (
      (policy.guildOnly || policy.userPermissions || policy.botPermissions) &&
      !interaction.guildId
    ) {
      throw new UserError('Bu işlem yalnızca bir sunucuda kullanılabilir.', 'GUILD_ONLY');
    }
    if (policy.userPermissions && !interaction.memberPermissions?.has(policy.userPermissions)) {
      throw new UserError('Bu işlem için yetkiniz bulunmuyor.', 'USER_PERMISSIONS');
    }
    if (policy.botPermissions && !interaction.appPermissions?.has(policy.botPermissions)) {
      throw new UserError(
        'Botun bu işlem için gerekli kanal izinleri bulunmuyor.',
        'BOT_PERMISSIONS',
      );
    }
    if (consumeCooldown) {
      const remaining = this.cooldowns.consume(
        `${route}:${interaction.guildId ?? 'dm'}:${interaction.user.id}`,
        policy.cooldownMs ?? 0,
      );
      if (remaining > 0)
        throw new UserError(
          `Tekrar kullanmak için ${(remaining / 1_000).toFixed(1)} saniye bekleyin.`,
          'COOLDOWN',
        );
    }
  }

  private async runComponent(
    interaction: RepliableInteraction,
    component: AnyComponent,
    context: HandlerContext,
  ): Promise<void> {
    if (component.acknowledgement === 'reply') {
      await interaction.deferReply(
        component.ephemeral === false ? {} : { flags: MessageFlags.Ephemeral },
      );
    } else if (component.acknowledgement === 'update' && interaction.isMessageComponent()) {
      await interaction.deferUpdate();
    }
    context.signal.throwIfAborted();
    if (component.kind === 'button' && interaction.isButton())
      await component.execute(interaction, context);
    else if (component.kind === 'select' && interaction.isStringSelectMenu())
      await component.execute(interaction, context);
    else if (component.kind === 'modal' && interaction.isModalSubmit())
      await component.execute(interaction, context);
    else throw new Error('Bileşen tipi kayıt ile eşleşmiyor.');
  }
}
