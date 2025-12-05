const { Schema, model } = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new Schema(
  {
    first_name: {
      type: String,
      required: [true, "First Name is a required field"],
      minlength: [2, "First Name must be atleast 2 characters long"],
      maxlength: [40, "First Name cannot exceed 40 characters"],
      set: (value) => value.charAt(0).toUpperCase() + value.slice(1),
    },
    last_name: {
      type: String,
      maxlength: [40, "Last Name cannot exceed 40 characters"],
      set: (value) => value.charAt(0).toUpperCase() + value.slice(1),
    },
    email: {
      type: String,
      required: [true, "Email is a required field"],
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone is a required field"],
      unique: true,
      match: [/^[7-9]\d{9}$/, "Please provide a valid Indian mobile number"],
    },
    isSuper: {
      type: Boolean,
      default: false,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: "User-Role",
    },
    password: {
      type: String,
      required: [true, "Password is a required field"],
      minlength: [8, "Password must be atleast 8 digits long"],
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    cpny_name:{
      type:String,
      default:"",
    },
    address: {
      type: String,
      default: "",
    },
    GSTIN: {
      type: String,
      default: "",
    },
    Bank_Name: {
      type: String,
      default: "",
    },
    Account_No: {
      type: String,
      default: "",
    },
    IFSC_Code: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const hashedPass = await bcrypt.hash(this.password, 10);
    this.password = hashedPass;
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre("findOneAndUpdate", async function (next) {
  if (!this._update.password) {
    return next();
  }

  try {
    const hashedPass = await bcrypt.hash(this._update.password, 10);
    this._update.password = hashedPass;
    next();
  } catch (error) {
    next(error);
  }
});

const User = model("User", userSchema);
module.exports = User;


