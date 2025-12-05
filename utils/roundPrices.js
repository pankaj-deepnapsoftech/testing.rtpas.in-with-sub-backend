const Product = require("../models/product");

// Utility function to round all existing prices to whole numbers
const roundAllPrices = async () => {
  try {
    console.log("Starting to round all prices to whole numbers...");
    
    // Find all products with decimal prices
    const products = await Product.find({
      $or: [
        { price: { $exists: true } },
        { latest_price: { $exists: true } },
        { regular_buying_price: { $exists: true } },
        { wholesale_buying_price: { $exists: true } },
        { mrp: { $exists: true } },
        { dealer_price: { $exists: true } },
        { distributor_price: { $exists: true } }
      ]
    });

    console.log(`Found ${products.length} products to process`);

    let updatedCount = 0;
    
    for (const product of products) {
      let needsUpdate = false;
      const updateData = {};

      // Check and round each price field
      if (product.price !== undefined && product.price % 1 !== 0) {
        updateData.price = Math.round(product.price);
        needsUpdate = true;
      }
      
      if (product.latest_price !== undefined && product.latest_price % 1 !== 0) {
        updateData.latest_price = Math.round(product.latest_price);
        needsUpdate = true;
      }
      
      if (product.regular_buying_price !== undefined && product.regular_buying_price % 1 !== 0) {
        updateData.regular_buying_price = Math.round(product.regular_buying_price);
        needsUpdate = true;
      }
      
      if (product.wholesale_buying_price !== undefined && product.wholesale_buying_price % 1 !== 0) {
        updateData.wholesale_buying_price = Math.round(product.wholesale_buying_price);
        needsUpdate = true;
      }
      
      if (product.mrp !== undefined && product.mrp % 1 !== 0) {
        updateData.mrp = Math.round(product.mrp);
        needsUpdate = true;
      }
      
      if (product.dealer_price !== undefined && product.dealer_price % 1 !== 0) {
        updateData.dealer_price = Math.round(product.dealer_price);
        needsUpdate = true;
      }
      
      if (product.distributor_price !== undefined && product.distributor_price % 1 !== 0) {
        updateData.distributor_price = Math.round(product.distributor_price);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Product.findByIdAndUpdate(product._id, updateData);
        updatedCount++;
        console.log(`Updated product: ${product.name} (${product.product_id})`);
      }
    }

    console.log(`Successfully updated ${updatedCount} products`);
    console.log("Price rounding completed!");
    
  } catch (error) {
    console.error("Error rounding prices:", error);
  }
};

module.exports = { roundAllPrices };
