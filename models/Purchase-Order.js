const mongoose = require("mongoose");

const PurchaseOrderSchema = new mongoose.Schema(
  {
    companyName: { type: String },
    companyAddress: { type: String },
    companyPhoneNumber: { type: String, required: false },
    companyEmail: { type: String, required: false },
    companyWebsite: { type: String, required: false },
    companyGST: { type: String },
    companyPan: { type: String, required: false },

    poOrder: { type: String },
    date: { type: String },
    items: [
      {
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 },
        productId: { type: String },
        uom: { type: String },
      },
    ],
    // Legacy fields for backward compatibility
    // itemName: { type: String },
    // quantity: { type: Number, min: 1 },

    supplierName: { type: String },
    supplierCode: { type: String },
    supplierType: {
      type: String,
      enum: ["Individual", "Company"],
      default: "Individual",
    },
    supplier_customerId: { type: String, required: false },
    supplierPan: { type: String, required: false },
    supplierEmail: { type: String, required: false },
    supplierShippedTo: { type: String, required: false },
    supplierBillTo: { type: String, required: false },
    supplierShippedGSTIN: { type: String, required: false },
    supplierBillGSTIN: { type: String, required: false },
    isSameAddress: { type: Boolean, default: false },

    GSTApply: { type: String },
    packagingAndForwarding: { type: String },
    freightCharges: { type: String, required: false },
    modeOfPayment: { type: String },
    deliveryPeriod: { type: String, required: false },
    billingAddress: { type: String, required: false },
    paymentTerms: { type: String, required: false },
    additionalRemarks: { type: String, required: false },
    additionalImportant: { type: String, required: false },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

const PurchaseOrder = mongoose.model("Purchase-Order", PurchaseOrderSchema);
module.exports = PurchaseOrder;
