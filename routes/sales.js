const express = require("express");
const {
  create,
  update,
  getAll,
  getOne,
  AddToken,
  uploadinvoice,
  Delivered,
  Imagehandler,
  unapproved,
  approve,
  bulkApprove,
  getUpcomingSales,
  markProductionCompleted,
  GetAllSalesData,
  GetAllSalesReadyToDispatch,
  GetAllPendingSalesData,
  GetAllCompletedData,
  directSendToDispatch,
} = require("../controllers/sales");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isSuper } = require("../middlewares/isSuper");
// const { isSuper } = require("../middlewares/isSuper");
const { Imageupload } = require("../utils/upload");
const { Validater } = require("../validation/Validator");
const { SalesValidation } = require("../validation/sales.validation");

const router = express.Router();

// router.route("/").post(isAuthenticated, isAllowed, create).put(isAuthenticated, isAllowed, update).delete(isAuthenticated, isAllowed, remove);
// router.get("/all", isAuthenticated, all);
// router.get("/wip", isAuthenticated, workInProgressProducts);
router.get("/unapproved", isAuthenticated, unapproved);
router.post("/create", isAuthenticated, Validater(SalesValidation), create);

// router.get("/:id", isAuthenticated, isAllowed, details);

router.put("/update/:id", isAuthenticated, update);

router.patch(
  "/upload-image/:id",
  isAuthenticated, // second image  upload
  Imagehandler
);

router.put(
  "/upload-invoice/:id",
  isAuthenticated,
  Imageupload.single("invoice"),
  uploadinvoice
);

router.patch("/addToken/:id", isAuthenticated, AddToken);

router.get("/getAll", isAuthenticated, getAll);
router.get("/getOne", isAuthenticated, getOne);
router.get("/upcoming-sales", isAuthenticated, getUpcomingSales);
router.patch("/approve/:id", isAuthenticated, approve);
router.post("/bulk-approve", isAuthenticated, bulkApprove);
router.patch("/mark-completed/:id", isAuthenticated, markProductionCompleted);
router.route('/sales-dispatch/:id').put(isAuthenticated, directSendToDispatch)
router.patch("/delivery/:id", Imageupload.single("delivery"), Delivered);
router.route("/sales-dispatch-all").get(isAuthenticated,GetAllSalesData);
router.route("/sales-dispatch-pending").get(isAuthenticated,GetAllPendingSalesData);
router.route("/sales-dispatch-completed").get(isAuthenticated,GetAllCompletedData);
router.route("/get-all-order-pending").get(isAuthenticated, GetAllSalesReadyToDispatch)

module.exports = router;
//
