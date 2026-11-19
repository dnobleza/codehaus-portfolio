const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'code-hauz portal' });
});

module.exports = router;
