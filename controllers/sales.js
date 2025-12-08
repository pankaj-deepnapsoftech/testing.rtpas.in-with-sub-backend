const { AssinedModel } = require("../models/Assined-to.model");
const { Purchase } = require("../models/purchase");
const { TryCatch, ErrorHandler } = require("../utils/error");
const { getAdminFilter, getAdminIdForCreation, canAccessRecord, cleanUpdateData } = require("../utils/adminFilter");

const generateorderId = async () => {
  const lastParty = await Purchase.findOne().sort({ createdAt: -1 });

  if (!lastParty) return "OID001";
  const lastId = lastParty.order_id.replace("OID", "");
  const nextId = Number(lastId) + 1;
  return `OID${nextId.toString().padStart(3, "0")}`;
};

exports.create = TryCatch(async (req, res) => {
  try {
    const data = req.body;
    const order_id = await generateorderId();
    // const productFile = req.files?.productFile?.[0];
    // const productFilePath = productFile
    //   ? `https://rtpasbackend.deepmart.shop/images/${productFile.filename}`///
    //   : null;
    const newData = {
      ...data,
      user_id: req?.user._id,
      admin_id: getAdminIdForCreation(req.user),
      order_id,
      approved: false, // Always require approval, regardless of user role
      //   productFile: productFilePath,
    };

    if (req.body.sale_id) {
      const Purchase = require("../models/purchase");
      await Purchase.findByIdAndUpdate(
        req.body.sale_id,
        { sale_status: "BOM Created" },
        { new: true }
      );
    }
    await Purchase.create(newData);
    return res.status(201).json({ message: "Purchase Order Generated" });
  } catch (error) {
    console.error("Error creating purchase:", error);
    throw new ErrorHandler("Internal Server Error", 500);
  }
});

const mongoose = require("mongoose");

exports.unapproved = TryCatch(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  const data = await Purchase.aggregate([
    { $match: { 
      $and: [
        ...adminFilterArray,
        { approved: false }
      ]
    } },
    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [{ $project: { name: 1, price: 1, uom: 1, current_stock: 1 } }],
      },
    },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [{ $project: { company_name: 1, consignee_name: 1 } }],
      },
    },


    { $unwind: { path: "$party", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        order_id: 1,
        product_qty: 1,
        GST: 1,
        price: 1,
        product_id: 1,
        party: 1,
        createdAt: 1,

      },
    },
  ])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  return res.status(200).json({ success: true, data });
});

exports.approve = TryCatch(async (req, res) => {
  const { id } = req.params;
  const sale = await Purchase.findById(id);
  if (!sale) {
    throw new ErrorHandler("Sale not found", 404);
  }

  // Check if user can access this sale
  if (!canAccessRecord(req.user, sale, "admin_id")) {
    throw new ErrorHandler("You don't have permission to approve this sale", 403);
  }

  const updated = await Purchase.findByIdAndUpdate(
    id,
    { approved: true },
    { new: true }
  );
  return res.status(200).json({ success: true, message: "Sale approved" });
});

exports.bulkApprove = TryCatch(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ErrorHandler("ids array is required", 400);
  }

  // Get admin filter to ensure we only approve sales belonging to this admin
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  await Purchase.updateMany(
    { 
      _id: { $in: ids },
      $and: adminFilterArray
    }, 
    { $set: { approved: true } }
  );
  return res
    .status(200)
    .json({ success: true, message: `Approved ${ids.length} sale(s)` });
});
exports.update = TryCatch(async (req, res) => {
  const data = req.body;
  const { id } = req.params;
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];
  
  const find = await Purchase.findOne({ 
    _id: id,
    $and: adminFilterArray
  });
  if (!find) {
    throw new ErrorHandler("data not found", 400);
  }

  // Ensure admin_id is not removed during update - preserve existing admin_id
  const updateData = cleanUpdateData(data);

  await Purchase.findOneAndUpdate(
    { 
      _id: id,
      $and: adminFilterArray
    }, 
    updateData
  );
  return res.status(201).json({ message: "Purchase Order updated" });
});

//  exports.Imagehandler = TryCatch(async (req, res)=> {
//     const { assined_to, assinedto_comment } = req.body;
//     const { id } = req.params;
//     const { filename } = req.file;
//     const find = await Purchase.findById(id);
//     if (!find) {
//       return res.status(404).json({
//         message: "data not found try again",
//       });
//     }                                                    //for second image

