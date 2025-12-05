const axios = require("axios");
const moment = require("moment");
const User = require("../models/user");
const Agent = require("../models/agent");
const BOM = require("../models/bom");
const MachineStatus = require("../models/machineStatus");
const MachineRegistry = require("../models/machineRegistrySchema");
const BOMFinishedMaterial = require("../models/bom-finished-material");
const Product = require("../models/product");
const { TryCatch } = require("../utils/error");
const Store = require("../models/store");
const ProductionProcess = require("../models/productionProcess");
const ProformaInvoice = require("../models/proforma-invoice");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");
const BOMScrapMaterial = require("../models/bom-scrap-material");
const BOMRawMaterial = require("../models/bom-raw-material");
const { Purchase } = require("../models/purchase");
const { DispatchModel } = require("../models/Dispatcher");
const { PartiesModels } = require("../models/Parties");

exports.getWelcomeMessage = async (req, res) => {
  try {
    const now = new Date();
    const hour = now.getHours();

    let greeting;
    if (hour < 12) {
      greeting = "Good Morning";
    } else if (hour < 18) {
      greeting = "Good Afternoon";
    } else {
      greeting = "Good Evening";
    }

    // Format date like Wednesday, 20 August 2025
    const options = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    };
    const formattedDate = now.toLocaleDateString("en-GB", options);

    res.status(200).json({
      status: 200,
      success: true,
      welcome: `${greeting}, Today is ${formattedDate}`,
      greeting,
      date: formattedDate,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error generating welcome message",
      error: error.message,
    });
  }
};

