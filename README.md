# Discord.js v14 · Modüler bot altyapısı

TypeScript strict, ESM ve Node.js 24 üzerine kurulu bir başlangıç projesi. Üretim bağımlılığı yalnızca `discord.js`; yapılandırma, JSON loglama, iptal sinyalleri, süreç yönetimi ve testler Node.js API'lerini kullanır.

## Kurulum

Node.js **24.x** ve npm gerekir. `.nvmrc` ile `nvm use` kullanabilirsiniz.

```sh
npm ci
cp .env.example .env
```

`.env` içindeki `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID` ve geliştirme sunucunuzun `DISCORD_GUILD_ID` değerlerini doldurun. ID'leri tırnak içine almak zorunlu değildir. Token'ı Git'e eklemeyin.

Discord Developer Portal'da uygulama oluşturun, **Bot** bölümünden token alın. **Installation** bölümünde sunucu kurulumu için `bot` ve `applications.commands` scope'larını seçin. Botu geliştirme sunucunuza ekleyin. Yönetici izni vermeniz gerekmez; ekleyeceğiniz işlevlere göre en az gerekli izinleri seçin. Varsayılan altyapı yalnızca `Guilds` intent'i kullanır; Message Content, Presence veya Server Members intent'i gerekmez.

```sh
# Yalnızca bu uygulamanın geliştirme sunucusundaki komut listesini günceller.
npm run deploy -- guild
npm run dev
```

Üretim için:

```sh
npm run check
npm run deploy -- global
npm run build
npm start
```

Dağıtım seçili scope'taki uygulama komutlarını **toplu olarak değiştirir**; modülden çıkardığınız komut o scope'tan silinir. Global ve guild kayıtları bağımsızdır; eski guild kayıtları global komutları gölgeleyebilir. Guild kayıtlarını kaldırmak için manifesti uygun şekilde düzenleyip boş listeyi `npm run deploy -- guild --allow-empty` ile dağıtabilirsiniz. Global değişikliklerin istemcilerde görünmesi zaman alabilir. Dağıtım, bot başlangıcında otomatik çalışmaz. Çalıştırmadan önce scope'u kontrol edin.

## Neler var?

- `/ping`: Gateway ve ilk onay gecikmesi.
- `/bilgi`: çalışma süresi, süreç belleği ve sunucu sayısı.
- `/yardim [komut]`: kayıt üzerinden üretilen liste ve autocomplete.
- `/sunucu`: sunucu bağlamı ve `ManageGuild` izni kontrolü.
- `/ornek`: kullanıcı sahipliği kontrollü buton, modal ve string seçim menüsü. Form verisi saklanmaz.
- Başlangıçta duplicate komut, modül ve bileşen kontrolleri.
- Kullanıcı/bot izinleri, sunucu kısıtı, kullanıcı ve sunucu bazlı cooldown.
- Ephemeral hata yanıtları, takip kimliği, async olay hata sınırı.
- Sınırlandırılmış cooldown tablosu, eşzamanlılık sınırı ve daraltılmış cache.
- `SIGINT`/`SIGTERM` kapanışı, devam eden işlere iptal sinyali, süre sınırlı drain.
- Typecheck, ESLint, Prettier, native test runner, CI ve çok aşamalı Docker imajı.

## Dizinler

```text
src/
  index.ts                 Süreç yaşam döngüsü ve başlangıç
  deploy.ts                Açıkça çalıştırılan komut dağıtımı
  config.ts                Saf yapılandırma doğrulama
  core/
    contracts.ts           Command, Component, BotModule ve context sözleşmeleri
    registry.ts            Başlangıç doğrulaması ve O(1) route kayıtları
    router.ts              İzin, cooldown, onay ve hata sınırı
    responses.ts           reply / editReply / followUp hata yanıtları
    events.ts              Tip güvenli async event adaptörü
    logger.ts              AsyncLocalStorage ve maskelenmiş JSON logları
    cooldowns.ts           Sınırlı TTL tablosu
    client.ts              Intent, cache ve REST ayarları
    runtime.ts             Discord bağlantısı ve kaynak temizliği
  modules/
    index.ts               Açık modül manifesti
    system/                Temel komutlar ve Gateway olayları
    example/               Buton, modal ve menü örneği
tests/                     Token/bağlantı gerektirmeyen testler
```

Modüller derleme sırasında import edilir. Her etkileşimde dosya sistemi taranmaz; yükleme sırası açıktır. Her modül kendi komutlarını, bileşenlerini ve olaylarını dışa aktarır. Discord istemcisine global property eklenmez; bağımlılıklar context üzerinden verilir.

