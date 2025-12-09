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
    Scrap_id: { type: String, unique: true },
    price: { type: Number, default: 0 },
    Extract_from: { type: String, required: true },
    Category: { type: String, required: true },
    qty: { type: Number, required: true, default: 0 },
    description: { type: String },
    uom: { type: String, required: true },
  },
  { timestamps: true }
); // <-- IMPORTANT

ScrapSchema.pre("save", async function (next) {
  if (this.Scrap_id) return next(); // skip if already exists

  // Fetch last inserted scrap item
  const lastItem = await mongoose
    .model("Scrap-data")
    .findOne({})
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

exports.ScrapModel = model("Scrap-data", ScrapSchema);
