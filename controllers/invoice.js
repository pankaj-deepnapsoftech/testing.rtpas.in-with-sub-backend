const Invoice = require("../models/invoice");
const { TryCatch, ErrorHandler } = require("../utils/error");

exports.create = TryCatch(async (req, res) => {
  const {
    invoiceNo,
    consigneeShipTo,
    address,
    gstin,
    billerAddress,
    billerGSTIN,
    deliveryNote,
    modeTermsOfPayment,
    referenceNo,
    otherReferences,
    buyersOrderNo,
    date,
    dispatchDocNo,
    deliveryNoteDate,
    dispatchedThrough,
    destination,
    termsOfDelivery,
    remarks,
    // Legacy fields
    category,
    buyer,
    supplier,
    invoice_no,
    document_date,
    sales_order_date,
    store,
    note,
    items,
    subtotal,
    tax,
    total,
  } = req.body;

  const invoiceData = {
    invoiceNo,
    consigneeShipTo,
    address,
    gstin,
    billerAddress,
    billerGSTIN,
    deliveryNote,
    modeTermsOfPayment,
    referenceNo,
    otherReferences,
    buyersOrderNo,
    date,
    dispatchDocNo,
    deliveryNoteDate,
    dispatchedThrough,
    destination,
    termsOfDelivery,
    remarks,
    creator: req.user._id,
  };

  // Add legacy fields if provided
  if (category) invoiceData.category = category;
  if (buyer) invoiceData.buyer = buyer;
  if (supplier) invoiceData.supplier = supplier;
  if (invoice_no) invoiceData.invoice_no = invoice_no;
  if (document_date) invoiceData.document_date = document_date;
  if (sales_order_date) invoiceData.sales_order_date = sales_order_date;
  if (store) {
    invoiceData.store = store;
  } else {
    // Create a default store if none provided
    invoiceData.store = null;
  }
  if (note) invoiceData.note = note;
  if (items) invoiceData.items = items;
  if (subtotal) invoiceData.subtotal = subtotal;
  if (tax) invoiceData.tax = tax;
  if (total) {
    invoiceData.total = total;
    invoiceData.balance = total; // Set balance equal to total initially
  }

  const createdInvoice = await Invoice.create(invoiceData);

  res.status(201).json({
    status: 201,
    success: true,
    invoice: createdInvoice._doc,
    message: "Invoice created successfully",
  });
});
exports.update = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Invoice doesn't exist", 400);
  }

  const updateData = req.body;
  if (!updateData || Object.keys(updateData).length === 0) {
    throw new ErrorHandler("Please provide fields to update", 400);
  }

  // Update balance if total is being updated
  if (updateData.total) {
    updateData.balance = updateData.total;
  }

  const updatedInvoice = await Invoice.findByIdAndUpdate(
    { _id: _id },
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate("creator buyer supplier store")
    .populate({
      path: "items.item",
      model: "Product",
    });

  if (!updatedInvoice) {
    throw new ErrorHandler("Invoice not found", 404);
  }

  res.status(200).json({
    status: 200,
    success: true,
    message: "Invoice has been updated successfully",
    invoice: updatedInvoice._doc,
  });
});
exports.remove = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Invoice Id not provided", 400);
  }

  const invoice = await Invoice.findOne({ _id: _id });
  if (!invoice) {
    throw new ErrorHandler("Invoice doesn't exist", 400);
  }
  await invoice.deleteOne();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Invoice deleted successfully",
  });
});
exports.details = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Invoice Id not provided", 400);
  }

  const invoice = await Invoice.findOne({ _id: _id })
    .populate("creator supplier buyer store")
    .populate({
      path: "items.item",
      model: "Product",
    });
  if (!invoice) {
    throw new ErrorHandler("Invoice doesn't exist", 400);
  }

  res.status(200).json({
    status: 200,
    success: true,
    invoice: invoice._doc,
  });
});
// exports.all = TryCatch(async (req, res) => {
//   const Invoices = await Invoice.find().populate(
//     "creator buyer supplier store", { path: "items.item" } // Populate the item field within each object in the items array
//   );

//   res.status(200).json({
//     status: 200,
//     success: true,
//     invoices: Invoices,
//   });
// });
exports.all = TryCatch(async (req, res) => {
  const Invoices = await Invoice.find().populate([
    "creator",
    "buyer",
    "supplier",
    "store",
    { path: "items.item" } // Populate the item field within each object in the items array
  ]);

  res.status(200).json({
    status: 200,
    success: true,
    invoices: Invoices,
  });
});
