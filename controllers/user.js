const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { TryCatch, ErrorHandler } = require("../utils/error");
const User = require("../models/user");
const OTP = require("../models/otp");
const { generateOTP } = require("../utils/generateOTP");
const { sendEmail } = require("../utils/sendEmail");
const mongoose = require("mongoose");
const { SubscriptionPayment } = require("../models/subscriptionPayment");

exports.create = TryCatch(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userDetails = req.body;
    let employeeId = null;

    // ================= TOKEN / AUTH USER DETECTION =================
    try {
      if (!req.user && req.headers?.authorization) {
        const token = req.headers.authorization.split(" ")[1];

        if (token) {
          const verified = jwt.verify(token, process.env.JWT_SECRET);
          if (verified?.email) {
            const authUser = await User.findOne({ email: verified.email })
              .populate("role")
              .session(session);

            if (authUser) {
              req.user = {
                email: authUser.email,
                _id: authUser._id,
                role: authUser.role,
                isSuper: authUser.isSuper,
              };
            }
          }
        }
      }
    } catch (e) {
      // ignore; next checks will handle
    }

    // ================= PERMISSION CONTROL =================
    if (!req.user) {
      if (!userDetails?.isSuper) {
        throw new ErrorHandler("Login required to create employees", 401);
      }
    } else {
      if (userDetails?.isSuper && !req.user.isSuper) {
        throw new ErrorHandler("Only super admin can create another super admin", 403);
      }
    }

    // ================= EMPLOYEE ID GENERATION =================
    if (!userDetails?.isSuper) {
      const adminObjectId =
        req.user?._id instanceof mongoose.Types.ObjectId
          ? req.user._id
          : new mongoose.Types.ObjectId(req.user?._id || undefined);

      const adminEmployeeCount = await User.countDocuments({
        isSuper: false,
        admin_id: adminObjectId,
      }).session(session);

      const prefix = userDetails.first_name?.substring(0, 3)?.toUpperCase() || "EMP";
      const adminCode = adminObjectId
        ? adminObjectId.toString().slice(-4).toUpperCase()
        : "SYS";

      let idNumber = String(adminEmployeeCount + 1).padStart(4, "0");
      employeeId = `${prefix}${idNumber}-${adminCode}`;

      // Fix rare duplicate IDs (concurrency)
      let existingEmployee = await User.findOne({ employeeId }).session(session);
      let counter = 1;

      while (existingEmployee && counter < 1000) {
        idNumber = String(adminEmployeeCount + 1 + counter).padStart(4, "0");
        employeeId = `${prefix}${idNumber}-${adminCode}`;
        existingEmployee = await User.findOne({ employeeId }).session(session);
        counter++;
      }

      if (counter >= 1000) {
        throw new ErrorHandler("Unable to generate unique employee ID. Please try again.", 500);
      }
    }

    // ================= PREPARE USER DATA =================
    const userData = { ...userDetails };
    if (employeeId) userData.employeeId = employeeId;

    if (!userDetails?.isSuper && req.user?._id) {
      userData.admin_id = req.user._id;
      userData.isVerified = true;
    }

    // ================= USER CREATION =================
    let user;
    try {
      user = await User.create([userData], { session });
      user = user[0]; // insertMany returns array
    } catch (err) {
      if (err?.code === 11000) {
        const dupField = Object.keys(err.keyPattern || {})[0] || "field";
        const message =
          dupField === "email"
            ? "Email already in use"
            : dupField === "phone"
              ? "Phone already in use"
              : dupField === "employeeId"
                ? "Employee ID already exists, please try again"
                : "Duplicate value for a unique field";

        throw new ErrorHandler(message, 400);
      }
      throw err;
    }

    // Remove password before sending in response
    user.password = undefined;

    // ================= SEND OTP (ONLY IF NOT VERIFIED) =================
    if (!user.isVerified) {
      const otp = generateOTP(4);

      await OTP.create([{ email: user.email, otp }], { session });

      await sendEmail(
        "Account Verification",
        `
          <strong>Dear ${user.first_name}</strong>,
          <p>Your OTP is: <strong>${otp}</strong></p>
          <p>Valid for 5 minutes.</p>
        `,
        user.email
      );
    }

    if (user?.isSuper) {  // ================= SUBSCRIPTION CREATION =================
      const today = new Date();
      const next7Days = new Date(today);
      next7Days.setDate(today.getDate() + 7);
      next7Days.setHours(0, 0, 0, 0);

      await SubscriptionPayment.create(
        [
          {
            userId: user._id,
            endDate: next7Days,
            razorpayPaymentId: user._id.toString(),
          },
        ],
        { session }
      );
    }

    // ================= COMMIT TRANSACTION =================
    await session.commitTransaction();
    session.endSession();

    // ================= FINAL RESPONSE =================
    return res.status(200).json({
      status: 200,
      success: true,
      message: user.isVerified
        ? "User has been created successfully."
        : "User created successfully. OTP sent to your email.",
      user,
    });

  } catch (error) {
    // Rollback all changes
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});



