const express = require('express');
const { isAuthenticated } = require('../middlewares/isAuthenticated');
const { create, details, update, all } = require('../controllers/Payment');
const router = express.Router();

router.post('/', isAuthenticated, create);
router.get('/all', isAuthenticated, all);
router.route('/:_id')
        .get(isAuthenticated, details)
        .put(isAuthenticated, update)

module.exports = router;