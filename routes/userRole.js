const express = require('express');
const { details, create, edit, remove, all, permissions } = require('../controllers/userRole');
const { isAuthenticated } = require('../middlewares/isAuthenticated');
const router = express.Router();

router.route('/')
        .post(isAuthenticated, create)
        .put(isAuthenticated, edit)
        .delete(isAuthenticated, remove);
router.get('/', isAuthenticated, all);
router.get('/:_id', isAuthenticated, details);

module.exports = router;
