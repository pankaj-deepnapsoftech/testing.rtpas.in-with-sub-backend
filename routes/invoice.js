const express = require("express");
const {
  create,
  all,
  details,
  update,
  remove,
} = require("../controllers/invoice");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { Validater } = require("../validation/Validator");
const {
  InvoiceValidation,
  InvoiceUpdateValidation,
} = require("../validation/invoice.validation");
const router = express.Router();

router.post("/", isAuthenticated, Validater(InvoiceValidation), create);
router.get("/all", isAuthenticated, all);
router
  .route("/:_id")
  .get(isAuthenticated, details)
  .put(isAuthenticated, Validater(InvoiceUpdateValidation), update)
  .delete(isAuthenticated, remove);

module.exports = router;