//     const path = `https://rtpasbackend.deepmart.shop/images/${filename}`;

//     await Purchase.findByIdAndUpdate(id, { designFile: path });

//     await AssinedModel.findByIdAndUpdate(assined_to, {
//       isCompleted: "Completed",
//       assinedto_comment,
//     });
//     return res.status(201).json({
//       message: "file uploaded successful",
//     });
//  )};
exports.Imagehandler = TryCatch(async (req, res) => {
  const { assined_to, assinedto_comment, designFile } = req.body;
  const { id } = req.params;

  if (!designFile) {
    return res.status(400).json({ message: "Design file URL is required" });
  }

  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];
  
  const find = await Purchase.findOne({ 
    _id: id,
    $and: adminFilterArray
  });
  if (!find) {
    return res.status(404).json({ message: "Sale not found" });
  }

  // Save designFile URL in DB
  await Purchase.findByIdAndUpdate(id, {
    designFile: designFile,
  });

  // Update assignment status
  await AssinedModel.findByIdAndUpdate(assined_to, {
    isCompleted: "Completed",
    assinedto_comment,
  });

  return res.status(201).json({ message: "Design file uploaded successfully" });
});

exports.getAll = TryCatch(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;
  
  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);

  const data = await Purchase.aggregate([
    { $match: adminFilter }, // Show all sales (approved and unapproved) in Sales Management, filtered by admin
    {
      $lookup: {
        from: "boms",
        localField: "_id",
        foreignField: "sale_id",
        as: "boms",
        pipeline: [
          {
            $lookup: {
              from: "production-processes",
              foreignField: "bom",
              localField: "_id",
              as: "production_processes",
              pipeline: [
                {
                  $project: {
                    processes: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              is_production_started: 1,
              production_processes: 1,
              bom_name: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user_id",
        pipeline: [
          {
            $lookup: {
              from: "user-roles",
              foreignField: "_id",
              localField: "role",
              as: "role",
            },
          },
          {
            $project: {
              first_name: 1,
              role: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "customers",
        localField: "customer_id",
        foreignField: "_id",
        as: "customer_id",
        pipeline: [
          {
            $project: {
              full_name: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [
          {
            $project: {
              name: 1,
              price: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [
          {
            $project: {
              consignee_name: 2,
              contact_number: 2,
              cust_id: 1,
              company_name: 1,
              bill_to: 1,
              bill_gst_to: 1,
              shipped_gst_to: 1,
              shipped_to: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$party",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "assineds",
        localField: "_id",
        foreignField: "sale_id",
        as: "assinedto",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "assined_to",
              foreignField: "_id",
              as: "assinedto",
              pipeline: [
                {
                  $lookup: {
                    from: "user-roles",
                    localField: "role",
                    foreignField: "_id",
                    as: "role",
                  },
                },
              ],
            },
          },
        ],
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
      $project: {
        sale_status: 1,   // ✅ new field
        approved: 1, // Include approval status
        order_id: 1,
        price: 1,
        product_qty: 1,
        GST: 1,
        total_price: 1,
        user_id: 1,
        customer_id: 1,
        product_id: 1,
        party: 1,
        assinedto: 1,
        boms: 1,
        mode_of_payment: 1,
        createdAt: 1,
        terms_of_delivery: 1,
      },
    },
  ])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  return res.status(200).json({ message: "all purchases order found", data });
});

exports.AddToken = TryCatch(async (req, res) => {
  const { id } = req.params;
  const { token_amt } = req.body;

  if (!token_amt) {
    return res.status(404).json({
      message: "token amount is required!",
    });
  }

  if (!id) {
    return res.status(404).json({
      message: "couldn't access the sale!",
    });
  }

  const sale = await Purchase.findById(id);
  if (!sale) {
    throw new ErrorHandler("Sale not found", 404);
  }

  // Check if user can access this sale
  if (!canAccessRecord(req.user, sale, "admin_id")) {
    throw new ErrorHandler("You don't have permission to update this sale", 403);
  }

  await Purchase.findByIdAndUpdate(id, {
    token_amt,
    token_status: false,
  });

  return res.status(200).json({
    message: "Token Amount added for sample :)",
  });
});


exports.markProductionCompleted = TryCatch(async (req, res) => {
  const { id } = req.params;
  const sale = await Purchase.findById(id);
  if (!sale) {
    throw new ErrorHandler("Sale not found", 404);
  }

  // Check if user can access this sale
  if (!canAccessRecord(req.user, sale, "admin_id")) {
    throw new ErrorHandler("You don't have permission to update this sale", 403);
  }

  const updated = await Purchase.findByIdAndUpdate(
    id,
    { salestatus: "Production Completed" },
    { new: true }
  );
  return res.status(200).json({ success: true, message: "Order marked as production completed" });
});

exports.getUpcomingSales = TryCatch(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  const data = await Purchase.aggregate([
    {
      $match: {
        $and: [
          ...adminFilterArray,
          {
            approved: true,
            $or: [
              { salestatus: { $ne: "Production Completed" } },
              { salestatus: { $exists: false } }
            ]
          }
        ]
      }
    },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [
          {
            $project: {
              company_name: 1,
              consignee_name: 1,
              contact_number: 1,
              email_id: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: { path: "$party", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [
          {
            $project: {
              name: 1,
              price: 1,
              uom: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: { path: "$product_id", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "boms",
        localField: "_id",
        foreignField: "sale_id",
        as: "boms",
      },
    },
    {
      $addFields: {
        has_bom: { $gt: [{ $size: "$boms" }, 0] },
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
      $project: {
        order_id: 1,
        party: 1,
        product_id: 1,
        product_qty: 1,
        price: 1,
        GST: 1,
        total_price: 1,
        uom: 1,
        mode_of_payment: 1,
        terms_of_delivery: 1,
        has_bom: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  const total = await Purchase.countDocuments({
    $and: [
      ...adminFilterArray,
      {
        approved: true,
        $or: [
          { salestatus: { $ne: "Production Completed" } },
          { salestatus: { $exists: false } }
        ]
      }
    ]
  });

  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

exports.getOne = TryCatch(async (req, res) => {
  const id = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;
  
  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];
  
  const data = await Purchase.aggregate([
    { $match: { 
      $and: [
        ...adminFilterArray,
        { user_id: id }
      ]
    } },
    {
      $lookup: {
        from: "boms",
        localField: "_id",
        foreignField: "sale_id",
        as: "boms",
        pipeline: [
          {
            $lookup: {
              from: "production-processes",
              foreignField: "bom",
              localField: "_id",
              as: "production_processes",
              pipeline: [
                {
                  $project: {
                    processes: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              is_production_started: 1,
              production_processes: 1,
              bom_name: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user_id",
        pipeline: [
          {
            $lookup: {
              from: "user-roles",
              foreignField: "_id",
              localField: "role",
              as: "role",
            },
          },
          {
            $project: {
              first_name: 1,
              role: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [
          {
            $project: {
              consignee_name: 1,
              contact_number: 1,
              cust_id: 1,
              company_name: 1,
              bill_to: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$party",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [
          {
            $project: {
              name: 1,
              price: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "assineds",
        localField: "_id",
        foreignField: "sale_id",
        as: "assinedto",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "assined_to",
              foreignField: "_id",
              as: "assinedto",
              pipeline: [
                {
                  $lookup: {
                    from: "user-roles",
                    localField: "role",
                    foreignField: "_id",
                    as: "role",
                  },
                },
              ],
            },
          },
        ],
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
      $project: {
        sale_status: 1,
        order_id: 1,
        price: 1,
        product_qty: 1,
        GST: 1,
        total_price: 1,
        user_id: 1,
        customer_id: 1,
        product_id: 1,
        party: 1,
        assinedto: 1,
        boms: 1,
        mode_of_payment: 1,
        terms_of_delivery: 1,
        createdAt: 1,
      },
    },
  ])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
  return res.status(200).json({ message: "data found by id", data });
});

exports.uploadinvoice = TryCatch(async (req, res) => {
  try {
    const { invoice_remark } = req.body;
    const { id } = req.params;
    const { filename } = req.file;
    const find = await Purchase.findById(id);
    if (!find) {
      return res.status(404).json({
        message: "data not found try again",
      });
    }

    // Check if user can access this sale
    if (!canAccessRecord(req.user, find, "admin_id")) {
      throw new ErrorHandler("You don't have permission to upload invoice for this sale", 403);
    }

    const path = `https://rtpasbackend.deepmart.shop/images/${filename}`;

    await Purchase.findByIdAndUpdate(id, {
      invoice: path,
      invoice_remark: invoice_remark,
    });

    // await AssinedModel.findByIdAndUpdate(assined_to, {
    //   isCompleted: "Completed",
    //   assinedto_comment,
    // });

    return res.status(201).json({
      message: "file uploaded successful",
    });
  } catch (err) {
    return res.status(500).json({
      message: err,
    });
  }
});

exports.Delivered = TryCatch(async (req, res) => {
  const { filename } = req.file;
  const { id } = req.params;

  if (!filename) {
    return res.status(404).json({
      message: "file not found",
    });
  }

  const data = await Purchase.findById(id);
  try {
    if (!data) {
      return res.status(404).json({
        message: "data not found",
      });
    }

    // Check if user can access this sale
    if (!canAccessRecord(req.user, data, "admin_id")) {
      throw new ErrorHandler("You don't have permission to update this sale", 403);
    }

    const path = `https://rtpasbackend.deepmart.shop/images/${filename}`;
    console.log("req.body.role=", req.body.role);
    if ((req.body.role = "Dispatcher")) {
      await Purchase.findByIdAndUpdate(id, {
        dispatcher_order_ss: path,
        product_status: "Delivered",
      });
    } else {
      await Purchase.findByIdAndUpdate(id, {
        customer_order_ss: path,
        product_status: "Delivered",
      });
    }
    return res.status(200).json({
      message: "file uploaded successful",
    });
  } catch (err) {
    return res.status(500).json({
      message: err,
    });
  }
});


exports.GetAllSalesData = TryCatch(async (req, res) => {
  let { page, limit } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  const skip = (page - 1) * limit;

  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  const session = await mongoose.startSession();
  session.startTransaction();
  let data = await Purchase.aggregate([
    { $match: { 
      $and: [
        ...adminFilterArray,
        { salestatus: { $in: ["Production Completed", "Dispatch"] } }
      ]
    } },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [
          {
            $project: { consignee_name: 1, company_name: 1 }
          }
        ]
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [
          {
            $project: { name: 1, current_stock: 1 }
          }
        ]
      }

    },
    {
      $lookup: {
        from: "dispatches",
        foreignField: "sales_order_id",
        localField: "_id",
        as: "dispatch",
        pipeline: [
          {
            $project: {
              dispatch_qty: 1,
              quantity: 1,
            }
          }
        ]
      }
    },
    {
      $addFields: {
        party: { $arrayElemAt: ["$party", 0] },
        product_id: { $arrayElemAt: ["$product_id", 0] },

      }
    },
    {
      $project: {
        order_id: 1,
        party: 1,
        product_id: 1,
        product_qty: 1,
        salestatus: 1,
        price: 1,
        GST: 1,
        dispatch: 1,
      }
    }

  ]).sort({ _id: -1 }).skip(skip).limit(limit);


  data = data.map((item) => {
    let remaning = 0;
    if (item.salestatus === "Production Completed" && item?.dispatch) {
      remaning = item?.product_qty - item.dispatch.reduce((i, result) => i + result.dispatch_qty, 0);
    } else {
      remaning = item?.product_qty
    }

    return { ...item, pending_qty: remaning };

  })

  const totaldata = await Purchase.find({ 
    $and: [
      ...adminFilterArray,
      { salestatus: { $in: ["Production Completed", "Dispatch"] } }
    ]
  }).countDocuments()

  res.status(200).json({
    data,
    totalPage: Math.ceil(totaldata / limit),
  })
  session.endSession()
});

exports.GetAllPendingSalesData = TryCatch(async (req, res) => {
  let { page, limit } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  const skip = (page - 1) * limit;

  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  const session = await mongoose.startSession();
  session.startTransaction()

  let data = await Purchase.aggregate([
    { $match: { 
      $and: [
        ...adminFilterArray,
        { salestatus: { $in: ["Production Completed"] } }
      ]
    } },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [
          {
            $project: { consignee_name: 1, company_name: 1 }
          }
        ]
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [
          {
            $project: { name: 1, current_stock: 1 }
          }
        ]
      }

    },
    {
      $lookup: {
        from: "dispatches",
        foreignField: "sales_order_id",
        localField: "_id",
        as: "dispatch",
        pipeline: [
          {
            $project: {
              dispatch_qty: 1,
              quantity: 1,
            }
          }
        ]
      }
    },
    {
      $addFields: {
        party: { $arrayElemAt: ["$party", 0] },
        product_id: { $arrayElemAt: ["$product_id", 0] },

      }
    },
    {
      $project: {
        order_id: 1,
        party: 1,
        product_id: 1,
        product_qty: 1,
        salestatus: 1,
        price: 1,
        GST: 1,
        dispatch: 1,
      }
    }

  ]).sort({ _id: -1 }).skip(skip).limit(limit);


  data = data.map((item) => {
    let remaning = 0;
    if (item.salestatus === "Production Completed" && item?.dispatch) {
      remaning = item?.product_qty - item.dispatch.reduce((i, result) => i + result.dispatch_qty, 0);
    } else {
      remaning = item?.product_qty
    }

    return { ...item, pending_qty: remaning };

  });

  const totalPage = await Purchase.find({ 
    $and: [
      ...adminFilterArray,
      { salestatus: { $in: ["Production Completed"] } }
    ]
  }).countDocuments();

  res.status(200).json({
    data,
    totalPage: Math.ceil(totalPage / limit),
  })
  session.endSession()
});

exports.GetAllCompletedData = TryCatch(async (req, res) => {
  let { page, limit } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  const skip = (page - 1) * limit;

  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  const session = await mongoose.startSession();
  session.startTransaction()


  const data = await Purchase.aggregate([
    { $match: { 
      $and: [
        ...adminFilterArray,
        { salestatus: { $in: ["Dispatch"] } }
      ]
    } },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [
          {
            $project: { consignee_name: 1, company_name: 1 }
          }
        ]
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [
          {
            $project: { name: 1, current_stock: 1 }
          }
        ]
      }

    },
    {
      $addFields: {
        party: { $arrayElemAt: ["$party", 0] },
        product_id: { $arrayElemAt: ["$product_id", 0] },

      }
    },
    {
      $project: {
        order_id: 1,
        party: 1,
        product_id: 1,
        product_qty: 1,
        salestatus: 1,
        price: 1,
        GST: 1,
      }
    }

  ]).sort({ _id: -1 }).skip(skip).limit(limit);

  const totalPage = await Purchase.find({ 
    $and: [
      ...adminFilterArray,
      { salestatus: { $in: ["Dispatch"] } }
    ]
  }).countDocuments();
  res.status(200).json({
    data,
    totalPage: Math.ceil(totalPage / limit),
  })

  session.endSession()
});


exports.GetAllSalesReadyToDispatch = TryCatch(async (req, res) => {
  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];
  
  let data = await Purchase.aggregate([
    {
      $match: { 
        $and: [
          ...adminFilterArray,
          { salestatus: { $ne: "Dispatch" }, approved: true }
        ]
      }
    },
    {
      $lookup: {
        from: "parties",
        localField: "party",
        foreignField: "_id",
        as: "party",
        pipeline: [
          {
            $project: {
              consignee_name: 1,
              company_name: 1,
            }
          }
        ]
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "product_id",
        foreignField: "_id",
        as: "product_id",
        pipeline: [
          {
            $project: {
              current_stock: 1,
              name: 1,
            }
          }
        ]
      }
    },
    {
      $lookup: {
        from: "dispatches",
        foreignField: "sales_order_id",
        localField: "_id",
        as: "dispatch",
        pipeline: [
          {
            $project: {
              dispatch_qty: 1,
              quantity: 1,
            }
          }
        ]
      }
    },
    {
      $addFields: {
        party: { $arrayElemAt: ["$party", 0] },
        product_id: { $arrayElemAt: ["$product_id", 0] },
      }
    },
    {
      $project: {
        party: 1,
        order_id: 1,
        product_id: 1,
        product_qty: 1,
        price: 1,
        GST: 1,
        dispatch: 1
      }
    }
  ]);

  data = data.map((item) => {
    let remaning = 0;
    if (item?.dispatch) {
      remaning = item?.product_qty - item.dispatch.reduce((i, result) => i + result.dispatch_qty, 0);
    } else {
      remaning = item?.product_qty
    }

    return { ...item, pending_qty: remaning };

  })
  res.status(200).json({
    data
  })
});



exports.directSendToDispatch = TryCatch(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const sale = await Purchase.findById(id);
  if (!sale) {
    throw new ErrorHandler("Sale not found", 404);
  }

  // Check if user can access this sale
  if (!canAccessRecord(req.user, sale, "admin_id")) {
    throw new ErrorHandler("You don't have permission to update this sale", 403);
  }

  const data = await Purchase.findByIdAndUpdate(
    id,
    { salestatus: status, approved: true },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data,
    message: "The sales order has been moved to dispatch."

  });
}); 
