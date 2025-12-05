const express = require("express");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const {
  create,
  details,
  update,
  remove,
  all,
  markDone,
  updateStatus,
  requestForAllocation,
  markInventoryInTransit,
  startProduction,
  pauseProduction,
  sendToDispatch,
  moveToInventory,
  getMovedToInventory,
  updateInventoryStatus,
  getInventoryProcesses,
  outFinishGoods,
  receiveByInventory,
  bulkDelete
} = require("../controllers/process");
const router = express.Router();

router.get("/moved-to-inventory",isAuthenticated, getInventoryProcesses);
router.get("/allocation", isAuthenticated, requestForAllocation);
router.put("/inventory-in-transit", isAuthenticated, markInventoryInTransit); //new
router.put("/start-production", isAuthenticated, startProduction);//new 
router.put("/pause", isAuthenticated, pauseProduction);

router.post("/", isAuthenticated, create);
router.get("/all", isAuthenticated, all);
router.get("/done/:_id", isAuthenticated, markDone);
router.delete("/bulk-delete", isAuthenticated, bulkDelete);
router.route("/:_id")
  .get(isAuthenticated, details)
  .put(isAuthenticated, update)
  .delete(isAuthenticated, remove);
  router.post("/out-finish-goods", outFinishGoods);
  router.post("/receive-by-inventory", isAuthenticated, receiveByInventory);
router.post("/update-inventory-status", isAuthenticated, updateInventoryStatus);
router.put("/update-status", updateStatus);
router.post("/move-to-inventory", isAuthenticated, moveToInventory);



module.exports = router;
 