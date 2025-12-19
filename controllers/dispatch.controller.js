const { DispatchModel } = require("../models/Dispatcher");
const { TryCatch, ErrorHandler } = require("../utils/error");
const Product = require("../models/product");
const { Purchase } = require("../models/purchase");
const { getAdminFilter, getAdminIdForCreation, canAccessRecord, cleanUpdateData } = require("../utils/adminFilter");

exports.CreateDispatch = TryCatch(async (req, res) => {
  const data = req.body;

  const adminFilter = getAdminFilter(req.user);

  if (!data.sales_order_id) {
    throw new ErrorHandler("Sales order ID is required", 400);
  }

  const purchase = await Purchase.findById(data.sales_order_id);
  if (!purchase) {
    throw new ErrorHandler("Sale not found", 404);
  }

  if (purchase.salestatus === "Dispatch") {
    throw new ErrorHandler("Duplicate dispatch attempt for an already dispatched order", 409);
  }

  if (!data.dispatch_qty || data.dispatch_qty <= 0) {
    throw new ErrorHandler("Valid dispatch quantity is required", 400);
  }

  const product = await Product.findById(data.product_id);
  if (!product) {
    throw new ErrorHandler("Product not found", 404);
  }

  const existingDispatches = await DispatchModel.find({
    $and: [
      ...(adminFilter.$and || [adminFilter]),
      { sales_order_id: data.sales_order_id }
    ]
  }).select("dispatch_qty");

  const alreadyDispatchedQty = existingDispatches.reduce((acc, d) => acc + (parseInt(d.dispatch_qty) || 0), 0);
  const remainingQty = (parseInt(purchase.product_qty) || 0) - alreadyDispatchedQty;

  if (data.dispatch_qty > remainingQty) {
    throw new ErrorHandler(`Dispatch qty exceeds remaining quantity. Remaining: ${remainingQty}`, 400);
  }

  if (product.current_stock < data.dispatch_qty) {
    throw new ErrorHandler("Insufficient stock for dispatch", 400);
  }

  product.current_stock = product.current_stock - data.dispatch_qty;
  product.change_type = "decrease";
  product.quantity_changed = data.dispatch_qty;
  await product.save();

  const result = await DispatchModel.create({
    ...data,
    creator: req.user._id,
    admin_id: getAdminIdForCreation(req.user),
    dispatch_date: data.dispatch_date || new Date(),
    dispatch_status: "Dispatch",
  });

  console.info("Dispatch created", {
    sales_order_id: String(data.sales_order_id),
    dispatch_id: String(result._id),
    dispatch_qty: data.dispatch_qty,
    product_id: String(data.product_id),
  });

  res.status(201).json({
    message: "Dispatch created successfully, stock updated",
    data: result,
    updated_stock: product.current_stock,
  });

  const newTotal = alreadyDispatchedQty + (parseInt(data.dispatch_qty) || 0);
  const orderQty = parseInt(purchase.product_qty) || 0;
  if (newTotal >= orderQty) {
    await Purchase.findByIdAndUpdate(data.sales_order_id, { salestatus: "Dispatch" });
    console.info("Sale marked dispatched", {
      sales_order_id: String(data.sales_order_id),
      total_dispatched: newTotal,
      order_qty: orderQty,
    });
  }
});

exports.GetAllDispatches = TryCatch(async (req, res) => {
  const { page, limit, dispatch_status, payment_status, search } = req.query;
  const pages = parseInt(page) || 1;
  const limits = parseInt(limit) || 10;
  const skip = (pages - 1) * limits;

  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);

  // Build filter object - always include admin filter
  // adminFilter already contains $and, so we extract its conditions
  const filterConditions = adminFilter.$and ? [...adminFilter.$and] : [adminFilter];

  if (dispatch_status && dispatch_status !== "All") {
    filterConditions.push({ dispatch_status: dispatch_status });
  }

  if (payment_status && payment_status !== "All") {
    filterConditions.push({ payment_status: payment_status });
  }

  if (search) {
    filterConditions.push({
      $or: [
        { merchant_name: { $regex: search, $options: 'i' } },
        { item_name: { $regex: search, $options: 'i' } },
        { sales_order_id: { $regex: search, $options: 'i' } },
        { order_id: { $regex: search, $options: 'i' } }
      ]
    });
  }

  // Use $and to ensure all conditions are met (admin filter + other filters)
  const filter = filterConditions.length > 1 ? { $and: filterConditions } : adminFilter;

  const totalData = await DispatchModel.countDocuments(filter);

  const data = await DispatchModel.find(filter)
    .populate("creator", "first_name last_name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limits);

  return res.status(200).json({
    message: "Dispatches retrieved successfully",
    data,
    totalData,
    currentPage: pages,
    totalPages: Math.ceil(totalData / limits),
  });
});

