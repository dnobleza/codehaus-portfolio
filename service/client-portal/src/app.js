const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRoute = require('./routes/health.route');

const app = express();

// Needed so req.ip and rate limiting see the real client behind a proxy.
app.set('trust proxy', config.trustProxy);

// Order matters. Do not reorder:
// requestLogger -> helmet -> cors -> /api limiter -> express.json -> routes -> notFound -> errorHandler
app.use(requestLogger);
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
// TODO: app.use('/api', apiLimiter) once rateLimiters middleware exists
app.use(express.json({ limit: '10kb' }));

app.use('/health', healthRoute);
// TODO: mount /api/v1 routes here as they are built

app.use(notFound);
app.use(errorHandler);

module.exports = app;
