const { Schema, model } = require("mongoose");

const BOMScrapMaterialSchema = new Schema(
  {
    bom: {
      type: Schema.Types.ObjectId,
      ref: "BOM",
      required: [true, "BOM is a required field"]
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    scrap_id: {
      type: String,
    },
    scrap_name: {
      type: String,
    },
    description: {
      type: String,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is a required field']
    },
    total_part_cost: {
      type: Number,
    },
    uom: {
      type: String,
      default: "",
    },
    unit_cost: {
      type: Number,
      default: 0,
    },
    uom_used_quantity: {
      type: String,
      default: "",
    },
    is_production_started: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

const BOMScrapMaterial = model("BOM-Scrap-Material", BOMScrapMaterialSchema);
module.exports = BOMScrapMaterial;
