const { PartiesModels } = require("../models/Parties");
const Product = require("../models/product");
const { ScrapModel } = require("../models/Scrap.model");

// const CATEGORY_PREFIX_MAP = {
//   "finished goods": "FG",
//   "raw materials": "RM",
//   "semi finished goods": "SFG",
//   "consumables": "CON",
//   "bought out parts": "BOP",
//   "trading goods": "TG",
//   "service": "SRV",
// };

// Generate fallback prefix from custom category
function generateDynamicPrefix(category) {
  try {
    if (!category || typeof category !== "string") {
      throw new Error(`Invalid category "${category}" for ID generation`);
    }

    return category
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 3);
  } catch (error) {
    throw new Error(`Invalid category "${category}" for ID generation`);
  }
}

async function generateProductId(category) {
  try {
    if (!category) throw new Error("Category is required for ID generation");

    const normalized = category.toLowerCase();
    const prefix = generateDynamicPrefix(normalized);

    const regex = new RegExp(`^${prefix}(\\d{3})$`, "i");
    const existing = await Product.find({ product_id: { $regex: regex } }, { product_id: 1 });

    let maxSeq = 0;
    for (const item of existing) {
      const match = String(item.product_id).match(/(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }

    const nextSeq = maxSeq + 1;
    const padded = String(nextSeq).padStart(3, "0");
    const newId = `${prefix}${padded}`;

    return newId;

  } catch (error) {
    console.error("Error in generateProductId:", error.message);
    throw error;
  }
}

async function generateProductIdsForBulk(jsonData) {
  // STEP 1: Load all existing product IDs from DB
  const existing = await Product.find(
    { product_id: { $exists: true } },
    { product_id: 1 }
  );

  // STEP 2: Build category-prefix map → highest existing number
  const prefixMap = {};

  for (const item of existing) {
    const id = item.product_id;
    const prefix = id.replace(/[0-9]/g, "");
    const num = parseInt(id.replace(/\D/g, ""));

    if (!prefixMap[prefix] || prefixMap[prefix] < num) {
      prefixMap[prefix] = num; // store highest existing
    }
  }

  // STEP 3: Process excel/csv data
  const output = [];

  for (const product of jsonData) {
    if (!product.category) {
      throw new Error(`Product missing category: ${JSON.stringify(product)}`);
    }

    const normalized = product.category.toLowerCase();
    const prefix = generateDynamicPrefix(normalized);

    if (!prefixMap[prefix]) prefixMap[prefix] = 0;

    prefixMap[prefix] += 1; // next sequence number
    const padded = String(prefixMap[prefix]).padStart(3, "0");

    product.product_id = `${prefix}${padded}`;

    output.push(product);
  }

  return output;
}

async function generateBulkCustomerIds(parsedData) {
  // Step A: Load all existing cust_id values
  const existing = await PartiesModels.find(
    { cust_id: { $exists: true } },
    { cust_id: 1 }
  );

  // Step B: Build prefix → highest number map
  const prefixMap = {};

  for (const row of existing) {
    const id = row.cust_id;
    const prefix = id.replace(/[0-9]/g, "");
    const num = Number(id.replace(/\D/g, ""));

    if (!prefixMap[prefix] || prefixMap[prefix] < num) {
      prefixMap[prefix] = num;
    }
  }

  // Step C: Process uploaded rows and assign IDs
  const output = [];

  for (const party of parsedData) {
    const prefix = generateCustomerPrefix(party);

    if (!prefixMap[prefix]) prefixMap[prefix] = 0; // initialize

    prefixMap[prefix] += 1;

    const padded = String(prefixMap[prefix]).padStart(3, "0");

    party.cust_id = `${prefix}${padded}`;

    output.push(party);
  }

  return output;
}


function generateCustomerPrefix(party) {
  const { type, company_name, consignee_name } = party;

  if (type === "Company" && company_name?.trim()) {
    return company_name.trim().substring(0, 2).toUpperCase();
  }

  if (Array.isArray(consignee_name) && consignee_name.length > 0) {
    return consignee_name[0].trim().substring(0, 2).toUpperCase();
  }

  if (typeof consignee_name === "string" && consignee_name.trim()) {
    return consignee_name.trim().substring(0, 2).toUpperCase();
  }

  return "CU";
}


async function assignScrapIds(jsonData) {

    // get last item from DB
    const lastItem = await ScrapModel
        .findOne({})
        .sort({ _id: -1 })
        .lean();

    let lastNumber = 0;

    if (lastItem?.Scrap_id) {
        lastNumber = Number(lastItem.Scrap_id.split("-").pop());
    }

    // assign new Scrap_id to each item
    const updatedData = jsonData.map((item, index) => {
        const newNumber = lastNumber + index + 1;
        const newId = `SCRAP-${String(newNumber).padStart(5, "0")}`;

        return {
            ...item,
            Scrap_id: newId,
        };
    });

    return updatedData;
}



module.exports = { assignScrapIds,generateProductId,generateProductIdsForBulk,generateBulkCustomerIds };
