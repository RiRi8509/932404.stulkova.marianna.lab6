const DAYS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье'
];

const CURRENCY_NAMES = {
  USD: 'доллара США',
  EUR: 'евро',
  CNY: 'китайского юаня'
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
let deferredInstallPrompt = null;

function formatRate(value) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);

  Object.entries(attributes).forEach(([attribute, value]) => {
    element.setAttribute(attribute, String(value));
  });

  return element;
}

function renderChart(rates, currency) {
  const chart = document.querySelector('#rate-chart');
  if (!chart) return;

  const width = 700;
  const height = 260;
  const paddingX = 48;
  const paddingY = 34;
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const range = Math.max(maxRate - minRate, 1);

  const points = rates.map((rate, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / (rates.length - 1);
    const normalizedValue = (rate - minRate) / range;
    const y = height - paddingY - normalizedValue * (height - paddingY * 2);
    return { x, y, rate };
  });

  chart.replaceChildren();

  const title = createSvgElement('title', { id: 'chart-title' });
  title.textContent = `График курса ${currency} за семь дней`;
  const description = createSvgElement('desc', { id: 'chart-desc' });
  description.textContent = rates
    .map((rate, index) => `${DAYS[index]}: ${formatRate(rate)}`)
    .join('. ');
  chart.append(title, description);

  for (let index = 0; index < 4; index += 1) {
    const y = paddingY + (index * (height - paddingY * 2)) / 3;
    chart.append(
      createSvgElement('line', {
        x1: paddingX,
        y1: y,
        x2: width - paddingX,
        y2: y,
        class: 'chart-grid-line'
      })
    );
  }

  const pointString = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPointString = [
    `${points[0].x},${height - paddingY}`,
    pointString,
    `${points[points.length - 1].x},${height - paddingY}`
  ].join(' ');

  chart.append(createSvgElement('polygon', { points: areaPointString, class: 'chart-area' }));
  chart.append(createSvgElement('polyline', { points: pointString, class: 'chart-line' }));

  points.forEach((point, index) => {
    chart.append(
      createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: 7,
        class: 'chart-point'
      })
    );

    const label = createSvgElement('text', {
      x: point.x,
      y: height - 8,
      'text-anchor': 'middle',
      class: 'chart-label'
    });
    label.textContent = DAYS[index].slice(0, 2);
    chart.append(label);
  });
}

function renderRates(data) {
  const ratesList = document.querySelector('#rates-list');
  const averageRate = document.querySelector('#average-rate');
  const selectedCurrency = document.querySelector('#selected-currency');
  const chartDescription = document.querySelector('#chart-description');
  const trendValue = document.querySelector('#trend-value');

  if (!ratesList || !averageRate || !selectedCurrency || !chartDescription || !trendValue) {
    return;
  }

  ratesList.replaceChildren();

  data.rates.forEach((rate, index) => {
    const item = document.createElement('li');
    item.className = 'rate-item';

    const day = document.createElement('span');
    day.className = 'rate-day';
    day.textContent = DAYS[index];

    const number = document.createElement('strong');
    number.className = 'rate-number';
    number.textContent = `${formatRate(rate)} ₽`;

    item.append(day, number);
    ratesList.append(item);
  });

  const difference = Number((data.rates.at(-1) - data.rates[0]).toFixed(2));
  const trendPrefix = difference > 0 ? '+' : '';

  averageRate.textContent = formatRate(data.avg);
  selectedCurrency.textContent = data.currency;
  chartDescription.textContent = `Изменение ${CURRENCY_NAMES[data.currency]} за учебную неделю`;
  trendValue.textContent = `${trendPrefix}${formatRate(difference)} ₽`;
  trendValue.setAttribute(
    'aria-label',
    `Изменение от понедельника к воскресенью: ${trendPrefix}${formatRate(difference)} рубля`
  );

  renderChart(data.rates, data.currency);
}

function setActiveCurrency(currency) {
  document.querySelectorAll('.currency-button').forEach((button) => {
    const isActive = button.dataset.currency === currency;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

async function loadCurrency(currency) {
  const ratesPanel = document.querySelector('#rates-panel');
  const errorMessage = document.querySelector('#error-message');

  if (!ratesPanel || !errorMessage) return;

  setActiveCurrency(currency);
  ratesPanel.setAttribute('aria-busy', 'true');
  errorMessage.hidden = true;

  try {
    const response = await fetch(`/api/rates/${currency}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Не удалось получить данные');
    }

    if (!Array.isArray(data.rates) || data.rates.length !== DAYS.length) {
      throw new Error('Сервер вернул данные в неожиданном формате');
    }

    renderRates(data);
  } catch (error) {
    errorMessage.textContent = `${error.message}. Проверьте запуск сервера и повторите попытку.`;
    errorMessage.hidden = false;
  } finally {
    ratesPanel.setAttribute('aria-busy', 'false');
  }
}

function updateConnectionStatus() {
  const connectionStatus = document.querySelector('#connection-status');
  if (!connectionStatus) return;

  const statusText = connectionStatus.querySelector('.status-text');
  const isOnline = navigator.onLine;

  connectionStatus.classList.toggle('is-online', isOnline);
  connectionStatus.classList.toggle('is-offline', !isOnline);
  statusText.textContent = isOnline ? 'Онлайн' : 'Офлайн';
}

function initializeCurrencyControls() {
  const buttons = document.querySelectorAll('.currency-button');
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      loadCurrency(button.dataset.currency);
    });
  });

  loadCurrency('USD');
}

function initializeInstallButton() {
  const installButton = document.querySelector('#install-button');
  if (!installButton) return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      console.info('Service Worker зарегистрирован');
    } catch (error) {
      console.error('Ошибка регистрации Service Worker:', error);
    }
  });
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

updateConnectionStatus();
initializeCurrencyControls();
initializeInstallButton();
registerServiceWorker();
