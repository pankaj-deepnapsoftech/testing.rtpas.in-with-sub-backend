const Product = require("../models/product");
const csv = require("csvtojson");
const fs = require("fs");
const { TryCatch, ErrorHandler } = require("../utils/error");
const { checkProductCsvValidity } = require("../utils/checkProductCsvValidity");
const BOMRawMaterial = require("../models/bom-raw-material");
const ProductionProcess = require("../models/productionProcess");
const BOM = require("../models/bom");
const {
  generateProductId,
  generateProductIdsForBulk,
} = require("../utils/generateProductId");
const path = require("path");
const XLSX = require("xlsx");
const Store = require("../models/store");
const {
  checkIndirectProductCsvValidity,
} = require("../utils/checkIndirectProductCsvValidity");

// Utility function to capitalize first letter of each word
const capitalizeWords = (str) => {
  if (!str) return str;
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

exports.create = TryCatch(async (req, res) => {
  const productDetails = req.body;
  if (!productDetails) {
    throw new ErrorHandler("Please provide product details", 400);
  }
  const generatedId = await generateProductId(productDetails.category);

  const product = await Product.create({
    ...productDetails,
    name: capitalizeWords(productDetails.name),
    product_id: generatedId,
    approved: req.user.isSuper,
  });
  // console.log(product);
  res.status(200).json({
    status: 200,
    success: true,
    message: "Product has been added successfully",
    product,
  });
});

exports.update = TryCatch(async (req, res) => {
  const productDetails = req.body;

  if (!productDetails) {
    throw new ErrorHandler("Please provide product details", 400);
  }

  const { _id } = productDetails;

  let product = await Product.findById(_id);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  // Check if category is being changed
  let newProductId = product.product_id; // Default: retain existing product_id
  if (productDetails.category && productDetails.category !== product.category) {
    newProductId = await generateProductId(productDetails.category);
  }

  // Check if stock has changed to update change_type and quantity_changed
  let extraUpdates = {};
  if (productDetails.current_stock !== undefined) {
    const newStock = Number(productDetails.current_stock);
    const oldStock = product.current_stock;
    if (newStock !== oldStock) {
      extraUpdates.change_type = newStock > oldStock ? "increase" : "decrease";
      extraUpdates.quantity_changed = Math.abs(newStock - oldStock);
    }
  }

  product = await Product.findOneAndUpdate(
    { _id },
    {
      ...productDetails,
      ...extraUpdates,
      name: capitalizeWords(productDetails.name),
      product_id: newProductId,
      // approved: req.user.isSuper ? productDetails?.approved : false,
    },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Product has been updated successfully",
    product,
  });
});

exports.remove = TryCatch(async (req, res) => {
  const { _id } = req.body;
  const product = await Product.findByIdAndDelete(_id);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }
  res.status(200).json({
    status: 200,
    success: true,
    message: "Product has been deleted successfully",
    product,
  });
});

exports.bulkDelete = TryCatch(async (req, res) => {
  const { productIds } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    throw new ErrorHandler("Please provide an array of product IDs", 400);
  }

  // Delete all products with the provided IDs
  const deleteResult = await Product.deleteMany({
    _id: { $in: productIds },
  });

  if (deleteResult.deletedCount === 0) {
    throw new ErrorHandler("No products were found to delete", 400);
  }

  res.status(200).json({
    status: 200,
    success: true,
    message: `Successfully deleted ${deleteResult.deletedCount} product${
      deleteResult.deletedCount > 1 ? "s" : ""
    }`,
    deletedCount: deleteResult.deletedCount,
  });
});
exports.details = TryCatch(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id).populate("store");
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }
  res.status(200).json({
    status: 200,
    success: true,
    product,
  });
});
exports.all = TryCatch(async (req, res) => {
  const { category } = req.query;
  let products;
  if (category) {
    products = await Product.find({
      approved: true,
      inventory_category: category,
    })
      .sort({ updatedAt: -1 })
      .populate("store");
  } else {
    products = await Product.find({ approved: true })
      .sort({ updatedAt: -1 })
      .populate("store");
  }

  res.status(200).json({
    status: 200,
    success: true,
    products,
  });
});
exports.unapproved = TryCatch(async (req, res) => {
  const unapprovedProducts = await Product.find({ approved: false }).sort({
    updatedAt: -1,
  });
  res.status(200).json({
    status: 200,
    success: true,
    unapproved: unapprovedProducts,
  });
});

