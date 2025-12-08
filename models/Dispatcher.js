const mongoose = require("mongoose");

const DispatchSchema = new mongoose.Schema(
  {
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    Sale_id: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: [] },
    ],
    production_process_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductionProcess",
      index: true,
      required: false,
    },
    sales_order_id: { type: mongoose.Schema.Types.ObjectId, ref: "purchase" , required: true },
    order_id: { type: String },
    merchant_name: { type: String },
    item_name: { type: String },
    quantity: { type: Number },
    total_amount: { type: Number },
    tracking_id: { type: String },
    tracking_web: { type: String },
    dispatch_date: { type: Date, default: Date.now },
    remarks: { type: String },
    dispatch_qty: { type: Number, required: true },
    product_id: { type: String },
    products: [
      {
        product_id: { type: String },
        name: { type: String },
        category: { type: String },
        quantity: { type: Number },
        price: { type: Number },
      },
    ],

    delivery_proof: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date, default: Date.now },
    },
    invoice: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date, default: Date.now },
    },

    dispatch_status: { 
      type: String, 
      enum: ["Dispatch", "Dispatch Pending", "Delivered"], 
      default: "Dispatch" 
    },
    delivery_status: { type: String, default: "Dispatch" },
    Task_status: { type: String, default: "Pending" },
  },
  { timestamps: true, strict: false }
);

const DispatchModel = mongoose.model("Dispatch", DispatchSchema);
module.exports = { DispatchModel };
