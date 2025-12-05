const {Schema, model} = require("mongoose");

const paymentSchema = new Schema(
  {
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "creator is a required field"],
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: [true, "Invoice is a required field"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is a required field"],
    },
    mode: {
      type: String,
      enum: ["Cash", "UPI", "NEFT", "RTGS", "Cheque"],
    },
    description: String,
  },
  { timestamps: true }
);

const Payment = model("Payment", paymentSchema);

module.exports = Payment;