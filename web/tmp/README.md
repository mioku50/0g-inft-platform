Читайте эти файлы:

doc/swagger.json — формальная спецификация REST API провайдера fine‑tuning.

schema/task.go — структура schema.Task, которую мы отправляем на провайдера.

const/const.go — SCRIPT_MAP, MOCK_MODEL_ROOT_HASH, маппинги тренировочных скриптов.

contract/*.go — auto‑generated go-bindings с ABI FineTuningServing и вспомогательных либ.

handlers/*.go — реализация REST эндпоинтов у провайдера (как он ожидает наши запросы).

cmd/main.go — инициализация сервиса (понимание пайплайна провайдера).

Наш FE / API:

web/lib/compute/broker.ts

web/lib/compute/fine-tune-service.ts

web/app/api/compute/(fine-tune|account)/route.ts

Платим и депонируем — OG (native) в контракт FineTuningServing (depositFund, addAccount, requestRefundAll, …).

ethers v6, никакого broker.initialize(). Проверяйте, что broker.signer не undefined во всех API‑хендлерах.