## Yeni modül eklemek

`src/modules/hello/index.ts` oluşturun:

```ts
import { SlashCommandBuilder } from 'discord.js';
import type { BotModule, Command } from '../../core/contracts.ts';
import { UserError } from '../../core/errors.ts';

const hello = {
  data: new SlashCommandBuilder().setName('merhaba').setDescription('Selam verir.'),
  cooldownMs: 3_000,
  async execute(interaction, { signal }) {
    signal.throwIfAborted();
    if (interaction.user.bot) throw new UserError('Bu komut kullanıcılara açıktır.');
    await interaction.editReply('Merhaba!');
  },
} satisfies Command;

export const helloModule = {
  name: 'hello',
  commands: [hello],
} satisfies BotModule;
```

`src/modules/index.ts` içindeki manifest listesine `helloModule` ekleyin. Ardından `npm run check` ve `npm run deploy -- guild` çalıştırın. Geliştirmede `.ts` import uzantıları native Node TypeScript çalıştırmasını sağlar; derlemede uzantılar `.js` olur.

İş mantığını modül içindeki servis dosyalarına ayırın. Veritabanı, HTTP istemcisi gibi ortak bağımlılıkları `Services` sözleşmesine ekleyip başlangıçta oluşturun. Kalıcı veriyi process içi `Map` içinde tutmayın.

## Etkileşim sözleşmesi

Slash komutları varsayılan olarak `deferReply` ile **hemen ve yalnızca kullanıcıya görünür** onaylanır. Komutta `reply()` yerine `editReply()` kullanın. Her başarılı komut nihai bir yanıt vermelidir; yalnızca defer edip dönmek hata sayılır. Herkese açık sonuç için `ephemeral: false` ekleyin. Defer edilmiş yanıtın görünürlüğü sonradan değiştirilemez; hata yanıtı da bu görünürlüğü kullanır, ancak dahili hata ayrıntısı içermez.

Modal açan komut veya butonda `acknowledgement: 'manual'` kullanın ve **3 saniye içinde** `showModal()`/`reply()` çağırın. Modal açmadan önce `deferReply()` çağrılamaz. `manual` yolda uzun IO çalıştırmayın. Autocomplete de ilk yanıt bütçesine tabidir; hızlı yerel sorgu/cache kullanın ve en fazla 25 seçim döndürün.

Bileşenlerde `kind: 'button' | 'select' | 'modal'`, `key` ve `execute` tanımlayın. `customId` biçimi `key:veri` şeklindedir. `select` string seçim menüsünü temsil eder. `acknowledgement: 'reply'` yeni yanıtı defer eder; `'update'` buton/menünün kaynak mesajını onaylar; `'manual'` veya belirtilmemiş değer handler'ın hemen onay vermesini gerektirir. Modal için `update` kullanılamaz. `deferUpdate` sonrasındaki hatalar kaynak mesajı değiştirmeden ephemeral follow-up ile bildirilir.

`customId` verisini doğrulayın, işlem sahibini ve kaynağın güncel yetkilerini kontrol edin. `userPermissions` ve `botPermissions` etkileşimdeki güncel izinleri kontrol eder; moderasyon hedefi/hiyerarşisi gibi iş kuralları ilgili modülün sorumluluğundadır. Komut görünürlüğü için builder'da `setDefaultMemberPermissions` da kullanın. Örnek: `/sunucu` hem görünürlük hem çalışma anı kontrolü uygular. Platforma kayıtlı izinler çalışma anı kontrolünün yerine geçmez.

Olaylar `defineEvent({ name: Events.GuildCreate, execute(services, guild) { ... } })` ile tanımlanır. Argümanlar olay adına göre tiplenir, sync throw ve async rejection yakalanır. `interactionCreate` çekirdek tarafından yönetilir; modüllerden doğrudan dinleyici eklemeyin. Özel olay görevleri uzun sürüyorsa iptal ve concurrency sınırlarını servis düzeyinde uygulayın; router sınırı yalnızca etkileşimleri kapsar.

## Hata yönetimi ve iptal

Beklenen iş kuralı hatalarında `throw new UserError('Kullanıcıya güvenli açıklama.', 'ERROR_CODE')` kullanın. `cause` gerekirse üçüncü argüman olarak `{ cause: error }` verilebilir. Diğer hatalarda kullanıcı yalnızca takip kodu görür; log aynı `requestId` ile stack ve cause içerir. Yanıt gönderilemezse yeniden deneme döngüsü kurulmaz.

