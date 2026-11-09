const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDirectory = path.join(__dirname, 'public');

const ratesByCurrency = {
  USD: [90.35, 91.1, 90.75, 92.2, 93.05, 92.6, 93.4],
  EUR: [98.2, 98.85, 99.1, 98.65, 99.55, 100.1, 99.8],
  CNY: [12.4, 12.52, 12.47, 12.61, 12.68, 12.72, 12.66]
};

function calculateAverage(values) {
  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(2));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'about.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Сервер работает',
    demonstration: true
  });
});

app.get('/api/rates/:currency', (req, res) => {
  const currency = req.params.currency.toUpperCase();
  const rates = ratesByCurrency[currency];

  if (!rates) {
    return res.status(404).json({
      error: 'Валюта не поддерживается'
    });
  }

  return res.json({
    currency,
    rates,
    avg: calculateAverage(rates),
    demonstration: true
  });
});

app.use(express.static(publicDirectory));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Маршрут API не найден' });
  }

  return res.status(404).send('Страница не найдена');
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});

module.exports = {
  app,
  calculateAverage,
  ratesByCurrency
};
