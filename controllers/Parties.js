const { PartiesModels } = require("../models/Parties");
const { TryCatch, ErrorHandler } = require("../utils/error");
const csv = require("csvtojson");
const fs = require("fs");
const path = require("path");
const { parseExcelFile } = require("../utils/parseExcelFile");
const { checkPartiesCsvValidity } = require("../utils/checkPartiesCsvValidity");
const { generateBulkCustomerIds } = require("../utils/generateProductId");

const generateCustomerId = async (partyType, companyName, consigneeName) => {
  let prefix = "";

  if (
    partyType === "Company" &&
    typeof companyName === "string" &&
    companyName.trim()
  ) {
    prefix = companyName.trim().substring(0, 2).toUpperCase();
  } else if (
    Array.isArray(consigneeName) &&
    consigneeName.length &&
    typeof consigneeName[0] === "string"
  ) {
    prefix = consigneeName[0].trim().substring(0, 2).toUpperCase();
  } else if (typeof consigneeName === "string" && consigneeName.trim()) {
    prefix = consigneeName.trim().substring(0, 2).toUpperCase();
  } else {
    prefix = "CU";
  }

  const lastParty = await PartiesModels.findOne({
    cust_id: { $regex: `^${prefix}` },
  }).sort({ createdAt: -1 });

  let nextId = 1;
  if (lastParty) {
    const lastId = lastParty.cust_id.replace(prefix, "");
    nextId = Number(lastId) + 1;
  }

  return `${prefix}${nextId.toString().padStart(3, "0")}`;
};

exports.CreateParties = TryCatch(async (req, res) => {
  const data = req.body;
  const { type, company_name, consignee_name } = data;

  const cust_id = await generateCustomerId(type, company_name, consignee_name);

  const isAdmin = !!req.user?.isSuper;
  const result = await PartiesModels.create({
    ...data,
    cust_id,
    approved: isAdmin,
    admin_id: req.user._id,
  });
  console.log(result);
  return res.status(201).json({
    message: "Party added successfully",
    result,
  });
});

exports.GetParties = TryCatch(async (req, res) => {
  const { page, limit } = req.query;
  const pages = parseInt(page) || 1;
  const limits = parseInt(limit) || 10;
  const skip = (pages - 1) * limits;
  const match = req.user?.isSuper ? {} : { admin_id: req.user._id };
  const totalData = await PartiesModels.find(match).countDocuments();
  const data = await PartiesModels.find(match)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limits);
  return res.status(200).json({
    message: "Data",
    data,
    totalData,
  });
});

exports.DeleteParties = TryCatch(async (req, res) => {
  const { id } = req.params;
  const find = await PartiesModels.findById(id);
  if (!find) {
    throw new ErrorHandler(" Party not found ", 400);
  }

  if (!req.user.isSuper && find.admin_id !== req.user._id.toString()) {
    throw new ErrorHandler("You are not authorized to delete this party", 403);
  }

  await PartiesModels.findByIdAndDelete(id);
  return res.status(200).json({
    message: "Party Deleted",
  });
});

exports.UpdateParties = TryCatch(async (req, res) => {
  const data = req.body;
  const { id } = req.params;

  const find = await PartiesModels.findById(id);
  if (!find) {
    throw new ErrorHandler("Party not registered", 400);
  }

  if (!req.user.isSuper && find.admin_id !== req.user._id.toString()) {
    throw new ErrorHandler("You are not authorized to update this party", 403);
  }

  const nextType = data.type ?? find.type;
  const nextCompanyName = data.company_name ?? find.company_name;
  const nextConsigneeName = data.consignee_name ?? find.consignee_name;

  const cust_id = await generateCustomerId(
    nextType,
    nextCompanyName,
    nextConsigneeName
  );

  const updated = await PartiesModels.findByIdAndUpdate(
    id,
    { ...find.toObject(), ...data, cust_id },
    { new: true }
  );

  return res.status(200).json({
    message: "Data updated successfully",
    updated,
  });
});

exports.GetUnapprovedParties = TryCatch(async (req, res) => {
  const match = req.user?.isSuper
    ? { approved: false }
    : { approved: false, admin_id: req.user._id };
  const data = await PartiesModels.find(match).sort({ _id: -1 });
  return res.status(200).json({
    message: "Unapproved parties",
    data,
  });
});

// Bulk Upload Handler
exports.bulkUploadHandler = async (req, res) => {
  const ext = path.extname(req.file.originalname).toLowerCase();
  let parsedData = [];

  try {
    if (ext === ".csv") {
      parsedData = await csv().fromFile(req.file.path);
    } else if (ext === ".xlsx") {
      parsedData = parseExcelFile(req.file.path);
    } else {
      throw new ErrorHandler(
        "Unsupported file type. Please upload .csv or .xlsx",
        400
      );
    }

    fs.unlink(req.file.path, () => {}); // Clean up uploaded file

    await checkPartiesCsvValidity(parsedData); // Validate rows

    const processedParties = [];
    for (const party of parsedData) {
      processedParties.push({
        ...party,
        admin_id: req.user._id,
        approved: !!req.user.isSuper,
      });
    }

    const partiesData = await generateBulkCustomerIds(processedParties);

    await PartiesModels.insertMany(partiesData);

    return res.status(200).json({
      success: true,
      message: "Parties uploaded successfully",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Upload failed",
    });
  }
};