exports.verifyUser = TryCatch(async (req, res) => {
  const { email } = req.body;
  await OTP.findOneAndDelete({ email });
  await User.findOneAndUpdate({ email }, { isVerified: true });
  res.status(200).json({
    status: 200,
    success: true,
    message: "Your account has been verified successfully",
  });
});


exports.update = TryCatch(async (req, res) => {
  const { _id, role } = req.body;

  if (!_id || !role) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }

  const user = await User.findByIdAndUpdate(
    _id,
    { role, isSuper: false },
    { new: true }
  );
  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }
  user.password = undefined;

  res.status(200).json({
    status: 200,
    success: true,
    message: "User has been updated successfully",
    user,
  });
});


exports.remove = TryCatch(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }
  await user.deleteOne();

  res.status(200).json({
    status: 200,
    success: true,
    message: "User has been deleted successfully",
  });
});

exports.details = TryCatch(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).populate("role");
  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }

  res.status(200).json({
    status: 200,
    success: true,
    user,
  });
});

exports.employeeDetails = TryCatch(async (req, res) => {
  const userId = req.params._id;

  if (!userId) {
    throw new ErrorHandler("User id not found", 400);
  }

  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      }
    },
    {
      $lookup: {
        from: "user-roles",
        localField: "role",
        foreignField: "_id",
        as: "role"
      }
    },
    {
      $lookup: {
        from: "subscriptionpayments",
        localField: "_id",
        foreignField: "userId",
        as: "subscription"
      }
    },
    {
      $addFields: {
        // Get FIRST role object
        role: { $arrayElemAt: ["$role", 0] },

        // Reverse subscription array and get the first item (latest)
        subscription: {
          $arrayElemAt: [
            { $reverseArray: "$subscription" },
            0
          ]
        },

        // Count total subscriptions
        subscription_count: { $size: "$subscription" } // ⚠️ This is wrong; we’ll fix it below
      }
    },
    {
      $addFields: {
        subscription_end: "$subscription.endDate",
        plan: "$subscription.plan",
      }
    },
    {
      $project: {
        first_name: 1,
        last_name: 1,
        email: 1,
        role: 1,
        subscription_end: 1,
        plan: 1,
        subscription_count: 1
      }
    }
  ]);


  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }

  res.status(200).json({
    status: 200,
    success: true,
    user,
  });
});


exports.loginWithPassword = TryCatch(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email })
    .select("first_name last_name email phone role isSuper password administration")
    .populate("role");
  if (!user) {
    throw new Error("User doesn't exist", 400);
  }

  const isMatched = await bcrypt.compare(password, user.password);
  if (!isMatched) {
    throw new ErrorHandler(
      "Make sure you have entered correct Email Id and Password",
      401
    );
  }

  // CREATING JWT TOKEN
  const token = jwt.sign(
    {
      email: user.email,
      iat: Math.floor(Date.now() / 1000) - 30,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  user.password = undefined;

  res.status(200).json({
    status: 200,
    success: false,
    message: "Logged in successfully",
    user,
    token,
  });
});


exports.loginWithToken = TryCatch(async (req, res) => {
  const token = req.headers?.authorization?.split(" ")[1];

  if (!token) {
    throw new ErrorHandler("Authorization token not provided", 401);
  }

  const verified = jwt.verify(token, process.env.JWT_SECRET);
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);

  if (
    verified &&
    verified.iat < currentTimeInSeconds &&
    verified.exp > currentTimeInSeconds
  ) {
    const user = await User.findOne({ email: verified?.email }).populate(
      "role"
    );

    if (!user) {
      throw new ErrorHandler("User doesn't exist", 401);
    }

    const newToken = jwt.sign(
      {
        email: user.email,
        iat: Math.floor(Date.now() / 1000) - 30,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Logged in successfully",
      user,
      token: newToken,
    });
  }
  throw new ErrorHandler("Session expired, login again", 401);
});


