const mongoose = require("mongoose");

exports.connectDB = async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URL, {dbName: process.env.DB_NAME});
        const dbHost = new URL(process.env.MONGODB_URL).hostname;
        console.log(`Database connected successfully to: ${dbHost}`);
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
}   

