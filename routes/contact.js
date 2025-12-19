const express = require("express");
const { create, planStats, all, getAllContacts } = require("../controllers/contact.controller");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isSuper } = require("../middlewares/isSuper");

const router = express.Router();

router.post("/", create);
router.get("/", getAllContacts);
router.get("/plan-stats", isAuthenticated, isSuper, planStats);
router.get("/all", isAuthenticated, isSuper, all);

module.exports = router;
