const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const ScrapSchema = new Schema(
  {
    admin_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    Scrap_name: { type: String, required: true },
    Scrap_id: { type: String, index: true },
    price: { type: Number, default: 0 },
    Extract_from: { type: String, required: true },
    Category: { type: String, required: true },
    qty: { type: Number, required: true, default: 0 },
    description: { type: String },
    uom: { type: String, required: true },
  },
  { timestamps: true }
);

ScrapSchema.pre("save", async function (next) {
  if (this.Scrap_id) return next();

  const lastItem = await mongoose
    .model("Scrap-data")
    .findOne({ admin_id: this.admin_id })
    .sort({ _id: -1 });

  let nextNumber = 1;

  if (lastItem && lastItem.Scrap_id) {
    const lastId = lastItem.Scrap_id.split("-").pop();
    nextNumber = parseInt(lastId) + 1;
  }

  const id = String(nextNumber).padStart(5, "0");
  this.Scrap_id = `SCRAP-${id}`;

  next();
});

ScrapSchema.index({ admin_id: 1, Scrap_id: 1 }, { unique: true });
exports.ScrapModel = model("Scrap-data", ScrapSchema);