exports.summary = TryCatch(async (req, res) => {
  // Here we have to send the view also
  let { from, to } = req.body;
  console.log("from", from);
  console.log("view ", to);
  if (from && to) {
    from = moment(from)
      .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
      .format();
    to = moment(to)
      .set({ hour: 23, minute: 59, second: 59, millisecond: 999 })
      .format();
  }
  const oneMonthAgoForBom = moment()
    .subtract(1, "months")
    .startOf("day")
    .toDate();
  const todayForBom = moment().endOf("day").toDate();

  // Products Summary
  const productsPipeline = [
    {
      $project: {
        product_id: 1,
        name: 1,
        current_stock: 1,
        min_stock: 1,
        max_stock: 1,
        price: 1,
        approved: 1,
        inventory_category: 1,
      },
    },
    {
      $group: {
        _id: "$inventory_category",
        total_low_stock: {
          $sum: {
            $cond: [{ $lt: ["$current_stock", "$min_stock"] }, 1, 0],
          },
        },
        total_excess_stock: {
          $sum: {
            $cond: [{ $gt: ["$current_stock", "$max_stock"] }, 1, 0],
          },
        },
        total_product_count: {
          $sum: 1,
        },
        total_stock_price: {
          $sum: {
            $multiply: ["$price", "$current_stock"],
          },
        },
      },
    },
  ];

  if (from && to) {
    productsPipeline.unshift({
      $match: {
        createdAt: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
        approved: true,
      },
    });
  } else {
    productsPipeline.unshift({
      $match: {
        approved: true,
      },
    });
  }
  const products = await Product.aggregate(productsPipeline);

  // Scrap Materials Summary
  const scrapPipeline = [
    {
      $project: {
        quantity: 1,
        total_part_cost: 1,
        createdAt: 1,
        is_production_started: 1,
      },
    },
    {
      $group: {
        _id: null,
        total_product_count: {
          $sum: 1,
        },
        total_stock_price: {
          $sum: "$total_part_cost",
        },
      },
    },
  ];

  if (from && to) {
    scrapPipeline.unshift({
      $match: {
        createdAt: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
      },
    });
  } else {
    scrapPipeline.unshift({
      $match: {
        is_production_started: true,
      },
    });
  }
  const scrap = await BOMScrapMaterial.aggregate(scrapPipeline);

  // WIP Materials Summary
  const wipInventoryPipeline = [
    {
      $project: {
        approvedByAdmin: 1,
        approvedByInventoryPersonnel: 1,
        in_production: 1,
        total_part_cost: 1,
        createdAt: 1,
      },
    },
    {
      $group: {
        _id: null,
        total_product_count: {
          $sum: 1,
        },
        total_stock_price: {
          $sum: "$total_part_cost",
        },
      },
    },
  ];

  if (from && to) {
    wipInventoryPipeline.unshift({
      $match: {
        createdAt: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
        approvedByAdmin: true,
        approvedByInventoryPersonnel: true,
        in_production: true,
      },
    });
  } else {
    scrapPipeline.unshift({
      $match: {
        approvedByAdmin: true,
        approvedByInventoryPersonnel: true,
        in_production: true,
      },
    });
  }
  const wipInventory = await BOMRawMaterial.aggregate(wipInventoryPipeline);

  // Stores Summary
  const storeCount = await Store.find({ approved: true }).countDocuments();

  // BOM Summary
  const bomCount = await BOM.find({ approved: true }).countDocuments();

  // Merchant Summary
  const merchantsPipeline = [
    {
      $project: {
        agent_type: 1,
      },
    },
    {
      $group: {
        _id: null,
        total_supplier_count: {
          $sum: {
            $cond: [{ $eq: ["$agent_type", "supplier"] }, 1, 0],
          },
        },
        total_buyer_count: {
          $sum: {
            $cond: [{ $eq: ["$agent_type", "buyer"] }, 1, 0],
          },
        },
      },
    },
  ];

  if (from && to) {
    merchantsPipeline.unshift({
      $match: {
        createdAt: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
        approved: true,
      },
    });
  } else {
    merchantsPipeline.unshift({
      $match: {
        approved: true,
      },
    });
  }
  const merchants = await Agent.aggregate(merchantsPipeline);

  // Approval Summary
  const unapprovedProducts = await Product.find({
    approved: false,
  }).countDocuments();
  const unapprovedStores = await Store.find({
    approved: false,
  }).countDocuments();
  const unapprovedMerchants = await Agent.find({
    approved: false,
  }).countDocuments();
  const unapprovedBoms = await BOM.find({ approved: false }).countDocuments();

  // Employee Summary
  const employeesPipeline = [
    {
      $lookup: {
        from: "user-roles",
        localField: "role",
        foreignField: "_id",
        as: "role_details",
      },
    },
    {
      $unwind: "$role_details",
    },
    {
      $project: {
        role_details: 1,
        isVerified: 1,
      },
    },
    {
      $match: {
        isVerified: true,
      },
    },
    {
      $group: {
        _id: "$role_details.role",
        total_employee_count: {
          $sum: 1,
        },
      },
    },
  ];

  if (from && to) {
    employeesPipeline.unshift({
      $match: {
        createdAt: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
      },
    });
  }

  const employees = await User.aggregate(employeesPipeline);

  // Production Process Summary
  const processPipeline = [
    {
      $project: {
        status: 1,
      },
    },
    {
      $group: {
        _id: "$status",
        total_process_count: {
          $sum: 1,
        },
      },
    },
  ];

  if (from && to) {
    processPipeline.unshift({
      $match: {
        createdAt: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
        approved: true,
      },
    });
  } else {
    processPipeline.unshift({
      $match: {
        approved: true,
      },
    });
  }
  const process = await ProductionProcess.aggregate(processPipeline);
  let processCountStatusWiseArr = process.map((p) => ({
    [p._id]: p.total_process_count,
  }));
  const processCountStatusWiseObj = {};
  processCountStatusWiseArr.forEach((obj) => {
    const key = Object.keys(obj)[0];
    processCountStatusWiseObj[key] = obj[key];
  });

  // Proforma Invoices, Invoices and Payments Insights
  let condition = {};
  if (from && to) {
    condition = {
      $gte: from,
      $lte: to,
    };
  }
  const totalProformaInvoices = await ProformaInvoice.find(
    condition
  ).countDocuments();
  const totalInvoices = await Invoice.find(condition).countDocuments();
  const totalPayments = await Payment.find(condition).countDocuments();

  // Invoices Total for Last 1 Month
  const oneMonthAgo = moment().subtract(1, "months").startOf("day").toDate();
  const today = moment().endOf("day").toDate();

  const invoiceTotalAgg = await Invoice.aggregate([
    {
      $match: {
        createdAt: {
          $gte: oneMonthAgo,
          $lte: today,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$total" },
      },
    },
  ]);

  const invoiceTotalLastMonth =
    invoiceTotalAgg.length > 0 ? invoiceTotalAgg[0].totalAmount : 0;
  // Total Verified Employees Count
  const totalVerifiedEmployees = await User.countDocuments({
    isVerified: true,
  });

  const bomTotalAgg = await BOM.aggregate([
    {
      $match: {
        approved: true,
        createdAt: {
          $gte: oneMonthAgoForBom,
          $lte: todayForBom,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalProductionAmount: { $sum: "$total_cost" },
      },
    },
  ]);

  const totalProductionAmount =
    bomTotalAgg.length > 0 ? bomTotalAgg[0].totalProductionAmount : 0;

  const totalSalesAgg = await Purchase.aggregate([
    {
      $match: {
        createdAt: {
          $gte: oneMonthAgo,
          $lte: today,
        },
      },
    },
    {
      $addFields: {
        total_price: {
          $add: [
            { $multiply: ["$price", "$product_qty"] },
            {
              $divide: [
                {
                  $multiply: [
                    { $multiply: ["$price", "$product_qty"] },
                    "$GST",
                  ],
                },
                100,
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalSalesAmount: { $sum: "$total_price" },
      },
    },
  ]);

  const totalSalesAmount =
    totalSalesAgg.length > 0 ? totalSalesAgg[0].totalSalesAmount : 0;

  const oneMonthAgoProduct = moment()
    .subtract(1, "months")
    .startOf("day")
    .toDate();
  const todayProduct = moment().endOf("day").toDate();

  // ================= Production Chart Summary =================

  let { filter } = req.query; // frontend can send ?filter=weekly|monthly|yearly

  let startDate;
  if (filter === "weekly") {
    startDate = moment().subtract(7, "days").startOf("day").toDate();
  } else if (filter === "monthly") {
    startDate = moment().subtract(30, "days").startOf("day").toDate();
  } else if (filter === "yearly") {
    startDate = moment().subtract(1, "year").startOf("day").toDate();
  }

  const matchCondition = {};
  if (startDate) {
    matchCondition.createdAt = { $gte: startDate, $lte: new Date() };
  }

  // Pre-production statuses
  const preProductionStatuses = [
    "raw material approval pending",
    "Inventory Allocated",
    "request for allow inventory",
    "inventory in transit",
  ];

  const productionChart = await ProductionProcess.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: null,
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        progress: {
          $sum: {
            $cond: [{ $eq: ["$status", "production in progress"] }, 1, 0],
          },
        },
        pre_production: {
          $sum: {
            $cond: [{ $in: ["$status", preProductionStatuses] }, 1, 0],
          },
        },
      },
    },
  ]);

  const chartData =
    productionChart.length > 0
      ? productionChart[0]
      : { completed: 0, progress: 0, pre_production: 0 };

  // ================= Merchant Chart Summary =================
  const merchantMatch = {};
  if (startDate) {
    merchantMatch.createdAt = { $gte: startDate, $lte: new Date() };
  }

  const [indBuyer, indSeller, compBuyer, compSeller, totalInd, totalComp] =
    await Promise.all([
      PartiesModels.countDocuments({
        ...merchantMatch,
        type: "Individual",
        parties_type: "Buyer",
      }),
      PartiesModels.countDocuments({
        ...merchantMatch,
        type: "Individual",
        parties_type: "Seller",
      }),
      PartiesModels.countDocuments({
        ...merchantMatch,
        type: "Company",
        parties_type: "Buyer",
      }),
      PartiesModels.countDocuments({
        ...merchantMatch,
        type: "Company",
        parties_type: "Seller",
      }),
      PartiesModels.countDocuments({ ...merchantMatch, type: "Individual" }),
      PartiesModels.countDocuments({ ...merchantMatch, type: "Company" }),
    ]);

  const merchantChart = {
    individual: {
      buyer: indBuyer,
      seller: indSeller,
    },
    company: {
      buyer: compBuyer,
      seller: compSeller,
    },
    totals: {
      total_individual: totalInd,
      total_company: totalComp,
      total_merchant: totalInd + totalComp,
    },
  };

  // ================= Inventory Chart Summary =================
  const productMatch = {};
  if (startDate) {
    productMatch.createdAt = { $gte: startDate, $lte: new Date() };
  }

  // Raw Materials
  const rawMaterialsCount = await Product.countDocuments({
    ...productMatch,
    category: "raw materials",
  });

  // Finished Goods
  const finishedGoodsCount = await Product.countDocuments({
    ...productMatch,
    category: "finished goods",
  });

  // Indirect Inventory
  const indirectInventoryCount = await Product.countDocuments({
    ...productMatch,
    inventory_category: "indirect",
  });

  // Work in Progress (from ProductionProcess)
  const workInProgressCount = await ProductionProcess.countDocuments({
    ...matchCondition,
    status: "production started",
  });

  const inventoryChart = {
    raw_materials: rawMaterialsCount,
    finished_goods: finishedGoodsCount,
    indirect_inventory: indirectInventoryCount,
    work_in_progress: workInProgressCount,
  };

  const productBuyTotalAgg = await Product.aggregate([
    {
      $match: {
        item_type: "buy",
        inventory_category: { $in: ["direct", "indirect"] },
        createdAt: { $gte: oneMonthAgoProduct, $lte: todayProduct },
      },
    },
    {
      $group: {
        _id: null,
        totalProductBuyPrice: { $sum: "$price" },
      },
    },
  ]);

  const totalProductBuyPriceLastMonth =
    productBuyTotalAgg.length > 0
      ? productBuyTotalAgg[0].totalProductBuyPrice
      : 0;

  res.status(200).json({
    status: 200,
    success: true,

    products: products,
    stores: {
      total_store_count: storeCount,
    },
    boms: {
      total_bom_count: bomCount,
    },

    merchants: merchants[0] || {
      total_supplier_count: 0,
      total_buyer_count: 0,
    },
    approvals_pending: {
      unapproved_product_count: unapprovedProducts,
      unapproved_store_count: unapprovedStores,
      unapproved_merchant_count: unapprovedMerchants,
      unapproved_bom_count: unapprovedBoms,
    },
    employees,
    verified_employees_count: totalVerifiedEmployees,
    total_production_amount: totalProductionAmount,
    total_sales_amount: totalSalesAmount,
    total_product_buy_price: totalProductBuyPriceLastMonth,

    processes: processCountStatusWiseObj,
    proforma_invoices: totalProformaInvoices,
    invoice_summary: {
      total_invoice_amount_last_month: invoiceTotalLastMonth,
    },

    production_chart: chartData, //for production data
    inventory_chart: inventoryChart, //for inventory data
    merchant_chart: merchantChart, // for merchant data

    invoices: totalInvoices,
    payments: totalPayments,
    scrap:
      scrap.length === 0
        ? [{ total_product_count: 0, total_stock_price: 0 }]
        : scrap,
    wip_inventory:
      wipInventory.length === 0
        ? [{ total_product_count: 0, total_stock_price: 0 }]
        : wipInventory,
  });
});

exports.salesData = TryCatch(async (req, res) => {
  const view = req.query.view || "yearly"; // Default yearly
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const currentDate = new Date(); // current system date
  let labels = [];
  let datasets = [];
  let totalSales = 0; // Total sales variable add kiya

  function getISOWeek(date) {
    const tmp = new Date(date.getTime());
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((tmp.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  }

  switch (view) {
    //GET /api/salesData?view=yearly&year=2025
    case "yearly": {
      labels = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const currentYear = Number(req.query.year) || new Date().getFullYear();
      const prevYear = currentYear - 1;

      // Prev Year Sales count (group by month)
      const prevSales = await Purchase.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(`${prevYear}-01-01`),
              $lt: new Date(`${prevYear + 1}-01-01`),
            },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Current Year Sales count
      const currSales = await Purchase.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(`${currentYear}-01-01`),
              $lt: new Date(`${currentYear + 1}-01-01`),
            },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Total sales for current year calculate karo
      totalSales = currSales.reduce((sum, item) => sum + item.total, 0);

      const prevData = Array(12).fill(0);
      const currData = Array(12).fill(0);

      prevSales.forEach((item) => {
        prevData[item._id - 1] = item.total;
      });
      currSales.forEach((item) => {
        currData[item._id - 1] = item.total;
      });

      datasets = [
        { label: String(prevYear), data: prevData },
        { label: String(currentYear), data: currData },
      ];

      break;
    }

    // GET /api/salesData?view=monthly&month=7&year=2025
    case "monthly": {
      const monthMap = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        oct: 10,
        nov: 11,
        dec: 12,
      };

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const monthStr = (req.query.month || "").toLowerCase();
      const currentMonth = monthMap[monthStr] || currentDate.getMonth() + 1;

      let currMonthYear = Number(req.query.year) || currentDate.getFullYear();
      let prevMonth = currentMonth - 1;
      let prevMonthYear = currMonthYear;

      if (prevMonth === 0) {
        prevMonth = 12;
        prevMonthYear -= 1;
      }

      const daysInMonth = new Date(currMonthYear, currentMonth, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

      const prevStart = new Date(prevMonthYear, prevMonth - 1, 1);
      const prevEnd = new Date(prevMonthYear, prevMonth, 1);

      const currStart = new Date(currMonthYear, currentMonth - 1, 1);
      const currEnd = new Date(currMonthYear, currentMonth, 1);

      const prevSales = await Purchase.aggregate([
        {
          $match: {
            createdAt: { $gte: prevStart, $lt: prevEnd },
          },
        },
        {
          $group: {
            _id: { $dayOfMonth: "$createdAt" },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const currSales = await Purchase.aggregate([
        {
          $match: {
            createdAt: { $gte: currStart, $lt: currEnd },
          },
        },
        {
          $group: {
            _id: { $dayOfMonth: "$createdAt" },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Total sales for current month calculate karo
      totalSales = currSales.reduce((sum, item) => sum + item.total, 0);

      const prevData = Array(daysInMonth).fill(0);
      const currData = Array(daysInMonth).fill(0);

      prevSales.forEach((item) => {
        if (item._id <= daysInMonth) {
          prevData[item._id - 1] = item.total;
        }
      });

      currSales.forEach((item) => {
        currData[item._id - 1] = item.total;
      });

      datasets = [
        { label: monthNames[prevMonth - 1], data: prevData },
        { label: monthNames[currentMonth - 1], data: currData },
      ];

      break;
    }

    //  http://localhost:8085/api/dashboard/sales?view=weekly&month=aug
    case "weekly": {
      const monthMap = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        oct: 10,
        nov: 11,
        dec: 12,
      };

      // Determine month from query parameter, default to current month if not provided or invalid
      const monthStr = (req.query.month || "").toLowerCase();
      const month =
        monthMap[monthStr] ||
        Number(req.query.month) ||
        currentDate.getMonth() + 1;
      const year = Number(req.query.year) || currentDate.getFullYear();

      // Calculate date ranges
      const startOfCurrentMonth = new Date(year, month - 1, 1);
      const endOfCurrentMonth = new Date(year, month, 0, 23, 59, 59, 999);

      // Handle previous month with year adjustment
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
      }

      const startOfPrevMonth = new Date(prevYear, prevMonth - 1, 1);
      const endOfPrevMonth = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

      // Function to get week numbers in a month (W1, W2, W3, W4)
      const getWeekNumbersForMonth = (start, end) => {
        const weeks = [];
        let current = new Date(start);

        // Always start with W1 for the first week of the month
        let weekCount = 1;

        while (current <= end) {
          weeks.push(`W${weekCount}`);
          weekCount++;
          // Move to next week
          current.setDate(current.getDate() + 7);
        }

        return weeks;
      };

      // Get week labels for both months
      const prevMonthWeeks = getWeekNumbersForMonth(
        startOfPrevMonth,
        endOfPrevMonth
      );
      const currMonthWeeks = getWeekNumbersForMonth(
        startOfCurrentMonth,
        endOfCurrentMonth
      );

      // Create combined labels (W1, W2, W3, W4 for both months)
      labels = [...prevMonthWeeks, ...currMonthWeeks];

      // Previous month sales by week
      const prevSales = await Purchase.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
          },
        },
        {
          $addFields: {
            weekOfMonth: {
              $ceil: {
                $divide: [{ $dayOfMonth: "$createdAt" }, 7],
              },
            },
          },
        },
        {
          $group: {
            _id: "$weekOfMonth",
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Current month sales by week
      const currSales = await Purchase.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
          },
        },
        {
          $addFields: {
            weekOfMonth: {
              $ceil: {
                $divide: [{ $dayOfMonth: "$createdAt" }, 7],
              },
            },
          },
        },
        {
          $group: {
            _id: "$weekOfMonth",
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Total sales for current month
      const totalSales = currSales.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );

      // Prepare data arrays
      const prevData = Array(prevMonthWeeks.length).fill(0);
      const currData = Array(currMonthWeeks.length).fill(0);

      // Fill data arrays
      prevSales.forEach((item) => {
        if (item._id <= prevData.length) {
          prevData[item._id - 1] = item.total || 0;
        }
      });

      currSales.forEach((item) => {
        if (item._id <= currData.length) {
          currData[item._id - 1] = item.total || 0;
        }
      });

      datasets = [
        {
          label: `${startOfPrevMonth.toLocaleString("default", {
            month: "short",
          })} ${prevYear}`,
          data: prevData,
        },
        {
          label: `${startOfCurrentMonth.toLocaleString("default", {
            month: "short",
          })} ${year}`,
          data: currData,
        },
      ];

      break;
    }
    default: {
      return res.status(400).json({
        success: false,
        message:
          "Invalid view type. Use 'yearly', 'monthly', 'weekly' or 'daily'.",
      });
    }
  }

  // Response mein totalSales add karo
  res.status(200).json({
    success: true,
    data: "mil rha hai----",
    labels,
    datasets,
    totalSales, // Total sales response mein add kiya
  });
});

// ***************************************************** DISPATCH API*****************
// Yearly data
// GET /api/dispatch-data?view=yearly&year=2024

// Monthly data with number
// GET /api/dispatch-data?view=monthly&year=2024&month=8
// GET /api/dispatch-data?view=monthly&year=2024&month=august
// GET /api/dispatch-data?view=monthly&year=2024&month=aug

// Current week in current month
// GET /api/dispatch-data?view=weekly

exports.dispatchData = TryCatch(async (req, res) => {
  const { view, year, month } = req.query;

  // Input validation
  if (!view || !["yearly", "monthly", "weekly"].includes(view)) {
    return res.status(400).json({
      success: false,
      message: "Invalid view. Use yearly, monthly, or weekly.",
    });
  }

  // For weekly view, we don't need year/month parameters - always use current rolling week
  if (view === "weekly") {
    // Skip year/month validation for weekly - it's always current
  } else {
    // Year validation for monthly and yearly
    if (!year || isNaN(year)) {
      return res.status(400).json({
        success: false,
        message: "Valid year is required.",
      });
    }
  }

  const yearNum = year ? parseInt(year) : new Date().getFullYear();
  const currentYear = new Date().getFullYear();

  if (view !== "weekly" && (yearNum < 2000 || yearNum > currentYear + 1)) {
    return res.status(400).json({
      success: false,
      message: "Year should be between 2000 and " + (currentYear + 1),
    });
  }

  let startDate, endDate;

  try {
    // Set date range based on view
    switch (view) {
      case "yearly":
        startDate = new Date(yearNum, 0, 1, 0, 0, 0, 0);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
        break;

      case "monthly":
        if (!month) {
          return res.status(400).json({
            success: false,
            message: "Month is required for monthly view.",
          });
        }

        // Improved month parsing
        let monthIndex;
        if (isNaN(month)) {
          const monthNames = [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
          ];
          const monthStr = month.toLowerCase().substring(0, 3);
          monthIndex = monthNames.indexOf(monthStr);

          if (monthIndex === -1) {
            return res.status(400).json({
              success: false,
              message: "Invalid month format. Use month name or number (1-12).",
            });
          }
        } else {
          monthIndex = parseInt(month) - 1;
          if (monthIndex < 0 || monthIndex > 11) {
            return res.status(400).json({
              success: false,
              message: "Month should be between 1-12.",
            });
          }
        }

        startDate = new Date(yearNum, monthIndex, 1, 0, 0, 0, 0);
        endDate = new Date(yearNum, monthIndex + 1, 0, 23, 59, 59, 999);
        break;

      case "weekly":
        // Rolling 7-day window: 3 days back + today + 3 days forward
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Start: 3 days before today
        const weekStartDate = new Date(today);
        weekStartDate.setDate(today.getDate() - 3);
        weekStartDate.setHours(0, 0, 0, 0);

        // End: 3 days after today
        const weekEndDate = new Date(today);
        weekEndDate.setDate(today.getDate() + 3);
        weekEndDate.setHours(23, 59, 59, 999);

        startDate = weekStartDate;
        endDate = weekEndDate;
        break;
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid date created");
    }
  } catch (error) {
    console.error("Date creation error:", error);
    return res.status(400).json({
      success: false,
      message: "Invalid date parameters.",
    });
  }

  try {
    // Fetch and aggregate data
    const totalData = await DispatchModel.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    console.log("Total Data Count:", totalData.length); // Debug: Check data count
    console.log("Date Range:", { startDate, endDate }); // Debug: Check date range

    let categories,
      data = {};

    switch (view) {
      case "yearly":
        categories = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        totalData.forEach((item) => {
          if (!item.createdAt || isNaN(new Date(item.createdAt).getTime())) {
            console.warn("Invalid createdAt date:", item.createdAt);
            return;
          }

          const month = new Date(item.createdAt).toLocaleDateString("en-US", {
            month: "short",
          });
          const status = item.dispatch_status?.toLowerCase()?.trim();

          console.log("Processing - Month:", month, "Status:", status); // Debug

          if (!data[month]) {
            data[month] = { dispatch: 0, deliver: 0 };
          }

          if (status === "dispatch") {
            data[month].dispatch++;
          } else if (status === "delivered") {
            data[month].deliver++;
          }
        });
        break;

      case "monthly":
        const numDays = endDate.getDate();
        categories = Array.from({ length: numDays }, (_, i) => String(i + 1));

        totalData.forEach((item) => {
          if (!item.createdAt || isNaN(new Date(item.createdAt).getTime())) {
            console.warn("Invalid createdAt date:", item.createdAt);
            return;
          }

          const day = new Date(item.createdAt).getDate().toString();
          const status = item.dispatch_status?.toLowerCase()?.trim();

          console.log("Processing - Day:", day, "Status:", status); // Debug

          if (!data[day]) {
            data[day] = { dispatch: 0, deliver: 0 };
          }

          if (status === "dispatch") {
            data[day].dispatch++;
          } else if (status === "delivered") {
            data[day].deliver++;
          }
        });
        break;

      case "weekly":
        // Rolling 7-day window: 3 days back + today + 3 days forward
        const today = new Date();
        const todayDateString = today.toDateString();

        // Create 7-day labels with actual dates and day names
        categories = [];
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        // Generate labels for 7 days (-3 to +3)
        for (let i = -3; i <= 3; i++) {
          const currentDay = new Date(today);
          currentDay.setDate(today.getDate() + i);

          const dayName = dayNames[currentDay.getDay()];
          const dateNum = currentDay.getDate();
          const monthName = currentDay.toLocaleDateString("en-US", {
            month: "short",
          });

          let label;
          if (i === 0) {
            // Today's label - make it special
            label = `Today ${dateNum}`;
          } else {
            label = `${dayName} ${dateNum}`;
          }

          categories.push(label);
        }

        totalData.forEach((item) => {
          if (!item.createdAt || isNaN(new Date(item.createdAt).getTime())) {
            console.warn("Invalid createdAt date:", item.createdAt);
            return;
          }

          const itemDate = new Date(item.createdAt);
          const status = item.dispatch_status?.toLowerCase()?.trim();

          // Find which day index this item belongs to (-3 to +3)
          const daysDiff = Math.floor(
            (itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff >= -3 && daysDiff <= 3) {
            const dayIndex = daysDiff + 3; // Convert to 0-6 index
            const dayKey = categories[dayIndex];

            console.log(
              "Processing - Day:",
              dayKey,
              "Status:",
              status,
              "Diff:",
              daysDiff
            ); // Debug

            if (!data[dayKey]) {
              data[dayKey] = { dispatch: 0, deliver: 0 };
            }

            if (status === "dispatch") {
              data[dayKey].dispatch++;
            } else if (status === "delivered") {
              data[dayKey].deliver++;
            }
          }
        });
        break;
    }

    // Fill missing categories with zero
    categories.forEach((cat) => {
      if (!data[cat]) {
        data[cat] = { dispatch: 0, deliver: 0 };
      }
    });

    // Build response arrays
    const dispatchData = categories.map((cat) => data[cat].dispatch);
    const deliverData = categories.map((cat) => data[cat].deliver);

    // Calculate totals for additional info
    const totalDispatched = dispatchData.reduce((sum, val) => sum + val, 0);
    const totalDelivered = deliverData.reduce((sum, val) => sum + val, 0);

    const response = {
      success: true,
      title: view.charAt(0).toUpperCase() + view.slice(1),
      labels: categories,
      datasets: [
        {
          label: "Dispatch",
          data: dispatchData,
          backgroundColor: "#ADD8E6",
          borderColor: "#87CEEB",
          borderWidth: 1,
        },
        {
          label: "Deliver",
          data: deliverData,
          backgroundColor: "#FFC0CB",
          borderColor: "#FFB6C1",
          borderWidth: 1,
        },
      ],
      summary: {
        totalDispatched,
        totalDelivered,
        totalOrders: totalDispatched + totalDelivered,
        period:
          view === "yearly"
            ? `Year ${year}`
            : view === "monthly"
            ? `${month}/${year}`
            : `Rolling 7 Days (${startDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })} - ${endDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })})`,
        weekInfo:
          view === "weekly"
            ? {
                weekStart: startDate.toISOString().split("T")[0],
                weekEnd: endDate.toISOString().split("T")[0],
                centerDate: new Date().toISOString().split("T")[0], // Today's date
                type: "rolling_week",
              }
            : undefined,
      },
    };

    console.log("Response Summary:", response.summary); // Debug
    res.status(200).json(response);
  } catch (error) {
    console.error("Database or processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching data.",
    });
  }
});

// ************************** NEW SEPARATE FUNCTION FOR FINANCIAL SUMMARY ****************

// For year
// http://localhost:8085/api/dashboard/finance?view=yearly&year=2025

// For month
// http://localhost:8085/api/dashboard/finance?view=monthly&year=2025&mon=7

// For week
// http://localhost:8085/api/dashboard/finance?view=weekly

exports.financialSummary = TryCatch(async (req, res) => {
  const { view, year, mon } = req.query;

  console.log("Financial Summary Request:", { view, year, mon });

  let dateCondition = {};
  let startDate, endDate;

  // ========== DATE FILTERING LOGIC BASED ON VIEW ==========
  if (view === "yearly" && year) {
    // FIXED: Yearly view - entire year data (create fresh date object for specific year)
    startDate = moment(`${year}-01-01`).startOf("day").toDate();
    endDate = moment(`${year}-12-31`).endOf("day").toDate();

    dateCondition = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    console.log(`Yearly filter applied for year: ${year}`, {
      startDate: moment(startDate).format("YYYY-MM-DD HH:mm:ss"),
      endDate: moment(endDate).format("YYYY-MM-DD HH:mm:ss"),
    });
  } else if (view === "monthly" && year) {
    // If month is not provided, default to current month
    const currentMonth = mon || new Date().getMonth() + 1;
    let monthIndex;

    if (!isNaN(currentMonth)) {
      // ✅ Agar month number aaya (1–12)
      monthIndex = parseInt(currentMonth) - 1; // moment index 0–11 hota hai
    } else {
      // ✅ Agar month string aaya (Jan / January / Aug / August)
      monthIndex = moment(currentMonth, ["MMM", "MMMM"]).month();
    }

    startDate = moment({ year: parseInt(year), month: monthIndex })
      .startOf("month")
      .toDate();

    endDate = moment({ year: parseInt(year), month: monthIndex })
      .endOf("month")
      .toDate();

    dateCondition = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    console.log(
      `Monthly filter applied for: ${currentMonth} ${year}${
        !mon ? " (defaulted to current month)" : ""
      }`,
      {
        monthIndex,
        startDate: moment(startDate).format("YYYY-MM-DD HH:mm:ss"),
        endDate: moment(endDate).format("YYYY-MM-DD HH:mm:ss"),
      }
    );
  } else if (view === "weekly") {
    // Weekly view - current day ke piche 6 days (total 7 days including today)
    endDate = moment().endOf("day").toDate();
    startDate = moment().subtract(6, "days").startOf("day").toDate();

    dateCondition = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    console.log(
      `Weekly filter applied from: ${moment(startDate).format(
        "YYYY-MM-DD"
      )} to: ${moment(endDate).format("YYYY-MM-DD")}`
    );
  } else {
    // Default - no date filtering, return all data
    console.log("No specific date filter applied - returning all data");
  }

  // ========== PROFORMA INVOICE SUMMARY ==========
  const totalProformaInvoices = await ProformaInvoice.countDocuments(
    dateCondition
  );

  const proformaAmountAgg = await ProformaInvoice.aggregate([
    { $match: dateCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$total_amount" },
      },
    },
  ]);
  const totalProformaAmount =
    proformaAmountAgg.length > 0 ? proformaAmountAgg[0].totalAmount : 0;

  // Get status-wise breakdown for ProformaInvoices
  const proformaStatusAgg = await ProformaInvoice.aggregate([
    { $match: dateCondition },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$total_amount" },
      },
    },
  ]);

  // ========== INVOICE SUMMARY ==========
  const totalInvoices = await Invoice.countDocuments(dateCondition);

  const invoiceAmountAgg = await Invoice.aggregate([
    { $match: dateCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$total" },
      },
    },
  ]);
  const totalInvoiceAmount =
    invoiceAmountAgg.length > 0 ? invoiceAmountAgg[0].totalAmount : 0;

  // Get status-wise breakdown for Invoices
  const invoiceStatusAgg = await Invoice.aggregate([
    { $match: dateCondition },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$total" },
      },
    },
  ]);

  // ========== PAYMENT SUMMARY ==========
  const totalPayments = await Payment.countDocuments(dateCondition);

  const paymentAmountAgg = await Payment.aggregate([
    { $match: dateCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);
  const totalPaymentAmount =
    paymentAmountAgg.length > 0 ? paymentAmountAgg[0].totalAmount : 0;

  // Get status-wise breakdown for Payments
  const paymentStatusAgg = await Payment.aggregate([
    { $match: dateCondition },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // ========== MONTHLY BREAKDOWN FOR YEARLY VIEW ==========
  let monthlyBreakdown = [];
  if (view === "yearly" && year) {
    monthlyBreakdown = await Invoice.aggregate([
      { $match: dateCondition },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          invoiceCount: { $sum: 1 },
          totalAmount: { $sum: "$total" },
        },
      },
      {
        $project: {
          month: "$_id.month",
          year: "$_id.year",
          monthName: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id.month", 1] }, then: "January" },
                { case: { $eq: ["$_id.month", 2] }, then: "February" },
                { case: { $eq: ["$_id.month", 3] }, then: "March" },
                { case: { $eq: ["$_id.month", 4] }, then: "April" },
                { case: { $eq: ["$_id.month", 5] }, then: "May" },
                { case: { $eq: ["$_id.month", 6] }, then: "June" },
                { case: { $eq: ["$_id.month", 7] }, then: "July" },
                { case: { $eq: ["$_id.month", 8] }, then: "August" },
                { case: { $eq: ["$_id.month", 9] }, then: "September" },
                { case: { $eq: ["$_id.month", 10] }, then: "October" },
                { case: { $eq: ["$_id.month", 11] }, then: "November" },
                { case: { $eq: ["$_id.month", 12] }, then: "December" },
              ],
              default: "Unknown",
            },
          },
          invoiceCount: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]);
  }

  // ========== DAILY BREAKDOWN FOR WEEKLY VIEW ==========
  let dailyBreakdown = [];
  if (view === "weekly") {
    dailyBreakdown = await Invoice.aggregate([
      { $match: dateCondition },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$createdAt" },
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          invoiceCount: { $sum: 1 },
          totalAmount: { $sum: "$total" },
        },
      },
      {
        $project: {
          date: "$_id.date",
          day: "$_id.day",
          month: "$_id.month",
          year: "$_id.year",
          invoiceCount: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ]);
  }

  // ========== RESPONSE ==========
  res.status(200).json({
    status: 200,
    success: true,
    message: `Financial summary for ${view} view`,
    filter_applied: {
      view: view || "all",
      year: year || null,
      month: mon || null,
      date_range: dateCondition.createdAt
        ? {
            from: moment(dateCondition.createdAt.$gte).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
            to: moment(dateCondition.createdAt.$lte).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          }
        : "No date filter",
    },

    // ProformaInvoice Summary
    proforma_invoices: {
      total_count: totalProformaInvoices,
      total_amount: totalProformaAmount,
      status_wise: proformaStatusAgg.reduce((acc, item) => {
        acc[item._id || "unknown"] = {
          count: item.count,
          amount: item.totalAmount,
        };
        return acc;
      }, {}),
    },

    // Invoice Summary
    invoices: {
      total_count: totalInvoices,
      total_amount: totalInvoiceAmount,
      status_wise: invoiceStatusAgg.reduce((acc, item) => {
        acc[item._id || "unknown"] = {
          count: item.count,
          amount: item.totalAmount,
        };
        return acc;
      }, {}),
    },

    // Payment Summary
    payments: {
      total_count: totalPayments,
      total_amount: totalPaymentAmount,
      status_wise: paymentStatusAgg.reduce((acc, item) => {
        acc[item._id || "unknown"] = {
          count: item.count,
          amount: item.totalAmount,
        };
        return acc;
      }, {}),
    },

    // Additional breakdowns based on view
    ...(view === "yearly" &&
      monthlyBreakdown.length > 0 && {
        monthly_breakdown: monthlyBreakdown,
      }),

    ...(view === "weekly" &&
      dailyBreakdown.length > 0 && {
        daily_breakdown: dailyBreakdown,
      }),
  });
});

// http://localhost:8085/api/dashboard/sales-delivered
// It gives the status of Monthly Sales and Completed Order
exports.getMonthlySalesAndDelivered = TryCatch(async (req, res, next) => {
  // Step 1: Get current date and normalize to start of the day in UTC
  const currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0); // Normalize to start of the day in UTC
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();
  const currentDay = currentDate.getDate();

  console.log({ currentMonth, currentYear, currentDay }); // Debug

  // Step 2: Calculate previous month
  const prevMonth = currentMonth - 1 > 0 ? currentMonth - 1 : 12;
  const prevYear = currentMonth - 1 > 0 ? currentYear : currentYear - 1;

  // Step 3: Set date ranges for current and previous month
  const currStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  const currEnd = new Date(
    Date.UTC(currentYear, currentMonth - 1, currentDay + 1)
  ); // Up to today

  const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const prevEnd = new Date(Date.UTC(prevYear, prevMonth, 1)); // Full previous month

  // Step 4: Aggregate sales for current month (1st to current date)
  const currSales = await Purchase.aggregate([
    {
      $match: {
        createdAt: { $gte: currStart, $lt: currEnd },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
      },
    },
  ]);

  // Step 5: Aggregate sales for previous month (full month)
  const prevSales = await Purchase.aggregate([
    {
      $match: {
        createdAt: { $gte: prevStart, $lt: prevEnd },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
      },
    },
  ]);

  // Step 6: Aggregate delivered count for current month (1st to current date)
  const currDelivered = await DispatchModel.aggregate([
    {
      $match: {
        createdAt: { $gte: currStart, $lt: currEnd },
        // dispatch_status: { $regex: "^Delivered$", $options: "i" }, // Case-insensitive match for "Delivered"
        $expr: { $eq: ["$quantity", "$dispatch_qty"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
      },
    },
  ]);

  // Step 7: Aggregate delivered count for previous month (full month)
  const prevDelivered = await DispatchModel.aggregate([
    {
      $match: {
        createdAt: { $gte: prevStart, $lt: prevEnd },
        // dispatch_status: { $regex: "^Delivered$", $options: "i" }, // Case-insensitive match for "Delivered"
        $expr: { $eq: ["$quantity", "$dispatch_qty"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
      },
    },
  ]);

  // Step 8: Extract total sales and delivered counts
  const currentMonthSales = currSales.length > 0 ? currSales[0].total : 0;
  const previousMonthSales = prevSales.length > 0 ? prevSales[0].total : 0;
  const differenceInSales = currentMonthSales - previousMonthSales;

  const currentMonthDelivered =
    currDelivered.length > 0 ? currDelivered[0].total : 0;
  const previousMonthDelivered =
    prevDelivered.length > 0 ? prevDelivered[0].total : 0;
  const differenceInDelivered = currentMonthDelivered - previousMonthDelivered;

  // Step 9: Send unified response
  res.status(200).json({
    success: true,
    sales: {
      currentMonthSales,
      previousMonthSales,
      differenceInSales,
    },
    delivered: {
      currentMonthDelivered,
      previousMonthDelivered,
      differenceInDelivered,
    },
    period: {
      currentMonth: `${currentMonth}/${currentYear}`,
      previousMonth: `${prevMonth}/${prevYear}`,
    },
  });
});

// New GET endpoint for dashboard with filter parameter
exports.dashboardWithFilter = TryCatch(async (req, res) => {
  const { filter } = req.query;

  console.log("Dashboard filter request:", { filter });

  let dateCondition = {};
  let startDate, endDate;

  // ========== DATE FILTERING LOGIC BASED ON FILTER ==========
  if (filter === "yearly") {
    // Yearly view - current year data
    const currentYear = new Date().getFullYear();
    startDate = moment(`${currentYear}-01-01`).startOf("day").toDate();
    endDate = moment(`${currentYear}-12-31`).endOf("day").toDate();

    dateCondition = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    console.log(`Yearly filter applied for year: ${currentYear}`, {
      startDate: moment(startDate).format("YYYY-MM-DD HH:mm:ss"),
      endDate: moment(endDate).format("YYYY-MM-DD HH:mm:ss"),
    });
  } else if (filter === "monthly") {
    // Monthly view - current month data
    startDate = moment().startOf("month").toDate();
    endDate = moment().endOf("month").toDate();

    dateCondition = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    console.log("Monthly filter applied for current month", {
      startDate: moment(startDate).format("YYYY-MM-DD HH:mm:ss"),
      endDate: moment(endDate).format("YYYY-MM-DD HH:mm:ss"),
    });
  } else if (filter === "weekly") {
    // Weekly view - last 7 days including today
    endDate = moment().endOf("day").toDate();
    startDate = moment().subtract(6, "days").startOf("day").toDate();

    dateCondition = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    console.log(
      `Weekly filter applied from: ${moment(startDate).format(
        "YYYY-MM-DD"
      )} to: ${moment(endDate).format("YYYY-MM-DD")}`
    );
  } else {
    // Default - no date filtering, return all data
    console.log("No specific date filter applied - returning all data");
  }

  // ========== PRODUCTION CHART DATA ==========
  const productionPipeline = [
    {
      $group: {
        _id: null,
        completed: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
          },
        },
        progress: {
          $sum: {
            $cond: [{ $eq: ["$status", "production in progress"] }, 1, 0],
          },
        },
        pre_production: {
          $sum: {
            $cond: [
              {
                $in: [
                  "$status",
                  ["raw material approval pending", "Inventory Allocated"],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ];

  if (Object.keys(dateCondition).length > 0) {
    productionPipeline.unshift({
      $match: {
        ...dateCondition,
        approved: true,
      },
    });
  } else {
    productionPipeline.unshift({
      $match: {
        approved: true,
      },
    });
  }

  const productionChart = await ProductionProcess.aggregate(productionPipeline);

  // ========== INVENTORY CHART DATA ==========
  const productMatch = { approved: true };
  if (Object.keys(dateCondition).length > 0) {
    productMatch.createdAt = dateCondition.createdAt;
  }

  // Raw Materials
  const rawMaterialsCount = await Product.countDocuments({
    ...productMatch,
    category: "raw materials",
  });

  // Finished Goods
  const finishedGoodsCount = await Product.countDocuments({
    ...productMatch,
    category: "finished goods",
  });

  // Indirect Inventory
  const indirectInventoryCount = await Product.countDocuments({
    ...productMatch,
    inventory_category: "indirect",
  });

  // Work in Progress (from ProductionProcess)
  const processMatch = { approved: true };
  if (Object.keys(dateCondition).length > 0) {
    processMatch.createdAt = dateCondition.createdAt;
  }

  const workInProgressCount = await ProductionProcess.countDocuments({
    ...processMatch,
    status: "production started",
  });

  const inventoryChart = {
    raw_materials: rawMaterialsCount,
    finished_goods: finishedGoodsCount,
    indirect_inventory: indirectInventoryCount,
    work_in_progress: workInProgressCount,
  };

  // ========== MERCHANT CHART DATA ==========
  const merchantPipeline = [
    {
      $group: {
        _id: "$type",
        buyers: {
          $sum: {
            $cond: [{ $eq: ["$parties_type", "Buyer"] }, 1, 0],
          },
        },
        sellers: {
          $sum: {
            $cond: [{ $eq: ["$parties_type", "Seller"] }, 1, 0],
          },
        },
        total: { $sum: 1 },
      },
    },
  ];

  if (Object.keys(dateCondition).length > 0) {
    merchantPipeline.unshift({
      $match: dateCondition,
    });
  }

  const merchantData = await PartiesModels.aggregate(merchantPipeline);

  // Transform merchant data
  const merchantChart = {
    individual: { buyer: 0, seller: 0 },
    company: { buyer: 0, seller: 0 },
    totals: { total_individual: 0, total_company: 0, total_merchant: 0 },
  };

  merchantData.forEach((item) => {
    if (item._id === "Individual") {
      merchantChart.individual.buyer = item.buyers;
      merchantChart.individual.seller = item.sellers;
      merchantChart.totals.total_individual = item.total;
    } else if (item._id === "Company") {
      merchantChart.company.buyer = item.buyers;
      merchantChart.company.seller = item.sellers;
      merchantChart.totals.total_company = item.total;
    }
  });

  merchantChart.totals.total_merchant =
    merchantChart.totals.total_individual + merchantChart.totals.total_company;

  res.status(200).json({
    status: 200,
    success: true,
    message: `Dashboard data for ${filter || "all"} view`,
    filter_applied: {
      filter: filter || "none",
      date_range:
        Object.keys(dateCondition).length > 0
          ? `${moment(startDate).format("YYYY-MM-DD")} to ${moment(
              endDate
            ).format("YYYY-MM-DD")}`
          : "No date filter",
    },
    production_chart: productionChart[0] || {
      completed: 0,
      progress: 0,
      pre_production: 0,
    },
    inventory_chart: inventoryChart,
    merchant_chart: merchantChart,
  });
});

////--> New version of machine code
// http://localhost:8085/api/dashboard/get-machine-list?device_id=LOOM1
// exports.getAllMachines = TryCatch(async (req, res) => {
//   const { device_id } = req.query;  // 🔄 machine → device_id

//   // 🔒 Check if device_id is provided
//   if (!device_id) {
//     return res.status(400).json({
//       success: false,
//       message: "device_id is required in query",
//     });
//   }

//   // 📦 Fetch all records for the device_id
//   const allRecords = await MachineStatus.find({ device_id });

//   // 🕐 Get the most recent one (by timestamp)
//   const latestRecord = await MachineStatus.findOne({ device_id }).sort({
//     timestamp: -1,
//   });

//   res.status(200).json({
//     success: true,
//     message: `Data for device_id: ${device_id}`,
//     latest: latestRecord,
//     history: allRecords,
//   });
// });

// This is the api which will take data from machine server and push the data in database
// To save machine data in database
exports.machineStatus = TryCatch(async (req, res) => {
  console.log("📡 Fetching device data");

  let externalData = [];
  try {
    const apiResponse = await axios.get("http://192.168.1.35:5000/data", {
      timeout: 5000,
    });
    externalData = apiResponse.data;
    console.log("📦 External data:", externalData);
  } catch (error) {
    console.error("❌ External API call failed:", error.message);
    return res.status(503).json({
      success: false,
      message: "Failed to fetch data from external device server",
      error: error.message,
    });
  }

  if (!Array.isArray(externalData) || externalData.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No data received from external API",
      data: [],
    });
  }

  // 1️⃣ Load or create device registry
  let deviceRegistry = await MachineRegistry.findOne();
  if (!deviceRegistry) {
    deviceRegistry = new MachineRegistry({ devices: [] });
  }

  const existingDevices = new Set(deviceRegistry.devices);

  // 🚀 OPTIMIZATION: Prepare data for bulk operations
  const validItems = [];
  const deviceIds = new Set();
  const designs = new Set();
  const statuses = new Set();

  // Step 1: Validate and prepare data
  for (const item of externalData) {
    const {
      device_id,
      count,
      design,
      efficiency,
      error1,
      error2,
      shift,
      status,
      timestamp,
    } = item;

    // Validate required fields
    if (!device_id || !status) {
      console.error(
        `❌ Missing required fields for item: ${JSON.stringify(item)}`
      );
      continue; // Skip this item if required fields are missing
    }

    validItems.push({
      device_id,
      count,
      design,
      efficiency,
      error1,
      error2,
      shift,
      status,
      timestamp,
    });

    deviceIds.add(device_id);
    designs.add(design);
    statuses.add(status);
  }

  // Step 2: Single bulk query to get all existing records
  const existingRecords = await MachineStatus.find({
    device_id: { $in: Array.from(deviceIds) },
    design: { $in: Array.from(designs) },
    status: { $in: Array.from(statuses) },
  });

  // Step 3: Create lookup map for faster access
  const existingMap = new Map();
  existingRecords.forEach((record) => {
    const key = `${record.device_id}_${record.design}_${record.status}`;
    existingMap.set(key, record);
  });

  // Step 4: Prepare bulk operations
  const bulkOperations = [];
  const currentDate = new Date().toISOString().split("T")[0]; // e.g., "2025-09-04"

  for (const item of validItems) {
    const {
      device_id,
      count,
      design,
      efficiency,
      error1,
      error2,
      shift,
      status,
      timestamp,
    } = item;

    const itemDate = moment(timestamp).toISOString().split("T")[0]; // Extract date from timestamp
    const key = `${device_id}_${design}_${status}`;
    const existing = existingMap.get(key);

    if (existing) {
      const isSameData =
        existing.count === count &&
        existing.efficiency === efficiency &&
        existing.error1 === error1 &&
        existing.error2 === error2 &&
        existing.shift === shift;

      if (itemDate === currentDate) {
        // Update existing document if date is today
        if (!isSameData || existing.shift !== shift) {
          if (existing.shift !== shift) {
            // 🆕 Save new record if shift is different
            bulkOperations.push({
              insertOne: {
                document: {
                  device_id,
                  count,
                  design,
                  efficiency,
                  error1,
                  error2,
                  shift,
                  status,
                  timestamp,
                },
              },
            });
            console.log(
              `✅ New record queued for ${device_id} at ${timestamp} with design ${design} due to different shift`
            );
          } else {
            // 🔁 Update only changed fields if shift is same
            bulkOperations.push({
              updateOne: {
                filter: { _id: existing._id },
                update: {
                  $set: {
                    count,
                    efficiency,
                    error1,
                    error2,
                    timestamp,
                  },
                },
              },
            });
            console.log(
              `🔁 Update queued for ${device_id} at ${timestamp} with design ${design}`
            );
          }
        } else {
          console.log(
            `⚠️ No change for ${device_id} around ${timestamp} with design ${design}, skipping.`
          );
        }
      } else {
        // 🆕 Save new document if date is different (e.g., new day)
        bulkOperations.push({
          insertOne: {
            document: {
              device_id,
              count,
              design,
              efficiency,
              error1,
              error2,
              shift,
              status,
              timestamp,
            },
          },
        });
        console.log(
          `✅ New record queued for ${device_id} at ${timestamp} with design ${design} due to new date`
        );
      }
    } else {
      // 🆕 Save new record if no existing record found
      bulkOperations.push({
        insertOne: {
          document: {
            device_id,
            count,
            design,
            efficiency,
            error1,
            error2,
            shift,
            status,
            timestamp,
          },
        },
      });
      console.log(
        `✅ New record queued for ${device_id} at ${timestamp} with design ${design}`
      );
    }

    // Add device to registry if not already present
    if (!existingDevices.has(device_id)) {
      existingDevices.add(device_id);
    }
  }

  // Step 5: Execute bulk operations
  if (bulkOperations.length > 0) {
    try {
      const result = await MachineStatus.bulkWrite(bulkOperations);
      console.log(
        `✅ Bulk operations completed: ${result.insertedCount} inserted, ${result.modifiedCount} updated`
      );
    } catch (error) {
      console.error("❌ Bulk operations failed:", error);
      // Fallback to individual operations if bulk fails
      console.log("🔄 Falling back to individual operations...");
      for (const operation of bulkOperations) {
        try {
          if (operation.insertOne) {
            const newRecord = new MachineStatus(operation.insertOne.document);
            await newRecord.save();
          } else if (operation.updateOne) {
            await MachineStatus.updateOne(
              operation.updateOne.filter,
              operation.updateOne.update
            );
          }
        } catch (individualError) {
          console.error("❌ Individual operation failed:", individualError);
        }
      }
    }
  }

  // Save updated registry
  deviceRegistry.devices = Array.from(existingDevices);
  await deviceRegistry.save();
  console.log("✅ Device registry updated");

  // Final response
  res.status(200).json({
    success: true,
    message: "Device data saved and registry updated",
    devices: deviceRegistry.devices,
  });
});

// this is the api which will show the results in the dashboard
//It has 5 parts
// http://localhost:8085/api/dashboard/machine-data?date=2025-09-04   //for date query
http://localhost:8085/api/dashboard/machine-data?design=Design123   // for Design query
// http://localhost:8085/api/dashboard/machine-data?device_id=PC-001    // for machine query
// http://localhost:5000/api/dashboard/machine-data?device_id=PC-001&design=Design123& date=2025-09-04  // for mixed query, when we have all query parameter

// http://localhost:5000/api/dashboard/machine-data?start_date=2025-09-01&end_date=2025-09-07 // for date range, when start_date and end_dte is given
// Unified API for machine data - handles device_id, design, and date queries
//
exports.getMachineData = TryCatch(async (req, res) => {
  const { device_id, design, date, start_date, end_date } = req.query;

  try {
    let query = {};
    let responseData = {};

    // Build query based on provided parameters
    if (device_id) {
      query.device_id = device_id;
    }

    if (design) {
      query.design = design;
    }

    if (date) {
      // Single date query - more flexible date handling
      const dateObj = new Date(date);

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      // Create date range for the entire day
      const startDate = new Date(dateObj);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(dateObj);
      endDate.setHours(23, 59, 59, 999);

      // Try multiple timestamp formats
      query.$or = [
        // Format 1: ISO string comparison
        {
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
        // Format 2: Date object comparison (if timestamp is stored as Date)
        {
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        },
        // Format 3: String comparison (if timestamp is stored as string)
        {
          timestamp: {
            $regex: `^${date}`,
            $options: "i",
          },
        },
      ];

      console.log("📅 Date query created:", {
        date: date,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        query: query.$or,
      });
    } else if (start_date && end_date) {
      // Date range query
      const startDate = new Date(start_date + "T00:00:00.000Z");
      const endDate = new Date(end_date + "T23:59:59.999Z");
      query.timestamp = {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      };
    }

    // If no query parameters, return error
    if (Object.keys(query).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide at least one parameter: device_id, design, date, or start_date+end_date",
      });
    }

    // Execute query
    const records = await MachineStatus.find(query).sort({ timestamp: 1 });

    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No data found for the given criteria",
        data: {
          query_params: req.query,
          records: [],
          summary: {},
        },
      });
    }

    // Generate comprehensive response based on query type
    if (device_id && !design && !date && !start_date) {
      // Device ID only query
      responseData = await generateDeviceResponse(records, device_id);
    } else if (design && !device_id && !date && !start_date) {
      // Design only query
      responseData = await generateDesignResponse(records, design);
    } else if ((date || start_date) && !device_id && !design) {
      // Date only query
      responseData = await generateDateResponse(records, date || start_date);
    } else {
      // Mixed query - provide comprehensive data
      responseData = await generateMixedResponse(records, req.query);
    }

    res.status(200).json({
      success: true,
      message: "Data retrieved successfully",
      data: {
        query_params: req.query,
        total_records: records.length,
        ...responseData,
      },
    });
  } catch (error) {
    console.error("Error fetching machine data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching machine data",
      error: error.message,
    });
  }
});

// Helper function for device-based response
async function generateDeviceResponse(records, deviceId) {
  const designs = [...new Set(records.map(record => record.design))];
  
  // Create design-wise status timeline
  const designWiseTimeline = {};
  const completeStatusTimeline = [];
  
  // Process each design separately
  designs.forEach(design => {
    const designRecords = records.filter(record => record.design === design);
    const sortedDesignRecords = designRecords.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const designTimeline = [];
    let currentStatus = null;
    let startTime = null;
    
    sortedDesignRecords.forEach((record, index) => {
      if (currentStatus !== record.status) {
        // Save previous status period if exists
        if (currentStatus && startTime) {
          const endTime = sortedDesignRecords[index - 1]?.timestamp || record.timestamp;
          const timelineEntry = {
            status: currentStatus,
            start_time: startTime,
            end_time: endTime,
            duration: getDuration(startTime, endTime),
            design: design,
            shift: sortedDesignRecords[index - 1]?.shift || record.shift,
            error1: sortedDesignRecords[index - 1]?.error1 || record.error1 || 0,
            error2: sortedDesignRecords[index - 1]?.error2 || record.error2 || 0,
            count: sortedDesignRecords[index - 1]?.count || record.count || 0,
            efficiency: sortedDesignRecords[index - 1]?.efficiency || record.efficiency || 0
          };
          designTimeline.push(timelineEntry);
          completeStatusTimeline.push(timelineEntry);
        }
        
        // Start new status period
        currentStatus = record.status;
        startTime = record.timestamp;
      }
    });
    
    // Add the last status period for this design
    if (currentStatus && startTime && sortedDesignRecords.length > 0) {
      const lastRecord = sortedDesignRecords[sortedDesignRecords.length - 1];
      const timelineEntry = {
        status: currentStatus,
        start_time: startTime,
        end_time: lastRecord.timestamp,
        duration: getDuration(startTime, lastRecord.timestamp),
        design: design,
        shift: lastRecord.shift,
        error1: lastRecord.error1 || 0,
        error2: lastRecord.error2 || 0,
        count: lastRecord.count || 0,
        efficiency: lastRecord.efficiency || 0
      };
      designTimeline.push(timelineEntry);
      completeStatusTimeline.push(timelineEntry);
    }
    
    designWiseTimeline[design] = designTimeline;
  });
  
  // Sort complete timeline by timestamp
  completeStatusTimeline.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // Calculate design-wise statistics
  const designWiseStats = {};
  designs.forEach(design => {
    const designRecords = records.filter(record => record.design === design);
    const designTimeline = designWiseTimeline[design];
    
    const designProduction = designRecords.reduce((sum, record) => sum + record.count, 0);
    const designAvgEfficiency = designRecords.length > 0 ? designRecords.reduce((sum, record) => sum + record.efficiency, 0) / designRecords.length : 0;
    const designTotalErrors = designRecords.reduce((sum, record) => sum + record.error1 + record.error2, 0);
    
    // Calculate ON/OFF time for this design
    const designOnTime = designTimeline
      .filter(period => period.status === 'ON')
      .reduce((total, period) => {
        const start = new Date(period.start_time);
        const end = new Date(period.end_time);
        return total + (end - start);
      }, 0);
      
    const designOffTime = designTimeline
      .filter(period => period.status === 'OFF')
      .reduce((total, period) => {
        const start = new Date(period.start_time);
        const end = new Date(period.end_time);
        return total + (end - start);
      }, 0);
    
    // Calculate individual error counts for this design
    const designError1 = designRecords.reduce((sum, record) => sum + (record.error1 || 0), 0);
    const designError2 = designRecords.reduce((sum, record) => sum + (record.error2 || 0), 0);
    
    designWiseStats[design] = {
      total_production: designProduction,
      avg_efficiency: designAvgEfficiency,
      total_errors: designTotalErrors,
      error1_count: designError1,
      error2_count: designError2,
      total_on_time: getDuration(0, designOnTime),
      total_off_time: getDuration(0, designOffTime),
      on_cycles: designTimeline.filter(period => period.status === 'ON').length,
      off_cycles: designTimeline.filter(period => period.status === 'OFF').length,
      total_records: designRecords.length
    };
  });

  // Calculate overall statistics
  const totalProduction = records.reduce((sum, record) => sum + record.count, 0);
  const avgEfficiency = records.reduce((sum, record) => sum + record.efficiency, 0) / records.length;
  const totalErrors = records.reduce((sum, record) => sum + (record.error1 || 0) + (record.error2 || 0), 0);
  const totalError1 = records.reduce((sum, record) => sum + (record.error1 || 0), 0);
  const totalError2 = records.reduce((sum, record) => sum + (record.error2 || 0), 0);
  
  // Count ON/OFF cycles
  const onOffCycles = completeStatusTimeline.filter(
    (period) => period.status === "ON"
  ).length;
  const offOnCycles = completeStatusTimeline.filter(
    (period) => period.status === "OFF"
  ).length;

  // Calculate total ON and OFF time
  const totalOnTime = completeStatusTimeline
    .filter((period) => period.status === "ON")
    .reduce((total, period) => {
      const start = new Date(period.start_time);
      const end = new Date(period.end_time);
      return total + (end - start);
    }, 0);

  const totalOffTime = completeStatusTimeline
    .filter((period) => period.status === "OFF")
    .reduce((total, period) => {
      const start = new Date(period.start_time);
      const end = new Date(period.end_time);
      return total + (end - start);
    }, 0);

  // Convert to readable format
  const totalOnDuration = getDuration(0, totalOnTime);
  const totalOffDuration = getDuration(0, totalOffTime);

  return {
    device_id: deviceId,
    designs,
    complete_status_timeline: completeStatusTimeline,
    design_wise_timeline: designWiseTimeline,
    design_wise_stats: designWiseStats,
    status_summary: {
      total_on_cycles: onOffCycles,
      total_off_cycles: offOnCycles,
      total_on_time: totalOnDuration,
      total_off_time: totalOffDuration,
      total_status_changes: completeStatusTimeline.length,
    },
    total_production: totalProduction,
    avg_efficiency: avgEfficiency,
    total_errors: totalErrors,
    error1_count: totalError1,
    error2_count: totalError2,
    shifts: [...new Set(records.map(record => record.shift))],
    first_record: records.length > 0 ? records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0].timestamp : null,
    last_record: records.length > 0 ? records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[records.length - 1].timestamp : null,
    total_records: records.length
  };
}

// Helper function for design-based response
async function generateDesignResponse(records, design) {
  const machines = [...new Set(records.map((record) => record.device_id))];

  const machineProduction = {};
  machines.forEach((machineId) => {
    const machineRecords = records.filter(
      (record) => record.device_id === machineId
    );
    machineProduction[machineId] = {
      total_count: machineRecords.reduce(
        (sum, record) => sum + record.count,
        0
      ),
      avg_efficiency:
        machineRecords.reduce((sum, record) => sum + record.efficiency, 0) /
        machineRecords.length,
      total_errors: machineRecords.reduce(
        (sum, record) => sum + record.error1 + record.error2,
        0
      ),
      shifts: [...new Set(machineRecords.map((record) => record.shift))],
      first_run: machineRecords[0].timestamp,
      last_run: machineRecords[machineRecords.length - 1].timestamp,
    };
  });

  const totalProduction = records.reduce(
    (sum, record) => sum + record.count,
    0
  );
  const avgEfficiency =
    records.reduce((sum, record) => sum + record.efficiency, 0) /
    records.length;

  return {
    design,
    machines,
    machine_production: machineProduction,
    total_production: totalProduction,
    avg_efficiency: avgEfficiency,
    shifts: [...new Set(records.map((record) => record.shift))],
    first_run: records[0].timestamp,
    last_run: records[records.length - 1].timestamp,
  };
}

// Helper function for date-based response
async function generateDateResponse(records, date) {
  const machines = [...new Set(records.map((record) => record.device_id))];
  const designs = [...new Set(records.map((record) => record.design))];

  const machineSummary = {};
  machines.forEach((machineId) => {
    const machineRecords = records.filter(
      (record) => record.device_id === machineId
    );
    machineSummary[machineId] = {
      designs: [...new Set(machineRecords.map((record) => record.design))],
      total_count: machineRecords.reduce(
        (sum, record) => sum + record.count,
        0
      ),
      avg_efficiency:
        machineRecords.reduce((sum, record) => sum + record.efficiency, 0) /
        machineRecords.length,
      total_errors: machineRecords.reduce(
        (sum, record) => sum + record.error1 + record.error2,
        0
      ),
      shifts: [...new Set(machineRecords.map((record) => record.shift))],
      status_changes: machineRecords.length,
    };
  });

  const totalProduction = records.reduce(
    (sum, record) => sum + record.count,
    0
  );
  const statusSummary = {};
  records.forEach((record) => {
    statusSummary[record.status] = (statusSummary[record.status] || 0) + 1;
  });

  return {
    date: date,
    machines,
    designs,
    machine_summary: machineSummary,
    total_production: totalProduction,
    status_summary: statusSummary,
    shifts: [...new Set(records.map((record) => record.shift))],
  };
}

// Helper function for mixed queries
async function generateMixedResponse(records, queryParams) {
  const machines = [...new Set(records.map((record) => record.device_id))];
  const designs = [...new Set(records.map((record) => record.design))];

  // Generate summary based on what's being queried
  let summary = {
    total_records: records.length,
    total_production: records.reduce((sum, record) => sum + record.count, 0),
    machines,
    designs,
  };

  // Add specific data based on query type
  if (queryParams.device_id) {
    summary.device_data = await generateDeviceResponse(
      records,
      queryParams.device_id
    );
  }

  if (queryParams.design) {
    summary.design_data = await generateDesignResponse(
      records,
      queryParams.design
    );
  }

  if (queryParams.date || queryParams.start_date) {
    summary.date_data = await generateDateResponse(
      records,
      queryParams.date || queryParams.start_date
    );
  }

  return summary;
}

// Helper function to calculate duration between two timestamps
function getDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

// Debug endpoint to check database content
exports.debugMachineData = TryCatch(async (req, res) => {
  try {
    const totalRecords = await MachineStatus.countDocuments({});
    const sampleRecords = await MachineStatus.find({})
      .limit(5)
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      message: "Database debug info",
      data: {
        total_records: totalRecords,
        sample_records: sampleRecords.map((record) => ({
          _id: record._id,
          device_id: record.device_id,
          design: record.design,
          status: record.status,
          timestamp: record.timestamp,
          timestamp_type: typeof record.timestamp,
          created_at: record.createdAt,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error in debug endpoint",
      error: error.message,
    });
  }
});




///api for production dashboard
exports.getProductionDashboard = TryCatch(async (req, res) => {
  const now = moment();

  // ==== Calculate date ranges ====
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

  // ==== BOM Counts ====
  const totalBOM = await BOM.countDocuments();
  const lastMonthBOM = await BOM.countDocuments({
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });
  const thisMonthBOM = await BOM.countDocuments({
    createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
  });

  // ==== Total Production Completed (All Time) ====
  const productionCompletedAllTime = await ProductionProcess.aggregate([
    { $match: {} },
    {
      $group: {
        _id: null,
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
      },
    },
  ]);

  // ==== Production Chart (Current Month Only) ====
  const preProductionStatuses = [
    "raw material approval pending",
    "Inventory Allocated",
    "request for allow inventory",
    "inventory in transit",
  ];

  const productionChartThisMonth = await ProductionProcess.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startOfThisMonth,
          $lte: endOfThisMonth,
        },
      },
    },
    {
      $group: {
        _id: null,
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        progress: {
          $sum: {
            $cond: [{ $eq: ["$status", "production in progress"] }, 1, 0],
          },
        },
        pre_production: {
          $sum: {
            $cond: [{ $in: ["$status", preProductionStatuses] }, 1, 0],
          },
        },
      },
    },
  ]);

  // ==== Prepare Response ====
  const chartData =
    productionChartThisMonth.length > 0
      ? productionChartThisMonth[0]
      : { completed: 0, progress: 0, pre_production: 0 };

  return res.status(200).json({
    success: true,
    bom: {
      total: totalBOM,
      lastMonth: lastMonthBOM,
      thisMonth: thisMonthBOM,
    },
    total_production_completed:
      productionCompletedAllTime.length > 0
        ? productionCompletedAllTime[0].completed
        : 0,
    production_chart: chartData, // 👈 Added chart data from current month
  });
});


