const Resource = require("../models/resources");
const { TryCatch, ErrorHandler } = require("../utils/error");
const { getAdminFilter, getAdminIdForCreation, canAccessRecord, cleanUpdateData } = require("../utils/adminFilter");

const slugify = require('slugify'); // npm install slugify


exports.create = TryCatch(async (req, res) => {
  const resourceData = req.body;

  if (!resourceData || !resourceData.name || !resourceData.type) {
    throw new ErrorHandler("Please provide all the required fields", 400);
  }

 
  const baseCode = resourceData.name.trim().substring(0, 3).toUpperCase();

  // Get admin filter to ensure we only check resources for this admin
  const adminFilter = getAdminFilter(req.user);
  const adminFilterArray = adminFilter.$and || [adminFilter];

  const regex = new RegExp(`^${baseCode}(\\d{3})$`);
  const latestResource = await Resource.find({ 
    $and: [
      ...adminFilterArray,
      { customId: { $regex: regex } }
    ]
  })
    .sort({ customId: -1 })
    .limit(1);

  let nextNumber = '001';
  if (latestResource.length > 0) {
    const lastCustomId = latestResource[0].customId;
    const lastNumber = parseInt(lastCustomId.slice(3), 10);
    nextNumber = String(lastNumber + 1).padStart(3, '0');
  }

 
  const generatedId = `${baseCode}${nextNumber}`;
  resourceData.customId = generatedId;
  resourceData.admin_id = getAdminIdForCreation(req.user);

  const createdResource = await Resource.create(resourceData);

  res.status(201).json({
    status: 201,
    success: true,
    message: "Resource has been created successfully",
    resource: createdResource,
  });
});



exports.edit = TryCatch(async (req, res) => {
  const { _id } = req.params;
  const { type, name, specification } = req.body;

  if (!_id) {
    throw new ErrorHandler("_id is a required field", 400);
  }

  const resource = await Resource.findById(_id);
  if (!resource) {
    throw new ErrorHandler("Resource not found", 404);
  }

  // Check if user can access this resource
  if (!canAccessRecord(req.user, resource, "admin_id")) {
    throw new ErrorHandler("You don't have permission to update this resource", 403);
  }

  const updatedResource = await Resource.findByIdAndUpdate(
    { _id },
    { $set: { type, name, specification } },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Resource has been updated successfully",
    resource: updatedResource,
  });
});

exports.remove = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("_id is a required field", 400);
  }
  const resource = await Resource.findById(_id);
  if (!resource) {
    throw new ErrorHandler("Resource not found", 404);
  }

  // Check if user can access this resource
  if (!canAccessRecord(req.user, resource, "admin_id")) {
    throw new ErrorHandler("You don't have permission to delete this resource", 403);
  }

  await resource.deleteOne();
  res.status(200).json({
    status: 200,
    success: true,
    message: "Resource has been deleted successfully",
  });
});


exports.details = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("_id is a required field", 400);
  }

  const resource = await Resource.findById(_id);
  if (!resource) {
    throw new ErrorHandler("Resource not found", 404);
  }

  // Check if user can access this resource
  if (!canAccessRecord(req.user, resource, "admin_id")) {
    throw new ErrorHandler("You don't have permission to view this resource", 403);
  }

    res.status(200).json({
        status: 200,
        success: true,
        resource,
    });
});

exports.all = TryCatch(async (req, res) => {
  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);
  
  const resources = await Resource.find(adminFilter).sort({ createdAt: -1 });
  res.status(200).json({
    status: 200,
    success: true,
    resources,
  });
});
