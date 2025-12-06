const express = require('express');
const { create, details, update, remove, all, unapproved, bulkUploadHandler } = require('../controllers/store');
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isSuper } = require('../middlewares/isSuper');
const {upload} = require('../utils/upload');
const router = express.Router();

router.post('/', isAuthenticated, create);
router.get('/all', isAuthenticated, all);
router.get('/unapproved', isAuthenticated,  unapproved);
router.post("/bulk", isAuthenticated, upload.single('excel'), bulkUploadHandler);
router.route('/:id')
        .get(isAuthenticated, details)
        .put(isAuthenticated, update)
        .delete(isAuthenticated, remove)

module.exports = router;
