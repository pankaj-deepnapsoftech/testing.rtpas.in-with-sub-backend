const Store = require("../models/store");
const csv = require('csvtojson');
const fs = require('fs');
const { ErrorHandler, TryCatch } = require("../utils/error");
const { getAdminFilter, getAdminIdForCreation } = require("../utils/adminFilter");
const { checkStoreCsvValidity } = require("../utils/checkStoreCsvValidity");

exports.create = TryCatch(async (req, res) => {
  const storeDetails = req.body;
  console.log("store1");
  if (!storeDetails) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }
  console.log("store2");

  const store = await Store.create({
    ...storeDetails,
    admin_id: getAdminIdForCreation(req.user),
    approved: req.user.isSuper,
  });
console.log("store3");
  res.status(200).json({
    status: 200,
    success: true,
    message: "Store has been added successfully",
    store,
  });
});
exports.update = TryCatch(async (req, res) => {
  const { id } = req.params;
  const storeDetails = req.body;
  if (!id) {
    throw new ErrorHandler("Store Id not provided", 400);
  }
  if (!storeDetails) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }
  let store = await Store.findOne({ _id: id, ...getAdminFilter(req.user) });
  if (!store) {
    throw new ErrorHandler("Store doesn't exist", 400);
  }

  const canApprove =
    req.user?.isSuper ||
    (Array.isArray(req.user?.role?.permissions) &&
      req.user.role.permissions.includes("approval"));

  store = await Store.findOneAndUpdate(
    { _id: id, ...getAdminFilter(req.user) },
    {
      ...storeDetails,
      approved: canApprove
        ? storeDetails?.approved ?? store.approved
        : store.approved,
    },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Store has been updated successfully",
    store,
  });
});
exports.remove = TryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new ErrorHandler("Store Id not provided", 400);
  }
  let store = await Store.findOne({ _id: id, ...getAdminFilter(req.user) });
  if (!store) {
    throw new ErrorHandler("Store doesn't exist", 400);
  }

  await store.deleteOne();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Store has been deleted successfully",
    store,
  });
});
exports.details = TryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new ErrorHandler("Store Id not provided", 400);
  }
  let store = await Store.findOne({ _id: id, ...getAdminFilter(req.user) });
  if (!store) {
    throw new ErrorHandler("Store doesn't exist", 400);
  }

  res.status(200).json({
    status: 200,
    success: true,
    store,
  });
});
exports.all = TryCatch(async (req, res) => {
  const stores = await Store.find({ approved: true, ...getAdminFilter(req.user) }).sort({ updatedAt: -1 });
  res.status(200).json({
    status: 200,
    success: true,
    stores,
  });
});
exports.unapproved = TryCatch(async (req, res) => {
  const stores = await Store.find({ approved: false, ...getAdminFilter(req.user) }).sort({ updatedAt: -1 });
  res.status(200).json({
    status: 200,
    success: true,
    unapproved: stores,
  });
});
exports.bulkUploadHandler = TryCatch(async (req, res) => {
  if (!req.file) {
    throw new ErrorHandler("No file uploaded", 400);
  }

  try {
    const response = await csv().fromFile(req.file.path);
    
    fs.unlink(req.file.path, () => {});

    await checkStoreCsvValidity(response);

    const shouldAutoApprove = req.user?.isSuper || 
      (Array.isArray(req.user?.role?.permissions) && 
       req.user.role.permissions.includes("approval"));

    const stores = response.map(store => ({
      ...store,
      approved: shouldAutoApprove
    }));

    const insertedStores = await Store.insertMany(stores);

    res.status(200).json({
      status: 200,
      success: true,
      message: `${insertedStores.length} stores have been added successfully`,
      count: insertedStores.length,
    });
  } catch (error) {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    throw new ErrorHandler(error?.message || "Failed to process bulk upload", 400);
  }
});
