const { Schema, model } = require("mongoose");

const BOMFinishedMaterialSchema = new Schema(
  {
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
    supporting_doc: {
      type: String,
    },
    comments: {
      type: String,
    },
    cost: {
      type: Number,
    }
  },
  {
    timestamps: true,
  }
);

const BOMFinishedMaterial = model(
  "BOM-Finished-Material",
  BOMFinishedMaterialSchema
);
module.exports = BOMFinishedMaterial;
