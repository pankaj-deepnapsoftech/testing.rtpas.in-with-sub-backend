const express = require("express");
const { update, create, remove, details, allBuyers, unapprovedBuyers, unapprovedSuppliers, allSuppliers, bulkUploadHandler } = require("../controllers/agent");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isSuper } = require("../middlewares/isSuper");
const { upload } = require("../utils/upload");
const router = express.Router();

router.post('/', isAuthenticated, create);
router.get('/buyers', allBuyers);
router.get('/suppliers', allSuppliers);
router.get('/unapproved-buyers', isAuthenticated, isSuper, unapprovedBuyers);
router.get('/unapproved-suppliers', isAuthenticated, isSuper, unapprovedSuppliers);
router.post("/bulk", isAuthenticated, upload.single('excel'), bulkUploadHandler);
router.route('/:id')
        .put(isAuthenticated, update)
        .delete(isAuthenticated, remove)
        .get(isAuthenticated, details)

module.exports = router;