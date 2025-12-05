const { Schema, model } = require("mongoose");

const BOMRawMaterialSchema = new Schema(
  {
    bom: {
      type: Schema.Types.ObjectId,
      ref: "BOM",
      required: [true, "BOM is a required field"],
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    description: {
      type: String,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
    },
    assembly_phase: {
      type: String,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
    },
    supporting_doc: {
      type: String,
    },
    comments: {
      type: String,
    },
    total_part_cost: {
      type: Number,
    },
    in_production: {
      type: Boolean,
      default: false,
    },
    approvedByAdmin: {
      type: Boolean,
      default: false,
    },
    uom_used_quantity: {
      type: String,
      default: "",
    },
    approvedByInventoryPersonnel: {
      type: Boolean,
      default: false,
    },
    isInventoryApprovalClicked: {
      type: Boolean,
      default: false,
    },
    isOutForInventoryClicked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const BOMRawMaterial = model("BOM-Raw-Material", BOMRawMaterialSchema);
module.exports = BOMRawMaterial;