exports.GetDispatch = TryCatch(async (req, res) => {
  const { page, limit } = req.query;
  const pages = parseInt(page) || 1;
  const limits = parseInt(limit) || 10;
  const skip = (pages - 1) * limits;

  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);

  const totalData = await DispatchModel.countDocuments(adminFilter);

  const data = await DispatchModel.aggregate([
    {
      $match: adminFilter
    },
    {
      $lookup: {
        from: "production-processes",
        localField: "production_process_id",
        foreignField: "_id",
        as: "production_process",
        pipeline: [
          {
            $lookup: {
              from: "products",
              localField: "finished_good.item",
              foreignField: "_id",
              as: "finished_good_item",
            },
          },
          {
            $lookup: {
              from: "boms",
              localField: "bom",
              foreignField: "_id",
              as: "bom",
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$production_process",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$production_process.finished_good_item",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$production_process.bom",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        Bom_name: { $ifNull: ["$production_process.bom.bom_name", "N/A"] },
        Product: {
          $ifNull: ["$production_process.finished_good_item.name", "N/A"],
        },
        ProductId: {
          $ifNull: ["$production_process.finished_good_item.product_id", "N/A"],
        },
        Quantity: { $ifNull: ["$production_process.quantity", 0] },
        Total: { $ifNull: ["$production_process.bom.total_cost", 0] },
        Status: "$delivery_status",
        PaymentStatus: "Unpaid",
      },
    },
    {
      $project: {
        production_process: 0,
      },
    },
    { $sort: { _id: -1 } },
    { $skip: skip },
    { $limit: limits },
  ]);

  return res.status(200).json({
    message: "Data",
    data,
    totalData,
  });
});

exports.DeleteDispatch = TryCatch(async (req, res) => {
  const { id } = req.params;
  const find = await DispatchModel.findById(id);
  if (!find) {
    throw new ErrorHandler("Data already Deleted", 400);
  }

  // Check if user can access this dispatch
  if (!canAccessRecord(req.user, find, "admin_id")) {
    throw new ErrorHandler("You don't have permission to delete this dispatch", 403);
  }

  await DispatchModel.findByIdAndDelete(id);
  return res.status(200).json({
    message: "Data deleted Successful",
  });
});

exports.UpdateDispatch = TryCatch(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const existingDispatch = await DispatchModel.findById(id);
  if (!existingDispatch) {
    throw new ErrorHandler("Dispatch not found", 404);
  }

  // Check if user can access this dispatch
  if (!canAccessRecord(req.user, existingDispatch, "admin_id")) {
    throw new ErrorHandler("You don't have permission to update this dispatch", 403);
  }

  if (data.dispatch_qty !== undefined && data.product_id) {
    const newDispatchQty = parseInt(data.dispatch_qty);
    const previousDispatchQty = parseInt(existingDispatch.dispatch_qty) || 0;

    const product = await Product.findById(data.product_id);
    if (!product) {
      throw new ErrorHandler("Product not found", 404);
    }

    // Calculate the difference in dispatch quantity
    const dispatchDifference = newDispatchQty - previousDispatchQty;

    // If increasing dispatch quantity, check if we have enough stock
    if (dispatchDifference > 0) {
      if (product.current_stock < dispatchDifference) {
        throw new ErrorHandler(
          `Insufficient stock. Available: ${product.current_stock}, Required additional: ${dispatchDifference}`,
          400
        );
      }
    }

    // Update stock based on the difference
    product.current_stock = product.current_stock - dispatchDifference;
    product.change_type = dispatchDifference > 0 ? "decrease" : "increase";
    product.quantity_changed = Math.abs(dispatchDifference);

    await product.save();
  }

  // If dispatch quantity is being changed, update status to "Dispatch Pending"
  if (data.dispatch_qty !== undefined && data.dispatch_qty !== existingDispatch.dispatch_qty) {
    data.dispatch_status = "Dispatch Pending";
  }

  // Ensure admin_id is not removed during update - preserve existing admin_id
  const updateData = cleanUpdateData(data);

  // Update the dispatch record
  const updatedDispatch = await DispatchModel.findByIdAndUpdate(id, updateData, {
    new: true,
  });

  return res.status(200).json({
    message: data.dispatch_qty !== undefined && data.dispatch_qty !== existingDispatch.dispatch_qty
      ? "Dispatch updated successfully, inventory adjusted, status changed to Dispatch Pending"
      : "Dispatch updated successfully, inventory adjusted",
    data: updatedDispatch,
    updated_stock:
      data.dispatch_qty !== undefined && data.product_id
        ? (await Product.findById(data.product_id)).current_stock
        : null,
  });
});

// exports.UpdateDispatch = TryCatch(async (req, res) => {
//   const { id } = req.params;
//   const data = req.body;

//   const find = await DispatchModel.findById(id);
//   if (!find) {
//     throw new ErrorHandler("Data not Found", 400);
//   }
//   await DispatchModel.findByIdAndUpdate(id, data);
//   return res.status(200).json({
//     message: "Data Updated Successful",
//   });
// });

exports.SendFromProduction = async (req, res) => {
  try {
    const { production_process_id } = req.body;

    if (!production_process_id) {
      return res.status(400).json({
        success: false,
        message: "production_process_id is required",
      });
    }

    const ProductionProcess = require("../models/productionProcess");
    const proc = await ProductionProcess.findById(production_process_id);

    if (!proc) {
      return res.status(404).json({
        success: false,
        message: "Production process not found",
      });
    }

    if (proc.status === "dispatched") {
      return res.status(409).json({
        success: false,
        message: "Production process already dispatched",
      });
    }

    const existing = await DispatchModel.findOne({ production_process_id });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Duplicate dispatch attempt for this production process",
      });
    }

    proc.status = "dispatched";
    await proc.save();

    const { DispatchModel } = require("../models/Dispatcher");
    const { getAdminIdForCreation } = require("../utils/adminFilter");
    const doc = await DispatchModel.create({
      creator: req.user?._id, // if you have auth
      admin_id: getAdminIdForCreation(req.user),
      production_process_id, // Save production process reference
      delivery_status: "Dispatch",
      dispatch_status: "Dispatch",
      Sale_id: [], // Optional, keep for sales link
    });

    console.info("Production dispatched", {
      production_process_id: String(production_process_id),
      dispatch_id: String(doc._id),
    });

    return res.status(200).json({
      success: true,
      message: "Sent to dispatch successfully",
      data: doc,
    });
  } catch (e) {
    console.error("Error in SendFromProduction:", e);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: e.message,
    });
  }
};