exports.bulkUploadHandler = async (req, res) => {
  try {
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let jsonData;

    if (fileExtension === ".csv") {
      // Handle CSV files
      jsonData = await csv().fromFile(req.file.path);
    } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
      // Handle Excel files
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonData = XLSX.utils.sheet_to_json(worksheet);
    } else {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Invalid file format. Please upload CSV or Excel file.",
      });
    }

    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});

    // Validate that all products are direct category
    const invalidProducts = jsonData.filter(
      (product) =>
        !product.inventory_category ||
        product.inventory_category.toLowerCase() !== "direct"
    );

    if (invalidProducts.length > 0) {
      return res.status(400).json({
        status: 400,
        success: false,
        message:
          "All products must have inventory_category as 'direct' for this upload.",
      });
    }

    // Validate the data
    await checkProductCsvValidity(jsonData);

    // Debug: Log the first product to see the structure
    if (jsonData.length > 0) {
      console.log(
        "First product sample:",
        JSON.stringify(jsonData[0], null, 2)
      );
    }

    // Process products and generate IDs for all products (ignoring any provided IDs)
    const processedProducts = [];
    for (const productData of jsonData) {
      let processedProduct = { ...productData };

      // Capitalize the product name
      if (processedProduct.name) {
        processedProduct.name = capitalizeWords(processedProduct.name);
      }

      // Debug: Log HSN code for each product

      // --- UPDATED CODE: product_id = last 3 chars of _id ---
      const tempId = new Product()._id.toString();
      // processedProduct.product_id = await generateProductId(productData.category);
      // -----------------------------------------------------

      // Ensure inventory_category is 'direct'
      processedProduct.inventory_category = "direct";

      // Set default approval status based on user role
      processedProduct.approved = req.user.isSuper ? true : false;

      // Convert string numbers to actual numbers
      if (processedProduct.current_stock) {
        processedProduct.current_stock = Number(processedProduct.current_stock);
      }
      if (
        processedProduct.min_stock &&
        processedProduct.min_stock.toString().trim() !== ""
      ) {
        processedProduct.min_stock = Number(processedProduct.min_stock);
      }
      if (
        processedProduct.max_stock &&
        processedProduct.max_stock.toString().trim() !== ""
      ) {
        processedProduct.max_stock = Number(processedProduct.max_stock);
      }
      if (processedProduct.price) {
        processedProduct.price = Number(processedProduct.price);
      }

      if (
        processedProduct.regular_buying_price &&
        processedProduct.regular_buying_price.toString().trim() !== ""
      ) {
        processedProduct.regular_buying_price = Number(
          processedProduct.regular_buying_price
        );
      }
      if (
        processedProduct.wholesale_buying_price &&
        processedProduct.wholesale_buying_price.toString().trim() !== ""
      ) {
        processedProduct.wholesale_buying_price = Number(
          processedProduct.wholesale_buying_price
        );
      }
      if (
        processedProduct.mrp &&
        processedProduct.mrp.toString().trim() !== ""
      ) {
        processedProduct.mrp = Number(processedProduct.mrp);
      }
      if (
        processedProduct.dealer_price &&
        processedProduct.dealer_price.toString().trim() !== ""
      ) {
        processedProduct.dealer_price = Number(processedProduct.dealer_price);
      }
      if (
        processedProduct.distributor_price &&
        processedProduct.distributor_price.toString().trim() !== ""
      ) {
        processedProduct.distributor_price = Number(
          processedProduct.distributor_price
        );
      }
      if (
        processedProduct.hsn_code !== undefined &&
        processedProduct.hsn_code !== null &&
        processedProduct.hsn_code !== ""
      ) {
        processedProduct.hsn_code = processedProduct.hsn_code.toString().trim();
        // If after trimming it becomes empty, delete it
        if (processedProduct.hsn_code === "") {
          delete processedProduct.hsn_code;
        }
      } else {
        // Remove hsn_code if it's empty, null, or undefined
        delete processedProduct.hsn_code;
      }

      if (
        processedProduct.store &&
        typeof processedProduct.store === "string"
      ) {
        const storeName = processedProduct.store.trim();

        // Lookup store by name (assuming store names are unique)
        const storeDoc = await Store.findOne({ name: storeName });

        if (!storeDoc) {
          throw new Error(
            `Invalid store name '${storeName}' in product: ${processedProduct.name}`
          );
        }

        // Replace store name with its ObjectId
        processedProduct.store = storeDoc._id;
      }

      processedProducts.push(processedProduct);
    }

    const newDirectProduct = await generateProductIdsForBulk(processedProducts);

    // Insert products
    await Product.insertMany(newDirectProduct);

    res.status(200).json({
      status: 200,
      success: true,
      message: `${newDirectProduct.length} direct products have been added successfully`,
    });
  } catch (error) {
    // Clean up file in case of error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }

    return res.status(400).json({
      status: 400,
      success: false,
      message: error?.message || "Error processing file",
    });
  }
};

