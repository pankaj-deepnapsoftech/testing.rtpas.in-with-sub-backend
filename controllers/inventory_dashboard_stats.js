const moment = require("moment");
const Product = require("../models/product");
const BOMRawMaterial = require("../models/bom-raw-material");
const { TryCatch } = require("../utils/error");
const ProductionProcess = require("../models/productionProcess");

exports.getInventoryStats = TryCatch(async (req, res) => {
  const now = moment();
  const startOfThisMonth = now.clone().startOf("month").toDate();
  const endOfThisMonth = now.clone().endOf("month").toDate();

  const startOfLastMonth = now
    .clone()
    .subtract(1, "month")
    .startOf("month")
    .toDate();
  const endOfLastMonth = now
    .clone()
    .subtract(1, "month")
    .endOf("month")
    .toDate();

  // ==== Direct Inventory ====
  
  const totalDirect = await Product.countDocuments({
    inventory_category: "direct",
  });
 
  const lastMonthDirect = await Product.countDocuments({
    inventory_category: "direct",
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });
  const thisMonthDirect = await Product.countDocuments({
    inventory_category: "direct",
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  // ==== Indirect Inventory ====
  const totalIndirect = await Product.countDocuments({ inventory_category: "indirect" });
  const lastMonthIndirect = await Product.countDocuments({
    inventory_category: "indirect",
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });
  const thisMonthIndirect = await Product.countDocuments({
    inventory_category: "indirect",
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  // ==== Work in Progress ====
  const totalWIP = await ProductionProcess.countDocuments({ status: "production started" }); // or adapt logic to your WIP model
  const lastMonthWIP = await ProductionProcess.countDocuments({
    status: "production started",
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });
  const thisMonthWIP = await ProductionProcess.countDocuments({
    status: "production started",
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  // ==== Inventory Approvals (raw materials waiting approval) ====
  const totalInvApproval = await BOMRawMaterial.countDocuments({});
  const lastMonthInvApproval = await BOMRawMaterial.countDocuments({
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });
  const thisMonthInvApproval = await BOMRawMaterial.countDocuments({
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  return res.status(200).json({
    success: true,
    direct_inventory: {
      total: totalDirect,
      lastMonth: lastMonthDirect,
      thisMonth: thisMonthDirect,
    },
    indirect_inventory: {
      total: totalIndirect,
      lastMonth: lastMonthIndirect,
      thisMonth: thisMonthIndirect,
    },
    work_in_progress: {
      total: totalWIP,
      lastMonth: lastMonthWIP,
      thisMonth: thisMonthWIP,
    },
    inventory_approval: {
      total: totalInvApproval,
      lastMonth: lastMonthInvApproval,
      thisMonth: thisMonthInvApproval,
    },
  });
});
