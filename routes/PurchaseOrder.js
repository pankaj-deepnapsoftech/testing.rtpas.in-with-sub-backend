const express = require("express");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const {
  create,
  all,
  details,
  update,
  remove,
  allSuppliers,
  getNextPONumber,
  bulkDelete,
  getSupplierDetails,
} = require("../controllers/purchaseOrder");
const router = express.Router();

router.post("/", isAuthenticated, create);
router.get("/all", isAuthenticated, all);
router.get("/next-po-number", isAuthenticated, getNextPONumber);
router.get("/suppliers", isAuthenticated, allSuppliers);
router.get("/supplier/:supplierId", isAuthenticated, getSupplierDetails);
router.delete("/bulk-delete", isAuthenticated, bulkDelete);

router
  .route("/:_id")
  .get(isAuthenticated, details)
  .put(isAuthenticated, update)
  .delete(isAuthenticated, remove);

module.exports = router;