exports.resetPasswordRequest = TryCatch(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ErrorHandler("Email Id not provided", 400);
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }

  let isExistingOTP = await OTP.findOne({ email: user.email });
  if (isExistingOTP) {
    sendEmail(
      "Reset Password Verification",
      `
        <strong>Dear ${user.first_name}</strong>,
    
        <p>We received a request to reset the password for your account associated with this email address.</p>
        <br>
        <p>To reset your password, please use the following One-Time Password (OTP): <strong>${isExistingOTP.otp}</strong></p>
    
        <p>This OTP is valid for 5 minutes. Do not share your OTP with anyone.</p>
        `,
      user?.email
    );
    return res.status(200).json({
      status: 200,
      success: false,
      message: "OTP has been successfully sent to your email id",
    });
  }

  let otp = generateOTP(4);
  await OTP.create({ email: user?.email, otp });

  sendEmail(
    "Reset Password Verification",
    `
    <strong>Dear ${user?.first_name}</strong>,

    <p>We received a request to reset the password for your account associated with this email address.</p>
    <br>
    <p>To reset your password, please use the following One-Time Password (OTP): <strong>${otp}</strong></p>

    <p>This OTP is valid for 5 minutes. Do not share your OTP with anyone.</p>
    `,
    user?.email
  );

  res.status(200).json({
    status: 200,
    success: false,
    message: "OTP has been successfully sent to your email id",
  });
});

exports.resetPassword = TryCatch(async (req, res) => {
  const { email, password } = req.body;

  if (!password) {
    throw new ErrorHandler("Password is a required field", 400);
  }

  await OTP.findOneAndDelete({ email });
  await User.findOneAndUpdate({ email }, { password });

  res.status(200).json({
    success: true,
    status: 200,
    message: "Your password has been updated successfully",
  });
});

exports.resendOtp = TryCatch(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ErrorHandler("Email Id not provided", 400);
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }
  let isExistingOTP = await OTP.findOne({ email: user.email });
  if (isExistingOTP) {
    sendEmail(
      "Reset Password Verification",
      `
        <strong>Dear ${user.first_name}</strong>,
    
        <p>We received a request to reset the password for your account associated with this email address.</p>
        <br>
        <p>To reset your password, please use the following One-Time Password (OTP): <strong>${isExistingOTP.otp}</strong></p>
    
        <p>This OTP is valid for 5 minutes. Do not share your OTP with anyone.</p>
        `,
      user?.email
    );
    return res.status(200).json({
      status: 200,
      success: false,
      message: "OTP has been successfully sent to your email id",
    });
  }

  let otp = generateOTP(4);
  await OTP.create({ email: user?.email, otp });

  sendEmail(
    "Reset Password Verification",
    `
    <strong>Dear ${user?.first_name}</strong>,

    <p>We received a request to reset the password for your account associated with this email address.</p>
    <br>
    <p>To reset your password, please use the following One-Time Password (OTP): <strong>${otp}</strong></p>

    <p>This OTP is valid for 5 minutes. Do not share your OTP with anyone.</p>
    `,
    user?.email
  );

  return res.status(200).json({
    status: 200,
    success: false,
    message: "OTP has been successfully sent to your email id",
  });
});

exports.all = TryCatch(async (req, res) => {
  const mongoose = require('mongoose');

  // Super admin sees all employees (non-super users)
  // Regular admin sees only their own employees (where admin_id matches their _id)
  let queryFilter;

  console.log('=== Fetching Employees ===');
  console.log('Current User ID:', req.user._id);
  console.log('Current User ID Type:', typeof req.user._id);
  console.log('Is Super Admin:', req.user?.isSuper);

  const adminObjectId = req.user._id instanceof mongoose.Types.ObjectId
    ? req.user._id
    : new mongoose.Types.ObjectId(req.user._id);

  queryFilter = {
    $and: [
      { admin_id: adminObjectId },
      { admin_id: { $exists: true, $ne: null } },
      { isSuper: false }
    ]
  };

  console.log('Query Filter:', JSON.stringify(queryFilter));
  console.log('Admin ObjectId:', adminObjectId);
  console.log('Admin ObjectId toString:', adminObjectId.toString());

  const users = await User.find(queryFilter).populate("role");

  console.log('Found Employees Count:', users.length);
  if (users.length > 0) {
    console.log('First Employee admin_id:', users[0].admin_id);
    console.log('First Employee admin_id toString:', users[0].admin_id?.toString());
    console.log('First Employee admin_id Type:', typeof users[0].admin_id);
  }

  res.status(200).json({
    status: 200,
    success: true,
    users,
  });
});



exports.updateProfile = TryCatch(async (req, res) => {
  const userId = req.user._id;
  const { address, first_name, last_name, phone, cpny_name, GSTIN, Bank_Name, Account_No, IFSC_Code } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      ...(address && { address }),
      ...(phone && { phone }),
      ...(first_name && { first_name }),
      ...(last_name && { last_name }),
      ...(cpny_name && { cpny_name }),
      ...(GSTIN && { GSTIN }),
      ...(Account_No && { Account_No }),
      ...(Bank_Name && { Bank_Name }),
      ...(IFSC_Code && { IFSC_Code }),
    },
    { new: true }
  );

  if (!updatedUser) {
    throw new ErrorHandler("User not found", 404);
  }

  updatedUser.password = undefined;

  res.status(200).json({
    status: 200,
    success: true,
    message: "Profile updated successfully",
    user: updatedUser,
  });
});
