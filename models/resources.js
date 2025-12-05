const { Schema, model } = require("mongoose");

const capitalizeFirstLetter = (str) =>
  typeof str === "string" && str.length > 0
    ? str.charAt(0).toUpperCase() + str.slice(1)
    : str;

const resourcesSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Resource name is required"],
      unique: true,
      minlength: [2, "Resource name must be at least 2 characters long"],
      maxlength: [50, "Resource name cannot exceed 50 characters"],
    },
    type: {
      type: String,
      required: [true, "Resource type is required"],
    },
    specification: {
      type: String,
      maxlength: [200, "Specification cannot exceed 200 characters"],
    },
    customId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

resourcesSchema.set("toJSON", {
  transform: function (doc, ret) {
    for (let key in ret) {
      if (typeof ret[key] === "string") {
        ret[key] = capitalizeFirstLetter(ret[key]);
      } else if (Array.isArray(ret[key])) {
        ret[key] = ret[key].map((item) => capitalizeFirstLetter(item));
      }
    }
    return ret;
  },
});

const Resource = model("Resource", resourcesSchema);
module.exports = Resource;
