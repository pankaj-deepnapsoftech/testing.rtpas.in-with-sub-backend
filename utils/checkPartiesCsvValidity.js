const { ErrorHandler } = require("./error");

// Mapping normalized headers to schema keys
const normalizeKeys = (row) => {
  const keyMap = {
    consignee_name: "consignee_name",
    company_name: "company_name",
    type: "type",
    merchant_type: "parties_type",
    email_id: "email_id",
    contact_number: "contact_number",
    contact_person_name: "contact_person_name",
    "contact person name": "contact_person_name",
    contact_person: "contact_person_name",
    shipped_to: "shipped_to",
    bill_to: "bill_to",
    shipped_gst_in: "shipped_gst_to",
    bill_gst_in: "bill_gst_to",
  };

  const normalizedRow = {};
  Object.entries(row).forEach(([rawKey, value]) => {
    const cleanedKey = rawKey
      .replace(/\uFEFF/g, "") // Remove BOM
      .trim()
      .toLowerCase();

    const mappedKey = keyMap[cleanedKey] || cleanedKey;
    normalizedRow[mappedKey] = value;
  });

  return normalizedRow;
};

const checkPartiesCsvValidity = async (csvData) => {
  if (!Array.isArray(csvData) || csvData.length === 0) {
    throw new ErrorHandler("CSV/XLSX file is empty or invalid", 400);
  }

  const validTypes = ["Individual", "Company"];
  const validPartiesTypes = ["Buyer", "Seller"];

  for (let i = 0; i < csvData.length; i++) {
    const rowNum = i + 1;
    let row = normalizeKeys(csvData[i]);

    const type = row.type?.trim();
    if (!type || !validTypes.includes(type)) {
      throw new ErrorHandler(
        `Row ${rowNum}: Type must be either 'Individual' or 'Company'`,
        400
      );
    }

    // === Type-specific validations ===
    if (type === "Individual") {
      if (!row.consignee_name || row.consignee_name.trim() === "") {
        throw new ErrorHandler(
          `Row ${rowNum}: Consignee_Name is required when Type is 'Individual'`,
          400
        );
      }
      if (row.company_name && row.company_name.trim() !== "") {
        throw new ErrorHandler(
          `Row ${rowNum}: Company_Name should be empty when Type is 'Individual'`,
          400
        );
      }
      if (row.bill_gst_to?.trim()) {
        throw new ErrorHandler(
          `Row ${rowNum}: Bill_GST_IN should be empty when Type is 'Individual'`,
          400
        );
      }
      if (row.shipped_gst_to?.trim()) {
        throw new ErrorHandler(
          `Row ${rowNum}: Shipped_GST_IN should be empty when Type is 'Individual'`,
          400
        );
      }
    } else if (type === "Company") {
      if (!row.company_name || row.company_name.trim() === "") {
        throw new ErrorHandler(
          `Row ${rowNum}: Company_Name is required when Type is 'Company'`,
          400
        );
      }
      if (row.consignee_name && row.consignee_name.trim() !== "") {
        throw new ErrorHandler(
          `Row ${rowNum}: Consignee_Name should be empty when Type is 'Company'`,
          400
        );
      }
      if (!row.bill_gst_to || row.bill_gst_to.trim() === "") {
        throw new ErrorHandler(
          `Row ${rowNum}: Bill_GST_IN is required when Type is 'Company'`,
          400
        );
      }
      if (!row.shipped_gst_to || row.shipped_gst_to.trim() === "") {
        throw new ErrorHandler(
          `Row ${rowNum}: Shipped_GST_IN is required when Type is 'Company'`,
          400
        );
      }
      if (!row.contact_person_name || row.contact_person_name.trim() === "") {
        throw new ErrorHandler(
          `Row ${rowNum}: Contact_Person_Name is required when Type is 'Company'`,
          400
        );
      }
    }

    // === Required fields ===
    const requiredFields = ["parties_type", "email_id", "contact_number"];
    for (const field of requiredFields) {
      if (!row[field] || row[field].toString().trim() === "") {
        throw new ErrorHandler(
          `Row ${rowNum}: ${field} is required and cannot be empty`,
          400
        );
      }
    }

    // === Merchant Type ===
    if (!validPartiesTypes.includes(row.parties_type)) {
      throw new ErrorHandler(
        `Row ${rowNum}: Merchant_Type (parties_type) must be either 'Buyer' or 'Seller'`,
        400
      );
    }

    // === Email Validation ===
    const email = row.email_id.toString().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ErrorHandler(`Row ${rowNum}: Invalid email format`, 400);
    }

    // === Contact Number Validation ===
    const contactNum = row.contact_number.toString().trim();
    if (
      contactNum.length < 10 ||
      contactNum.length > 15 ||
      !/^\d+$/.test(contactNum)
    ) {
      throw new ErrorHandler(
        `Row ${rowNum}: Contact number should be 10-15 digits`,
        400
      );
    }

    // Normalize certain fields to arrays (if needed later)
    if (typeof row.consignee_name === "string") {
      row.consignee_name = [row.consignee_name.trim()];
    }

    if (typeof row.email_id === "string") {
      row.email_id = [email];
    }

    if (typeof row.contact_number === "string") {
      row.contact_number = [contactNum];
    }

    // Trim all string fields
    Object.keys(row).forEach((key) => {
      if (typeof row[key] === "string") {
        row[key] = row[key].trim();
      }
    });

    // Store normalized row back
    csvData[i] = row;
  }

  return true;
};

module.exports = { checkPartiesCsvValidity };