exports.bulkUploadHandlerIndirect = async (req, res) => {
  try {
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let jsonData;

    if (fileExtension === ".csv") {
      // Handle CSV files
      jsonData = await csv().fromFile(req.file.path);
    } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
      // Handle Excel files
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonData = XLSX.utils.sheet_to_json(worksheet);
    } else {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Invalid file format. Please upload CSV or Excel file.",
      });
    }

    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});

    const invalidProducts = jsonData.filter(
      (product) =>
        !product.inventory_category ||
        product.inventory_category.toLowerCase() !== "indirect"
    );

    if (invalidProducts.length > 0) {
      return res.status(400).json({
        status: 400,
        success: false,
        message:
          "All products must have inventory_category as 'indirect' for this upload.",
      });
    }

    // Validate the data
    await checkIndirectProductCsvValidity(jsonData);

    // Process products and generate IDs for all products (ignoring any provided IDs)
    const processedProducts = [];
    for (const productData of jsonData) {
      let processedProduct = { ...productData };

      // Capitalize the product name
      if (processedProduct.name) {
        processedProduct.name = capitalizeWords(processedProduct.name);
      }

      // Always generate product_id automatically (ignore any provided product_id)
      // processedProduct.product_id = await generateProductId(
      //   processedProduct.category
      // );

      processedProduct.inventory_category = "indirect";

      // Set default approval status based on user role
      processedProduct.approved = req.user.isSuper ? true : false;

      // Convert string numbers to actual numbers
      if (processedProduct.current_stock) {
        processedProduct.current_stock = Number(processedProduct.current_stock);
      }
      if (
        processedProduct.min_stock &&
        processedProduct.min_stock.toString().trim() !== ""
      ) {
        processedProduct.min_stock = Number(processedProduct.min_stock);
      }
      if (
        processedProduct.max_stock &&
        processedProduct.max_stock.toString().trim() !== ""
      ) {
        processedProduct.max_stock = Number(processedProduct.max_stock);
      }
      if (processedProduct.price) {
        processedProduct.price = Number(processedProduct.price);
      }

      if (
        processedProduct.regular_buying_price &&
        processedProduct.regular_buying_price.toString().trim() !== ""
      ) {
        processedProduct.regular_buying_price = Number(
          processedProduct.regular_buying_price
        );
      }
      if (
        processedProduct.wholesale_buying_price &&
        processedProduct.wholesale_buying_price.toString().trim() !== ""
      ) {
        processedProduct.wholesale_buying_price = Number(
          processedProduct.wholesale_buying_price
        );
      }
      if (
        processedProduct.mrp &&
        processedProduct.mrp.toString().trim() !== ""
      ) {
        processedProduct.mrp = Number(processedProduct.mrp);
      }
      if (
        processedProduct.dealer_price &&
        processedProduct.dealer_price.toString().trim() !== ""
      ) {
        processedProduct.dealer_price = Number(processedProduct.dealer_price);
      }
      if (
        processedProduct.distributor_price &&
        processedProduct.distributor_price.toString().trim() !== ""
      ) {
        processedProduct.distributor_price = Number(
          processedProduct.distributor_price
        );
      }
      if (
        processedProduct.hsn_code !== undefined &&
        processedProduct.hsn_code !== null &&
        processedProduct.hsn_code !== ""
      ) {
        processedProduct.hsn_code = processedProduct.hsn_code.toString().trim();
        // If after trimming it becomes empty, delete it
        if (processedProduct.hsn_code === "") {
          delete processedProduct.hsn_code;
        }
      } else {
        // Remove hsn_code if it's empty, null, or undefined
        delete processedProduct.hsn_code;
      }

      if (
        processedProduct.store &&
        typeof processedProduct.store === "string"
      ) {
        const storeName = processedProduct.store.trim();

        // Lookup store by name (assuming store names are unique)
        const storeDoc = await Store.findOne({ name: storeName });

        if (!storeDoc) {
          throw new Error(
            `Invalid store name '${storeName}' in product: ${processedProduct.name}`
          );
        }

        // Replace store name with its ObjectId
        processedProduct.store = storeDoc._id;
      }

      processedProducts.push(processedProduct);
    }

    const indirectGoods = await generateProductIdsForBulk(processedProducts);

    // Insert products
    await Product.insertMany(indirectGoods);

    res.status(200).json({
      status: 200,
      success: true,
      message: `${processedProducts.length} indirect products have been added successfully`,
    });
  } catch (error) {
    // Clean up file in case of error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }

    return res.status(400).json({
      status: 400,
      success: false,
      message: error?.message || "Error processing file",
    });
  }
};
exports.workInProgressProducts = TryCatch(async (req, res) => {
  const products = [];
  const processes = await ProductionProcess.find({
    status: { $in: ["production started", "production in progress"] }
  }).populate({
    path: "raw_materials",
    populate: [
      {
        path: "item",
      },
    ],
  })
    .populate({
      path: "bom",
      populate: [
        {
          path: "finished_good",
          populate: {
            path: "item",
          },
        },
      ],
    });

  processes.forEach((p) => {
    p.raw_materials.forEach((material) =>
      products.push({
        ...material._doc,
        bom: p.bom,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })
    );
  });

  res.status(200).json({
    status: 200,
    success: true,
    products,
  });
});
// Add this to your existing product.js controller file

