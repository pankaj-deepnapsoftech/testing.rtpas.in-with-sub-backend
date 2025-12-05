const express = require('express');
const { details, create, edit, remove, all, permissions } = require('../controllers/userRole');
const router = express.Router();

router.route('/')
        .post(create)
        .put(edit)
        .delete(remove);
router.get('/', all);
router.get('/:_id', details);

module.exports = router;