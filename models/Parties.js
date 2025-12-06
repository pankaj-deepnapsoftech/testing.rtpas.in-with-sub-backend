const { Schema, model } = require("mongoose");

const PartiesSchema = new Schema(
  {
    cust_id: { type: String, unique: true },
    consignee_name: { type: [String], trim: true },
    // gst_add: { type: String, trim: true },
    // gst_in: { type: [String], trim: true },
    contact_number: { type: [String], trim: true },
    // delivery_address: { type: [String], trim: true },
    email_id: { type: [String], trim: true },
    shipped_to: { type: String, trim: true },
    bill_to: { type: String, trim: true },
    shipped_gst_to: { type: String, trim: true },
    bill_gst_to: { type: String, trim: true },
    type: { type: String, required: true, trim: true },
    company_name: { type: String, default: "" },
    parties_type: { type: String, required: true, trim: true },
    contact_person_name:{type:String},
    approved: { type: Boolean, default: false },
    admin_id:{type:String, required:true},
  },
  { timestamps: true }
);

module.exports.PartiesModels = model("Parties", PartiesSchema);