exports.exportToExcel = TryCatch(async (req, res) => {
  const { category } = req.query;

  // Fetch products based on category filter (direct products only)
  let products;
  if (category && category !== "all") {
    products = await Product.find({
      approved: true,
      inventory_category: "direct", // Only direct products
      category: category, // Filter by specific category if provided
    })
      .sort({ updatedAt: -1 })
      .populate("store", "name");
  } else {
    products = await Product.find({
      approved: true,
      inventory_category: "direct", // Only direct products
    })
      .sort({ updatedAt: -1 })
      .populate("store", "name");
  }

  // Transform data for Excel export (matching your form structure)
  const excelData = products.map((product) => ({
    "Inventory Category": product.inventory_category || "N/A",
    "Product Name": product.name || "N/A",
    "Product Color": product.color_name || "N/A",
    "Product ID": product.product_id || "N/A", // Auto-generated, shown in export
    Store: product.store?.name || product.store || "N/A",
    UOM: product.uom || "N/A",
    Category: product.category || "N/A",
    "Current Stock": product.current_stock || 0,
    "Min Stock": product.min_stock || "N/A",
    "Max Stock": product.max_stock || "N/A",
    Price: product.price || 0,
    "HSN Code": product.hsn_code || "N/A",
    "Item Type": product.item_type || "N/A",
    "Product/Service": product.product_or_service || "N/A",
    "Sub Category": product.sub_category || "N/A",
    "Regular Buying Price": product.regular_buying_price || "N/A",
    "Wholesale Buying Price": product.wholesale_buying_price || "N/A",
    MRP: product.mrp || "N/A",
    "Dealer Price": product.dealer_price || "N/A",
    "Distributor Price": product.distributor_price || "N/A",

    "Created Date": product.createdAt
      ? new Date(product.createdAt).toLocaleDateString()
      : "N/A",
    "Updated Date": product.updatedAt
      ? new Date(product.updatedAt).toLocaleDateString()
      : "N/A",
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Auto-size columns
  const colWidths = [];
  const headers = Object.keys(excelData[0] || {});
  headers.forEach((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...excelData.map((row) => String(row[header] || "").length)
    );
    colWidths[i] = { wch: Math.min(maxLength + 2, 50) };
  });
  ws["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Direct Products");

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `direct_products_${category || "all"}_${timestamp}.xlsx`;

  // Set response headers
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  // Write and send file
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.send(buffer);
});

exports.downloadSampleTemplate = TryCatch(async (req, res) => {
  // Updated sample data structure matching your current form (without product_id)
  const sampleData = [
    {
      inventory_category: "direct",
      name: "Sample Product 1",
      color_name: "Red",
      uom: "kg",
      category: "raw materials",
      current_stock: 100,
      min_stock: 10,
      max_stock: 500,
      price: 1000,
      hsn_code: "HSN001",
      item_type: "buy",
      product_or_service: "product",
      sub_category: "Metal Parts",
      regular_buying_price: 900,
      wholesale_buying_price: 850,
      mrp: 1200,
      dealer_price: 1100,
      distributor_price: 1050,
      store: "Faridabad Store",
    },
    {
      inventory_category: "direct",
      name: "Sample Service 1",
      color_name: "Blue",
      uom: "hours",
      category: "service",
      current_stock: 0,
      price: 500,
      hsn_code: "HSN002",
      item_type: "sell",
      product_or_service: "service",
      sub_category: "Consultation",
      mrp: 600,
      dealer_price: 550,
      distributor_price: 525,
      store: "Faridabad Store",
    },
    {
      inventory_category: "direct",
      name: "Trading Item 1",
      color_name: "White",
      uom: "pcs",
      category: "trading goods",
      current_stock: 250,
      min_stock: 25,
      max_stock: 1000,
      price: 750,
      hsn_code: "HSN003",
      item_type: "both",
      product_or_service: "product",
      sub_category: "Electronics",
      regular_buying_price: 700,
      wholesale_buying_price: 650,
      mrp: 900,
      dealer_price: 850,
      distributor_price: 800,
      store: "Faridabad Store",
    },
  ];

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Auto-size columns
  const colWidths = [];
  const headers = Object.keys(sampleData[0]);
  headers.forEach((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...sampleData.map((row) => String(row[header] || "").length)
    );
    colWidths[i] = { wch: Math.min(maxLength + 2, 30) };
  });
  ws["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Sample Direct Products");

  // Set response headers
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="direct_products_sample_template.xlsx"'
  );

  // Write and send file
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.send(buffer);
});

