exports.checkIndirectProductCsvValidity = async (data) => {
  const itemTypes = ["buy", "sell", "both"];
  const productOrServiceTypes = ["product", "service"];
  const inventoryCategories = ["indirect"];
  const categoryTypes = [
    "finished goods",
    "raw materials",
    "semi finished goods",
    "consumables",
    "bought out parts",
    "trading goods",
    "service",
  ];

  for (let i = 0; i < data.length; i++) {
    const product = data[i];
    const rowNumber = i + 1;

    // Required field validations
    if (
      !product.inventory_category ||
      product.inventory_category.toString().trim() === ""
    ) {
      throw new Error(
        `Inventory category is a required field in row: ${rowNumber}`
      );
    }

    if (
      !inventoryCategories.includes(product.inventory_category.toLowerCase())
    ) {
      throw new Error(
        `Inventory category must be 'indirect' for this upload in row: ${rowNumber}`
      );
    }

    if (!product.name || product.name.toString().trim() === "") {
      throw new Error(`Product name is a required field in row: ${rowNumber}`);
    }

    if (
      product.name.toString().length < 2 ||
      product.name.toString().length > 40
    ) {
      throw new Error(
        `Product name should be between 2-40 characters in row: ${rowNumber}`
      );
    }

    // Product ID validation (should not be provided as it will be auto-generated)
    if (product.product_id && product.product_id.toString().trim() !== "") {
      console.warn(
        `Warning: Product ID in row ${rowNumber} will be ignored. IDs are auto-generated.`
      );
    }

    if (!product.uom || product.uom.toString().trim() === "") {
      throw new Error(
        `Unit of measurement (UOM) is a required field in row: ${rowNumber}`
      );
    }

    if (
      product.uom.toString().length < 1 ||
      product.uom.toString().length > 40
    ) {
      throw new Error(
        `UOM should be between 1-40 characters in row: ${rowNumber}`
      );
    }

    if (!product.category || product.category.toString().trim() === "") {
      throw new Error(`Category is a required field in row: ${rowNumber}`);
    }

    if (!categoryTypes.includes(product.category.toLowerCase())) {
      throw new Error(
        `Category must be one of: ${categoryTypes.join(
          ", "
        )} in row: ${rowNumber}`
      );
    }

    // Stock validations
    if (
      product.current_stock === undefined ||
      product.current_stock === null ||
      product.current_stock.toString().trim() === ""
    ) {
      throw new Error(`Current stock is a required field in row: ${rowNumber}`);
    }

    if (isNaN(+product.current_stock) || +product.current_stock < 0) {
      throw new Error(
        `Current stock must be a valid non-negative number in row: ${rowNumber}`
      );
    }

    // Optional stock validations
    if (product.min_stock && product.min_stock.toString().trim() !== "") {
      if (isNaN(+product.min_stock) || +product.min_stock < 0) {
        throw new Error(
          `Min stock must be a valid non-negative number in row: ${rowNumber}`
        );
      }
    }

    if (product.max_stock && product.max_stock.toString().trim() !== "") {
      if (isNaN(+product.max_stock) || +product.max_stock < 0) {
        throw new Error(
          `Max stock must be a valid non-negative number in row: ${rowNumber}`
        );
      }
    }
    // Optional store field validation (only check length or type)
    if (product.store && product.store.toString().length > 50) {
      throw new Error(
        `Store field cannot exceed 50 characters in row: ${rowNumber}`
      );
    }

    // Validate min_stock <= max_stock if both provided
    if (
      product.min_stock &&
      product.max_stock &&
      product.min_stock.toString().trim() !== "" &&
      product.max_stock.toString().trim() !== ""
    ) {
      if (+product.min_stock > +product.max_stock) {
        throw new Error(
          `Min stock cannot be greater than max stock in row: ${rowNumber}`
        );
      }
    }

    // Price validation
    if (
      product.price === undefined ||
      product.price === null ||
      product.price.toString().trim() === ""
    ) {
      throw new Error(`Price is a required field in row: ${rowNumber}`);
    }

    if (isNaN(+product.price) || +product.price < 0) {
      throw new Error(
        `Price must be a valid non-negative number in row: ${rowNumber}`
      );
    }

    // Item type validation
    if (!product.item_type || product.item_type.toString().trim() === "") {
      throw new Error(`Item type is a required field in row: ${rowNumber}`);
    }

    if (!itemTypes.includes(product.item_type.toLowerCase())) {
      throw new Error(
        `Item type must be one of: ${itemTypes.join(", ")} in row: ${rowNumber}`
      );
    }

    // Product or service validation
    if (
      !product.product_or_service ||
      product.product_or_service.toString().trim() === ""
    ) {
      throw new Error(
        `Product/Service is a required field in row: ${rowNumber}`
      );
    }

    if (
      !productOrServiceTypes.includes(product.product_or_service.toLowerCase())
    ) {
      throw new Error(
        `Product/Service must be one of: ${productOrServiceTypes.join(
          ", "
        )} in row: ${rowNumber}`
      );
    }

    // Optional price field validations
    const optionalPriceFields = [
      "regular_buying_price",
      "wholesale_buying_price",
      "mrp",
      "dealer_price",
      "distributor_price",
    ];

    optionalPriceFields.forEach((field) => {
      if (product[field] && product[field].toString().trim() !== "") {
        if (isNaN(+product[field]) || +product[field] < 0) {
          throw new Error(
            `${field.replace(
              "_",
              " "
            )} must be a valid non-negative number in row: ${rowNumber}`
          );
        }
      }
    });

    // HSN code length validation (optional)
    if (product.hsn_code && product.hsn_code.toString().length > 20) {
      throw new Error(
        `HSN code cannot exceed 20 characters in row: ${rowNumber}`
      );
    }

    // Sub category length validation (optional)
    if (product.sub_category && product.sub_category.toString().length > 40) {
      throw new Error(
        `Sub category cannot exceed 40 characters in row: ${rowNumber}`
      );
    }

    // Normalize case for enum fields
    product.inventory_category = product.inventory_category.toLowerCase();
    product.item_type = product.item_type.toLowerCase();
    product.product_or_service = product.product_or_service.toLowerCase();
    product.category = product.category.toLowerCase();
  }
};
