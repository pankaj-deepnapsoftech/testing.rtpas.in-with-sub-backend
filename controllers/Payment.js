const { TryCatch, ErrorHandler } = require("../utils/error");
const Payment = require("../models/payment");
const Invoice = require("../models/invoice");

exports.create = TryCatch(async (req, res) => {
  const paymentDetails = req.body;
  if (!paymentDetails) {
    throw new ErrorHandler("Payment details not provided", 400);
  }
  const invoice = await Invoice.findById(paymentDetails?.invoice);
  if (!invoice) {
    throw new ErrorHandler("Invoice doesn't exitst", 400);
  }

  const { amount, mode, description } = paymentDetails;
  if (!amount || !mode) {
    throw new ErrorHandler("Amount and Mode are required fields", 400);
  }
  if (invoice.balance < amount) {
    throw new Error("Amount must be less than the balance amount", 400);
  }

  invoice.balance -= amount;
  await invoice.save();

  await Payment.create({
    amount,
    mode,
    description,
    invoice: paymentDetails?.invoice,
    creator: req.user._id,
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Payment has been created successfully",
  });
});
exports.update = TryCatch(async (req, res) => {
  const { _id } = req.params;

  if (!_id) {
    throw new ErrorHandler("Payment ID not provided", 400);
  }

  const { amount, mode, description } = req.body;

  const payment = await Payment.findById(_id);
  if (!payment) {
    throw new ErrorHandler("Payment doesn't exist", 400);
  }

  const invoice = await Invoice.findById(payment.invoice);
  if (!invoice) {
    throw new ErrorHandler("Associated invoice doesn't exist", 400);
  }

  // Calculate new balance only if amount is being updated
  if (typeof amount === "number" && amount !== payment.amount) {
    // Revert old payment first
    invoice.balance += payment.amount;

    // Check for overpayment
    if (invoice.balance < amount) {
      throw new ErrorHandler("Amount exceeds current invoice balance", 400);
    }

    // Deduct new amount
    invoice.balance -= amount;
    await invoice.save();

    // Update payment amount
    payment.amount = amount;
  }

  // Update only if fields are provided
  if (mode) payment.mode = mode;
  if (description) payment.description = description;

  await payment.save();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Payment has been updated successfully",
  });
});

exports.details = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Id not provided", 400);
  }

  const payment = await Payment.findById(_id)
    .populate("creator")
    .populate({
      path: "invoice",
      populate: [{ path: "buyer" }, { path: "supplier" }],
    });
  if (!payment) {
    throw new ErrorHandler("Payment doesn't exist", 400);
  }

  // Fetch the latest invoice balance separately to ensure we have the current balance
  const currentInvoice = await Invoice.findById(payment.invoice._id);
  if (currentInvoice) {
    payment.invoice.balance = currentInvoice.balance;
  }

  res.status(200).json({
    status: 200,
    success: true,
    payment,
  });
});
exports.all = TryCatch(async (req, res) => {
  const payments = await Payment.find({})
    .populate("creator")
    .populate({
      path: "invoice",
      populate: [{ path: "buyer" }, { path: "supplier" }],
    });

  // Update each payment's invoice balance with the current balance
  for (let payment of payments) {
    const currentInvoice = await Invoice.findById(payment.invoice._id);
    if (currentInvoice) {
      payment.invoice.balance = currentInvoice.balance;
    }
  }

  res.status(200).json({
    status: 200,
    success: true,
    payments,
  });
});
