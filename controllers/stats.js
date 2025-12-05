const moment = require("moment");
const BOM = require("../models/bom");
const User = require("../models/user");
const { TryCatch, ErrorHandler } = require("../utils/error");

exports.getStats = TryCatch(async (req, res) => {
  // ==== Calculate date ranges ====
  const now = moment();
  const startOfThisMonth = now.clone().startOf("month").toDate();
  const endOfThisMonth = now.clone().endOf("month").toDate();

  const startOfLastMonth = now.clone().subtract(1, "month").startOf("month").toDate();
  const endOfLastMonth = now.clone().subtract(1, "month").endOf("month").toDate();

  // ==== BOM Counts ====
  const totalBOM = await BOM.countDocuments();
  const lastMonthBOM = await BOM.countDocuments({
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },  
  });
  const thisMonthBOM = await BOM.countDocuments({
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  // ==== Verified Employees Counts ====
  const totalVerifiedEmployees = await User.countDocuments({ isVerified: true });
  const lastMonthVerifiedEmployees = await User.countDocuments({
    isVerified: true,
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });
  const thisMonthVerifiedEmployees = await User.countDocuments({ 
    isVerified: true,
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  return res.status(200).json({
    success: true,
    bom: {
      total: totalBOM,
      lastMonth: lastMonthBOM,
      thisMonth: thisMonthBOM,
    },
    verified_employees: {
      total: totalVerifiedEmployees,
      lastMonth: lastMonthVerifiedEmployees,
      thisMonth: thisMonthVerifiedEmployees,
    },
  });
});


