const mongoose = require("mongoose");
const { Schema } = mongoose;

const ContactQuerySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    plan: {
      type: String,
      enum: ["KONTROLIX", "RTPAS", "Enterprise", "Custom", "SOPAS"],
      required: true,
    },
    source: { type: String, default: "landing" },
  },
  { timestamps: true }
);

const ContactQuery = mongoose.model("ContactQuery", ContactQuerySchema);

module.exports = { ContactQuery };