exports.UploadDeliveryProof = TryCatch(async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    throw new ErrorHandler("No file uploaded", 400);
  }

  const dispatch = await DispatchModel.findById(id);
  if (!dispatch) {
    throw new ErrorHandler("Dispatch not found", 404);
  }

  // Check if user can access this dispatch
  if (!canAccessRecord(req.user, dispatch, "admin_id")) {
    throw new ErrorHandler("You don't have permission to upload delivery proof for this dispatch", 403);
  }

  // Update dispatch with delivery proof information
  dispatch.delivery_proof = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    uploadDate: new Date(),
  };

  // Change dispatch status to "Delivered" when delivery proof is uploaded
  dispatch.dispatch_status = "Delivered";

  await dispatch.save();

  return res.status(200).json({
    message: "Delivery proof uploaded successfully, status changed to Delivered",
    data: dispatch,
  });
});

exports.UploadInvoice = TryCatch(async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    throw new ErrorHandler("No file uploaded", 400);
  }

  const dispatch = await DispatchModel.findById(id);
  if (!dispatch) {
    throw new ErrorHandler("Dispatch not found", 404);
  }

  // Check if user can access this dispatch
  if (!canAccessRecord(req.user, dispatch, "admin_id")) {
    throw new ErrorHandler("You don't have permission to upload invoice for this dispatch", 403);
  }

  dispatch.invoice = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    uploadDate: new Date(),
  };

  await dispatch.save();

  return res.status(200).json({
    message: "Invoice uploaded successfully",
    data: dispatch,
  });
});

exports.DownloadFile = TryCatch(async (req, res) => {
  const { id, type } = req.params;

  const dispatch = await DispatchModel.findById(id);
  if (!dispatch) {
    throw new ErrorHandler("Dispatch not found", 404);
  }

  // Check if user can access this dispatch
  if (!canAccessRecord(req.user, dispatch, "admin_id")) {
    throw new ErrorHandler("You don't have permission to download files for this dispatch", 403);
  }

  let fileData;
  if (type === "delivery-proof") {
    fileData = dispatch.delivery_proof;
  } else if (type === "invoice") {
    fileData = dispatch.invoice;
  } else {
    throw new ErrorHandler("Invalid file type", 400);
  }

  if (!fileData || !fileData.filename) {
    throw new ErrorHandler("File not found", 404);
  }

  const path = require("path");
  const filePath = path.join(__dirname, "../uploads", fileData.filename);

  res.download(filePath, fileData.originalName);
});

exports.Stats = TryCatch(async (req, res) => {
  // Get admin filter to ensure each admin only sees their own statistics
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  const totalDispatches = await DispatchModel.countDocuments(adminFilter);
  const dispatchedCount = await DispatchModel.countDocuments({ 
    $and: [...adminFilterArray, { dispatch_status: "Dispatch" }] 
  });
  const deliveredCount = await DispatchModel.countDocuments({ 
    $and: [...adminFilterArray, { dispatch_status: "Delivered" }] 
  });
  const pendingCount = await DispatchModel.countDocuments({ 
    $and: [...adminFilterArray, { dispatch_status: "Dispatch Pending" }] 
  });
  return res.status(200).json({
    message: "Dispatch statistics retrieved successfully",
    data: {
      totalDispatches,
      dispatchedCount,
      deliveredCount,
      pendingCount,
    },
  });
});

exports.getDispatchQty = TryCatch(async (req, res) => {
  const { id } = req.params;
  
  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  
  const data = await DispatchModel.find({ 
    $and: [
      ...(adminFilter.$and || [adminFilter]),
      { sales_order_id: id }
    ]
  }).select("dispatch_qty");
  
  return res.status(200).json({
    message: "Dispatch quantities retrieved successfully",
    data,
  });
});
