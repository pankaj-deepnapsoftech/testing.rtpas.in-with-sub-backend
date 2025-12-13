const express = require("express");
const {
  create,
  update,
  remove,
  bulkDelete,
  details,
  all,
  unapproved,
  bulkUploadHandler,
  bulkUploadHandlerIndirect,
  workInProgressProducts,
  exportToExcel,
  downloadSampleTemplate,
  exportToExcelIndirect,
  downloadSampleTemplateIndirect,
  rawMaterials,
  updateInventory,
  updatePrice,
  updateStock,
  clearUpdatedPrice,
  clearUpdatedStock,
  removeFromInventoryShortages,
  updateShortageQuantity,
  updateIndividualShortage,
  
  updateStockAndShortages,
  availabilQty,
} = require("../controllers/product");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isSuper } = require("../middlewares/isSuper");
const { upload } = require("../utils/upload");
const { roundAllPrices } = require("../utils/roundPrices");
const router = express.Router();
    
// CRUD operations
router
  .route("/")
  .post(isAuthenticated, create)
  .put(isAuthenticated, update)
  .delete(isAuthenticated, remove);

// Bulk delete operation
router.delete("/bulk-delete", isAuthenticated , bulkDelete);

// Get operations
router.get("/all", isAuthenticated, all);
router.get("/wip", isAuthenticated, workInProgressProducts);
router.get("/unapproved", isAuthenticated,  unapproved);
router.get("/raw-materials", isAuthenticated, rawMaterials);
router.get("/:id", isAuthenticated, details);

// Bulk operations
router.post(
  "/bulk",
  isAuthenticated,
  upload.single("excel"),
  bulkUploadHandler
);
router.post(
  "/bulkindrect",
  isAuthenticated,
  upload.single("excel"),
  bulkUploadHandlerIndirect
);

// Inventory update
router.post("/update-inventory", isAuthenticated, updateInventory);
router.put("/update-price", isAuthenticated, updatePrice);
router.put("/update-stock", isAuthenticated, updateStock);
router.put("/update-stock-and-shortages", isAuthenticated, updateStockAndShortages);
router.put(
  "/clear-updated-price",
  isAuthenticated,
  
  clearUpdatedPrice
);
router.put(
  "/clear-updated-stock",
  isAuthenticated,
  clearUpdatedStock
);
router.put(
  "/remove-from-shortages",
  isAuthenticated,
  removeFromInventoryShortages
);
router.put(
  "/update-shortage-quantity",
  isAuthenticated,
  updateShortageQuantity
);

// Update a specific shortage entry (targeted BOM shortage resolution)
router.put(
  "/update-individual-shortage",
  isAuthenticated,
  updateIndividualShortage
);


// Utility route to round all existing prices to whole numbers
router.post("/round-prices", isAuthenticated, isSuper, async (req, res) => {
  try {
    await roundAllPrices();
    res.status(200).json({
      status: 200,
      success: true,
      message: "All prices have been rounded to whole numbers successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      message: "Failed to round prices",
      error: error.message,
    });
  }
});

// Export operations - Updated for direct products

router.get("/export/excel", isAuthenticated, exportToExcel);
router.get("/export/sample", downloadSampleTemplate);

router.get("/exports/inexcel", isAuthenticated, exportToExcelIndirect);
router.get("/exports/insample", downloadSampleTemplateIndirect);

module.exports = router;