Logger token/authorization/secret anahtarlarını, yapılandırılmış bot token'ını ve Discord interaction/webhook URL token'larını maskeler. Buna rağmen interaction, mesaj, form, HTTP header/body veya tüm config nesnesini loglamayın; loglara ihtiyaç duyulan kimlikleri ve hata nesnesini verin. Mesaj mention'ları varsayılan kapalıdır.

Her handler `context.signal` alır. `HANDLER_TIMEOUT_MS` dolduğunda veya kapanışta abort edilir. Bu **kooperatif iptaldir**: `fetch(url, { signal })`, destekleyen veritabanı sürücülerinin timeout/abort seçenekleri ve uzun döngülerde `signal.throwIfAborted()` kullanın. Sinyale uymayan Promise zorla durdurulamaz ve bitene kadar concurrency slotunu tutar; süresi dolan işin sonucu router tarafından hata olarak ele alınır. CPU yoğun işlerde worker kullanın. Autocomplete için iptal bütçesi 2 saniyedir.

`unhandledRejection` ve `uncaughtException` fatal kabul edilir: maskelenmiş fatal log senkron yazılır ve süreç hemen çıkış kodu **1** ile sonlanır. Güvenilir olmayan süreç durumunda async recovery/cleanup çalıştırılmaz. SIGINT/SIGTERM normalde **0** döndürür. Kapanış yeni etkileşim alımını durdurur, işleri iptal eder, en fazla `SHUTDOWN_TIMEOUT_MS` bekler ve istemciyi temizler. Son savunma olarak 65 saniyelik süreç çıkış sınırı bulunur. Süreç yöneticisi/container yeniden başlatmayı yönetmelidir.

## Yapılandırma

| Değişken                      | Varsayılan    | Açıklama                                  |
| ----------------------------- | ------------- | ----------------------------------------- |
| `DISCORD_TOKEN`               | zorunlu       | Bot token'ı                               |
| `DISCORD_APPLICATION_ID`      | zorunlu       | Uygulama ID'si                            |
| `DISCORD_GUILD_ID`            | boş           | Guild dağıtımında zorunlu                 |
| `NODE_ENV`                    | `development` | `development`, `test`, `production`       |
| `LOG_LEVEL`                   | `info`        | `debug`, `info`, `warn`, `error`, `fatal` |
| `MAX_CONCURRENT_INTERACTIONS` | `100`         | Aktif etkileşim üst sınırı                |
| `HANDLER_TIMEOUT_MS`          | `30000`       | Kooperatif işlem iptal süresi             |
| `SHUTDOWN_TIMEOUT_MS`         | `10000`       | Aktif işleri bekleme sınırı               |

Hatalı yapılandırma başlangıçta toplu raporlanır. Varsayılan cache, mesaj/presence/reaction/voice state tutmaz ve üye cache'ini sınırlar; ses, moderasyon veya mesaj işlevleri eklerken `core/client.ts` ayarlarını ihtiyaçla birlikte değiştirin. Discord.js REST rate limit kuyruğu ve Gateway reconnect mekanizması kullanılır; ek kontrolsüz retry döngüsü yoktur.

Kapasite dolduğunda yeni etkileşim başlatılmaz; Discord istemcisi başarısız etkileşim gösterebilir. Bu seçim, aşırı yükte sınırsız yanıt kuyruğu büyümesini engeller. Cooldown verisi tek sürece aittir ve yeniden başlatmada sıfırlanır; çok süreçli/shard kurulumunda ortak atomik Redis TTL işlemi gibi bir servisle değiştirin. Bu proje tek süreç için başlangıçtır; otomatik sharding, veritabanı ve HTTP sağlık endpoint'i içermez.

## Test ve Docker

```sh
npm run check
docker build -t discord-bot .
docker run --init --env-file .env --restart unless-stopped --stop-timeout 70 discord-bot
```

Testler gerçek Discord bağlantısı açmaz; izinleri, cooldown yarışlarını, hata yanıtı durumlarını, gizli veri maskelemeyi, kayıt çakışmalarını ve kapanışı doğrular. Docker runtime root kullanmaz; `.env` imaja kopyalanmaz. Canlı Gateway/Discord API ve Docker çalıştırma doğrulaması ayrıca uygun ortam ve bot kimlik bilgileri gerektirir.

Referanslar: [Discord.js v14 belgeleri](https://discord.js.org/docs/packages/discord.js/14.27.0), [Discord etkileşim yanıt sözleşmesi](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx).
