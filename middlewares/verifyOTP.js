const OTP = require("../models/otp");
const { ErrorHandler, TryCatch } = require("../utils/error");

exports.verifyOTP = TryCatch(async (req, res, next)=>{
    const {email, otp} = req.body;

    if(!email || !otp){
        throw new ErrorHandler("Email Id and OTP are required field", 400);
    }

    const isAvailable = await OTP.findOne({email, otp});
    if(!isAvailable){
        throw new ErrorHandler("Invalid OTP", 401);
    }

    next();
})