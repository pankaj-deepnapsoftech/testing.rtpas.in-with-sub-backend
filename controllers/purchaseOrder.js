const { PartiesModels } = require("../models/Parties");
const PurchaseOrder = require("../models/Purchase-Order");
const { TryCatch, ErrorHandler } = require("../utils/error");
const { generatePONumber } = require("../utils/generatePONumber");

exports.create = TryCatch(async (req, res) => {
  const purchaseOrder = req.body;
  if (!purchaseOrder) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }

  // Validate required fields
  const requiredFields = ["supplierName", "items", "supplierType"];
  for (const field of requiredFields) {
    if (!purchaseOrder[field]) {
      throw new ErrorHandler(`${field} is required`, 400);
    }
  }

  // Validate items array
  if (!Array.isArray(purchaseOrder.items) || purchaseOrder.items.length === 0) {
    throw new ErrorHandler("At least one item is required", 400);
  }

  // Validate each item
  for (const item of purchaseOrder.items) {
    if (!item.itemName || !item.quantity || item.quantity < 1) {
      throw new ErrorHandler(
        "Each item must have a valid name and quantity",
        400
      );
    }
  }

  // Validate supplier type
  if (!["Individual", "Company"].includes(purchaseOrder.supplierType)) {
    throw new ErrorHandler(
      "Supplier type must be either 'Individual' or 'Company'",
      400
    );
  }

  // Generate automatic PO number
  const poNumber = await generatePONumber();

  const createdPurchaseOrder = await PurchaseOrder.create({
    ...purchaseOrder,
    poOrder: poNumber, // Override with auto-generated number
    creator: req.user._id,
  });

  res.status(200).json({
    status: 200,
    success: true,
    purchase_order: createdPurchaseOrder._doc,
    message: "Purchase Order created successfully",
  });
});

exports.getNextPONumber = TryCatch(async (req, res) => {
  const poNumber = await generatePONumber();

  res.status(200).json({
    status: 200,
    success: true,
    poNumber: poNumber,
    message: "Next PO number generated successfully",
  });
});

exports.allSuppliers = TryCatch(async (req, res) => {
  const sellers = await PartiesModels.find(
    { parties_type: "Seller" },
    {
      _id: 1,
      cust_id: 1,
      consignee_name: 1,
      company_name: 1,
      type: 1,
      shipped_to: 1,
      bill_to: 1,
      shipped_gst_to: 1,
      bill_gst_to: 1,
      pan_no: 1,
      contact_number: 1,
      email_id: 1,
    }
  );

  const formatted = sellers.map((supplier) => ({
    id: supplier._id,
    supplierCode: supplier.cust_id || "",
    supplierName: Array.isArray(supplier.consignee_name)
      ? supplier.consignee_name[0]
      : supplier.consignee_name || "",
    companyName: supplier.company_name || "",
    supplierType: supplier.type || "Individual",

    supplierShippedTo: supplier.shipped_to || "",
    supplierBillTo: supplier.bill_to || "",
    supplierShippedGSTIN: supplier.shipped_gst_to || "",
    supplierBillGSTIN: supplier.bill_gst_to || "",

    supplierPan: supplier.pan_no || "",
    companyPan: supplier.pan_no || "",

    supplierEmail: Array.isArray(supplier.email_id)
      ? supplier.email_id[0]
      : supplier.email_id || "",

    // companyPhoneNumber: Array.isArray(supplier.contact_number)
    //   ? supplier.contact_number[0]
    //   : supplier.contact_number || "",
  }));

  res.status(200).json({
    status: 200,
    success: true,
    suppliers: formatted,
    message: "Suppliers fetched successfully",
  });
});

