const { object, string, number } = require("yup");
const { ObjectId } = require('mongodb');

const PurchasesValidation = object({
  customer_id: string().required("Customer Id is Required"),
  product_id: string().required("Product Id is Required"),
  product_type: string().required("Product Type is Required"),
  price: number().required("Price is Required"),
});

const GardValidation = object({
  type: string().required("Type is Required"),
  name: string().required("Name is Required"),
  phone: string().min(10).max(12).required("Phone Number is Required"),
  address: string().required("Address is Required"),
  status: string().required("Status is Required"),
});

const assinedValidation = object({
  sale_id: string()
    .required("Sale ID is required")
    .test(
      "is-valid-objectid",
      "Sale ID must be a valid MongoDB ObjectId",
      (value) => ObjectId.isValid(value)
    ),
  assined_to: string()
    .required("Sale ID is required")
    .test(
      "is-valid-objectid",
      "Assined to ID must be a valid MongoDB ObjectId",
      (value) => ObjectId.isValid(value)
    ),
  assined_process: string().required("Type is Required"),
});

module.exports = { PurchasesValidation, GardValidation, assinedValidation };
