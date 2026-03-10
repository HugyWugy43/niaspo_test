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

