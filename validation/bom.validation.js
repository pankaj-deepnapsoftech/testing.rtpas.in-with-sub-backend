const { object, string, number, array, mixed, boolean } = require("yup");

exports.BOMValidation = object({
  bom_name: string()
    .required("BOM name is a required field")
    .min(2, "BOM name should be at least 2 characters long")
    .max(100, "BOM name cannot exceed 100 characters"),

  parts_count: number()
    .required("Parts count is a required field")
    .positive("Parts count must be positive")
    .integer("Parts count must be an integer"),

  total_cost: number()
    .required("Total cost is a required field")
    .min(0, "Total cost cannot be negative"),

  raw_materials: array().min(1, "At least one raw material is required"),

  finished_good: mixed().required("Finished good is a required field"),

  processes: array().of(string()),

  other_charges: object({
    labour_charges: number().min(0, "Labour charges cannot be negative"),
    machinery_charges: number().min(0, "Machinery charges cannot be negative"),
    electricity_charges: number().min(
      0,
      "Electricity charges cannot be negative"
    ),
    other_charges: number().min(0, "Other charges cannot be negative"),
  }),

  remarks: string().max(500, "Remarks cannot exceed 500 characters"),

  resources: array(),
  manpower: array(),
  scrap_materials: array(),
  approved_by: mixed(),
  approval_date: mixed(),
});
