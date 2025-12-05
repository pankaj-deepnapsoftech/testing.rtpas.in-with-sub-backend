//bom model
const { Schema, model } = require("mongoose");
const bomSchema = new Schema(
  {
    bom_id: {
      type: String,
      unique: true,
      required: [true, "BOM ID is a required field"],
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is a required field"],
    },
    production_process: {
      type: Schema.Types.ObjectId,
      ref: "Production-Process",
    },
    is_production_started: {
      type: Boolean,
      default: false,
    },
    raw_materials: {
      type: [Schema.Types.ObjectId],
      ref: "BOM-Raw-Material",
    },
    scrap_materials: {
      type: [Schema.Types.ObjectId],
      ref: "BOM-Scrap-Material",
    },
    resources: [
      {
        resource_id: {
          type: Schema.Types.ObjectId,
          ref: "Resource",
          required: true,
        },
        type: { type: String },
        specification: { type: String },
        comment: {
          type: String,
        },
        customId:{ type: String},
      },
    ],
    manpower: [
      {
        number: {
          type: String,
          required: true
        }
      }
    ],


    processes: {
      type: [String],
      set: (value) => {
        if (Array.isArray(value)) {
          return value.map((str) =>
            typeof str === "string"
              ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
              : str
          );
        }
        return value;
      },
    },
    finished_good: {
      type: Schema.Types.ObjectId,
      ref: "BOM-Finished-Material",
      required: [true, "Finished good is a required field"],
    },
    approved: {
      type: Boolean,
      default: false,
    },
    approved_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approval_date: {
      type: Date,
    },
    bom_name: {
      type: String,
      required: [true, "BOM name is a required field"],
      set: (value) => value.charAt(0).toUpperCase() + value.slice(1),
    },
    sale_id: {
      type: Schema.Types.ObjectId,
      ref: "purchase",
    },
    parts_count: {
      type: Number,
      required: [true, "Part's count is a required field"],
    },
    other_charges: {
      labour_charges: {
        type: Number,
        default: 0,
      },
      machinery_charges: {
        type: Number,
        default: 0,
      },
      electricity_charges: {
        type: Number,
        default: 0,
      },
      other_charges: {
        type: Number,
        default: 0,
      },
    },
    total_cost: {
      type: Number,
      required: [true, "Total cost is a required field"],
    },
    remarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const BOM = model("BOM", bomSchema);
module.exports = BOM;