// api for accountant dashboard

exports.accountantDashboard = TryCatch(async (req, res) => {
  const today = moment();
  const currentMonthStart = today.clone().startOf("month").startOf("day");
  const currentDate = today.clone().endOf("day");

  const previousMonthStart = today.clone().subtract(1, "month").startOf("month");
  const previousMonthEnd = today.clone().subtract(1, "month").endOf("month");

  const currentMonthCondition = {
    createdAt: {
      $gte: currentMonthStart.toDate(),
      $lte: currentDate.toDate(),
    },
  };

  const previousMonthCondition = {
    createdAt: {
      $gte: previousMonthStart.toDate(),
      $lte: previousMonthEnd.toDate(),
    },
  };

  // ===== CURRENT MONTH =====
  const totalProformaInvoices = await ProformaInvoice.countDocuments(currentMonthCondition);
  const proformaAmountAgg = await ProformaInvoice.aggregate([
    { $match: currentMonthCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$total_amount" },
      },
    },
  ]);
  const totalProformaAmount = proformaAmountAgg[0]?.totalAmount || 0;

  const proformaStatusAgg = await ProformaInvoice.aggregate([
    { $match: currentMonthCondition },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$total_amount" },
      },
    },
  ]);

  const totalInvoices = await Invoice.countDocuments(currentMonthCondition);
  const invoiceAmountAgg = await Invoice.aggregate([
    { $match: currentMonthCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$total" },
      },
    },
  ]);
  const totalInvoiceAmount = invoiceAmountAgg[0]?.totalAmount || 0;

  const invoiceStatusAgg = await Invoice.aggregate([
    { $match: currentMonthCondition },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$total" },
      },
    },
  ]);

  const totalPayments = await Payment.countDocuments(currentMonthCondition);
  const paymentAmountAgg = await Payment.aggregate([
    { $match: currentMonthCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);
  const totalPaymentAmount = paymentAmountAgg[0]?.totalAmount || 0;

  const paymentStatusAgg = await Payment.aggregate([
    { $match: currentMonthCondition },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // ===== PREVIOUS MONTH =====
  const prevTotalProformaInvoices = await ProformaInvoice.countDocuments(previousMonthCondition);
  const prevProformaAmountAgg = await ProformaInvoice.aggregate([
    { $match: previousMonthCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$total_amount" },
      },
    },
  ]);
  const prevTotalProformaAmount = prevProformaAmountAgg[0]?.totalAmount || 0;

  const prevTotalInvoices = await Invoice.countDocuments(previousMonthCondition);
  const prevInvoiceAmountAgg = await Invoice.aggregate([
    { $match: previousMonthCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$total" },
      },
    },
  ]);
  const prevTotalInvoiceAmount = prevInvoiceAmountAgg[0]?.totalAmount || 0;

  const prevTotalPayments = await Payment.countDocuments(previousMonthCondition);
  const prevPaymentAmountAgg = await Payment.aggregate([
    { $match: previousMonthCondition },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);
  const prevTotalPaymentAmount = prevPaymentAmountAgg[0]?.totalAmount || 0;

  // ===== RESPONSE =====
  res.status(200).json({
    status: 200,
    success: true,
    message: "Financial summary for current and previous month",

    date_ranges: {
      current_month: {
        from: currentMonthStart.format("YYYY-MM-DD"),
        to: currentDate.format("YYYY-MM-DD"),
      },
      previous_month: {
        from: previousMonthStart.format("YYYY-MM-DD"),
        to: previousMonthEnd.format("YYYY-MM-DD"),
      },
    },

    // Current Month Summary
    current_month: {
      proforma_invoices: {
        total_count: totalProformaInvoices,
        total_amount: totalProformaAmount,
        status_wise: proformaStatusAgg.reduce((acc, item) => {
          acc[item._id || "unknown"] = {
            count: item.count,
            amount: item.totalAmount,
          };
          return acc;
        }, {}),
      },
      invoices: {
        total_count: totalInvoices,
        total_amount: totalInvoiceAmount,
        status_wise: invoiceStatusAgg.reduce((acc, item) => {
          acc[item._id || "unknown"] = {
            count: item.count,
            amount: item.totalAmount,
          };
          return acc;
        }, {}),
      },
      payments: {
        total_count: totalPayments,
        total_amount: totalPaymentAmount,
        status_wise: paymentStatusAgg.reduce((acc, item) => {
          acc[item._id || "unknown"] = {
            count: item.count,
            amount: item.totalAmount,
          };
          return acc;
        }, {}),
      },
    },

    // Previous Month Summary
    previous_month: {
      proforma_invoices: {
        total_count: prevTotalProformaInvoices,
        total_amount: prevTotalProformaAmount,
      },
      invoices: {
        total_count: prevTotalInvoices,
        total_amount: prevTotalInvoiceAmount,
      },
      payments: {
        total_count: prevTotalPayments,
        total_amount: prevTotalPaymentAmount,
      },
    },
  });
});
 
