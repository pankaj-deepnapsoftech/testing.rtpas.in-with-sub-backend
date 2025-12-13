const BOM = require("../models/bom");
const Counter = require("../models/counter");

const generateBomId = async (adminId) => {
  const prefix = "BOM";

  // Atomically find & increment
  const counterKey = adminId ? `bom_id_${adminId}` : "bom_id";
  let counter = await Counter.findByIdAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // If this is the very first time, sync with DB
  if (counter.seq === 1) {
    const match = { bom_id: { $regex: /^BOM/ } };
    if (adminId) match.admin_id = adminId;
    const lastBom = await BOM.findOne(match)
      .sort({ createdAt: -1 });

    if (lastBom) {
      const numericPart = parseInt(lastBom.bom_id.replace(prefix, "")) || 0;

      // Reset counter higher than existing
      counter = await Counter.findByIdAndUpdate(
        { _id: counterKey },
        { seq: numericPart + 1 },
        { new: true }
      );
    }
  }

  return `${prefix}${counter.seq.toString().padStart(3, "0")}`;
};

module.exports = { generateBomId };
