const express = require('express');
const { Client } = require('pg');
const { createClient: createRedisClient } = require('redis');
const Docker = require('dockerode');
const axios = require('axios');
const k8s = require('@kubernetes/client-node');

const app = express();
const K8S_NAMESPACE = process.env.K8S_NAMESPACE || 'dev-env';

app.use(express.json());

const pgConfig = {
  host: process.env.POSTGRES_HOST || 'db',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'devuser',
  password: process.env.POSTGRES_PASSWORD || 'devpass',
  database: process.env.POSTGRES_DB || 'devdb'
};

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

// Небольшая фича для КР: заметки (in-memory, только для демонстрации)
const notes = [];

// Docker client для получения списка контейнеров (только в среде, где есть docker.sock)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Настройки для запуска GitHub Actions workflow из backend
const ghOwner = process.env.GH_OWNER;
const ghRepo = process.env.GH_REPO;
const ghWorkflowId = process.env.GH_WORKFLOW_ID; // например, ci-cd.yml
const ghToken = process.env.GH_TOKEN; // персональный токен или fine-grained token

app.get('/api/status', async (req, res) => {
  const status = {
    backend: 'ok',
    time: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV || 'development',
      hostname: process.env.HOSTNAME || 'unknown'
    },
    services: {
      postgres: 'unknown',
      redis: 'unknown'
    }
  };

  // Check PostgreSQL
  try {
    const client = new Client(pgConfig);
    await client.connect();
    const result = await client.query('SELECT NOW() as now');
    status.services.postgres = `ok (${result.rows[0].now.toISOString()})`;
    await client.end();
  } catch (err) {
    status.services.postgres = `error (${err.message})`;
  }

  // Check Redis
  try {
    const redisClient = createRedisClient({ url: redisUrl });
    await redisClient.connect();
    const pong = await redisClient.ping();
    status.services.redis = `ok (PING=${pong})`;
    await redisClient.disconnect();
  } catch (err) {
    status.services.redis = `error (${err.message})`;
  }

  res.json(status);
});

app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Привет из backend-контейнера!',
    time: new Date().toISOString()
  });
});

// Заметки: простая фича для демонстрации и unit-тестов
app.get('/api/notes', (req, res) => {
  res.json({ notes });
});

app.post('/api/notes', (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'Текст заметки обязателен.' });
  }
  if (text.length > 200) {
    return res.status(400).json({ error: 'Текст заметки не должен превышать 200 символов.' });
  }
  const note = {
    id: notes.length + 1,
    text,
    createdAt: new Date().toISOString()
  };
  notes.push(note);
  res.status(201).json({ note });
});

app.get('/api/containers', async (req, res) => {
  try {
    const allContainers = await docker.listContainers({ all: true });
    const projectOnly = req.query.projectOnly !== 'false'; // по умолчанию только контейнеры проекта

    let toShow = allContainers;
    if (projectOnly && process.env.HOSTNAME) {
      // backend в Docker имеет HOSTNAME = короткий id контейнера; ищем свои сети
      const self = allContainers.find(c => c.Id.startsWith(process.env.HOSTNAME) || c.Names.some(n => n.includes(process.env.HOSTNAME)));
      const ourNetworks = self && self.NetworkSettings && self.NetworkSettings.Networks
        ? Object.keys(self.NetworkSettings.Networks)
        : [];
      if (ourNetworks.length > 0) {
        toShow = allContainers.filter(c =>
          c.NetworkSettings && c.NetworkSettings.Networks &&
          ourNetworks.some(net => c.NetworkSettings.Networks[net])
        );
      }
    }

    const simplified = toShow.map(c => ({
      id: c.Id.substring(0, 12),
      names: c.Names,
      image: c.Image,
      state: c.State,
      status: c.Status,
      networks: c.NetworkSettings && c.NetworkSettings.Networks
        ? Object.keys(c.NetworkSettings.Networks)
        : []
    }));
    res.json({ containers: simplified });
  } catch (err) {
    // В Kubernetes-кластере docker.sock обычно недоступен, поэтому возвращаем
    // мягкую ошибку, чтобы фронтенд мог показать понятное сообщение.
    const msg = 'Список контейнеров Docker доступен только в среде, где backend имеет доступ к /var/run/docker.sock (локальный Docker / Compose / Swarm).';
    res.status(200).json({
      containers: [],
      message: msg,
      error: err.message
    });
  }
});

// Запуск CI/CD workflow GitHub Actions с сайта
// Требует настроенных переменных окружения GH_OWNER, GH_REPO, GH_WORKFLOW_ID, GH_TOKEN
app.post('/api/deploy', async (req, res) => {
  if (!ghOwner || !ghRepo || !ghWorkflowId || !ghToken) {
    return res.status(500).json({
      error: 'CI/CD не настроен',
      details: 'Задайте переменные окружения GH_OWNER, GH_REPO, GH_WORKFLOW_ID и GH_TOKEN'
    });
  }

  const url = `https://api.github.com/repos/${ghOwner}/${ghRepo}/actions/workflows/${ghWorkflowId}/dispatches`;

  try {
    const response = await axios.post(
      url,
      { ref: 'main' },
      {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'dev-env-backend'
        }
      }
    );

    res.json({
      message: 'CI/CD workflow успешно запущен',
      status: response.status
    });
  } catch (err) {
    res.status(500).json({
      error: 'Не удалось запустить CI/CD workflow',
      details: err.response ? err.response.data : err.message
    });
  }
});

module.exports = app;

