//bom routes
const express = require('express');
const { create, unapproved, update,approved, remove, details, all, autoBom,findFinishedGoodBom, unapprovedRawMaterials, approveRawMaterial, approveRawMaterialForAdmin, unapprovedRawMaterialsForAdmin, bomsGroupedByWeekDay, bulkUploadBOMHandler, allRawMaterialsForInventory, getInventoryShortages, bulkRemove, getInventoryApprovalStatus, getSalesOrderStatus, getAllSalesOrdersStatus, getAllBOMs } = require('../controllers/bom');
const { isAuthenticated } = require('../middlewares/isAuthenticated');
const { isSuper } = require('../middlewares/isSuper');
const { Validater } = require("../validation/Validator");
const { BOMValidation } = require("../validation/bom.validation");
const router = express.Router();

router.post("/", isAuthenticated, Validater(BOMValidation), create);
router.get("/all", all);
router.get("/unapproved", isAuthenticated,  unapproved);
// router.get('/approved', isAuthenticated, isSuper, approved);
router.get("/autobom", isAuthenticated, isSuper, autoBom);
router.get(
  "/unapproved/raw-materials",
  isAuthenticated,
  isSuper,
  unapprovedRawMaterialsForAdmin
);
router.post(
  "/approve/raw-materials",
  isAuthenticated,
  isSuper,
  approveRawMaterialForAdmin
);
router.get(
  "/unapproved/inventory/raw-materials",
  isAuthenticated,
  unapprovedRawMaterials
);
router.get(
  "/all/inventory/raw-materials",
  isAuthenticated,
  allRawMaterialsForInventory
);
router.post(
  "/approve/inventory/raw-materials",
  isAuthenticated,
  approveRawMaterial
);
router.get("/weekly", isAuthenticated, bomsGroupedByWeekDay);
router.get("/inventory-shortages", isAuthenticated, getInventoryShortages);
router.get("/inventory-approval-status/:salesOrderId", isAuthenticated, getInventoryApprovalStatus);
router.get("/sales-order-status/:salesOrderId", isAuthenticated, getSalesOrderStatus);
// router.get("/sales-order-status/all", isAuthenticated, getAllSalesOrdersStatus);
router.get("/all-boms", isAuthenticated, getAllBOMs);
router.get("/bom/:_id", isAuthenticated, findFinishedGoodBom);

router.delete("/bulk-delete", isAuthenticated, isSuper, bulkRemove);

router
  .route("/:id")
  .delete(isAuthenticated, remove)
  .get(isAuthenticated, details)
  .put(isAuthenticated, update);
//   router.get(
//   "/all/inventory/finished-goods",
//   isAuthenticated,
//   allFinishedGoodsForInventory
// );

// router.post(
//   "/approve/inventory/finished-goods",
//   isAuthenticated,
//   approveFinishedGood
// );

module.exports = router;