exports.rawMaterials = TryCatch(async (req, res) => {
  const rawMaterials = await Product.find({
    category: "raw materials",
    approved: true,
  }).select("name _id product_id uom");
  res.status(200).json({
    status: 200,
    success: true,
    rawMaterials,
  });
});
exports.exportToExcelIndirect = TryCatch(async (req, res) => {
  const { category } = req.query;

  let products;
  if (category && category !== "all") {
    products = await Product.find({
      approved: true,
      inventory_category: "indirect",
      category: category,
    })
      .sort({ updatedAt: -1 })
      .populate("store", "name");
  } else {
    products = await Product.find({
      approved: true,
      inventory_category: "indirect",
    })
      .sort({ updatedAt: -1 })
      .populate("store", "name");
  }

  const excelData = products.map((product) => ({
    "Inventory Category": product.inventory_category || "N/A",
    "Product Name": product.name || "N/A",
    "Product Color": product.color_name || "N/A",
    "Product ID": product.product_id || "N/A", // Auto-generated, shown in export
    Store: product.store?.name || product.store || "N/A",
    UOM: product.uom || "N/A",
    Category: product.category || "N/A",
    "Current Stock": product.current_stock || 0,
    "Min Stock": product.min_stock || "N/A",
    "Max Stock": product.max_stock || "N/A",
    Price: product.price || 0,
    "HSN Code": product.hsn_code || "N/A",
    "Item Type": product.item_type || "N/A",
    "Product/Service": product.product_or_service || "N/A",
    "Sub Category": product.sub_category || "N/A",
    "Regular Buying Price": product.regular_buying_price || "N/A",
    "Wholesale Buying Price": product.wholesale_buying_price || "N/A",
    MRP: product.mrp || "N/A",
    "Dealer Price": product.dealer_price || "N/A",
    "Distributor Price": product.distributor_price || "N/A",

    "Created Date": product.createdAt
      ? new Date(product.createdAt).toLocaleDateString()
      : "N/A",
    "Updated Date": product.updatedAt
      ? new Date(product.updatedAt).toLocaleDateString()
      : "N/A",
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Auto-size columns
  const colWidths = [];
  const headers = Object.keys(excelData[0] || {});
  headers.forEach((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...excelData.map((row) => String(row[header] || "").length)
    );
    colWidths[i] = { wch: Math.min(maxLength + 2, 50) };
  });
  ws["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "InDirect Products");

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `indirect_products_${category || "all"}_${timestamp}.xlsx`;

  // Set response headers
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  // Write and send file
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.send(buffer);
});

exports.downloadSampleTemplateIndirect = TryCatch(async (req, res) => {
  // Updated sample data structure matching your current form (without product_id)
  const sampleData = [
    {
      inventory_category: "indirect",
      name: "Sample Product 1",
      color_name: "Green",
      uom: "kg",
      category: "raw materials",
      current_stock: 100,
      min_stock: 10,
      max_stock: 500,
      price: 1000,
      hsn_code: "HSN001",
      item_type: "buy",
      product_or_service: "product",
      sub_category: "Metal Parts",
      regular_buying_price: 900,
      wholesale_buying_price: 850,
      mrp: 1200,
      dealer_price: 1100,
      distributor_price: 1050,
      store: "Faridabad",
    },
    {
      inventory_category: "indirect",
      name: "Sample Service 1",
      color_name: "Yellow",
      uom: "hours",
      category: "service",
      current_stock: 0,
      price: 500,
      hsn_code: "HSN002",
      item_type: "sell",
      product_or_service: "service",
      sub_category: "Consultation",
      mrp: 600,
      dealer_price: 550,
      distributor_price: 525,
      store: "Faridabad",
    },
    {
      inventory_category: "indirect",
      name: "Trading Item 1",
      color_name: "Black",
      uom: "pcs",
      category: "trading goods",
      current_stock: 250,
      min_stock: 25,
      max_stock: 1000,
      price: 750,
      hsn_code: "HSN003",
      item_type: "both",
      product_or_service: "product",
      sub_category: "Electronics",
      regular_buying_price: 700,
      wholesale_buying_price: 650,
      mrp: 900,
      dealer_price: 850,
      distributor_price: 800,
      store: "Faridabad",
    },
  ];

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Auto-size columns
  const colWidths = [];
  const headers = Object.keys(sampleData[0]);
  headers.forEach((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...sampleData.map((row) => String(row[header] || "").length)
    );
    colWidths[i] = { wch: Math.min(maxLength + 2, 30) };
  });
  ws["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Sample InDirect Products");

  // Set response headers
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="indirect_products_sample_template.xlsx"'
  );

  // Write and send file
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.send(buffer);
});

exports.updateInventory = TryCatch(async (req, res) => {
  const { itemId, buyQuantity, newPrice } = req.body;

  if (!itemId || !buyQuantity || !newPrice) {
    throw new ErrorHandler(
      "Please provide itemId, buyQuantity, and newPrice",
      400
    );
  }

  // Find the product
  const product = await Product.findById(itemId);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  // Calculate new stock and average price
  const currentStock = product.current_stock || 0;
  const currentPrice = product.price || 0;
  const updatedPrice = Number(newPrice); // The price entered by user

  const totalValue = currentStock * currentPrice + buyQuantity * updatedPrice;
  const newTotalStock = currentStock + buyQuantity;
  const finalPrice =
    newTotalStock > 0 ? Math.round(totalValue / newTotalStock) : updatedPrice;

  // Update the product
  const updatedProduct = await Product.findByIdAndUpdate(
    itemId,
    {
      current_stock: newTotalStock,
      price: finalPrice,
      latest_price: finalPrice, // Update latest price
      change_type: "increase",
      quantity_changed: buyQuantity,
      regular_buying_price: updatedPrice, // Update regular buying price
    },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Inventory updated successfully",
    product: updatedProduct,
    currentPrice: currentPrice, // Current price before update
    updatedPrice: updatedPrice, // Price entered by user
    finalPrice: finalPrice, // Final price after update (calculated average)
    priceDifference: Math.round(updatedPrice - currentPrice),
    previousStock: currentStock,
    newStock: newTotalStock,
  });
});

