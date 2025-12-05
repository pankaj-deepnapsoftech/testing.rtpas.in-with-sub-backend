const express = require("express");
const {
  create,
  edit,
  remove,
  all,
  details,
} = require("../controllers/resources");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const router = express.Router();

router.post("/", isAuthenticated, create);
router.get("/", isAuthenticated, all);
router.get("/:_id", isAuthenticated, details);
router.put("/:_id", isAuthenticated, edit);
router.delete("/:_id", isAuthenticated, remove);

module.exports = router;
