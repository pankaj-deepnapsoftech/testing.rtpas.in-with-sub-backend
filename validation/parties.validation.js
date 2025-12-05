const { object, string, array } = require("yup");

exports.PartiesValidation = object({
  consignee_name: array().of(string()),

  contact_number: array()
    .of(string().required())
    .required("Contact numbers required"),

  email_id: array()
    .of(string().email("Invalid email"))
    .required("At least one email is required"),

  shipped_to: string().required("Shipped To address is required"),

  bill_to: string().required("Bill To address is required"),

  shipped_gst_to: string().when("type", {
    is: (val) => val === "Company",
    then: (schema) =>
      schema
        .required("Shipped To GST is required")
        .matches(
          /^[A-Z0-9]{15}$/,
          "Shipped GSTIN must be exactly 15 characters, only uppercase letters and numbers"
        ),
    otherwise: (schema) => schema.strip(),
  }),

  bill_gst_to: string().when("type", {
    is: (val) => val === "Company",
    then: (schema) =>
      schema
        .required("Bill To GST is required")
        .matches(
          /^[A-Z0-9]{15}$/,
          "Bill GSTIN must be exactly 15 characters, only uppercase letters and numbers"
        ),
    otherwise: (schema) => schema.strip(),
  }),

  type: string().required("Type is a required field"),

  parties_type: string().required("Parties Type is a required field"),
});