exports.updatePrice = TryCatch(async (req, res) => {
  const { productId, newPrice } = req.body;

  console.log("updatePrice called with:", { productId, newPrice });

  if (!productId || newPrice === undefined) {
    throw new ErrorHandler("Please provide productId and newPrice", 400);
  }

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  console.log("Found product for price update:", {
    name: product.name,
    currentPrice: product.price,
    newPrice: newPrice,
  });

  const currentPrice = product.price || 0;
  const updatedPrice = Number(newPrice); // The price entered by user
  const currentStock = product.current_stock || 0;
  console.log("current Pricee :--> ", currentPrice);
  console.log("updated price::", updatedPrice);
  // Update the product with new updated_price field instead of replacing current price
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      $push: {
        price_history: {
          $each: [{ price: updatedPrice, updated_at: new Date() }],
          $slice: -5, // Keep only the last 5 entries in the array
        },
      },
      updated_price: updatedPrice, // Store updated price in new field
      latest_price: updatedPrice, // Update latest price for reference
    },
    { new: true }
  );

  console.log("Product updated successfully:", {
    name: updatedProduct.name,
    currentPrice: updatedProduct.price,
    updatedPrice: updatedProduct.updated_price,
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Updated price saved successfully",
    product: updatedProduct,
    currentPrice: currentPrice, // Original price remains unchanged
    updatedPrice: updatedPrice, // New updated price
    priceDifference: updatedPrice - currentPrice,
    currentStock: currentStock, // Current stock information
  });
});

// TODO:
exports.updateStock = TryCatch(async (req, res) => {
  const { productId, newStock } = req.body;

  console.log("updateStock called with:", { productId, newStock });

  if (!productId || newStock === undefined) {
    throw new ErrorHandler("Please provide productId and newStock", 400);
  }

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  console.log("Found product for stock update:", {
    name: product.name,
    currentStock: product.current_stock,
    newStock: newStock,
  });

  const currentStock = product.current_stock || 0;
  const updatedStock = Number(newStock); // The stock entered by user

  // Update the product with new updated_stock field instead of replacing current_stock
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      updated_stock: updatedStock, // Store updated stock in new field
      current_stock: currentStock + updatedStock,
    },
    { new: true }
  );

  console.log("Product updated successfully:", {
    name: updatedProduct.name,
    currentStock: updatedProduct.current_stock,
    updatedStock: updatedProduct.updated_stock,
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Updated stock saved successfully",
    product: updatedProduct,
    currentStock: currentStock, // Original stock remains unchanged
    updatedStock: updatedStock, // New updated stock
    totalAvailableStock: currentStock + updatedStock, // Total available stock
    stockDifference: updatedStock,
  });
});

// Function to clear updated price (optional - if you want to reset updated price)
exports.clearUpdatedPrice = TryCatch(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    throw new ErrorHandler("Please provide productId", 400);
  }

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  // Clear the updated price field only
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      updated_price: null, // Clear the updated price field
    },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Updated price cleared successfully",
    product: updatedProduct,
    currentPrice: product.price,
    clearedUpdatedPrice: product.updated_price,
  });
});

// Function to clear updated stock (optional - if you want to reset updated stock)
exports.clearUpdatedStock = TryCatch(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    throw new ErrorHandler("Please provide productId", 400);
  }

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  // Clear the updated stock field only
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      updated_stock: null, // Clear the updated stock field
    },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Updated stock cleared successfully",
    product: updatedProduct,
    currentStock: product.current_stock,
    clearedUpdatedStock: product.updated_stock,
  });
});

// Function to remove item from inventory shortages when updated
exports.removeFromInventoryShortages = TryCatch(async (req, res) => {
  const { productId } = req.body;

  console.log("removeFromInventoryShortages called with productId:", productId);

  if (!productId) {
    throw new ErrorHandler("Please provide productId", 400);
  }

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  console.log("Found product:", {
    name: product.name,
    updated_stock: product.updated_stock,
    updated_price: product.updated_price,
  });

  // Check if product has been updated (has updated_stock or updated_price)
  const hasUpdates =
    (product.updated_stock && product.updated_stock !== null) ||
    (product.updated_price && product.updated_price !== null);

  console.log("Has updates:", hasUpdates);

  if (!hasUpdates) {
    throw new ErrorHandler("Product has no updates to process", 400);
  }

  // Import InventoryShortage model
  const InventoryShortage = require("../models/inventoryShortage");

  // Find shortages before deletion for debugging
  const shortagesBefore = await InventoryShortage.find({ item: productId });
  console.log("Shortages found before deletion:", shortagesBefore.length);

  // Remove all inventory shortages for this product
  const deleteResult = await InventoryShortage.deleteMany({
    item: productId,
  });

  console.log("Delete result:", deleteResult);

  res.status(200).json({
    status: 200,
    success: true,
    message: "Product removed from inventory shortages successfully",
    product: product,
    deletedShortages: deleteResult.deletedCount,
    hasUpdates: hasUpdates,
    shortagesBefore: shortagesBefore.length,
  });
});

