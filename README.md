# Инфраструктура тестовой среды разработчика

Курсовая работа: автоматическое развёртывание тестовых сред. Стек: Docker, Docker Compose, Docker Swarm, Kubernetes, GitHub Actions.

**Состав:** backend (Node.js + Express), frontend (статический сайт), PostgreSQL, Redis, Nginx-прокси, **Swagger UI** (документация API), **Adminer** (просмотр БД). Манифесты K8s в `k8s/`, CI/CD в `.github/workflows/ci-cd.yml`.

---

## Запуск

### Docker Compose (локально)

```bash
docker compose up --build
```

Сайт: **http://localhost**. Администрирование: **http://localhost/swagger/** — документация API (Swagger UI), **http://localhost/adminer/** — веб-интерфейс БД (логин: PostgreSQL, сервер `db`, пользователь `devuser`, пароль `devpass`, БД `devdb`).

### Docker Swarm

Образы при `stack deploy` не собираются — сначала соберите их.

```bash
docker compose build
docker swarm init
docker stack deploy -c docker-compose.yml dev-env
```

Проверка: `docker stack services dev-env`. Сайт: **http://localhost**.

При ошибке адреса: `docker swarm init --advertise-addr 127.0.0.1`.

Удаление: `docker stack rm dev-env`, затем `docker swarm leave --force`.

### Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/db-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

Доступ — через LoadBalancer/Ingress по вашей конфигурации кластера.

---

## Просмотр базы данных

БД не скрыта: к ней можно подключиться с теми же учётными данными, что и backend (**devuser** / **devpass**, база **devdb**). В приложении просто нет экрана «админки» для таблиц — это обычная изоляция по ролям (пользователь сайта не видит БД, а тот, у кого есть доступ к среде, может).

**Docker Compose** (порт 5432 наружу не проброшен — подключаемся из контейнера):

```bash
docker compose exec db psql -U devuser -d devdb -c "\dt"
```

Список таблиц: `\dt`. SQL: `SELECT * FROM ...` и т.д. Интерактивная консоль: `docker compose exec -it db psql -U devuser -d devdb`.

**Kubernetes** (под в том же namespace, что и backend):

```bash
kubectl exec -it deployment/backend -n dev-env -- sh
# внутри пода нет psql; либо поставить клиент, либо запустить временный под с postgres-образом:
kubectl run -it --rm psql-client --image=postgres:16-alpine -n dev-env --env="PGPASSWORD=devpass" -- psql -h db -U devuser -d devdb -c "\dt"
```

На хосте с установленным **psql** можно смотреть БД и через порт, если его пробросить. В `docker-compose.yml` у сервиса `db` портов на хост нет — при необходимости добавьте `ports: ["5432:5432"]` и подключайтесь: `psql -h localhost -U devuser -d devdb` (пароль: devpass).

---

## CI/CD (GitHub Actions)

Workflow **«CI/CD Dev Env»** запускается при push и PR в `main`.

- **Actions** → выбранный run → job **build-and-push**: шаг **Backend tests** — там вывод `npm test` (Jest). При падении тестов деплой не выполняется.
- Job **deploy** применяет манифесты в кластер и перезапускает backend/frontend (нужен секрет `KUBE_CONFIG_B64`).

### Секрет KUBE_CONFIG_B64

Для деплоя в K8s в репозитории нужен секрет **KUBE_CONFIG_B64** — base64 от kubeconfig.

**Кластер с exec (Yandex Cloud и т.п.):** на ПК с рабочим `kubectl` выполните `.\scripts\create-static-kubeconfig.ps1`, затем закодируйте `static-kubeconfig.yaml`:

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content -Path ".\static-kubeconfig.yaml" -Raw)))
```

**Обычный kubeconfig (без exec):**

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content -Path "$env:USERPROFILE\.kube\config" -Raw)))
```

Скопировать вывод → GitHub → Settings → Secrets and variables → Actions → New repository secret → Name: `KUBE_CONFIG_B64`, Value: вставленная строка.
