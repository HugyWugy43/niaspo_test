# 3.1 Организация CI/CD (GitHub Actions)

Для автоматического развёртывания тестовой среды в рамках курсовой работы был реализован конвейер **CI/CD** на базе **GitHub Actions**. Конвейер запускается при изменениях в репозитории и выполняет последовательность этапов: получение исходного кода, установка зависимостей, запуск unit‑тестов, сборка контейнеров, публикация образов и развёртывание в Kubernetes‑кластере.

## Триггеры запуска

Workflow запускается автоматически при:

- `push` в ветку `main`;
- `pull_request` в ветку `main`.

Это обеспечивает автоматическое выполнение проверок и развёртывание новой версии тестовой среды после внесения изменений в основной код.

## Структура workflow

Workflow разделён на два job’а:

- **`build-and-push`** — этап непрерывной интеграции (CI): установка зависимостей и тестирование, затем сборка и публикация Docker‑образов в реестр.
- **`deploy`** — этап непрерывного развёртывания (CD): подключение к кластеру Kubernetes и применение манифестов инфраструктуры.

Job `deploy` зависит от успешного завершения `build-and-push` (через `needs: build-and-push`), то есть развёртывание выполняется только если тесты и сборка прошли успешно.

## Используемые секреты и реестр образов

- Публикация образов выполняется в **GitHub Container Registry** (`ghcr.io`).
- Для доступа к кластеру используется секрет **`KUBE_CONFIG_B64`**, содержащий base64‑кодированный kubeconfig.

## Листинг workflow CI/CD

Листинг 3.1 — Файл workflow GitHub Actions (`.github/workflows/ci-cd.yml`)

```yaml
name: CI/CD Dev Env

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_BACKEND: hugywugy43/dev-env-backend
  IMAGE_FRONTEND: hugywugy43/dev-env-frontend
  IMAGE_PROXY: hugywugy43/dev-env-proxy
  IMAGE_TAG: latest

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Backend dependencies
        working-directory: backend
        run: npm install

      - name: Backend tests
        working-directory: backend
        run: npm test

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          provenance: false
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_BACKEND }}:${{ env.IMAGE_TAG }}

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          provenance: false
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_FRONTEND }}:${{ env.IMAGE_TAG }}

      - name: Build and push proxy image
        uses: docker/build-push-action@v5
        with:
          context: ./proxy
          push: true
          provenance: false
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PROXY }}:${{ env.IMAGE_TAG }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: testing
    permissions:
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure kubectl
        env:
          KUBE_CONFIG_B64: ${{ secrets.KUBE_CONFIG_B64 }}
        run: |
          mkdir -p $HOME/.kube
          echo "$KUBE_CONFIG_B64" | base64 -d > $HOME/.kube/config
          kubectl version --client

      - name: Apply Kubernetes manifests
        run: |
          kubectl apply -f k8s/namespace.yaml
          kubectl apply -f k8s/db-deployment.yaml
          kubectl apply -f k8s/redis-deployment.yaml
          kubectl apply -f k8s/backend-deployment.yaml
          kubectl apply -f k8s/frontend-deployment.yaml
          kubectl apply -f k8s/pgadmin-deployment.yaml
          kubectl apply -f k8s/ingress.yaml

      - name: Rollout restart (pick up new images)
        run: |
          # Перезапускаем deployment'ы, но не считаем задержку ошибкой для всего пайплайна
          kubectl rollout restart deployment/backend deployment/frontend -n dev-env || true
```

## Результат работы CI/CD

В результате настройки CI/CD достигается требуемая для курсовой автоматизация:

- при каждом обновлении `main` автоматически выполняются unit‑тесты;
- при успешных тестах собираются и публикуются Docker‑образы;
- после публикации образов инфраструктура тестовой среды автоматически применяется к Kubernetes‑кластеру, а компоненты приложения перезапускаются для получения новой версии.