// Function to update individual shortage entry by shortage ID
exports.updateIndividualShortage = TryCatch(async (req, res) => {
  const { shortageId, newShortageQuantity, stockToAdd } = req.body;

  console.log("updateIndividualShortage called with:", { shortageId, newShortageQuantity, stockToAdd });

  if (!shortageId) {
    throw new ErrorHandler("Please provide shortageId", 400);
  }

  // Import InventoryShortage model
  const InventoryShortage = require("../models/inventoryShortage");

  // Find the specific shortage entry
  const shortage = await InventoryShortage.findById(shortageId);
  if (!shortage) {
    throw new ErrorHandler("Shortage entry not found", 404);
  }

  // Find the product
  const product = await Product.findById(shortage.item);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  let updatedProduct = product;
  let updatedShortage = shortage;

  // If stockToAdd is provided, update product stock and calculate new shortage quantity
  if (stockToAdd !== undefined && stockToAdd !== null && stockToAdd > 0) {
    const currentStock = product.current_stock || 0;
    const currentShortageQuantity = shortage.shortage_quantity || 0;

    // Calculate new shortage quantity after adding stock
    const newShortageQty = Math.max(0, currentShortageQuantity - stockToAdd);

    // Update product stock
    updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      {
        current_stock: currentStock + stockToAdd,
        updated_stock: (product.updated_stock || 0) + stockToAdd,
      },
      { new: true }
    );

    // Update the specific shortage entry
    if (newShortageQty === 0) {
      updatedShortage = await InventoryShortage.findByIdAndUpdate(
        shortageId,
        {
          shortage_quantity: 0,
          is_resolved: true,
          resolved_at: new Date(),
          resolved_by: req.user._id,
        },
        { new: true }
      );
    } else {
      updatedShortage = await InventoryShortage.findByIdAndUpdate(
        shortageId,
        {
          shortage_quantity: newShortageQty,
          is_resolved: false,
        },
        { new: true }
      );
    }
  }
  // If newShortageQuantity is provided directly, just update the shortage quantity
  else if (newShortageQuantity !== undefined && newShortageQuantity !== null) {
    if (newShortageQuantity < 0) {
      throw new ErrorHandler("Shortage quantity cannot be negative", 400);
    }

    if (newShortageQuantity === 0) {
      updatedShortage = await InventoryShortage.findByIdAndUpdate(
        shortageId,
        {
          shortage_quantity: 0,
          is_resolved: true,
          resolved_at: new Date(),
          resolved_by: req.user._id,
        },
        { new: true }
      );
    } else {
      updatedShortage = await InventoryShortage.findByIdAndUpdate(
        shortageId,
        {
          shortage_quantity: newShortageQuantity,
          is_resolved: false,
        },
        { new: true }
      );
    }
  } else {
    throw new ErrorHandler("Please provide either stockToAdd or newShortageQuantity", 400);
  }

  console.log("Individual shortage updated successfully:", {
    shortageId: updatedShortage._id,
    newShortageQuantity: updatedShortage.shortage_quantity,
    isResolved: updatedShortage.is_resolved,
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Individual shortage updated successfully",
    shortage: updatedShortage,
    product: updatedProduct,
  });
});

// TODO: Function to update shortage quantity for partially resolved items
exports.updateShortageQuantity = TryCatch(async (req, res) => {
  const { productId, newShortageQuantity } = req.body;

  console.log("updateShortageQuantity called with:", {
    productId,
    newShortageQuantity,
  });

  if (!productId) {
    throw new ErrorHandler("Please provide productId", 400);
  }

  if (newShortageQuantity === undefined || newShortageQuantity === null) {
    throw new ErrorHandler("Please provide newShortageQuantity", 400);
  }

  if (newShortageQuantity < 0) {
    throw new ErrorHandler("Shortage quantity cannot be negative", 400);
  }

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ErrorHandler("Product doesn't exist", 400);
  }

  // Import InventoryShortage model
  const InventoryShortage = require("../models/inventoryShortage");

  // Find existing shortages for this product
  const existingShortages = await InventoryShortage.find({ item: productId });
  console.log("Existing shortages found:", existingShortages.length);

  if (existingShortages.length === 0) {
    throw new ErrorHandler("No shortages found for this product", 400);
  }

  // Update all shortages for this product with the new quantity
  const updatePromises = existingShortages.map((shortage) =>
    InventoryShortage.findByIdAndUpdate(
      shortage._id,
      { shortage_quantity: newShortageQuantity },
      { new: true }
    )
  );

  const updatedShortages = await Promise.all(updatePromises);

  console.log("Updated shortages:", updatedShortages.length);

  res.status(200).json({
    status: 200,
    success: true,
    message: "Shortage quantity updated successfully",
    product: product,
    updatedShortages: updatedShortages.length,
    newShortageQuantity: newShortageQuantity,
  });
});

