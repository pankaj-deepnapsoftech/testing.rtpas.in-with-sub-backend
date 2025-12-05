const BOM = require("../models/bom");
const Counter = require("../models/counter");

const generateBomId = async () => {
  const prefix = "BOM";

  // Atomically find & increment
  let counter = await Counter.findByIdAndUpdate(
    { _id: "bom_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // If this is the very first time, sync with DB
  if (counter.seq === 1) {
    const lastBom = await BOM.findOne({ bom_id: { $regex: /^BOM/ } })
      .sort({ createdAt: -1 });

    if (lastBom) {
      const numericPart = parseInt(lastBom.bom_id.replace(prefix, "")) || 0;

      // Reset counter higher than existing
      counter = await Counter.findByIdAndUpdate(
        { _id: "bom_id" },
        { seq: numericPart + 1 },
        { new: true }
      );
    }
  }

  return `${prefix}${counter.seq.toString().padStart(3, "0")}`;
};

module.exports = { generateBomId };