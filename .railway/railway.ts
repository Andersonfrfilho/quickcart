import { bucket, defineRailway, github, postgres, preserve, project, redis, service, volume } from "railway/iac";

/*
 * A infraestrutura do QuickCart, declarada.
 *
 * Serve para o ambiente ser REPRODUZÍVEL: hoje ele é resultado de configuração feita à mão, e o
 * que não está escrito só existe na memória de quem clicou. Foi assim que `worker` e `web` ficaram
 * sem gatilho de deploy sem ninguém perceber.
 *
 * Os VALORES das variáveis não vivem aqui — `preserve()` declara o nome e mantém o valor no
 * Railway. Nenhum segredo entra no repositório.
 *
 * ⚠️ O que não está declarado é APAGADO no `apply`. Verificado: omitir o Postgres fez o plano
 * pedir para deletá-lo. Antes de aplicar, rode `railway config plan` e leia a saída inteira.
 */
export default defineRailway(() => {
  const quickcart = github("Andersonfrfilho/quickcart", { checkSuites: false });

  /*
   * `image` explícito, e ele NÃO é opcional aqui.
   *
   * Sem essa linha o helper assume `postgres:18`, e o `plan` acusa uma troca de imagem que parece
   * inofensiva. Não é: a imagem em uso é a única com `pg_trgm` e `pgvector`, de que a busca do
   * catálogo depende. O serviço subiria bem e a busca voltaria vazia — falha silenciosa.
   *
   * Declarar como `service()` em vez de `postgres()` também não serve: muda o TIPO do recurso, e o
   * plano vira "apagar o banco e criar um serviço". Verificado: o plano dizia exatamente isso.
   */
  const postgresY64j = postgres("postgres-Y64j", { region: "sfo", image: "ghcr.io/karan316/postgres-extensions" });
  const Redis = redis("Redis", { region: "sfo" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 5000 });
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 5000 });
  const quickcartStagingMedia = bucket("quickcart-staging-media", { region: "sjc" });
  const worker = service("worker", {
    source: quickcart,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile.worker" },
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 5 },
    env: { API_BASE_URL: preserve(), BULL_BOARD_PASSWORD: preserve(), BULL_BOARD_USER: preserve(), DATABASE_URL: preserve(), NODE_ENV: preserve(), NOTIFICATION_SUPPRESSION_KEY: preserve(), REDIS_URL: preserve(), WORKER_SERVICE_EMAIL: preserve(), WORKER_SERVICE_PASSWORD: preserve() },
  });
  const api = service("api", {
    source: quickcart,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile.api" },
    healthcheck: "/v1/health",
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 5 },
    env: { ALLOWED_ORIGINS: preserve(), BOOTSTRAP_ADMIN_EMAIL: preserve(), BOOTSTRAP_ADMIN_NAME: preserve(), BOOTSTRAP_ADMIN_PASSWORD: preserve(), BOOTSTRAP_SERVICE_EMAIL: preserve(), BOOTSTRAP_SERVICE_PASSWORD: preserve(), DATABASE_URL: preserve(), MODERATION_ENABLED: preserve(), NODE_ENV: preserve(), NOTIFICATION_EMAIL_FROM: preserve(), NOTIFICATION_SUPPRESSION_KEY: preserve(), PORT: preserve(), REDIS_URL: preserve(), USER_ACCESS_TOKEN_EXPIRES_IN_SECONDS: preserve(), USER_ACCESS_TOKEN_SECRET: preserve(), USER_REFRESH_COOKIE_SAME_SITE: preserve(), USER_REFRESH_TOKEN_EXPIRES_IN_SECONDS: preserve(), WHATSAPP_ACCESS_TOKEN: preserve(), WHATSAPP_API_VERSION: preserve(), WHATSAPP_APP_SECRET: preserve(), WHATSAPP_BASE_URL: preserve(), WHATSAPP_BUSINESS_ACCOUNT_ID: preserve(), WHATSAPP_PHONE_NUMBER_ID: preserve(), WHATSAPP_WEBHOOK_VERIFY_TOKEN: preserve() },
  });
  const web = service("web", {
    source: quickcart,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile.web" },
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 5 },
    env: { PORT: preserve(), VITE_API_URL: preserve() },
  });

  return project("quickcart", {
    resources: [postgresY64j, worker, api, web, Redis, postgresVolume, redisVolume, quickcartStagingMedia],
  });
});
