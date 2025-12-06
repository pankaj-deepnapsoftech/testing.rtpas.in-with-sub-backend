const { Schema, model } = require("mongoose");

const Purchases = new Schema(
  {
    admin_id: { type: Schema.Types.ObjectId, ref: "User", index: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    order_id: { type: String, unique: true },
    party: {
      type: Schema.Types.ObjectId,
      ref: "Parties",
      required: true,
    },
    product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    product_type: { type: String, required: true, trim: true },

    price: { type: Number, required: true, trim: true },
    product_qty: { type: Number, required: true, trim: true, default: 0 },
    GST: { type: Number, trim: true },
    productFile: { type: String }, ///
    designFile: { type: String }, ///
    bompdf: { type: String },
    uom: {
      type: String,
      required: [true, "Unit of Measurement (UoM) is a required field"],
      minlength: [
        2,
        "Unit of Measurement (UoM) should be atleast 2 characters long",
      ],
      maxlength: [40, "Unit of Measurement (UoM) cannot exceed 40 characters"],
    },

    Status: { type: String, required: true, trim: true, default: "Pending" },
    customer_approve: { type: String, required: true, default: "Pending" },
    comment: { type: String, trim: true },
    invoice: { type: String },
    customer_pyement_ss: { type: String },
    customer_order_ss: { type: String },
    product_status: { type: String, enum: ["Dispatch", "Delivered"] },
    paymet_status: { type: String },
    payment_verify: { type: Boolean },
    tracking_id: { type: String },
    tracking_web: { type: String },
    token_amt: { type: Number },
    token_status: { type: Boolean },
    token_ss: { type: String },
    isSampleApprove: { type: Boolean },
    isTokenVerify: { type: Boolean },
    half_payment: { type: Number },
    half_payment_status: { type: String },
    half_payment_image: { type: String },

    salestatus: { type: String, trim: true,enum:["Production Completed","Dispatch"] },
    salestatus_comment: { type: String, trim: true },
    dispatcher_order_ss: { type: String, trim: true },
    customer_invoice_comment: { type: String, trim: true },
    customer_invoice_approve: { type: String, trim: true },

    half_payment: { type: Number },
    half_payment_status: { type: String },
    half_payment_image: { type: String },
    half_payment_approve: { type: Boolean },
    delivery_status_by_customer: { type: String, trim: true },
    delivery_status_comment_by_customer: { type: String, trim: true },
    mode_of_payment: {
      type: String,
      enum: ["Cash", "Cheque", "NEFT/RTGS", "UPI", "Debit Card", "Credit Card"],
      required: true,
      trim: true,
    },
    terms_of_delivery: {
      type: String,
    },
    approved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

exports.Purchase = model("purchase", Purchases);
