# Инфраструктура тестовой среды разработчика (Docker, Swarm, Kubernetes, CI/CD)

## Стек

- Docker, Dockerfile
- Docker Compose (`docker-compose.yml`)
- Docker Swarm (кластерная архитектура на базе того же compose-файла)
- Kubernetes (манифесты в каталоге `k8s/`)
- Backend: Node.js + Express (`backend/`)
- Frontend: статический HTML/JS/CSS (`frontend/`)
- PostgreSQL, Redis
- Proxy: Nginx (`proxy/`)
- CI/CD: GitHub Actions (`.github/workflows/ci-cd.yml`)

## Локальный запуск через Docker Compose

```bash
docker compose up --build
```

После запуска:
- открыть `http://localhost` — статический фронтенд,
- блок «Статус сервисов» — кнопка «Обновить» обращается к `/api/status`,
- блок «Проверка backend» — кнопка «Запрос» обращается к `/api/hello`,
- основной блок «Заметки» — добавление и просмотр заметок через `/api/notes`.

## Swarm (кластер)

```bash
docker swarm init
docker stack deploy -c docker-compose.yml dev-env
docker stack services dev-env
```

## Kubernetes (minikube / kind)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/db-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

Далее в hosts можно прописать `dev-env.local` и настроить ingress-контроллер.

## CI/CD и тесты (GitHub Actions)

### Где смотреть статус тестов

1. **Репозиторий на GitHub** → вкладка **Actions**.
2. Выберите workflow **«CI/CD Dev Env»** и последний запуск (по коммиту или PR).
3. Внутри запуска:
   - Job **«build-and-push»** — здесь выполняются тесты. Раскройте шаг **«Backend tests»**: в логе будет вывод `npm test` (Jest). Если тесты упали, весь job помечается как failed и деплой не запускается.
   - Job **«deploy»** — применяет манифесты в кластер и перезапускает backend/frontend.

Итог: **зелёная галочка** у запуска — тесты прошли и (при push в `main`) деплой выполнен. **Красный крестик** — смотреть лог шага «Backend tests» в job «build-and-push».

### Как устроен `.github/workflows/ci-cd.yml`

- **Триггеры**: запуск при `push` и при `pull_request` в ветку `main`.
- **Переменные**: образы пушатся в `ghcr.io` (REGISTRY), имена образов заданы в `env` (IMAGE_BACKEND, IMAGE_FRONTEND, IMAGE_PROXY), тег — `latest`.
- **Job `build-and-push`** (один runner):
  1. Checkout кода.
  2. Установка Node.js 20.
  3. `npm install` в `backend/`.
  4. **`npm test`** в `backend/` — запуск Jest; при падении тестов пайплайн останавливается.
  5. Логин в GitHub Container Registry по `GITHUB_TOKEN`.
  6. Сборка и пуш трёх Docker-образов: backend, frontend, proxy.
- **Job `deploy`** (зависит от `build-and-push`, только при успехе):
  1. Использует **environment: testing** (при необходимости можно добавить approval).
  2. Восстанавливает kubeconfig из секрета `KUBE_CONFIG_B64`.
  3. Применяет манифесты из `k8s/` (namespace, db, redis, backend, frontend, ingress).
  4. Делает `kubectl rollout restart` для backend и frontend, чтобы поды подхватили новые образы.

При **pull_request** деплой тоже запускается (если есть секрет и environment), но образы уже запушены на предыдущем шаге; при необходимости деплой для PR можно отключить или ограничить.

## Секрет KUBE_CONFIG_B64 для GitHub Actions

Чтобы job `deploy` подключался к кластеру, в репозитории нужен секрет `KUBE_CONFIG_B64`.

### Если кластер использует exec (Yandex Cloud `yc`, AWS `aws`, GCP `gcloud` и т.п.)

Стандартный kubeconfig вызывает локальную утилиту (`yc.exe` и т.д.). В GitHub Actions её нет, поэтому нужен **статический** kubeconfig с токеном.

1. На ПК, где уже есть доступ к кластеру (`kubectl` работает), выполни:
   ```powershell
   cd C:\Users\Admin\niaspo
   .\scripts\create-static-kubeconfig.ps1
   ```
   Скрипт создаёт ServiceAccount в кластере (файл `k8s/sa-for-ci.yaml`), достаёт токен и сохраняет статический kubeconfig в `static-kubeconfig.yaml`.

2. Закодируй файл в base64 и добавь в GitHub:
   ```powershell
   [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content -Path ".\static-kubeconfig.yaml" -Raw)))
   ```
   GitHub → Settings → Secrets and variables → Actions → New repository secret → Name: `KUBE_CONFIG_B64`, Value: вставь строку.

### Если кластер уже отдаёт kubeconfig с токеном/сертификатом (без exec)

Можно кодировать обычный `~/.kube/config`:

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content -Path "$env:USERPROFILE\.kube\config" -Raw)))
```

Скопируй вывод целиком → GitHub → Settings → Secrets and variables → Actions → New repository secret → Name: `KUBE_CONFIG_B64`, Value: вставь строку.

