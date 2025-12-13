const mongoose = require("mongoose");
const Product = require("../models/product");
const { ScrapModel } = require("../models/Scrap.model");
const BOM = require("../models/bom");

exports.connectDB = async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URL, {dbName: process.env.DB_NAME});
        try {
            await Product.syncIndexes();
            console.log("Product indexes synced");
        } catch (idxErr) {
            console.log("Failed to sync Product indexes:", idxErr?.message);
        }
        try {
            await ScrapModel.syncIndexes();
            console.log("Scrap indexes synced");
        } catch (idxErr2) {
            console.log("Failed to sync Scrap indexes:", idxErr2?.message);
        }
        try {
            await BOM.syncIndexes();
            console.log("BOM indexes synced");
        } catch (idxErr3) {
            console.log("Failed to sync BOM indexes:", idxErr3?.message);
        }
        const dbHost = new URL(process.env.MONGODB_URL).hostname;
        console.log(`Database connected successfully to: ${dbHost}`);
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
}   
