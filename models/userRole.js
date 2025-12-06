const { Schema, model } = require("mongoose");

const capitalizeFirstLetter = (str) =>
  typeof str === "string" && str.length > 0
    ? str.charAt(0).toUpperCase() + str.slice(1)
    : str;

const userRoleSchema = new Schema(
  {
    role: {
      type: String,
      required: [true, "Role is a required field"], 
      minlength: [2, "Role must be at least 2 characters long"],
      maxlength: [20, "Role cannot exceed 20 characters"],
    },
    admin_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    permissions: {
      type: [String],
      enum: {
        values: [
          "dashboard",
          "user role",
          "employee",
          "inventory",
          "direct",'indirect','wip','store',"approval","scrap",
          "direct",
          "store",
          "approval",
          "production",
          "bom","production-status","pre-production",
          'machine-status',
          'resources',
          'sensors',
          'accounts',
          "procurement",
          "purchase-order",
          "proforma-invoice","taxInvoice","payment",
          "sales",
          "task",
          "bom",
          "merchant",
          "dispatch"

        ],
        message:
          "Permissions should be one of the following: product, store, approval, agent, bom",
      },
    },
    description: {
      type: String,
      maxlength: [100, "Description cannot exceed 100 characters"],
    },
  },
  {
    timestamps: true,
  }
);

userRoleSchema.set("toJSON", {
  transform: function (doc, ret) {
    for (let key in ret) {
      if (key === "permissions") {
        continue;
      }
      if (typeof ret[key] === "string") {
        ret[key] = capitalizeFirstLetter(ret[key]);
      } else if (Array.isArray(ret[key])) {
        ret[key] = ret[key].map((item) => capitalizeFirstLetter(item));
      }
    }
    return ret;
  },
});

const UserRole = model("User-Role", userRoleSchema);
userRoleSchema.index({ role: 1, admin_id: 1 }, { unique: true });
module.exports = UserRole;