exports.getSupplierDetails = TryCatch(async (req, res) => {
  const { supplierId } = req.params;

  if (!supplierId) {
    throw new ErrorHandler("Supplier ID is required", 400);
  }

  const supplier = await PartiesModels.findById(supplierId, {
    _id: 1,
    cust_id: 1,
    consignee_name: 1,
    company_name: 1,
    type: 1,
    shipped_to: 1,
    bill_to: 1,
    shipped_gst_to: 1,
    bill_gst_to: 1,
    pan_no: 1,
    contact_number: 1,
    email_id: 1,
  });

  if (!supplier) {
    throw new ErrorHandler("Supplier not found", 404);
  }

  const formatted = {
    id: supplier._id,
    supplierCode: supplier.cust_id || "",
    supplierName: Array.isArray(supplier.consignee_name)
      ? supplier.consignee_name[0]
      : supplier.consignee_name || "",
    companyName: supplier.company_name || "",
    supplierType: supplier.type || "Individual",
    supplierShippedTo: supplier.shipped_to || "",
    supplierBillTo: supplier.bill_to || "",
    supplierShippedGSTIN: supplier.shipped_gst_to || "",
    supplierBillGSTIN: supplier.bill_gst_to || "",
    supplierPan: supplier.pan_no || "",
    supplierEmail: Array.isArray(supplier.email_id)
      ? supplier.email_id[0]
      : supplier.email_id || "",
  };

  res.status(200).json({
    status: 200,
    success: true,
    supplier: formatted,
    message: "Supplier details fetched successfully",
  });
});

exports.update = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Purchase Order doesn't exist", 400);
  }
  const purchaseOrder = req.body;
  if (!purchaseOrder) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }

  // Validate supplier type if provided
  if (
    purchaseOrder.supplierType &&
    !["Individual", "Company"].includes(purchaseOrder.supplierType)
  ) {
    throw new ErrorHandler(
      "Supplier type must be either 'Individual' or 'Company'",
      400
    );
  }

  const updatedPurchaseOrder = await PurchaseOrder.findByIdAndUpdate(
    { _id: _id },
    {
      $set: { ...purchaseOrder },
    },
    { new: true }
  );

  if (!updatedPurchaseOrder) {
    throw new ErrorHandler("Purchase Order not found", 404);
  }

  res.status(200).json({
    status: 200,
    success: true,
    message: "Purchase Order has been updated successfully",
    purchase_order: updatedPurchaseOrder._doc,
  });
});

exports.remove = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Purchase Order Id not provided", 400);
  }

  const purchaseOrder = await PurchaseOrder.findOne({ _id: _id });
  if (!purchaseOrder) {
    throw new ErrorHandler("Purchase Order doesn't exist", 400);
  }
  await purchaseOrder.deleteOne();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Purchase Order deleted successfully",
  });
});

exports.bulkDelete = TryCatch(async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ErrorHandler(
      "Please provide an array of Purchase Order IDs",
      400
    );
  }

  // Validate all IDs exist
  const existingPurchaseOrders = await PurchaseOrder.find({
    _id: { $in: ids },
  });

  if (existingPurchaseOrders.length !== ids.length) {
    throw new ErrorHandler("One or more Purchase Orders not found", 400);
  }

  // Delete all purchase orders
  const deleteResult = await PurchaseOrder.deleteMany({ _id: { $in: ids } });

  res.status(200).json({
    status: 200,
    success: true,
    message: `${deleteResult.deletedCount} Purchase Order(s) deleted successfully`,
    deletedCount: deleteResult.deletedCount,
  });
});

exports.details = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Purchase Order Id not provided", 400);
  }

  const purchaseOrder = await PurchaseOrder.findById(_id);
  if (!purchaseOrder) {
    throw new ErrorHandler("Purchase Order doesn't exist", 400);
  }
  res.status(200).json({
    status: 200,
    success: true,
    purchase_order: purchaseOrder._doc,
    message: "Purchase Order details fetched successfully",
  });
});

exports.all = TryCatch(async (req, res) => {
  const purchaseOrders = await PurchaseOrder.find({}).populate(
    "creator",
    "name email",
  );
  res.status(200).json({
    status: 200,
    success: true,
    purchase_orders: purchaseOrders,
    message: "All Purchase Orders fetched successfully",
  });
});
