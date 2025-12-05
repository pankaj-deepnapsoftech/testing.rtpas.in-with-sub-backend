const { Schema, model } = require("mongoose");

const inventoryShortageSchema = new Schema(
  {
    bom: {
      type: Schema.Types.ObjectId,
      ref: "BOM",
      required: true,
    },
    raw_material: {
      type: Schema.Types.ObjectId,
      ref: "BOM-Raw-Material",
      required: true,
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    shortage_quantity: {
      type: Number,
      required: true,
    },
    // Track original shortage quantity when first created
    original_shortage_quantity: {
      type: Number,
      required: true,
    },
    // Track if shortage was resolved
    is_resolved: {
      type: Boolean,
      default: false,
    },
    // Track when shortage was resolved
    resolved_at: {
      type: Date,
    },
    // Track who resolved the shortage
    resolved_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    // Track if shortage should be recreated on BOM edit
    should_recreate_on_edit: {
      type: Boolean,
      default: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const InventoryShortage = model("InventoryShortage", inventoryShortageSchema);
module.exports = InventoryShortage;