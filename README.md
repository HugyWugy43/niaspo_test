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
- кнопка «Обновить статус» обращается к `/api/status`,
- кнопка «Отправить запрос» обращается к `/api/hello`.

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

