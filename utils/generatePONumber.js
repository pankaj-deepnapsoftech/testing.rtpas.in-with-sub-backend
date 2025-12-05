const PurchaseOrder = require("../models/Purchase-Order");

const generatePONumber = async () => {
  try {
    // Find the latest purchase order to get the highest number
    const latestPO = await PurchaseOrder.findOne({}, {}, { sort: { 'poOrder': -1 } });
    
    let nextNumber = 1;
    
    if (latestPO && latestPO.poOrder) {
      // Extract the number from the latest PO (e.g., "PO001" -> 1)
      const match = latestPO.poOrder.match(/PO(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    // Format the number with leading zeros (e.g., 1 -> "001")
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    
    return `PO${formattedNumber}`;
  } catch (error) {
    console.error('Error generating PO number:', error);
    // Fallback: return current timestamp-based number
    const timestamp = Date.now();
    return `PO${timestamp}`;
  }
};

module.exports = { generatePONumber }; 