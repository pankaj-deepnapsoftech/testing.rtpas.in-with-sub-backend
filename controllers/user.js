const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { TryCatch, ErrorHandler } = require("../utils/error");
const User = require("../models/user");
const UserRole = require("../models/userRole");
const OTP = require("../models/otp");
const { generateOTP } = require("../utils/generateOTP");
const { sendEmail } = require("../utils/sendEmail");
const { getAdminIdForCreation } = require("../utils/adminFilter");

exports.create = TryCatch(async (req, res) => {
  const userDetails = req.body;
  let employeeId = null;
  let roleId = null;

  // Populate req.user if Authorization header present (route is open for bootstrap)
  try {
    if (!req.user && req.headers?.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      if (token) {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified?.email) {
          const authUser = await User.findOne({ email: verified.email }).populate('role');
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
    // ignore token errors here; creation guard below will handle
  }

  if (!req.user) {
    if (!userDetails?.isSuper) {
      throw new ErrorHandler("Login required to create employees", 401);
    }
  } else {
    if (userDetails?.isSuper && !req.user.isSuper) {
      throw new ErrorHandler("Only super admin can create another super admin", 403);
    }
  }

  // Handle role assignment
  // if (userDetails.role) {
  //   const mongoose = require('mongoose');
  //   
  //   // Check if role is a valid ObjectId format
  //   if (mongoose.Types.ObjectId.isValid(userDetails.role)) {
  //     // It's an ObjectId, validate it exists in database
  //     const role = await UserRole.findById(userDetails.role);
  //     if (role) {
  //       roleId = role._id;
  //     } else if (!userDetails.isSuper) {
  //       // Role not found and user is not super admin
  //       throw new ErrorHandler(`Role "${userDetails.role}" not found. Please create the role first.`, 400);
  //     }
  //   } else {
  //     // It's a role name string, find by name
  //     const role = await UserRole.findOne({ 
  //       role: { $regex: new RegExp(`^${userDetails.role}$`, 'i') } 
  //     });
  //     if (role) {
  //       roleId = role._id;
  //     } else if (!userDetails.isSuper) {
  //       // Only require role for non-super users (employees/managers)
  //       throw new ErrorHandler(`Role "${userDetails.role}" not found. Please create the role first.`, 400);
  //     }
  //   }
  //   // Super admins can be created without a role
  // }

  // === EMPLOYEE ID GENERATION (Globally unique, admin-wise numbering) ===
if (!userDetails?.isSuper) {
  const mongoose = require('mongoose');
  let adminObjectId = req.user && req.user._id 
    ? (req.user._id instanceof mongoose.Types.ObjectId 
        ? req.user._id 
        : new mongoose.Types.ObjectId(req.user._id)) 
    : null;
  // Only count for the current admin to keep numbering admin-wise
  const adminEmployeeCount = await User.countDocuments({ 
    isSuper: false, 
    admin_id: adminObjectId 
  });
  const prefix = userDetails.first_name?.substring(0, 3).toUpperCase() || "EMP";
  const adminCode = (adminObjectId ? adminObjectId.toString().slice(-4) : 'SYS').toUpperCase();
  let idNumber = String(adminEmployeeCount + 1).padStart(4, "0");
  employeeId = `${prefix}${idNumber}-${adminCode}`;
  // Ensure globally unique employeeId (rare collisions/concurrency)
  let existingEmployee = await User.findOne({ employeeId });
  let counter = 1;
  while (existingEmployee && counter < 1000) {
    idNumber = String(adminEmployeeCount + 1 + counter).padStart(4, "0");
    employeeId = `${prefix}${idNumber}-${adminCode}`;
    existingEmployee = await User.findOne({ employeeId });
    counter++;
  }
  if (counter >= 1000) {
    throw new ErrorHandler("Unable to generate unique employee ID. Please try again.", 500);
  }
}
  // Prepare user data for creation
  const userData = { ...userDetails };
  // if (roleId) {
  //   userData.role = roleId;
  // }
  if (employeeId) {
    userData.employeeId = employeeId;
  }

  // Set admin_id for employees - the admin who creates the employee becomes their admin
  // Only set admin_id for non-super users (employees) and only if req.user exists (authenticated request)
  // If creating via registration (no token), admin_id will be null (can be set later)
  if (!userDetails?.isSuper && req.user && req.user._id) {
    // Set admin_id to the current user (admin) who is creating this employee
    // Ensure it's stored as ObjectId
    const mongoose = require('mongoose');
    userData.admin_id = req.user._id instanceof mongoose.Types.ObjectId 
      ? req.user._id 
      : new mongoose.Types.ObjectId(req.user._id);
    // Auto-verify employees created by an authenticated admin
    userData.isVerified = true;
    
    console.log('=== Creating Employee ===');
    console.log('Admin ID (req.user._id):', req.user._id);
    console.log('Admin ID Type:', typeof req.user._id);
    console.log('Setting admin_id for employee:', userData.admin_id);
  }

  let user;
  try {
    user = await User.create(userData);
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'field';
      const message = dupField === 'email'
        ? 'Email already in use'
        : dupField === 'phone'
        ? 'Phone already in use'
        : dupField === 'employeeId'
        ? 'Employee ID already exists, please try again'
        : 'Duplicate value for a unique field';
      throw new ErrorHandler(message, 400);
    }
    throw err;
  }
  user.password = undefined;

  if (!user.isVerified) {
    let otp = generateOTP(4);
    await OTP.create({ email: user?.email, otp });
    sendEmail(
      "Account Verification",
      `
        <strong>Dear ${user.first_name}</strong>,
    
        <p>Thank you for registering with us! To complete your registration and verify your account, please use the following One-Time Password (OTP): <strong>${otp}</strong></p>

        <p>This OTP is valid for 5 minutes. Do not share your OTP with anyone.</p>
        `,
      user?.email
    );
  }

  res.status(200).json({
    status: 200,
    success: true,
    message: user.isVerified
      ? "User has been created successfully."
      : "User has been created successfully. OTP has been successfully sent to your email id",
    user,
  });
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

  const user = await User.findById(userId).populate("role");
  if (!user) {
    throw new ErrorHandler("User doesn't exist", 400);
  }

  // Check if user can access this employee (admin filtering)
  const { canAccessRecord } = require("../utils/adminFilter");
  if (!canAccessRecord(req.user, user, "admin_id")) {
    throw new ErrorHandler("You are not authorized to access this employee", 403);
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
    .select("first_name last_name email phone role isSuper password")
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
  const { address, first_name, last_name, phone,cpny_name,GSTIN,Bank_Name,Account_No,IFSC_Code } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      ...(address && { address }),
      ...(phone && { phone }),
      ...(first_name && { first_name }),
      ...(last_name && { last_name }),
      ...(cpny_name && {cpny_name}),
      ...(GSTIN && {GSTIN}),
      ...(Account_No && { Account_No}),
      ...(Bank_Name && {Bank_Name}),
      ...(IFSC_Code && {IFSC_Code}),
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