// Function to update stock and automatically adjust shortages
exports.updateStockAndShortages = TryCatch(async (req, res) => {
  const { productId, newStock } = req.body;

  if (!productId) throw new ErrorHandler("Please provide productId", 400);
  if (newStock === undefined || newStock === null)
    throw new ErrorHandler("Please provide newStock", 400);

  const parsedNewStock = Number(newStock);
  if (Number.isNaN(parsedNewStock))
    throw new ErrorHandler("Stock must be a valid number", 400);

  if (parsedNewStock < 0)
    throw new ErrorHandler("Stock cannot be negative", 400);

  if (!productId.match(/^[0-9a-fA-F]{24}$/))
    throw new ErrorHandler("Invalid product ID format", 400);

  const product = await Product.findById(productId);
  if (!product) throw new ErrorHandler("Product doesn't exist", 400);

  const oldStock = Number(product.current_stock || 0);
  const stockDifference = parsedNewStock - oldStock;

  // No Change
  if (stockDifference === 0) {
    return res.status(200).json({
      status: 200,
      success: true,
      message: "No stock change detected",
      product,
      stockChange: { oldStock, newStock: parsedNewStock, stockDifference },
      shortageUpdate: null,
    });
  }

  // Update product stock
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      current_stock: parsedNewStock,
      updated_stock: stockDifference > 0 ? stockDifference : null,
      change_type: stockDifference > 0 ? "increase" : "decrease",
      quantity_changed: Math.abs(stockDifference),
    },
    { new: true }
  );

  const InventoryShortage = require("../models/inventoryShortage");
  const existingShortages = await InventoryShortage.find({ item: productId });

  let shortageUpdateResult = null;

  // ---------------------------------------------------
  // 🟢 PART 1 — UPDATE EXISTING SHORTAGES (PERFECT SPLIT)
  // ---------------------------------------------------
  if (existingShortages.length > 0) {
    const totalShortages = existingShortages.length;
    const totalReduce = Math.abs(stockDifference);

    const baseReduce = Math.floor(totalReduce / totalShortages);
    const remainder = totalReduce % totalShortages;

    const updatePromises = existingShortages.map(async (shortage, index) => {
      const reduceValue =
        index === totalShortages - 1 ? baseReduce + remainder : baseReduce;

      const currentShortage = shortage.shortage_quantity;

      const newQty = Math.max(0, currentShortage - reduceValue);

      if (newQty === 0) {
        return InventoryShortage.findByIdAndUpdate(
          shortage._id,
          {
            shortage_quantity: 0,
            is_resolved: true,
            resolved_at: new Date(),
            resolved_by: req.user._id,
            should_recreate_on_edit: true,
          },
          { new: true }
        );
      } else {
        return InventoryShortage.findByIdAndUpdate(
          shortage._id,
          {
            shortage_quantity: newQty,
            is_resolved: false,
            resolved_at: null,
            resolved_by: null,
          },
          { new: true }
        );
      }
    });

    const updatedShortages = await Promise.all(updatePromises);

    shortageUpdateResult = {
      totalShortages,
      activeShortages: updatedShortages.length,
      updatedShortages,
    };
  }

  // ---------------------------------------------------
  // 🟢 PART 2 — CREATE NEW SHORTAGES (IF STOCK REDUCED)
  // ---------------------------------------------------
  else if (stockDifference < 0) {
    const shortageQty = Math.abs(stockDifference);

    const BOM = require("../models/bom");
    const BOMRawMaterial = require("../models/bom-raw-material");

    const bomRawMaterials = await BOMRawMaterial.find({ item: productId });
    const bomIds = bomRawMaterials.map((m) => m.bom);

    if (bomIds.length > 0) {
      const creationPromises = bomIds.map(async (bomId) => {
        const bom = await BOM.findById(bomId);
        if (!bom) return null;

        return InventoryShortage.create({
          bom: bomId,
          raw_material: bomRawMaterials.find(
            (m) => m.bom.toString() === bomId.toString()
          )?._id,
          item: productId,
          shortage_quantity: shortageQty,
          original_shortage_quantity: shortageQty,
          is_resolved: false,
          should_recreate_on_edit: true,
        });
      });

      const created = await Promise.all(creationPromises);

      const validShortages = created.filter((s) => s !== null);

      shortageUpdateResult = {
        totalShortages: 0,
        activeShortages: validShortages.length,
        createdShortages: validShortages.length,
        updatedShortages: validShortages,
      };
    }
  }

  // ---------------------------------------------------
  // 🟢 FINAL RESPONSE
  // ---------------------------------------------------
  res.status(200).json({
    status: 200,
    success: true,
    message: "Stock updated and shortages adjusted successfully",
    product: updatedProduct,
    stockChange: { oldStock, newStock: parsedNewStock, stockDifference },
    shortageUpdate: shortageUpdateResult,
  });
});








