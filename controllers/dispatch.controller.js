const { DispatchModel } = require("../models/Dispatcher");
const { TryCatch, ErrorHandler } = require("../utils/error");
const Product = require("../models/product");
const { Purchase } = require("../models/purchase");

exports.CreateDispatch = TryCatch(async (req, res) => {
  const data = req.body;


  const find = await DispatchModel.find({
    sales_order_id: data.sales_order_id,
  });

  const remaningOrder = find.reduce((i, result) => i + result?.dispatch_qty, 0);



  if (find[0]?.quantity - remaningOrder < data?.dispatch_qty) {
    throw new ErrorHandler("Dispatch qty is not valid according to order", 400);
  }

  // if (find) {
  //   if(find?.quantity - find.dispatch_qty < data?.dispatch_qty){
  //      throw new ErrorHandler("Dispatch qty is not valid according to order", 400);
  //   }
  //   const result = await DispatchModel.findOneAndUpdate(
  //     { _id: find._id },
  //     { $inc: { dispatch_qty: data.dispatch_qty } },
  //     { new: true }
  //   );


  //   if (result?.quantity == result?.dispatch_qty) {
  //     await Purchase.findByIdAndUpdate(result?.sales_order_id, { salestatus: "Dispatch" });
  //   }

  //   return res.status(201).json({
  //     message: "Dispatch created successfully, stock updated",
  //     data: result
  //   });
  // }


  if (!data.sales_order_id) {
    throw new ErrorHandler("Sales order ID is required", 400);
  }

  if (!data.dispatch_qty || data.dispatch_qty <= 0) {
    throw new ErrorHandler("Valid dispatch quantity is required", 400);
  }

  const product = await Product.findById(data.product_id);
  if (!product) {
    throw new ErrorHandler("Product not found", 404);
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
    dispatch_date: data.dispatch_date || new Date(),
    dispatch_status: "Dispatch", // Set default status
  });

  res.status(201).json({
    message: "Dispatch created successfully, stock updated",
    data: result,
    updated_stock: product.current_stock,
  });


  if (result?.quantity - remaningOrder === result?.dispatch_qty) {
    await Purchase.findByIdAndUpdate(result?.sales_order_id, { salestatus: "Dispatch" });
  }
});

exports.GetAllDispatches = TryCatch(async (req, res) => {
  const { page, limit, dispatch_status, payment_status, search } = req.query;
  const pages = parseInt(page) || 1;
  const limits = parseInt(limit) || 10;
  const skip = (pages - 1) * limits;

  // Build filter object
  const filter = {};

  if (dispatch_status && dispatch_status !== "All") {
    filter.dispatch_status = dispatch_status;
  }

  if (payment_status && payment_status !== "All") {
    filter.payment_status = payment_status;
  }

  if (search) {
    filter.$or = [
      { merchant_name: { $regex: search, $options: 'i' } },
      { item_name: { $regex: search, $options: 'i' } },
      { sales_order_id: { $regex: search, $options: 'i' } },
      { order_id: { $regex: search, $options: 'i' } }
    ];
  }

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

  const totalData = await DispatchModel.countDocuments();

  const data = await DispatchModel.aggregate([
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

  // Update the dispatch record
  const updatedDispatch = await DispatchModel.findByIdAndUpdate(id, data, {
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

    // ✅ Update production process status
    proc.status = "dispatched";
    await proc.save();

    // Create dispatch entry
    const { DispatchModel } = require("../models/Dispatcher");
    const doc = await DispatchModel.create({
      creator: req.user?._id, // if you have auth
      production_process_id, // Save production process reference
      delivery_status: "Dispatch",
      Sale_id: [], // Optional, keep for sales link
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
  const totalDispatches = await DispatchModel.countDocuments();
  const dispatchedCount = await DispatchModel.countDocuments({ dispatch_status: "Dispatch" });
  const deliveredCount = await DispatchModel.countDocuments({ dispatch_status: "Delivered" });
  const pendingCount = await DispatchModel.countDocuments({ dispatch_status: "Dispatch Pending" });
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
  const data = await DispatchModel.find({ sales_order_id: id }).select("")
  return
});