const { Schema, model } = require("mongoose");

const BOMScrapMaterialSchema = new Schema(
  {
    bom: {
      type: Schema.Types.ObjectId,
      ref: "BOM",
      required: true,
    },

   
    item: {
  type: Schema.Types.ObjectId,
  ref: "Scrap-data",
  required: true
}
,
    description: { type: String },

    quantity: {
      type: Number,
      required: true,
    },

    total_part_cost: { type: Number, default: 0 },

    uom: { type: String, default: "" },

    unit_cost: { type: Number, default: 0 },

    uom_used_quantity: { type: String, default: "" },

    is_production_started: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model("BOM-Scrap-Material", BOMScrapMaterialSchema);
