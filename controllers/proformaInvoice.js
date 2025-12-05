const ProformaInvoice = require("../models/proforma-invoice");
const { TryCatch, ErrorHandler } = require("../utils/error");

exports.create = TryCatch(async (req, res) => {
  const proformaInvoice = req.body;
  if (!proformaInvoice) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }

  const createdProformaInvoice = await ProformaInvoice.create({
    ...proformaInvoice,
    creator: req.user._id,
  });

  res.status(200).json({
    status: 200,
    success: true,
    proforma_invoice: createdProformaInvoice._doc,
    message: "Proforma Invoice created successfully",
  });
});

exports.update = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Proforma Invoice doesn't exist", 400);
  }
  const proformaInvoice = req.body;
  if (!proformaInvoice) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }

  const updatedProformaInvoice = await ProformaInvoice.findByIdAndUpdate(
    { _id: _id },
    {
      $set: { ...proformaInvoice, items: proformaInvoice.items },
    },
    { new: true }
  );
  
  res.status(200).json({
    status: 200,
    success: true,
    message: "Proforma Invoice has been updated successfully",
    proforma_invoice: updatedProformaInvoice._doc,
  });
});

exports.remove = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Proforma Invoice Id not provided", 400);
  }

  const proformaInvoice = await ProformaInvoice.findOne({ _id: _id });
  if (!proformaInvoice) {
    throw new ErrorHandler("Proforma Invoice doesn't exist", 400);
  }
  await proformaInvoice.deleteOne();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Proforma Invoice deleted successfully",
  });
});

exports.details = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Proforma Invoice Id not provided", 400);
  }

  const proformaInvoice = await ProformaInvoice.findOne({ _id: _id })
    .populate("creator supplier buyer store")
    .populate({
      path: "items.item",
      model: "Product",
    });

  if (!proformaInvoice) {
    throw new ErrorHandler("Proforma Invoice doesn't exist", 400);
  }

  res.status(200).json({
    status: 200,
    success: true,
    proforma_invoice: proformaInvoice._doc,
  });
});

exports.all = TryCatch(async (req, res) => {
  const proformaInvoices = await ProformaInvoice.find()
    .sort({ createdAt: -1 }) // <-- Sort latest first
    .populate([
      { path: "creator", model: "User" },
      { path: "buyer", model: "Parties" },
      { path: "store", model: "Store" }
      
    ])
   .populate({  path:"items.item", model: "Product" });
  res.status(200).json({
    status: 200,
    success: true,
    proforma_invoices: proformaInvoices,
  });
});

exports.getNextInvoiceNumber = TryCatch(async (req, res) => {
  // Prevent misuse of the route with an _id parameter
  if (req.params._id) {
    throw new ErrorHandler(
      "Invalid request: No _id required for this endpoint",
      400
    );
  }

  const latestInvoice = await ProformaInvoice.findOne()
    .sort({ createdAt: -1 })
    .select("proforma_invoice_no");

  let nextInvoiceNumber = "PI001"; // Default starting invoice number

  if (latestInvoice && latestInvoice.proforma_invoice_no) {
    // Extract the numeric part of the latest invoice number (e.g., "001" from "PI001")
    const numberPart = parseInt(latestInvoice.proforma_invoice_no.replace("PI", ""));
    // Increment and format the next invoice number
    nextInvoiceNumber = `PI${String(numberPart + 1).padStart(3, "0")}`;
  }

  res.status(200).json({
    status: 200,
    success: true,
    proforma_invoice_no: nextInvoiceNumber,
    message: "Next proforma invoice number generated successfully",
  });
});

module.exports = {
  create: exports.create,
  update: exports.update,
  remove: exports.remove,
  details: exports.details,
  all: exports.all,
  getNextInvoiceNumber: exports.getNextInvoiceNumber,
};