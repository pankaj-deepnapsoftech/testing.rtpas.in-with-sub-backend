const moment = require("moment");
const BOM = require("../models/bom");
const User = require("../models/user");
const { TryCatch, ErrorHandler } = require("../utils/error");

exports.getStats = TryCatch(async (req, res) => {
  const adminId = req.user?._id; // LOGGED IN ADMIN ID

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

  // ==== Verified Employees ONLY for this admin ====
  const totalVerifiedEmployees = await User.countDocuments({
    isVerified: true,
    admin_id: adminId,
  });

  const lastMonthVerifiedEmployees = await User.countDocuments({
    isVerified: true,
    admin_id: adminId,
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });

  const thisMonthVerifiedEmployees = await User.countDocuments({
    isVerified: true,
    admin_id: adminId,
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  return res.status(200).json({
    success: true,
    verified_employees: {
      total: totalVerifiedEmployees,
      lastMonth: lastMonthVerifiedEmployees,
      thisMonth: thisMonthVerifiedEmployees,
    },
  });
});
