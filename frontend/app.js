async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.json();
}

function renderStatus(data) {
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = '';

  const backend = document.createElement('div');
  backend.textContent = `Backend: ${data.backend}, время: ${data.time}`;

  const env = document.createElement('div');
  env.textContent = `Контейнер: ${data.env.hostname}, NODE_ENV: ${data.env.node_env}`;

  const services = document.createElement('div');
  services.innerHTML = `
    <strong>PostgreSQL:</strong> ${data.services.postgres}<br/>
    <strong>Redis:</strong> ${data.services.redis}
  `;

  statusDiv.appendChild(backend);
  statusDiv.appendChild(env);
  statusDiv.appendChild(services);
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Загрузка...';
  try {
    const data = await fetchJson('/api/status');
    renderStatus(data);
  } catch (err) {
    statusDiv.textContent = 'Ошибка: ' + err.message;
  }
});

document.getElementById('helloBtn').addEventListener('click', async () => {
  const out = document.getElementById('helloResult');
  out.textContent = 'Загрузка...';
  try {
    const data = await fetchJson('/api/hello');
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.textContent = 'Ошибка: ' + err.message;
  }
});

function renderContainers(listDiv, data, showAll) {
  if (!data.containers || data.containers.length === 0) {
    listDiv.textContent = showAll ? 'Контейнеры не найдены.' : 'Контейнеры проекта не найдены. Запустите docker compose up.';
    return;
  }
  const title = document.createElement('p');
  title.className = 'hint';
  title.textContent = showAll ? 'Все контейнеры на хосте Docker:' : 'Контейнеры этой тестовой среды:';
  const ul = document.createElement('ul');
  data.containers.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${c.names.join(', ')}</strong> (${c.id})<br/>
      Образ: ${c.image}<br/>
      Состояние: ${c.state} — ${c.status || 'n/a'}<br/>
      Сети: ${c.networks && c.networks.length ? c.networks.join(', ') : 'нет данных'}
    `;
    ul.appendChild(li);
  });
  listDiv.innerHTML = '';
  listDiv.appendChild(title);
  listDiv.appendChild(ul);
}

document.getElementById('containersBtn').addEventListener('click', async () => {
  const listDiv = document.getElementById('containersList');
  listDiv.textContent = 'Загрузка...';
  try {
    const data = await fetchJson('/api/containers');
    renderContainers(listDiv, data, false);
  } catch (err) {
    listDiv.textContent = 'Ошибка: ' + err.message + '. Убедитесь, что backend имеет доступ к docker.sock.';
  }
});

document.getElementById('containersAllBtn').addEventListener('click', async () => {
  const listDiv = document.getElementById('containersList');
  listDiv.textContent = 'Загрузка...';
  try {
    const data = await fetchJson('/api/containers?projectOnly=false');
    renderContainers(listDiv, data, true);
  } catch (err) {
    listDiv.textContent = 'Ошибка: ' + err.message;
  }
});

document.getElementById('logsBtn').addEventListener('click', async () => {
  const out = document.getElementById('logsOutput');
  out.textContent = 'Загрузка...';
  const deployment = document.getElementById('logsDeployment').value;
  const tail = document.getElementById('logsTail').value || 100;
  try {
    const data = await fetchJson(`/api/k8s/logs?deployment=${encodeURIComponent(deployment)}&tail=${encodeURIComponent(tail)}`);
    if (!data.available) {
      out.textContent = data.message || 'Логи недоступны.';
      return;
    }
    if (data.error) {
      out.textContent = 'Ошибка: ' + data.error;
      return;
    }
    if (data.message && !data.logs) {
      out.textContent = data.message;
      return;
    }
    const header = data.pod ? `Pod: ${data.pod}\n\n` : '';
    out.textContent = header + (data.logs || '(пусто)');
  } catch (err) {
    out.textContent = 'Ошибка: ' + err.message;
  }
});

