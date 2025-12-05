exports.checkStoreCsvValidity = async (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("CSV file is empty or invalid");
  }
  
  for (let i = 0; i < data.length; i++) {
    const store = data[i];
    
    if (!store.name || store.name.trim() === "") {
      throw new Error(`Store name is a required field in row: ${i + 1}`);
    }
    if (!store.address_line1 || store.address_line1.trim() === "") {
      throw new Error(`Address line 1 is a required field in row: ${i + 1}`);
    }
    if (!store.city || store.city.trim() === "") {
      throw new Error(`City is a required field in row: ${i + 1}`);
    }
    if (!store.state || store.state.trim() === "") {
      throw new Error(`State is a required field in row: ${i + 1}`);
    }
  }
};
