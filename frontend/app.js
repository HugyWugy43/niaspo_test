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

document.getElementById('containersBtn').addEventListener('click', async () => {
  const listDiv = document.getElementById('containersList');
  listDiv.textContent = 'Загрузка...';
  try {
    const data = await fetchJson('/api/containers');
    if (!data.containers || data.containers.length === 0) {
      listDiv.textContent = 'Контейнеры не найдены.';
      return;
    }
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
    listDiv.appendChild(ul);
  } catch (err) {
    listDiv.textContent = 'Ошибка: ' + err.message + '. Убедитесь, что backend имеет доступ к docker.sock.';
  }
});

