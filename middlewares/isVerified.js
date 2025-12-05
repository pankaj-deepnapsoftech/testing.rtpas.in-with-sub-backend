const jwt = require('jsonwebtoken');
const User = require("../models/user");
const { TryCatch, ErrorHandler } = require("../utils/error");

exports.isUserVerified = TryCatch(async (req, res, next) => {
  let { email } = req.body;
  if (!email) {
    const token = req.headers?.authorization?.split(" ")[1];
    if (!token) {
      throw new ErrorHandler("Verify your account to continue", 401);
    }
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    email = verified?.email;
  }
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }
  if (!user.isVerified) {
    throw new ErrorHandler("Verify your account to continue", 401);
  }

  next();
});
