const { TryCatch, ErrorHandler } = require("../utils/error");
const { ContactQuery } = require("../models/contactQuery");

exports.create = TryCatch(async (req, res) => {
  const {
    name,
    businessName,
    email,
    phoneNumber,
    city,
    message,
    plan,
    source,
  } = req.body || {};

  if (!name || !businessName || !email || !phoneNumber || !city || !plan) {
    throw new ErrorHandler("Please provide all required fields", 400);
  }

  const normalizedPlan =
    typeof plan === "string" ? plan.trim() : String(plan || "");

  const doc = await ContactQuery.create({
    name,
    businessName,
    email,
    phoneNumber,
    city,
    message,
    plan: normalizedPlan,
    source: source || "landing",
  });

  res.status(201).json({
    success: true,
    message: "Your request has been submitted successfully",
    data: { _id: doc._id },
  });
});

exports.planStats = TryCatch(async (req, res) => {
  const statsAgg = await ContactQuery.aggregate([
    {
      $group: {
        _id: "$plan",
        count: { $sum: 1 },
        latestAt: { $max: "$createdAt" },
      },
    },
    { $project: { plan: "$_id", count: 1, latestAt: 1, _id: 0 } },
    { $sort: { count: -1 } },
  ]);

  const latest = await ContactQuery.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .select(
      "name businessName email phoneNumber city message plan createdAt"
    );

  res.status(200).json({
    success: true,
    stats: statsAgg,
    latest,
  });
});

exports.all = TryCatch(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const plan = req.query.plan;
  const match = {};
  if (plan) match.plan = plan;

  const [items, total] = await Promise.all([
    ContactQuery.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ContactQuery.countDocuments(match),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    total,
    page,
    limit,
  });
});

exports.getAllContacts = TryCatch(async (req, res) => {
  const contacts = await ContactQuery.find({}).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: contacts,
  });
});
