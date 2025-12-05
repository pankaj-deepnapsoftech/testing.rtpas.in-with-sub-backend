const { Schema, model } = require("mongoose");

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is a required field"],
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    otp: {
      type: String,
      required: [true, "OTP is a required field"],
      minlength: [4, "OTP should be 4 digits long"],
      maxlength: [4, "OTP should be 4 digits long"],
    },
    createdAt: {
      type: Date,
      expires: "5m",
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const OTP = model("OTP", otpSchema);
module.exports = OTP;
